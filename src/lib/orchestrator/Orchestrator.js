import { ReflectiveListener } from '../agents/ReflectiveListener.js';
import { ClarityCoach } from '../agents/ClarityCoach.js';
import { MomentumPartner } from '../agents/MomentumPartner.js';
import { analyzeInput } from '../services/inputAnalyzer.js';
import { ResponseEvaluator } from '../evaluator/ResponseEvaluator.js';

export class Orchestrator {
  constructor() {
    this.agents = {
      'reflective-listener': new ReflectiveListener(),
      'clarity-coach': new ClarityCoach(),
      'momentum-partner': new MomentumPartner()
    };
    this.evaluator = new ResponseEvaluator();
  }

  async orchestrate(contents, currentMetrics = {}) {
    // Analyze user input
    const analysis = await analyzeInput(contents);

    // Get last user message
    const lastUserMessage = contents[contents.length - 1]?.parts?.[0]?.text || '';

    // Select frame based on emotional state and metrics
    const frame = this.selectFrame(analysis, currentMetrics);

    // Add metric-based behavioral modulations BEFORE generating response
    let modulations = this.getMetricBasedModulations(currentMetrics, frame);
    if (modulations.length > 0) {
      console.log('Applying metric-based modulations:', modulations);
    }

    // Get agent
    const agent = this.agents[frame];

    // First attempt: Generate response
    let response = await agent.respond(contents, modulations);

    // Evaluate response quality
    let evaluation = await this.evaluator.evaluate(
      response.text,
      lastUserMessage,
      currentMetrics,
      frame
    );

    let retried = false;

    // If rejected, retry ONCE with context about why it was rejected
    if (!evaluation.accepted) {
      console.log('Response rejected. Retrying with rejection context...');
      console.log('Issues found:', evaluation.issues);

      // Build rejection context to add to the conversation
      const rejectionContext = this.buildRejectionContext(evaluation.issues);

      // Add rejection feedback as a system message to the conversation
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

      // Get modulations from evaluation issues
      const evaluationModulations = this.evaluator.getModulations(evaluation.issues);
      modulations = [...new Set([...modulations, ...evaluationModulations])];

      // Retry with feedback
      response = await agent.respond(contentsWithFeedback, modulations);

      // Re-evaluate
      evaluation = await this.evaluator.evaluate(
        response.text,
        lastUserMessage,
        currentMetrics,
        frame
      );

      retried = true;
    }

    return {
      assistantMessage: response.text,
      frame: frame,
      reason: this.getFrameReason(analysis, frame),
      inputAnalysis: analysis,
      evaluation: {
        accepted: evaluation.accepted,
        score: evaluation.score,
        issues: evaluation.issues,
        metrics: evaluation.metrics,
        retried: retried
      }
    };
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
