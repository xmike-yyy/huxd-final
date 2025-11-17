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
    this.MAX_RETRIES = 3;
  }

  async orchestrate(contents, currentMetrics = {}) {
    // Analyze user input
    const analysis = await analyzeInput(contents);

    // Get last user message
    const lastUserMessage = contents[contents.length - 1]?.parts?.[0]?.text || '';

    // Select frame based on emotional state and metrics
    let frame = this.selectFrame(analysis, currentMetrics);

    let attempts = 0;
    let response;
    let evaluation;
    let modulations = [];

    // Retry loop with evaluation
    while (attempts < this.MAX_RETRIES) {
      attempts++;

      // Get agent with modulations applied
      const agent = this.agents[frame];

      // Generate response (with modulations if retrying)
      response = await agent.respond(contents, modulations);

      // Evaluate response quality
      evaluation = await this.evaluator.evaluate(
        response.text,
        lastUserMessage,
        currentMetrics,
        frame
      );

      // If accepted, break out of retry loop
      if (evaluation.accepted) {
        break;
      }

      // If rejected and we have retries left, get modulations and try again
      if (attempts < this.MAX_RETRIES) {
        modulations = this.evaluator.getModulations(evaluation.issues);
        console.log(`Response rejected (attempt ${attempts}). Retrying with modulations:`, modulations);
      }
    }

    // If all retries failed, fallback to Reflective Listener
    if (!evaluation.accepted && frame !== 'reflective-listener') {
      console.log('All retries failed. Falling back to Reflective Listener.');
      frame = 'reflective-listener';
      const fallbackAgent = this.agents[frame];
      response = await fallbackAgent.respond(contents, ['focus_on_validation', 'increase_empathy']);

      // Re-evaluate fallback
      evaluation = await this.evaluator.evaluate(
        response.text,
        lastUserMessage,
        currentMetrics,
        frame
      );
    }

    return {
      assistantMessage: response.text,
      frame: frame,
      reason: this.getFrameReason(analysis, frame),
      inputAnalysis: analysis,
      evaluation: {
        accepted: evaluation.accepted,
        score: evaluation.score,
        attempts: attempts,
        issues: evaluation.issues,
        metrics: evaluation.metrics
      }
    };
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
    if (currentMetrics.pushbackFrequency !== undefined &&
        currentMetrics.pushbackFrequency > 5) {
      console.log('High user pushback detected. Using Reflective Listener.');
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
}
