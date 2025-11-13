import { ReflectiveListener } from '../agents/ReflectiveListener.js';
import { ClarityCoach } from '../agents/ClarityCoach.js';
import { MomentumPartner } from '../agents/MomentumPartner.js';
import { analyzeInput } from '../services/inputAnalyzer.js';

export class Orchestrator {
  constructor() {
    this.agents = {
      'reflective-listener': new ReflectiveListener(),
      'clarity-coach': new ClarityCoach(),
      'momentum-partner': new MomentumPartner()
    };
  }

  async orchestrate(contents) {
    // Analyze user input
    const analysis = await analyzeInput(contents);

    // Select frame based on emotional state
    const frame = this.selectFrame(analysis);

    // Get agent and generate response
    const agent = this.agents[frame];
    const response = await agent.respond(contents);

    return {
      assistantMessage: response.text,
      frame: frame,
      reason: this.getFrameReason(analysis, frame),
      inputAnalysis: analysis
    };
  }

  selectFrame(analysis) {
    const { sentiment, emotionalState, intent } = analysis;

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
