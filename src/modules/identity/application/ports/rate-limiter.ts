export interface RateLimiter {
  // Counts one request against `key` and returns the count in this window.
  hit(key: string, seconds: number): Promise<number>;
}
