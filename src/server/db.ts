import { PGlite } from "@electric-sql/pglite";
import { drizzle as embedded } from "drizzle-orm/pglite";
import { drizzle as remote } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import { assertDemo } from "./config";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
// One process owns the embedded directory. PostgreSQL is required for multiple instances.
const globalDb = globalThis as unknown as {
  tourismDb?: ReturnType<typeof createDb>;
};
function createDb() {
  assertDemo();
  if (process.env.DATABASE_URL)
    return remote(postgres(process.env.DATABASE_URL), {
      schema,
      casing: "snake_case",
    });
  const path = process.env.LOCAL_DATABASE_PATH ?? ".local/demo-db";
  mkdirSync(dirname(path), { recursive: true });
  return embedded(new PGlite(path), { schema, casing: "snake_case" });
}
export function db() {
  return (globalDb.tourismDb ??= createDb());
}
