import { sql } from "drizzle-orm";
import { createHash } from "node:crypto";
import { db } from "./db";
import { ApiError } from "./identity";
import { sqlRows } from "./sql-rows";
export async function limit(key: string, max = 60, seconds = 60) {
  const hashed = createHash("sha256").update(key).digest("hex");
  const rows = await db().execute(
    sql`INSERT INTO request_limits(key,count,reset_at) VALUES (${hashed},1,now()+ ${seconds}*interval '1 second') ON CONFLICT (key) DO UPDATE SET count=CASE WHEN request_limits.reset_at<=now() THEN 1 ELSE request_limits.count+1 END,reset_at=CASE WHEN request_limits.reset_at<=now() THEN now()+ ${seconds}*interval '1 second' ELSE request_limits.reset_at END RETURNING count`,
  );
  if (Number(sqlRows(rows)[0]?.count) > max)
    throw new ApiError(
      429,
      "RATE_LIMITED",
      "Too many requests. Wait a minute and retry. Your draft is retained.",
    );
}
