import { geminiGenerate } from '../services/gemini.js';

export class BaseAgent {
  constructor(name, systemPrompt) {
    this.name = name;
    this.systemPrompt = systemPrompt;
  }

  async respond(contents, modulations = []) {
    // Apply modulations to system prompt
    const modulatedPrompt = this.applyModulations(this.systemPrompt, modulations);

    const { text } = await geminiGenerate({
      contents,
      systemPrompt: modulatedPrompt
    });

    return {
      text,
      frame: this.name
    };
  }

  applyModulations(basePrompt, modulations) {
    if (!modulations || modulations.length === 0) {
      return basePrompt;
    }

    let modulatedPrompt = basePrompt + '\n\n--- IMPORTANT ADJUSTMENTS FOR THIS RESPONSE ---\n';

    modulations.forEach(modulation => {
      switch (modulation) {
        case 'add_validation_first':
          modulatedPrompt += '\n- START with emotional validation before any suggestions or advice';
          break;
        case 'increase_empathy':
          modulatedPrompt += '\n- Use more empathetic and understanding language';
          break;
        case 'increase_questions':
          modulatedPrompt += '\n- Use 70%+ questions instead of statements. Be more Socratic.';
          break;
        case 'reduce_imperatives':
          modulatedPrompt += '\n- Avoid directive statements. Turn statements into questions.';
          break;
        case 'reduce_optimism':
          modulatedPrompt += '\n- Avoid toxic positivity. Be realistic and grounded.';
          break;
        case 'increase_realism':
          modulatedPrompt += '\n- Acknowledge difficulties. Don\'t minimize challenges.';
          break;
        case 'reduce_length':
          modulatedPrompt += '\n- Keep response to 3-4 sentences maximum. Be concise.';
          break;
        case 'focus_on_listening':
          modulatedPrompt += '\n- Focus on listening and reflection, not problem-solving.';
          break;
        case 'delay_solutions':
          modulatedPrompt += '\n- Do not offer solutions yet. Focus on understanding first.';
          break;
        case 'focus_on_validation':
          modulatedPrompt += '\n- Prioritize emotional validation above all else.';
          break;
        case 'increase_emotional_vocabulary':
          modulatedPrompt += '\n- Use specific emotion words (frustrated, overwhelmed, etc.) instead of generic terms.';
          break;
        case 'softer_language':
          modulatedPrompt += '\n- Use gentler, less enthusiastic language. Acknowledge difficulty.';
          break;
      }
    });

    return modulatedPrompt;
  }
}
