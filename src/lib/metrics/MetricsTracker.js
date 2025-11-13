import { MetricsServiceClient } from '../services/metricsService.js';

export class MetricsTracker {
  constructor() {
    this.metricsClient = new MetricsServiceClient();
    this.reset();
  }

  reset() {
    this.sentimentAuthenticity = 100;
    this.questionRatio = 100;
    this.validationCompliance = 100;
    this.userPushback = 0;
    this.userSolutionsCount = 0;
    this.exchangeCount = 0;
    this.needsScaffolding = false;
    this.validationHistory = []; // Track compliant/non-compliant exchanges
  }

  async calculate(contents) {
    try {
      // Convert contents to format expected by Python service
      const messages = contents.map((c) => ({
        text: c.parts?.[0]?.text || '',
        role: c.role
      }));

      this.exchangeCount = Math.min(
        messages.filter((m) => m.role === 'user').length,
        messages.filter((m) => m.role === 'model').length
      );

      console.log('[MetricsTracker] Calling Python service with', messages.length, 'messages');

      // Call Python service to get all metrics at once
      const result = await this.metricsClient.analyzeAllMetrics(messages);

      console.log('[MetricsTracker] Python service response:', JSON.stringify(result, null, 2));

      // Update metrics from Python service response
      this.sentimentAuthenticity = result.sentiment_authenticity?.score || 100;
      this.questionRatio = result.question_ratio?.ratio || 100;
      this.userPushback = result.user_pushback?.frequency || 0;
      this.userSolutionsCount = result.user_solutions?.count || 0;
      this.needsScaffolding = result.user_solutions?.needs_scaffolding || false;

      console.log('[MetricsTracker] Updated metrics:', this.toJSON());

      // Validation compliance is calculated separately per exchange
      // It's updated via updateValidationCompliance() method

      return this.toJSON();
    } catch (error) {
      console.error('[MetricsTracker] Error calculating metrics:', error);
      console.error('[MetricsTracker] Error stack:', error.stack);
      // Return fallback values if Python service is down
      return this.toJSON();
    }
  }

  async checkValidationCompliance(userMessage, agentResponse) {
    try {
      const result = await this.metricsClient.analyzeValidationCompliance(
        userMessage,
        agentResponse
      );
      return result.compliant;
    } catch (error) {
      console.error('Error checking validation compliance:', error);
      return true; // Default to compliant if check fails
    }
  }

  updateValidationCompliance(isCompliant) {
    // Add to history
    this.validationHistory.push(isCompliant);

    // Calculate percentage
    const compliantCount = this.validationHistory.filter((c) => c).length;
    const totalCount = this.validationHistory.length;

    if (totalCount === 0) {
      this.validationCompliance = 100; // Default to 100 if no exchanges yet
    } else {
      this.validationCompliance = (compliantCount / totalCount) * 100;
    }

    console.log(
      `[MetricsTracker] Validation compliance: ${compliantCount}/${totalCount} = ${this.validationCompliance.toFixed(1)}%`
    );
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
