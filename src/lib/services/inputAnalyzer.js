import { geminiGenerate } from './gemini.js';

const ANALYSIS_SCHEMA = {
  type: 'OBJECT',
  properties: {
    sentiment: { type: 'NUMBER' },
    emotionalState: { type: 'STRING' },
    intent: { type: 'STRING' }
  },
  required: ['sentiment', 'emotionalState', 'intent']
};

export async function analyzeInput(contents) {
  const systemPrompt = `Analyze the user's emotional state and intent.

Return JSON with:
- sentiment: -1.0 (very negative) to 1.0 (very positive)
- emotionalState: frustrated, confused, positive, neutral, overwhelmed, anxious, hopeful, etc.
- intent: venting, seeking_advice, celebrating, reflecting, uncertain

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
      intent: 'reflecting'
    };
  }
}
