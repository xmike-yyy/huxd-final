import { geminiGenerate } from '../services/gemini.js';

export class BaseAgent {
  constructor(name, systemPrompt) {
    this.name = name;
    this.systemPrompt = systemPrompt;
  }

  async respond(contents) {
    const { text } = await geminiGenerate({
      contents,
      systemPrompt: this.systemPrompt
    });

    return {
      text,
      frame: this.name
    };
  }
}
