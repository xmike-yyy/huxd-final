// Client for calling Python metrics service
import { withRetry } from './retry.js';

const METRICS_SERVICE_URL = 'http://localhost:8000';

export class MetricsServiceClient {
  constructor(baseUrl = METRICS_SERVICE_URL) {
    this.baseUrl = baseUrl;
  }

  async callEndpoint(endpoint, data) {
    try {
      const res = await withRetry(
        () =>
          fetch(`${this.baseUrl}${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
          }).then(async (r) => {
            if (!r.ok) {
              // Try to parse error, else throw generic
              let detail = 'Metrics service error';
              try {
                const errJson = await r.json();
                detail = errJson?.detail || detail;
              } catch {
                // ignore
              }
              const e = new Error(detail);
              e.status = r.status;
              throw e;
            }
            return r;
          }),
        { retries: 2, delayMs: 300, factor: 2 }
      );

      return await res.json();
    } catch (error) {
      console.error(`Metrics service error (${endpoint}):`, error);
      throw error;
    }
  }

  async analyzeSentimentAuthenticity(messages) {
    return this.callEndpoint('/metrics/sentiment-authenticity', { messages });
  }

  async analyzeValidationCompliance(userMessage, agentResponse) {
    return this.callEndpoint('/metrics/validation-compliance', {
      user_message: userMessage,
      agent_response: agentResponse
    });
  }

  async analyzeQuestionRatio(messages) {
    return this.callEndpoint('/metrics/question-ratio', { messages });
  }

  async analyzeUserPushback(messages) {
    return this.callEndpoint('/metrics/user-pushback', { messages });
  }

  async analyzeUserSolutions(messages) {
    return this.callEndpoint('/metrics/user-solutions', { messages });
  }

  async analyzeAllMetrics(messages) {
    return this.callEndpoint('/metrics/all', { messages });
  }

  async healthCheck() {
    const res = await withRetry(
      () => fetch(`${this.baseUrl}/health`),
      { retries: 2, delayMs: 300, factor: 2 }
    );
    return res.json();
  }
}
