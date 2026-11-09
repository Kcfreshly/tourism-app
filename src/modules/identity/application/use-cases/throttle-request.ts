import { AppError } from "@/shared/application/app-error";
import type { RateLimiter } from "../ports/rate-limiter";

export class ThrottleRequest {
  constructor(private readonly limiter: RateLimiter) {}

  async execute(key: string, max = 60, seconds = 60) {
    if ((await this.limiter.hit(key, seconds)) > max)
      throw new AppError(
        "RATE_LIMITED",
        "RATE_LIMITED",
        "Too many requests. Wait a minute and retry. Your draft is retained.",
      );
  }
}
