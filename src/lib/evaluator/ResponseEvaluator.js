import { GoogleGenAI } from '@google/genai';
import { env } from '$env/dynamic/private';

export class ResponseEvaluator {
  constructor() {
    const key = env.GEMINI_API_KEY;
    if (!key) throw new Error('GEMINI_API_KEY not set');
    this.ai = new GoogleGenAI({ apiKey: key });
    this.modelName = env.GEMINI_MODEL || 'gemini-2.5-flash';
  }

  /**
   * Evaluate agent response against quality metrics
   * @param {string} agentResponse - The response from the agent
   * @param {string} userMessage - The last user message
   * @param {object} currentMetrics - Current conversation metrics
   * @param {string} selectedFrame - The frame that generated the response
   * @returns {object} Evaluation result with acceptance status and issues
   */
  async evaluate(agentResponse, userMessage, currentMetrics, selectedFrame) {
    const issues = [];

    // Check for validation compliance
    const validationCheck = await this.checkValidation(agentResponse, userMessage, currentMetrics);
    if (!validationCheck.passed) {
      issues.push({
        type: 'MISSING_VALIDATION',
        severity: 'HIGH',
        fix: 'Add emotional validation before suggestions or reframing',
        details: validationCheck.reason
      });
    }

    // Check question ratio in response
    const questionRatio = this.calculateQuestionRatio(agentResponse);
    if (selectedFrame === 'clarity-coach' && questionRatio < 0.5) {
      issues.push({
        type: 'TOO_DIRECTIVE',
        severity: 'MEDIUM',
        fix: 'Convert statements to questions. Clarity Coach should use 70%+ questions.',
        details: `Current ratio: ${(questionRatio * 100).toFixed(0)}%`
      });
    }

    // Check for toxic positivity
    const toxicPositivityCheck = await this.checkToxicPositivity(agentResponse);
    if (toxicPositivityCheck.detected) {
      issues.push({
        type: 'TOXIC_POSITIVITY',
        severity: 'HIGH',
        fix: 'Remove dismissive or overly positive phrases that invalidate emotions',
        details: toxicPositivityCheck.phrases.join(', ')
      });
    }

    // Check response length (not too overwhelming)
    const sentenceCount = this.countSentences(agentResponse);
    if (sentenceCount > 6) {
      issues.push({
        type: 'TOO_LONG',
        severity: 'LOW',
        fix: 'Keep responses concise (3-5 sentences max)',
        details: `Current: ${sentenceCount} sentences`
      });
    }

    // Check for unsolicited advice (especially if user is in distress)
    if (currentMetrics.sentimentAuthenticity < 40) {
      const adviceCheck = await this.checkUnsolicitedAdvice(agentResponse, userMessage);
      if (adviceCheck.detected && !adviceCheck.validated) {
        issues.push({
          type: 'UNSOLICITED_ADVICE',
          severity: 'MEDIUM',
          fix: 'Focus on validation and listening before offering solutions',
          details: 'User showing low sentiment authenticity - prioritize emotional support'
        });
      }
    }

    return {
      accepted: issues.length === 0 || !this.hasHighSeverityIssues(issues),
      issues,
      score: this.calculateScore(issues),
      metrics: {
        validationPresent: validationCheck.passed,
        questionRatio: questionRatio,
        toxicPositivityDetected: toxicPositivityCheck.detected,
        sentenceCount: sentenceCount
      }
    };
  }

