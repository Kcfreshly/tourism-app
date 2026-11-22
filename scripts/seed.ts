import { randomUUID } from "node:crypto";
import Ajv from "ajv/dist/2020.js";
import source from "../tourism-v1-handoff/data/experiences.demo.json";
import events from "../src/data/events.demo.json";
import nightlife from "../src/data/nightlife.demo.json";
import contract from "../tourism-v1-handoff/contracts/catalogue.schema.json";
import { db } from "../src/database/client";
import { sql } from "drizzle-orm";
import { audit, catalogue, packages } from "../src/database/schema";
import { sqlRows } from "../src/database/sql-rows";
import { demoPackages } from "../src/modules/catalogue/domain/packages";
import { assertDemo } from "../src/config/environment";
assertDemo();
const validate = new Ajv().compile(contract);
for (const fixture of [source, events, nightlife])
  if (!validate(fixture)) throw Error(JSON.stringify(validate.errors));
const records = [
  ...source.experiences,
  ...events.experiences,
  ...nightlife.experiences,
];
// A seed a super admin deleted stays deleted: bring it back with Restore in
// the admin panel, which keeps its edits and history.
const deletedSeeds = new Set(
  sqlRows(
    await db().execute(
      sql`SELECT DISTINCT details->'snapshot'->>'seedKey' AS seed_key FROM audit_events WHERE action = 'CATALOGUE_DELETED'`,
    ),
  ).map((r) => String(r.seed_key)),
);
let skipped = 0;
for (const record of records) {
  if (deletedSeeds.has(record.id)) {
    skipped++;
    continue;
  }
  const [row] = await db()
    .insert(catalogue)
    .values({
      id: randomUUID(),
      seedKey: record.id,
      status: "DEMO_PUBLISHED",
      record,
    })
    .onConflictDoNothing({ target: catalogue.seedKey })
    .returning();
  // Every listing starts with a snapshot in the audit trail.
  if (row)
    await db()
      .insert(audit)
      .values({
        id: randomUUID(),
        actorId: "seed",
        action: "CATALOGUE_SNAPSHOT",
        entityId: row.id,
        details: {
          snapshot: {
            id: row.id,
            seedKey: row.seedKey,
            status: row.status,
            version: row.version,
            record: row.record,
            review: row.review,
          },
        },
      });
}
if (skipped)
  console.log(
    `${skipped} deleted demo listing(s) left out; restore them in the admin panel.`,
  );
for (const record of demoPackages)
  await db()
    .insert(packages)
    .values({
      id: randomUUID(),
      slug: record.slug,
      status: "DEMO_PUBLISHED",
      record,
    })
    .onConflictDoNothing({ target: packages.slug });
console.log(
  `${records.length} fictional catalogue seeds and ${demoPackages.length} ready-made trips ensured; existing edits preserved.`,
);
process.exit(0);
