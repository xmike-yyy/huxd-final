import { ReflectiveListener } from '../agents/ReflectiveListener.js';
import { ClarityCoach } from '../agents/ClarityCoach.js';
import { MomentumPartner } from '../agents/MomentumPartner.js';
import { analyzeInput } from '../services/inputAnalyzer.js';
import { ResponseEvaluator } from '../evaluator/ResponseEvaluator.js';

import { geminiGenerate } from '../services/gemini.js';

export class Orchestrator {
  constructor() {
    this.agents = {
      'reflective-listener': new ReflectiveListener(),
      'clarity-coach': new ClarityCoach(),
      'momentum-partner': new MomentumPartner()
    };
    this.evaluator = new ResponseEvaluator();
  }

  async orchestrate(contents, currentMetrics = {}, reflectionContext = { summary: '', items: [] }) {
    // Analyze user input
    const analysis = await analyzeInput(contents);

    // Get last user message
    const lastUserMessage = contents[contents.length - 1]?.parts?.[0]?.text || '';

    // Lazy Summarization Logic
    let activeReflectionSummary = reflectionContext.summary || '';
    let updatedReflectionSummary = null;

    // Check if we need to access/update reflections
    if (analysis.needsReflectionContext) {
      console.log('Orchestrator: Analysis indicates need for reflection context.');
      
      // If we have new unsummarized items, we MUST summarize them now to get the latest context
      if (reflectionContext.items && reflectionContext.items.length > 0) {
        console.log(`Orchestrator: Summarizing ${reflectionContext.items.length} new reflection items...`);
        activeReflectionSummary = await this.summarizeReflections(
          activeReflectionSummary, 
          reflectionContext.items
        );
        updatedReflectionSummary = activeReflectionSummary; // Mark for return to client
      } else {
         console.log('Orchestrator: No new items to summarize, using existing summary.');
      }
    } else {
       // If not needed, we don't pass any reflection context to the agent to save tokens/focus
       activeReflectionSummary = ''; 
    }

    // Select frame based on emotional state and metrics
    const frame = this.selectFrame(analysis, currentMetrics);

    // Add metric-based behavioral modulations BEFORE generating response
    let modulations = this.getMetricBasedModulations(currentMetrics, frame);
    if (modulations.length > 0) {
      console.log('Applying metric-based modulations:', modulations);
    }

    // Get agent
    const agent = this.agents[frame];

    let response;
    let evaluation;
    let retried = false;
    let attempts = 0;
    const MAX_ATTEMPTS = 3;

    // Retry loop: Initial attempt + up to 2 retries
    while (attempts < MAX_ATTEMPTS) {
      attempts++;
      
      if (attempts > 1) {
         console.log(`Response rejected. Retrying (Attempt ${attempts}/${MAX_ATTEMPTS})...`);
         console.log('Issues found:', evaluation.issues);
         retried = true;
      }

      // Generate response (passing the SUMMARY string, not the array)
      if (attempts === 1) {
        response = await agent.respond(contents, modulations, activeReflectionSummary);
      } else {
         // On retries, we add feedback to the conversation history
         const rejectionContext = this.buildRejectionContext(evaluation.issues);
         
         const contentsWithFeedback = [
            ...contents,
            {
              role: 'model',
              parts: [{ text: response.text }]
            },
            {
              role: 'user',
              parts: [{ text: rejectionContext }]
            }
          ];
          
          // Add modulations from evaluation
          const evaluationModulations = this.evaluator.getModulations(evaluation.issues);
          modulations = [...new Set([...modulations, ...evaluationModulations])];
          
          response = await agent.respond(contentsWithFeedback, modulations, activeReflectionSummary);
      }

      // Evaluate response quality
      evaluation = await this.evaluator.evaluate(
        response.text,
        lastUserMessage,
        currentMetrics,
        frame
      );

      if (evaluation.accepted) {
        break;
      }
    }

    return {
      assistantMessage: response.text,
      frame: frame,
      reason: this.getFrameReason(analysis, frame),
      inputAnalysis: analysis,
      updatedReflectionSummary: updatedReflectionSummary, // Return new summary if changed
      evaluation: {
        accepted: evaluation.accepted,
        score: evaluation.score,
        issues: evaluation.issues,
        metrics: evaluation.metrics,
        retried: retried,
        attempts: attempts
      }
    };
  }

  async summarizeReflections(currentSummary, newItems) {
    if (!newItems || newItems.length === 0) return currentSummary;

    const newContent = newItems.map(i => `[${new Date(i.createdAt).toLocaleDateString()}] ${i.content}`).join('\n');
    
    const prompt = `
      You are maintaining a "Reflection Profile" for a user.
      
      CURRENT PROFILE SUMMARY:
      "${currentSummary || 'No profile yet.'}"

      NEW REFLECTIONS TO INTEGRATE:
      ${newContent}

      TASK:
      Update the profile summary to include insights from the new reflections.
      - Keep it concise (max 200 words).
      - Focus on recurring patterns, emotional triggers, and successful coping strategies.
      - Discard outdated or trivial details.
      - Write in the third person (e.g., "The user feels...").

      Updated Profile Summary:
    `;

    try {
      const { text } = await geminiGenerate({
        contents: [{ role: 'user', parts: [{ text: prompt }] }]
      });
      return text.trim();
    } catch (e) {
      console.error('Failed to summarize reflections:', e);
      return currentSummary; // Fallback
    }
  }