  /**
   * Check if response includes proper emotional validation
   */
  async checkValidation(agentResponse, userMessage, currentMetrics) {
    const prompt = `
Analyze if the agent's response properly validates the user's emotions before offering advice or reframing.

User Message: "${userMessage}"
Agent Response: "${agentResponse}"

Does the agent response:
1. Acknowledge the user's emotional state?
2. Validate feelings before suggesting solutions?
3. Show empathy and understanding?

Respond in JSON format:
{
  "passed": true/false,
  "reason": "explanation"
}
`;

    try {
      const request = {
        model: this.modelName,
        contents: [{ role: 'user', parts: [{ text: prompt }] }]
      };
      const result = await this.ai.models.generateContent(request);
      const text = typeof result?.text === 'string' ? result.text : '';
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (error) {
      console.error('Validation check error:', error);
    }

    return { passed: true, reason: 'Unable to evaluate' };
  }

  /**
   * Calculate question-to-statement ratio
   */
  calculateQuestionRatio(text) {
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const questions = sentences.filter(s => s.includes('?'));
    return sentences.length > 0 ? questions.length / sentences.length : 0;
  }

  /**
   * Check for toxic positivity phrases
   */
  async checkToxicPositivity(agentResponse) {
    const toxicPhrases = [
      'just think positive',
      'look on the bright side',
      'it could be worse',
      'everything happens for a reason',
      'just be grateful',
      'don\'t worry',
      'stay positive',
      'good vibes only',
      'choose happiness',
      'just let it go',
      'don\'t be negative'
    ];

    const detectedPhrases = toxicPhrases.filter(phrase =>
      agentResponse.toLowerCase().includes(phrase)
    );

    // Also use LLM for more nuanced detection
    const prompt = `
Analyze this mental wellness agent response for toxic positivity - dismissive optimism that invalidates genuine emotions.

Response: "${agentResponse}"

Look for:
- Dismissing or minimizing emotions
- Forcing positivity when validation is needed
- Suggesting emotions are a choice when they're not
- Comparing suffering ("it could be worse")
- Spiritual bypassing

Respond in JSON:
{
  "detected": true/false,
  "confidence": 0-100,
  "examples": ["phrase1", "phrase2"]
}
`;

    try {
      const request = {
        model: this.modelName,
        contents: [{ role: 'user', parts: [{ text: prompt }] }]
      };
      const result = await this.ai.models.generateContent(request);
      const text = typeof result?.text === 'string' ? result.text : '';
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const llmResult = JSON.parse(jsonMatch[0]);
        return {
          detected: detectedPhrases.length > 0 || llmResult.detected,
          phrases: [...detectedPhrases, ...llmResult.examples]
        };
      }
    } catch (error) {
      console.error('Toxic positivity check error:', error);
    }

    return {
      detected: detectedPhrases.length > 0,
      phrases: detectedPhrases
    };
  }

  /**
   * Check for unsolicited advice
   */
  async checkUnsolicitedAdvice(agentResponse, userMessage) {
    const prompt = `
Analyze if the agent gives advice without first validating emotions.

User Message: "${userMessage}"
Agent Response: "${agentResponse}"

Determine:
1. Does the response include advice or suggestions?
2. Was validation provided before the advice?

Respond in JSON:
{
  "detected": true/false (advice given),
  "validated": true/false (validation present first)
}
`;

    try {
      const request = {
        model: this.modelName,
        contents: [{ role: 'user', parts: [{ text: prompt }] }]
      };
      const result = await this.ai.models.generateContent(request);
      const text = typeof result?.text === 'string' ? result.text : '';
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (error) {
      console.error('Advice check error:', error);
    }

    return { detected: false, validated: true };
  }

  /**
   * Count sentences in text
   */
  countSentences(text) {
    return text.split(/[.!?]+/).filter(s => s.trim().length > 0).length;
  }

  /**
   * Check if there are any high severity issues
   */
  hasHighSeverityIssues(issues) {
    return issues.some(issue => issue.severity === 'HIGH');
  }

  /**
   * Calculate overall quality score (0-100)
   */
  calculateScore(issues) {
    if (issues.length === 0) return 100;

    const penalties = {
      'HIGH': 30,
      'MEDIUM': 15,
      'LOW': 5
    };

    const totalPenalty = issues.reduce((sum, issue) => {
      return sum + (penalties[issue.severity] || 0);
    }, 0);

    return Math.max(0, 100 - totalPenalty);
  }

  /**
   * Generate modulation instructions based on issues
   */
  getModulations(issues) {
    const modulations = [];

    issues.forEach(issue => {
      switch (issue.type) {
        case 'MISSING_VALIDATION':
          modulations.push('add_validation_first');
          modulations.push('increase_empathy');
          break;
        case 'TOO_DIRECTIVE':
          modulations.push('increase_questions');
          modulations.push('reduce_imperatives');
          break;
        case 'TOXIC_POSITIVITY':
          modulations.push('reduce_optimism');
          modulations.push('increase_realism');
          break;
        case 'TOO_LONG':
          modulations.push('reduce_length');
          break;
        case 'UNSOLICITED_ADVICE':
          modulations.push('focus_on_listening');
          modulations.push('delay_solutions');
          break;
      }
    });

    return [...new Set(modulations)]; // Remove duplicates
  }
}
