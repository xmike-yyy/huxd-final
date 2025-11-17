import { json } from '@sveltejs/kit';
import { Orchestrator } from '$lib/orchestrator/Orchestrator.js';
import { MetricsTracker } from '$lib/metrics/MetricsTracker.js';

export async function POST({ request }) {
  try {
    const { history } = await request.json();

    if (!Array.isArray(history)) {
      return json({ error: 'history array required' }, { status: 400 });
    }

    // Convert to Gemini format
    const contents = history.map((m) => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.content }]
    }));

    // Calculate metrics
    const metricsTracker = new MetricsTracker();
    await metricsTracker.calculate(contents);

    // Calculate validation compliance for ALL exchanges in conversation history
    for (let i = 0; i < contents.length - 1; i++) {
      if (contents[i].role === 'user' && contents[i + 1].role === 'model') {
        const userText = contents[i].parts?.[0]?.text || '';
        const agentText = contents[i + 1].parts?.[0]?.text || '';
        const isCompliant = await metricsTracker.checkValidationCompliance(userText, agentText);
        metricsTracker.updateValidationCompliance(isCompliant);
      }
    }

    // Get current metrics for orchestrator
    const currentMetrics = metricsTracker.toJSON();

    // Orchestrate response with current metrics
    const orchestrator = new Orchestrator();
    const result = await orchestrator.orchestrate(contents, currentMetrics);

    // Check validation compliance for the NEW exchange
    const lastUserMessage = contents.filter((c) => c.role === 'user').pop();
    if (lastUserMessage) {
      const userText = lastUserMessage.parts?.[0]?.text || '';
      const agentText = result.assistantMessage;
      const isCompliant = await metricsTracker.checkValidationCompliance(userText, agentText);
      metricsTracker.updateValidationCompliance(isCompliant);
    }

    const metrics = metricsTracker.toJSON();

    return json({
      assistantMessage: result.assistantMessage,
      frame: result.frame,
      reason: result.reason,
      metrics: metrics,
      inputAnalysis: result.inputAnalysis,
      evaluation: result.evaluation // Include evaluation results
    });
  } catch (err) {
    console.error('Chat API error:', err);
    return json(
      {
        error: 'Failed to generate response',
        details: err.message
      },
      { status: 500 }
    );
  }
}