  /**
   * Build human-readable rejection context to help the agent fix issues
   */
  buildRejectionContext(issues) {
    if (!issues || issues.length === 0) {
      return '[INTERNAL FEEDBACK] Please revise your previous response to better align with therapeutic best practices.';
    }

    let context = '[INTERNAL FEEDBACK] Your previous response had the following issues that need to be addressed:\n\n';

    issues.forEach((issue, index) => {
      context += `${index + 1}. ${issue.type}: ${issue.fix}\n`;
      if (issue.details) {
        context += `   Details: ${issue.details}\n`;
      }
    });

    context += '\nPlease generate a revised response that addresses these issues while maintaining your therapeutic approach.';

    return context;
  }

  selectFrame(analysis, currentMetrics = {}) {
    const { sentiment, emotionalState, intent } = analysis;

    // Metric-based overrides (enforce quality standards)

    // If validation compliance is low, force Reflective Listener
    if (currentMetrics.validationCompliance !== undefined &&
        currentMetrics.validationCompliance < 80) {
      console.log('Low validation compliance detected. Using Reflective Listener.');
      return 'reflective-listener';
    }

    // If user pushback is high, use gentler Reflective Listener
    if (currentMetrics.userPushback !== undefined &&
        currentMetrics.userPushback > 5) {
      console.log('High user pushback detected. Using Reflective Listener.');
      return 'reflective-listener';
    }

    // If sentiment authenticity is low (performative positivity/emotional guarding), use Reflective Listener
    if (currentMetrics.sentimentAuthenticity !== undefined &&
        currentMetrics.sentimentAuthenticity < 40) {
      console.log('Low sentiment authenticity detected (emotional guarding). Using Reflective Listener.');
      return 'reflective-listener';
    }

    // Negative emotions → Reflective Listener
    if (
      sentiment < 0 ||
      ['frustrated', 'overwhelmed', 'anxious', 'sad', 'angry'].includes(emotionalState)
    ) {
      return 'reflective-listener';
    }

    // Confusion or seeking advice → Clarity Coach
    if (
      ['confused', 'ambivalent', 'uncertain'].includes(emotionalState) ||
      intent === 'seeking_advice'
    ) {
      return 'clarity-coach';
    }

    // Positive or celebrating → Momentum Partner
    if (
      sentiment > 0.3 ||
      ['positive', 'hopeful', 'motivated', 'proud'].includes(emotionalState) ||
      intent === 'celebrating'
    ) {
      return 'momentum-partner';
    }

    // Default to Clarity Coach (neutral facilitator)
    return 'clarity-coach';
  }

  getFrameReason(analysis, frame) {
    if (frame === 'reflective-listener') {
      return `Negative emotions detected: ${analysis.emotionalState}`;
    }
    if (frame === 'clarity-coach') {
      return `User needs clarity: ${analysis.emotionalState}`;
    }
    if (frame === 'momentum-partner') {
      return `Positive state: ${analysis.emotionalState}`;
    }
    return 'Default routing';
  }

  /**
   * Generate behavioral modulations based on current metrics
   * This enforces the architecture's requirement to adjust frame behavior based on metrics
   */
  getMetricBasedModulations(currentMetrics, frame) {
    const modulations = [];

    // If no user solutions after 10+ exchanges, make Clarity Coach more directive with scaffolding
    if (currentMetrics.needsScaffolding && frame === 'clarity-coach') {
      modulations.push('increase_directiveness');
      modulations.push('provide_scaffolding');
      console.log('Needs scaffolding detected - making Clarity Coach more directive');
    }

    // If pushback is high, shift to softer language and more questions
    if (currentMetrics.userPushback !== undefined && currentMetrics.userPushback > 5) {
      modulations.push('increase_questions');
      modulations.push('soften_language');
      modulations.push('reduce_imperatives');
      console.log('High pushback detected - using softer, more questioning approach');
    }

    // If question ratio is too low, increase questions
    if (currentMetrics.questionRatio !== undefined && currentMetrics.questionRatio < 30) {
      modulations.push('increase_questions');
      console.log('Low question ratio - encouraging more Socratic approach');
    }

    // If sentiment authenticity is low, increase empathy and validation
    if (currentMetrics.sentimentAuthenticity !== undefined &&
        currentMetrics.sentimentAuthenticity < 40) {
      modulations.push('increase_empathy');
      modulations.push('add_validation_first');
      console.log('Low sentiment authenticity - prioritizing validation');
    }

    return [...new Set(modulations)]; // Remove duplicates
  }
}
