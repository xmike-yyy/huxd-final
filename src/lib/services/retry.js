// Simple retry utility with exponential backoff
// Usage:
// await withRetry(() => doSomething(), { retries: 2, delayMs: 300, factor: 2, shouldRetry: (err) => true })
export async function withRetry(operation, options = {}) {
  const {
    retries = 2, // total attempts = retries + 1
    delayMs = 300,
    factor = 2,
    shouldRetry
  } = options;

  let attempt = 0;
  let lastError;
  let currentDelay = delayMs;

  while (attempt <= retries) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      const retryOk = typeof shouldRetry === 'function' ? !!shouldRetry(error) : true;
      if (attempt === retries || !retryOk) {
        break;
      }
      await sleep(currentDelay);
      currentDelay = Math.floor(currentDelay * factor);
      attempt += 1;
    }
  }

  throw lastError;
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}


