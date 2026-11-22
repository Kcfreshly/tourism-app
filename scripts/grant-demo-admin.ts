import { eq } from "drizzle-orm";
import { db } from "../src/database/client";
import { user, audit } from "../src/database/schema";
import { assertDemo } from "../src/config/environment";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
assertDemo();
// `--super` grants SUPER_ADMIN, which can also delete listings.
const args = process.argv.slice(2);
const role = args.includes("--super") ? "SUPER_ADMIN" : "ADMIN";
const target = args.find((a) => a !== "--super");
const email =
  target === "--qa-fixture"
    ? JSON.parse(await readFile(".local/qa-account.json", "utf8")).email
    : target?.trim().toLowerCase();
if (!email)
  throw Error(
    "Usage: npm run demo:grant-admin -- fictional-email@example.test [--super] (stop local server first)",
  );
await db().transaction(async (tx) => {
  const [person] = await tx
    .update(user)
    .set({ role })
    .where(eq(user.email, email))
    .returning();
  if (!person) throw Error("Create the demo account through /account first.");
  await tx.insert(audit).values({
    id: randomUUID(),
    actorId: "local-owner-cli",
    action: "DEMO_ADMIN_GRANTED",
    entityId: person.id,
    details: { mode: "demo", role },
  });
});
console.log(
  role === "SUPER_ADMIN"
    ? "Local demo super admin role granted to the existing account."
    : "Local demo administrator role granted to the existing account.",
);
process.exit(0);
