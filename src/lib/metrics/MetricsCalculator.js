import Sentiment from 'sentiment';

/**
 * JavaScript implementation of the 5 humane metrics
 * Replaces the Python VADER-based service with JS sentiment analysis
 */

const sentiment = new Sentiment();

/**
 * Calculate sentiment authenticity score (0-100)
 * Detects performative positivity vs genuine emotional expression
 */
function calculateSentimentAuthenticity(userMessages) {
  if (!userMessages || userMessages.length === 0) return 50;

  // Analyze last 5 user messages
  const recentMessages = userMessages.slice(-5);
  let totalScore = 0;

  recentMessages.forEach(msg => {
    const result = sentiment.analyze(msg);
    let score = 50; // neutral baseline

    // Check for emotional specificity (specific emotion words)
    const emotionWords = [
      'frustrated', 'overwhelmed', 'anxious', 'excited', 'grateful',
      'confused', 'worried', 'hopeful', 'scared', 'proud', 'disappointed',
      'angry', 'sad', 'happy', 'stressed', 'relieved'
    ];
    const hasSpecificEmotion = emotionWords.some(word =>
      msg.toLowerCase().includes(word)
    );
    if (hasSpecificEmotion) score += 20;

    // Check for vulnerability indicators
    const vulnerabilityPhrases = [
      "i feel", "i'm feeling", "i've been", "i don't know",
      "i'm not sure", "i'm struggling", "it's hard", "i can't"
    ];
    const showsVulnerability = vulnerabilityPhrases.some(phrase =>
      msg.toLowerCase().includes(phrase)
    );
    if (showsVulnerability) score += 15;

    // Penalize performative positivity
    const performativePhrases = [
      "i'm fine", "everything's fine", "it's all good",
      "no worries", "i'm okay", "it's whatever"
    ];
    const isPerformative = performativePhrases.some(phrase =>
      msg.toLowerCase().includes(phrase)
    ) && result.score >= 0; // Said positive but feels neutral
    if (isPerformative) score -= 25;

    // Check message length (very short = possibly guarded)
    if (msg.split(' ').length < 5) score -= 10;

    // Sentiment variation adds authenticity
    if (Math.abs(result.score) > 2) score += 10;

    totalScore += Math.max(0, Math.min(100, score));
  });

  return Math.round(totalScore / recentMessages.length);
}

/**
 * Calculate validation-before-reframe compliance (0-100%)
 * Checks if agent validates emotions before offering advice/reframes
 */
function calculateValidationCompliance(messages) {
  if (!messages || messages.length < 2) return 100;

  let totalReframes = 0;
  let compliantReframes = 0;

  for (let i = 1; i < messages.length; i++) {
    const msg = messages[i];
    if (msg.role !== 'assistant') continue;

    const prevUserMsg = messages[i - 1];
    if (!prevUserMsg || prevUserMsg.role !== 'user') continue;

    // Check if response contains advice/reframe keywords
    const adviceKeywords = [
      'try', 'could', 'might', 'consider', 'what if', 'maybe',
      'have you thought', 'one way', 'instead', 'perhaps'
    ];
    const hasAdvice = adviceKeywords.some(word =>
      msg.content.toLowerCase().includes(word)
    );

    if (hasAdvice) {
      totalReframes++;

      // Check if validation comes first
      const validationPhrases = [
        "that makes sense", "i hear", "it sounds like", "that's",
        "i understand", "it's understandable", "that must",
        "i can see", "feeling", "makes sense that"
      ];

      // Get first 100 characters to check if validation comes first
      const beginning = msg.content.substring(0, 100).toLowerCase();
      const hasValidationFirst = validationPhrases.some(phrase =>
        beginning.includes(phrase)
      );

      if (hasValidationFirst) compliantReframes++;
    }
  }

  if (totalReframes === 0) return 100;
  return Math.round((compliantReframes / totalReframes) * 100);
}

/**
 * Calculate question-to-imperative ratio (0-100%)
 * Higher = more Socratic, lower = more directive
 */
function calculateQuestionRatio(messages) {
  if (!messages || messages.length === 0) return 50;

  const assistantMessages = messages.filter(m => m.role === 'assistant');
  if (assistantMessages.length === 0) return 50;

  let totalSentences = 0;
  let questionCount = 0;

  assistantMessages.forEach(msg => {
    // Split by sentence endings
    const sentences = msg.content.split(/[.!?]+/).filter(s => s.trim().length > 0);
    totalSentences += sentences.length;

    // Count questions
    const questions = sentences.filter(s => s.includes('?'));
    questionCount += questions.length;
  });

  if (totalSentences === 0) return 50;
  return Math.round((questionCount / totalSentences) * 100);
}

/**
 * Calculate user pushback frequency (per 100 messages)
 * Detects resistance to agent suggestions
 */
function calculateUserPushback(userMessages) {
  if (!userMessages || userMessages.length === 0) return 0;

  let pushbackCount = 0;

  const pushbackPhrases = [
    "but ", "i can't", "that won't work", "you don't understand",
    "i tried that", "that's not", "no,", "yeah but", "i know but",
    "it's not that simple", "easier said than done", "that doesn't help"
  ];

  userMessages.forEach(msg => {
    const lowerMsg = msg.toLowerCase();
    const hasPushback = pushbackPhrases.some(phrase =>
      lowerMsg.includes(phrase)
    );
    if (hasPushback) pushbackCount++;
  });

  // Convert to per-100 rate
  const rate = (pushbackCount / userMessages.length) * 100;
  return Math.round(rate);
}

/**
 * Count user-generated solutions
 * Tracks instances where user generates their own insights/action plans
 */
function countUserSolutions(userMessages) {
  if (!userMessages || userMessages.length === 0) return 0;

  let solutionCount = 0;

  const solutionPhrases = [
    "i think i'll", "i could", "maybe i", "i should", "i'll try",
    "i'm going to", "i want to", "i need to", "what if i",
    "i realized", "i noticed", "i learned", "makes me think"
  ];

  userMessages.forEach(msg => {
    const lowerMsg = msg.toLowerCase();
    const hasSolution = solutionPhrases.some(phrase =>
      lowerMsg.includes(phrase)
    );
    if (hasSolution) solutionCount++;
  });

  return solutionCount;
}

/**
 * Calculate all 5 humane metrics from conversation history
 * @param {Array} messages - Conversation history
 * @returns {Object} All calculated metrics
 */
export function calculateMetrics(messages) {
  if (!messages || messages.length === 0) {
    return {
      sentimentAuthenticity: 50,
      questionRatio: 50,
      validationCompliance: 100,
      userPushback: 0,
      userSolutionsCount: 0,
      exchangeCount: 0,
      needsScaffolding: false
    };
  }

  const userMessages = messages
    .filter(m => m.role === 'user')
    .map(m => m.content);

  const exchangeCount = Math.floor(messages.length / 2);
  const userSolutionsCount = countUserSolutions(userMessages);
  const needsScaffolding = userSolutionsCount === 0 && exchangeCount >= 10;

  return {
    sentimentAuthenticity: calculateSentimentAuthenticity(userMessages),
    questionRatio: calculateQuestionRatio(messages),
    validationCompliance: calculateValidationCompliance(messages),
    userPushback: calculateUserPushback(userMessages),
    userSolutionsCount,
    exchangeCount,
    needsScaffolding
  };
}
