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
    // Local checks (no API calls)
    const questionRatio = this.calculateQuestionRatio(agentResponse);
    const sentenceCount = this.countSentences(agentResponse);
    const localToxicPhrases = this.checkLocalToxicPhrases(agentResponse);

    // Single consolidated LLM call for all quality checks
    const llmChecks = await this.performConsolidatedCheck(
      agentResponse,
      userMessage,
      currentMetrics,
      selectedFrame,
      questionRatio,
      localToxicPhrases
    );

    const issues = [];

    // Process results from consolidated check
    if (!llmChecks.validationCheck.passed) {
      issues.push({
        type: 'MISSING_VALIDATION',
        severity: 'HIGH',
        fix: 'Add emotional validation before suggestions or reframing',
        details: llmChecks.validationCheck.reason
      });
    }

    if (selectedFrame === 'clarity-coach' && questionRatio < 0.5) {
      issues.push({
        type: 'TOO_DIRECTIVE',
        severity: 'MEDIUM',
        fix: 'Convert statements to questions. Clarity Coach should use 70%+ questions.',
        details: `Current ratio: ${(questionRatio * 100).toFixed(0)}%`
      });
    }

    if (llmChecks.toxicPositivityCheck.detected || localToxicPhrases.length > 0) {
      issues.push({
        type: 'TOXIC_POSITIVITY',
        severity: 'HIGH',
        fix: 'Remove dismissive or overly positive phrases that invalidate emotions',
        details: [...localToxicPhrases, ...llmChecks.toxicPositivityCheck.examples].join(', ')
      });
    }

    if (sentenceCount > 6) {
      issues.push({
        type: 'TOO_LONG',
        severity: 'LOW',
        fix: 'Keep responses concise (3-5 sentences max)',
        details: `Current: ${sentenceCount} sentences`
      });
    }

    if (currentMetrics.sentimentAuthenticity < 40 && llmChecks.adviceCheck.detected && !llmChecks.adviceCheck.validated) {
      issues.push({
        type: 'UNSOLICITED_ADVICE',
        severity: 'MEDIUM',
        fix: 'Focus on validation and listening before offering solutions',
        details: 'User showing low sentiment authenticity - prioritize emotional support'
      });
    }

    return {
      accepted: issues.length === 0 || !this.hasHighSeverityIssues(issues),
      issues,
      score: this.calculateScore(issues),
      metrics: {
        validationPresent: llmChecks.validationCheck.passed,
        questionRatio: questionRatio,
        toxicPositivityDetected: llmChecks.toxicPositivityCheck.detected || localToxicPhrases.length > 0,
        sentenceCount: sentenceCount
      }
    };
  }

  /**
   * Perform all LLM-based checks in a single consolidated call
   */
  async performConsolidatedCheck(agentResponse, userMessage, currentMetrics, selectedFrame, questionRatio, localToxicPhrases) {
    const prompt = `You are evaluating a mental wellness agent's response for quality and safety.

User Message: "${userMessage}"
Agent Response: "${agentResponse}"
Selected Frame: ${selectedFrame}
Current Metrics: ${JSON.stringify(currentMetrics)}

Perform the following checks and respond in JSON format:

1. VALIDATION CHECK: Does the agent response acknowledge and validate the user's emotional state before offering advice or reframing?

2. TOXIC POSITIVITY CHECK: Look for:
   - Dismissing or minimizing emotions
   - Forcing positivity when validation is needed
   - Suggesting emotions are a choice when they're not
   - Comparing suffering ("it could be worse")
   - Spiritual bypassing

3. UNSOLICITED ADVICE CHECK: ${currentMetrics.sentimentAuthenticity < 40 ? 'Does the response include advice without proper validation first?' : 'Skip this check'}

Respond in this exact JSON format:
{
  "validationCheck": {
    "passed": true/false,
    "reason": "explanation"
  },
  "toxicPositivityCheck": {
    "detected": true/false,
    "confidence": 0-100,
    "examples": ["phrase1", "phrase2"]
  },
  "adviceCheck": {
    "detected": true/false,
    "validated": true/false
  }
}`;

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
      console.error('Consolidated evaluation error:', error);
    }

    // Fallback if check fails
    return {
      validationCheck: { passed: true, reason: 'Unable to evaluate' },
      toxicPositivityCheck: { detected: false, confidence: 0, examples: [] },
      adviceCheck: { detected: false, validated: true }
    };
  }

  /**
   * Check for toxic positivity phrases locally (no API call)
   */
  checkLocalToxicPhrases(agentResponse) {
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

    return toxicPhrases.filter(phrase =>
      agentResponse.toLowerCase().includes(phrase)
    );
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
