import Sentiment from 'sentiment';

const sentiment = new Sentiment();

/**
 * Incremental metrics tracker that updates metrics based on new messages only
 * Stores running state to avoid recalculating entire conversation history
 */
export class MetricsTracker {
  constructor(previousState = null) {
    if (previousState) {
      // Load from previous state
      this.sentimentAuthenticity = previousState.sentimentAuthenticity || 50;
      this.questionRatio = previousState.questionRatio || 50;
      this.validationCompliance = previousState.validationCompliance || 100;
      this.userPushback = previousState.userPushback || 0;
      this.userSolutionsCount = previousState.userSolutionsCount || 0;
      this.exchangeCount = previousState.exchangeCount || 0;
      this.needsScaffolding = previousState.needsScaffolding || false;

      // Running state
      this._recentUserMessages = previousState._recentUserMessages || [];
      this._validationStats = previousState._validationStats || { totalReframes: 0, compliantReframes: 0 };
      this._questionStats = previousState._questionStats || { totalSentences: 0, questionCount: 0 };
    } else {
      this.reset();
    }
  }

  reset() {
    this.sentimentAuthenticity = 50;
    this.questionRatio = 50;
    this.validationCompliance = 100;
    this.userPushback = 0;
    this.userSolutionsCount = 0;
    this.exchangeCount = 0;
    this.needsScaffolding = false;

    // Running state for incremental calculation
    this._recentUserMessages = [];
    this._validationStats = { totalReframes: 0, compliantReframes: 0 };
    this._questionStats = { totalSentences: 0, questionCount: 0 };
  }

  /**
   * Update metrics based on new message pair (user + assistant)
   * Only processes NEW messages, not entire history
   */
  updateWithNewExchange(userMessage, assistantMessage) {
    this.exchangeCount++;

    // Update sentiment authenticity (rolling average of last 5)
    this._updateSentimentAuthenticity(userMessage);

    // Update user pushback
    this._updateUserPushback(userMessage);

    // Update user solutions count
    this._updateUserSolutions(userMessage);

    // Update validation compliance
    if (assistantMessage) {
      this._updateValidationCompliance(userMessage, assistantMessage);
      this._updateQuestionRatio(assistantMessage);
    }

    // Update scaffolding flag
    this.needsScaffolding = this.userSolutionsCount === 0 && this.exchangeCount >= 10;

    return this.toJSON();
  }

  _updateSentimentAuthenticity(userMessage) {
    const result = sentiment.analyze(userMessage);
    let score = 50; // neutral baseline

    // Check for emotional specificity
    const emotionWords = [
      'frustrated', 'overwhelmed', 'anxious', 'excited', 'grateful',
      'confused', 'worried', 'hopeful', 'scared', 'proud', 'disappointed',
      'angry', 'sad', 'happy', 'stressed', 'relieved'
    ];
    if (emotionWords.some(word => userMessage.toLowerCase().includes(word))) {
      score += 20;
    }

    // Check for vulnerability
    const vulnerabilityPhrases = [
      "i feel", "i'm feeling", "i've been", "i don't know",
      "i'm not sure", "i'm struggling", "it's hard", "i can't"
    ];
    if (vulnerabilityPhrases.some(phrase => userMessage.toLowerCase().includes(phrase))) {
      score += 15;
    }

    // Penalize performative positivity
    const performativePhrases = [
      "i'm fine", "everything's fine", "it's all good",
      "no worries", "i'm okay", "it's whatever"
    ];
    if (performativePhrases.some(phrase => userMessage.toLowerCase().includes(phrase)) && result.score >= 0) {
      score -= 25;
    }

    // Check message length
    if (userMessage.split(' ').length < 5) score -= 10;

    // Sentiment variation
    if (Math.abs(result.score) > 2) score += 10;

    score = Math.max(0, Math.min(100, score));

    // Keep last 5 messages for rolling average
    this._recentUserMessages.push(userMessage);
    if (this._recentUserMessages.length > 5) {
      this._recentUserMessages.shift();
    }

    // Update with exponential moving average
    const weight = 0.3;
    this.sentimentAuthenticity = this.sentimentAuthenticity * (1 - weight) + score * weight;
  }

  _updateUserPushback(userMessage) {
    const pushbackPhrases = [
      "but ", "i can't", "that won't work", "you don't understand",
      "i tried that", "that's not", "no,", "yeah but", "i know but",
      "it's not that simple", "easier said than done", "that doesn't help"
    ];

    const hasPushback = pushbackPhrases.some(phrase =>
      userMessage.toLowerCase().includes(phrase)
    );

    if (hasPushback) {
      // Increment count and recalculate rate
      const totalUserMessages = this.exchangeCount;
      const currentCount = Math.round((this.userPushback / 100) * (totalUserMessages - 1)) + 1;
      this.userPushback = (currentCount / totalUserMessages) * 100;
    } else {
      // Recalculate rate without incrementing
      const totalUserMessages = this.exchangeCount;
      const currentCount = Math.round((this.userPushback / 100) * (totalUserMessages - 1));
      this.userPushback = (currentCount / totalUserMessages) * 100;
    }
  }

  _updateUserSolutions(userMessage) {
    const solutionPhrases = [
      "i think i'll", "i could", "maybe i", "i should", "i'll try",
      "i'm going to", "i want to", "i need to", "what if i",
      "i realized", "i noticed", "i learned", "makes me think"
    ];

    const hasSolution = solutionPhrases.some(phrase =>
      userMessage.toLowerCase().includes(phrase)
    );

    if (hasSolution) {
      this.userSolutionsCount++;
    }
  }

  _updateValidationCompliance(userMessage, assistantMessage) {
    // Check if response contains advice/reframe keywords
    const adviceKeywords = [
      'try', 'could', 'might', 'consider', 'what if', 'maybe',
      'have you thought', 'one way', 'instead', 'perhaps'
    ];
    const hasAdvice = adviceKeywords.some(word =>
      assistantMessage.toLowerCase().includes(word)
    );

    if (hasAdvice) {
      this._validationStats.totalReframes++;

      // Check if validation comes first
      const validationPhrases = [
        "that makes sense", "i hear", "it sounds like", "that's",
        "i understand", "it's understandable", "that must",
        "i can see", "feeling", "makes sense that"
      ];

      const beginning = assistantMessage.substring(0, 100).toLowerCase();
      const hasValidationFirst = validationPhrases.some(phrase =>
        beginning.includes(phrase)
      );

      if (hasValidationFirst) {
        this._validationStats.compliantReframes++;
      }
    }

    // Update compliance percentage
    if (this._validationStats.totalReframes > 0) {
      this.validationCompliance = (this._validationStats.compliantReframes / this._validationStats.totalReframes) * 100;
    }
  }

  _updateQuestionRatio(assistantMessage) {
    // Split by sentence endings
    const sentences = assistantMessage.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const questions = sentences.filter(s => s.includes('?'));

    // Update running totals
    this._questionStats.totalSentences += sentences.length;
    this._questionStats.questionCount += questions.length;

    // Update ratio
    if (this._questionStats.totalSentences > 0) {
      this.questionRatio = (this._questionStats.questionCount / this._questionStats.totalSentences) * 100;
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
      needsScaffolding: this.needsScaffolding,
      // Include running state for persistence
      _recentUserMessages: this._recentUserMessages,
      _validationStats: this._validationStats,
      _questionStats: this._questionStats
    };
  }
}
