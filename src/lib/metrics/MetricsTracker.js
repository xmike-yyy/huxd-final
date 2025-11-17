import { calculateMetrics } from './MetricsCalculator.js';
import { geminiGenerate } from '../services/gemini.js';

export class MetricsTracker {
  constructor() {
    this.reset();
  }

  reset() {
    this.sentimentAuthenticity = 50;
    this.questionRatio = 50;
    this.validationCompliance = 100;
    this.userPushback = 0;
    this.userSolutionsCount = 0;
    this.exchangeCount = 0;
    this.needsScaffolding = false;
  }

  async calculate(contents) {
    try {
      // Convert Gemini contents format to simple messages array
      const messages = contents.map((c) => ({
        content: c.parts?.[0]?.text || '',
        role: c.role === 'model' ? 'assistant' : c.role
      }));

      console.log('[MetricsTracker] Calculating metrics for', messages.length, 'messages');

      // Use JavaScript metrics calculator
      const metrics = calculateMetrics(messages);

      // Update internal state
      this.sentimentAuthenticity = metrics.sentimentAuthenticity;
      this.questionRatio = metrics.questionRatio;
      this.validationCompliance = metrics.validationCompliance;
      this.userPushback = metrics.userPushback;
      this.userSolutionsCount = metrics.userSolutionsCount;
      this.exchangeCount = metrics.exchangeCount;
      this.needsScaffolding = metrics.needsScaffolding;

      console.log('[MetricsTracker] Updated metrics:', this.toJSON());

      return this.toJSON();
    } catch (error) {
      console.error('[MetricsTracker] Error calculating metrics:', error);
      // Return current values if calculation fails
      return this.toJSON();
    }
  }

  toJSON() {
    return {
      sentimentAuthenticity: Math.round(this.sentimentAuthenticity),
      questionRatio: Math.round(this.questionRatio),
      validationCompliance: Math.round(this.validationCompliance),
      userPushback: Math.round(this.userPushback),
      userSolutionsCount: this.userSolutionsCount,
      exchangeCount: this.exchangeCount,
      needsScaffolding: this.needsScaffolding
    };
  }

  /**
   * Check if agent response includes proper emotional validation
   */
  async checkValidationCompliance(userText, agentText) {
    try {
      const systemPrompt = `Analyze if the agent's response properly validates the user's emotions.

User: "${userText}"
Agent: "${agentText}"

Does the agent response acknowledge and validate the user's emotional state before offering advice or reframing?

Respond with only "true" or "false".`;

      const { text } = await geminiGenerate({
        contents: [{ role: 'user', parts: [{ text: systemPrompt }] }],
        systemPrompt: ''
      });

      return text.toLowerCase().includes('true');
    } catch (error) {
      console.error('[MetricsTracker] Error checking validation compliance:', error);
      return true; // Default to true if check fails
    }
  }

  /**
   * Update validation compliance score based on whether validation was present
   */
  updateValidationCompliance(isCompliant) {
    // Use exponential moving average to update compliance
    const weight = 0.3; // Weight for new observation
    const newValue = isCompliant ? 100 : 0;
    this.validationCompliance = this.validationCompliance * (1 - weight) + newValue * weight;
  }
}
