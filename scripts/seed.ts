import { randomUUID } from "node:crypto";
import Ajv from "ajv/dist/2020.js";
import source from "../tourism-v1-handoff/data/experiences.demo.json";
import events from "../src/data/events.demo.json";
import nightlife from "../src/data/nightlife.demo.json";
import contract from "../tourism-v1-handoff/contracts/catalogue.schema.json";
import { db } from "../src/database/client";
import { catalogue, packages } from "../src/database/schema";
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
for (const record of records)
  await db()
    .insert(catalogue)
    .values({
      id: randomUUID(),
      seedKey: record.id,
      status: "DEMO_PUBLISHED",
      record,
    })
    .onConflictDoNothing({ target: catalogue.seedKey });
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
