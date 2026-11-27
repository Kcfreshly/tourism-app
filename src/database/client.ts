import { PGlite } from "@electric-sql/pglite";
import { drizzle as embedded } from "drizzle-orm/pglite";
import { drizzle as remote } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import { assertDemo } from "../config/environment";
import { mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
// One process owns the embedded directory. PostgreSQL is required for multiple instances.
const globalDb = globalThis as unknown as {
  tourismDb?: ReturnType<typeof createDb>;
};

function running(pid: number) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    // EPERM: the process exists but belongs to someone else.
    return (e as NodeJS.ErrnoException).code === "EPERM";
  }
}

// A second process writing to the same PGlite directory corrupts it, so the
// first one records its process id in `<path>.lock` and others refuse to open.
// A lock left by a process that has exited (for example after Ctrl+C) is taken
// over.
export function claimDatabase(path: string) {
  const lock = `${path}.lock`;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      writeFileSync(lock, String(process.pid), { flag: "wx" });
      process.on("exit", () => {
        try {
          if (readFileSync(lock, "utf8") === String(process.pid))
            unlinkSync(lock);
        } catch {}
      });
      return;
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
      const owner = Number(readFileSync(lock, "utf8"));
      if (owner === process.pid) return;
      if (owner && running(owner))
        throw new Error(
          `The local database ${path} is open in another process (pid ${owner}), ` +
            "usually the dev server. Stop it before running database scripts. " +
            `If no such process is running, delete ${lock}.`,
        );
      unlinkSync(lock);
    }
  }
  throw new Error(`Could not lock the local database ${path}.`);
}

function createDb() {
  assertDemo();
  if (process.env.DATABASE_URL)
    return remote(postgres(process.env.DATABASE_URL), {
      schema,
      casing: "snake_case",
    });
  const path = process.env.LOCAL_DATABASE_PATH ?? ".local/demo-db";
  mkdirSync(dirname(path), { recursive: true });
  claimDatabase(path);
  return embedded(new PGlite(path), { schema, casing: "snake_case" });
}
export function db() {
  return (globalDb.tourismDb ??= createDb());
}
export type Database = ReturnType<typeof db>;
