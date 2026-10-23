import { readFile, readdir } from "node:fs/promises";
import { sql } from "drizzle-orm";
import { db } from "../src/server/db";
import { sqlRows } from "../src/server/sql-rows";
await db().execute(
  sql`CREATE TABLE IF NOT EXISTS migration_history (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`,
);
for (const file of (await readdir("migrations"))
  .filter((f) => f.endsWith(".sql"))
  .sort()) {
  const name = file.replace(".sql", "");
  const applied = await db().execute(
    sql`SELECT name FROM migration_history WHERE name=${name}`,
  );
  if (sqlRows(applied).length) continue;
  const migration = await readFile(`migrations/${file}`, "utf8");
  await db().transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(734091)`);
    const existing = await tx.execute(
      sql`SELECT name FROM migration_history WHERE name=${name}`,
    );
    if (sqlRows(existing).length) return;
    for (const statement of migration.split(";").filter((s) => s.trim()))
      await tx.execute(sql.raw(statement));
    await tx.execute(sql`INSERT INTO migration_history(name) VALUES (${name})`);
  });
  console.log(`Applied ${name}`);
}
console.log("Database migrations up to date.");
process.exit(0);
