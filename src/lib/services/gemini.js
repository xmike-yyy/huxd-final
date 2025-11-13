import { env } from '$env/dynamic/private';
import { GoogleGenAI } from '@google/genai';

export async function geminiGenerate({ contents, systemPrompt = '', config = {} }) {
  const key = env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY not set');

  const ai = new GoogleGenAI({ apiKey: key });

  if (systemPrompt) {
    config.systemInstruction = {
      role: 'model',
      parts: [{ text: systemPrompt }]
    };
  }

  const request = {
    model: env.GEMINI_MODEL || 'gemini-2.5-flash',
    contents: contents,
    config: config
  };

  const response = await ai.models.generateContent(request);
  const text = typeof response?.text === 'string' ? response.text : '';

  return { text, raw: response };
}
