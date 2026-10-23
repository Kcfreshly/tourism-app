import { randomUUID } from "node:crypto";
import Ajv from "ajv/dist/2020.js";
import source from "../tourism-v1-handoff/data/experiences.demo.json";
import contract from "../tourism-v1-handoff/contracts/catalogue.schema.json";
import { db } from "../src/server/db";
import { catalogue } from "../src/server/schema";
import { assertDemo } from "../src/server/config";
assertDemo();
const validate = new Ajv().compile(contract);
if (!validate(source)) throw Error(JSON.stringify(validate.errors));
for (const record of source.experiences)
  await db()
    .insert(catalogue)
    .values({
      id: randomUUID(),
      seedKey: record.id,
      status: "DEMO_PUBLISHED",
      record,
    })
    .onConflictDoNothing({ target: catalogue.seedKey });
console.log(
  `${source.experiences.length} fictional catalogue seeds ensured; existing edits preserved.`,
);
process.exit(0);
