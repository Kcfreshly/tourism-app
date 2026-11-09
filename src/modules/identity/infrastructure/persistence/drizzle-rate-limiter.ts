import { sql } from "drizzle-orm";
import { createHash } from "node:crypto";
import type { Database } from "@/database/client";
import { sqlRows } from "@/database/sql-rows";
import type { RateLimiter } from "../../application/ports/rate-limiter";

// Database-backed counters keyed by a hash of the operation and actor.
export class DrizzleRateLimiter implements RateLimiter {
  constructor(private readonly db: () => Database) {}

  async hit(key: string, seconds: number) {
    const hashed = createHash("sha256").update(key).digest("hex");
    const rows = await this.db().execute(
      sql`INSERT INTO request_limits(key,count,reset_at) VALUES (${hashed},1,now()+ ${seconds}*interval '1 second') ON CONFLICT (key) DO UPDATE SET count=CASE WHEN request_limits.reset_at<=now() THEN 1 ELSE request_limits.count+1 END,reset_at=CASE WHEN request_limits.reset_at<=now() THEN now()+ ${seconds}*interval '1 second' ELSE request_limits.reset_at END RETURNING count`,
    );
    return Number(sqlRows(rows)[0]?.count);
  }
}
