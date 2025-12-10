import { json } from '@sveltejs/kit';
import { Orchestrator } from '$lib/orchestrator/Orchestrator.js';
import { MetricsTracker } from '$lib/metrics/MetricsTracker.js';

export async function POST({ request }) {
  try {
    const { history, sessionId, previousMetrics, reflectionContext } = await request.json();

    if (!Array.isArray(history)) {
      return json({ error: 'history array required' }, { status: 400 });
    }

    // Convert to Gemini format
    const contents = history.map((m) => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.content }]
    }));

    // Get last user message (the NEW message we're responding to)
    const lastUserMessage = contents[contents.length - 1]?.parts?.[0]?.text || '';

    // Initialize metrics tracker with previous state (conversation-specific)
    const metricsTracker = new MetricsTracker(previousMetrics);

    // Only update metrics with the NEW user message (no assistant response yet)
    // We'll update again after we get the assistant response
    const currentMetrics = metricsTracker.toJSON();

    console.log(`[Chat API] Session ${sessionId}: Exchange ${currentMetrics.exchangeCount + 1}`);
    console.log('[Chat API] Current metrics:', currentMetrics);

    // Orchestrate response with current metrics
    const orchestrator = new Orchestrator();
    // Pass reflectionContext (containing summary and new items) to orchestrator
    const result = await orchestrator.orchestrate(contents, currentMetrics, reflectionContext || { summary: '', items: [] });

    // Now update metrics with the complete exchange (user + assistant)
    metricsTracker.updateWithNewExchange(lastUserMessage, result.assistantMessage);
    const updatedMetrics = metricsTracker.toJSON();

    return json({
      assistantMessage: result.assistantMessage,
      frame: result.frame,
      reason: result.reason,
      metrics: updatedMetrics,
      inputAnalysis: result.inputAnalysis,
      evaluation: result.evaluation,
      updatedReflectionSummary: result.updatedReflectionSummary // Pass back new summary if generated
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
