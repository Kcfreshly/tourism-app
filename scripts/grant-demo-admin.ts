import { eq } from "drizzle-orm";
import { db } from "../src/database/client";
import { user, audit } from "../src/database/schema";
import { assertDemo } from "../src/config/environment";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
assertDemo();
const email =
  process.argv[2] === "--qa-fixture"
    ? JSON.parse(await readFile(".local/qa-account.json", "utf8")).email
    : process.argv[2]?.trim().toLowerCase();
if (!email)
  throw Error(
    "Usage: npm run demo:grant-admin -- fictional-email@example.test (stop local server first)",
  );
await db().transaction(async (tx) => {
  const [person] = await tx
    .update(user)
    .set({ role: "ADMIN" })
    .where(eq(user.email, email))
    .returning();
  if (!person) throw Error("Create the demo account through /account first.");
  await tx.insert(audit).values({
    id: randomUUID(),
    actorId: "local-owner-cli",
    action: "DEMO_ADMIN_GRANTED",
    entityId: person.id,
    details: { mode: "demo" },
  });
});
console.log("Local demo administrator role granted to the existing account.");
process.exit(0);
