// Account bucket check: guest picks reach the database at sign-up, return on
// a fresh browser after sign-in, and later changes are saved. Also checks the
// API's guards. Run with the dev server up: node scripts/check-bucket.mjs
// Creates one fictional demo account. No payment, supplier or model is called.
import { fileURLToPath } from "node:url";
process.env.PLAYWRIGHT_BROWSERS_PATH ??= fileURLToPath(
  new URL("../.local/playwright-browsers", import.meta.url),
);
const { chromium, expect } = await import("@playwright/test");

const base = process.env.PUBLIC_APP_URL ?? "http://127.0.0.1:3000";
const email = `bucket-${Date.now()}@example.test`;
const password = "demo-bucket-2026";
const browser = await chromium.launch({ headless: true, channel: "chromium" });
const checks = [];
const errors = [];
const api = (page, method, body) =>
  page.evaluate(
    async ([method, body]) => {
      const r = await fetch("/api/v1/bucket", {
        method,
        headers: { "Content-Type": "application/json" },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      return { status: r.status, body: await r.json() };
    },
    [method, body],
  );
async function fresh() {
  const page = await (
    await browser.newContext({ viewport: { width: 1440, height: 900 } })
  ).newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  return page;
}
async function account(page, create) {
  await page.goto(`${base}/account`);
  await page.waitForLoadState("networkidle");
  if (create) {
    await page.getByRole("button", { name: "Create account" }).click();
    await page.getByLabel("Display name").fill("Bucket check");
  }
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.locator("main form button[type=submit]").click();
  // Signed in once the auth session exists, however long the server takes.
  await expect
    .poll(
      () =>
        page.evaluate(async () => {
          const r = await fetch("/api/auth/get-session");
          return !!(await r.json())?.user;
        }),
      { timeout: 20000 },
    )
    .toBe(true);
}
const pill = (page) => page.locator(".bucket-pill .bucket-count");
try {
  // Guests can't read a server bucket, and writes need the app's origin.
  const guest = await fresh();
  await guest.goto(`${base}/explore`);
  expect((await api(guest, "GET")).status).toBe(401);
  const foreign = await fetch(`${base}/api/v1/bucket`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ offerIds: [], expectedVersion: 0 }),
  });
  expect(foreign.status).toBe(403);
  checks.push("API: guests get 401; cross-origin writes get 403.");

  // Picks made as a guest are saved to the account at sign-up.
  const cards = guest.locator(".experience.card");
  await cards
    .nth(0)
    .getByRole("button", { name: /Add to bucket/ })
    .click();
  await cards
    .nth(1)
    .getByRole("button", { name: /Add to bucket/ })
    .click();
  await expect(pill(guest)).toHaveText("2");
  await account(guest, true);
  await guest.goto(`${base}/explore`);
  await expect
    .poll(async () => (await api(guest, "GET")).body.data.offerIds.length)
    .toBe(2);
  const saved = (await api(guest, "GET")).body.data;
  checks.push("Sign-up: the guest's 2 picks are saved to the account.");

  // API guards on a real account.
  const stale = await api(guest, "PUT", {
    offerIds: saved.offerIds,
    expectedVersion: saved.version - 1,
  });
  expect(stale.status).toBe(409);
  const tooMany = await api(guest, "PUT", {
    offerIds: Array.from({ length: 31 }, (_, i) => `offer-${i}`),
    expectedVersion: saved.version,
  });
  expect(tooMany.status).toBe(422);
  const cleaned = await api(guest, "PUT", {
    offerIds: [...saved.offerIds, "offer-does-not-exist"],
    expectedVersion: saved.version,
  });
  expect(cleaned.status).toBe(200);
  expect(cleaned.body.data.offerIds).toEqual(saved.offerIds);
  checks.push("API: stale version 409, over 30 ids 422, unknown ids dropped.");

  // Sign out empties this browser; signing in elsewhere brings it back.
  await guest.goto(`${base}/account`);
  await guest.getByRole("button", { name: "Sign out" }).click();
  await expect(pill(guest)).toHaveText("0");
  const other = await fresh();
  await account(other, false);
  await other.goto(`${base}/explore`);
  await expect(pill(other)).toHaveText("2");
  checks.push("Sign-in on a fresh browser restores the saved bucket.");

  // Later changes are saved shortly after they're made.
  await other
    .locator(".experience.card")
    .first()
    .getByRole("button", { name: /Remove from bucket/ })
    .click();
  await expect(pill(other)).toHaveText("1");
  await expect
    .poll(async () => (await api(other, "GET")).body.data.offerIds.length, {
      timeout: 5000,
    })
    .toBe(1);
  checks.push("A removal is saved to the account within the save delay.");

  expect(errors).toEqual([]);
  console.log(checks.map((check) => `✓ ${check}`).join("\n"));
} finally {
  await browser.close();
}
