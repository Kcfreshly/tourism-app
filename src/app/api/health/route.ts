import { sql } from "drizzle-orm";
import { db } from "@/database/client";

// For container and load-balancer health checks: the app is up and can reach
// its database. Never cached, never shows the error to callers.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await db().execute(sql`SELECT 1`);
    return Response.json(
      { status: "ok" },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json(
      { status: "unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
