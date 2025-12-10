import { geminiGenerate } from './gemini.js';

const ANALYSIS_SCHEMA = {
  type: 'OBJECT',
  properties: {
    sentiment: { type: 'NUMBER' },
    emotionalState: { type: 'STRING' },
    intent: { type: 'STRING' },
    needsReflectionContext: { type: 'BOOLEAN' }
  },
  required: ['sentiment', 'emotionalState', 'intent', 'needsReflectionContext']
};

export async function analyzeInput(contents) {
  const systemPrompt = `Analyze the user's emotional state and intent based on the conversation history.

Return JSON with:
- sentiment: -1.0 (very negative) to 1.0 (very positive)
- emotionalState: frustrated, confused, positive, neutral, overwhelmed, anxious, hopeful, etc.
- intent: venting, seeking_advice, celebrating, reflecting, uncertain
- needsReflectionContext: TRUE only if the user explicitly asks about their past thoughts, patterns, or history, OR if knowing their past reflections would significantly improve the answer (e.g. "Do I always do this?", "What did I say yesterday?"). Default to FALSE.

Focus on the most recent user message.`;

  try {
    const { text } = await geminiGenerate({
      contents,
      systemPrompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: ANALYSIS_SCHEMA
      }
    });

    return JSON.parse(text);
  } catch (error) {
    // Fallback if analysis fails
    return {
      sentiment: 0,
      emotionalState: 'neutral',
      intent: 'reflecting',
      needsReflectionContext: false
    };
  }
}
