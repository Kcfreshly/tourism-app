import assert from "node:assert/strict";
import { randomUUID, randomBytes } from "node:crypto";
import { writeFile, mkdir } from "node:fs/promises";
const base = process.env.PUBLIC_APP_URL ?? "http://127.0.0.1:3000";
async function call(path, body, cookie, method = "POST") {
  return fetch(base + path, {
    method,
    headers: {
      Origin: base,
      "Content-Type": "application/json",
      ...(cookie ? { Cookie: cookie } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}
const profile = {
  cityId: "lagos",
  startDate: "2026-11-10",
  endDate: "2026-11-16",
  adults: 2,
  interests: ["nature"],
  occasion: "Fictional account test",
  pace: "BALANCED",
  accommodation: "",
  zoneId: "UNDECIDED",
  assistance: "DRIVER_ONLY",
  budgetMinor: 150000000,
  budgetBasis: "PARTY",
  dietary: "",
  alcohol: "OPTIONAL",
  walking: "MODERATE",
  selectedOfferIds: [],
};
const created = await call("/api/v1/trips", profile);
assert.equal(created.status, 201, await created.clone().text());
const trip = (await created.json()).data;
const guest = created.headers
  .getSetCookie()
  .map((c) => c.split(";")[0])
  .join("; ");
const email = `demo-${randomUUID()}@example.test`,
  password = randomBytes(24).toString("base64url");
const signed = await call(
  "/api/auth/sign-up/email",
  { email, password, name: "Fictional QA traveller", role: "ADMIN" },
  guest,
);
assert.equal(signed.status, 200, await signed.clone().text());
const body = await signed.json();
assert.equal(body.user.role, "CUSTOMER");
const account = signed.headers
  .getSetCookie()
  .filter((c) => !c.startsWith("tourism-session="))
  .map((c) => c.split(";")[0])
  .join("; ");
assert(account);
const merged = await call("/api/v1/account/merge", {}, `${guest}; ${account}`);
assert.equal(merged.status, 200, await merged.clone().text());
assert.equal((await merged.json()).data.merged, 1);
assert.equal(
  (await (await call("/api/v1/account/merge", {}, account)).json()).data.merged,
  0,
);
assert.equal(
  (await call(`/api/v1/trips/${trip.id}`, undefined, guest, "GET")).status,
  401,
);
assert.equal(
  (await call(`/api/v1/trips/${trip.id}`, undefined, account, "GET")).status,
  200,
);
assert.equal(
  (await call("/api/v1/admin/catalogue", undefined, account, "GET")).status,
  403,
);
const signedOut = await call("/api/v1/session", undefined, account, "DELETE");
assert.equal(signedOut.status, 200, await signedOut.clone().text());
assert.equal(
  (await call(`/api/v1/trips/${trip.id}`, undefined, account, "GET")).status,
  401,
);
const login = await call("/api/auth/sign-in/email", { email, password });
assert.equal(login.status, 200, await login.clone().text());
const account2 = login.headers
  .getSetCookie()
  .map((c) => c.split(";")[0])
  .join("; ");
assert.equal(
  (await call(`/api/v1/trips/${trip.id}`, undefined, account2, "GET")).status,
  200,
);
await mkdir(".local", { recursive: true });
await writeFile(
  ".local/qa-account.json",
  JSON.stringify({ email, password, cookie: account2, tripId: trip.id }),
);
console.log(
  "PASS: signup/sign-in, public role escalation denied, exactly-once guest merge, old guest access revoked, account reload after sign-out/sign-in, session invalidation.",
);
console.log(
  "Fictional QA account state stored privately in ignored .local/qa-account.json for follow-up admin tests.",
);
