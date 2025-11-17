import { calculateMetrics } from './MetricsCalculator.js';

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
}
