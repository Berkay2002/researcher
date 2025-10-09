/**
 * Token bucket rate limiter for API calls
 *
 * Implements a token bucket algorithm that allows bursts up to the bucket size
 * while maintaining an average rate over time.
 */

const MS_PER_SECOND = 1000;

export class RateLimiter {
  private tokens: number;
  private lastRefill: number;
  private readonly maxTokens: number;
  private readonly refillRate: number; // tokens per second
  private readonly queue: Array<{
    resolve: () => void;
    tokensNeeded: number;
  }> = [];
  private isProcessing = false;

  /**
   * @param requestsPerSecond - Maximum number of requests allowed per second
   * @param burstSize - Maximum number of requests that can be made at once (defaults to requestsPerSecond)
   */
  constructor(
    requestsPerSecond: number,
    burstSize: number = requestsPerSecond
  ) {
    this.maxTokens = burstSize;
    this.tokens = burstSize;
    this.refillRate = requestsPerSecond;
    this.lastRefill = Date.now();
  }

  /**
   * Refill tokens based on elapsed time
   */
  private refill(): void {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / MS_PER_SECOND; // Convert to seconds
    const tokensToAdd = elapsed * this.refillRate;

    this.tokens = Math.min(this.maxTokens, this.tokens + tokensToAdd);
    this.lastRefill = now;
  }

  /**
   * Process the queue of waiting requests
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing) {
      return;
    }
    this.isProcessing = true;

    while (this.queue.length > 0) {
      this.refill();

      const next = this.queue[0];
      if (!next) {
        break;
      }

      if (this.tokens >= next.tokensNeeded) {
        this.tokens -= next.tokensNeeded;
        this.queue.shift();
        next.resolve();
      } else {
        // Not enough tokens, wait until we can refill
        const tokensNeeded = next.tokensNeeded - this.tokens;
        const waitTime = (tokensNeeded / this.refillRate) * MS_PER_SECOND;
        await new Promise((resolve) => setTimeout(resolve, waitTime));
      }
    }

    this.isProcessing = false;
  }

  /**
   * Acquire tokens before making an API call
   * @param tokens - Number of tokens to acquire (defaults to 1)
   * @returns Promise that resolves when tokens are available
   */
  acquire(tokens = 1): Promise<void> {
    this.refill();

    if (this.tokens >= tokens) {
      this.tokens -= tokens;
      return Promise.resolve();
    }

    // Not enough tokens, queue the request
    return new Promise<void>((resolve) => {
      this.queue.push({ resolve, tokensNeeded: tokens });
      this.processQueue();
    });
  }

  /**
   * Execute a function with rate limiting
   * @param fn - Function to execute
   * @param tokens - Number of tokens to acquire (defaults to 1)
   * @returns Promise with the function result
   */
  async execute<T>(fn: () => Promise<T>, tokens = 1): Promise<T> {
    await this.acquire(tokens);
    return fn();
  }

  /**
   * Get current token count (for debugging)
   */
  getAvailableTokens(): number {
    this.refill();
    return Math.floor(this.tokens);
  }
}

/**
 * Create a rate limiter singleton for a specific service
 */
export function createRateLimiter(
  requestsPerSecond: number,
  burstSize?: number
): RateLimiter {
  return new RateLimiter(requestsPerSecond, burstSize);
}
