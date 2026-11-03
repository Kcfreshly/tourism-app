// Browser journey check for the cost panel, combined guides and checkout.
// Run with the dev server up: node scripts/check-checkout.mjs
// Creates one fictional demo account and trip. No payment is taken.
import { fileURLToPath } from "node:url";
process.env.PLAYWRIGHT_BROWSERS_PATH ??= fileURLToPath(
  new URL("../.local/playwright-browsers", import.meta.url),
);
const { chromium, expect } = await import("@playwright/test");

const base = process.env.PUBLIC_APP_URL ?? "http://127.0.0.1:3000";
const browser = await chromium.launch({ headless: true, channel: "chromium" });
const checks = [];
const errors = [];
try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`${base}/account`);
  await page.waitForLoadState("networkidle");
  if (await page.getByRole("button", { name: "Create account" }).count()) {
    await page.getByRole("button", { name: "Create account" }).click();
    await page.getByLabel("Display name").fill("Checkout check");
    await page.getByLabel("Email").fill(`checkout-${Date.now()}@example.test`);
    await page.getByLabel("Password").fill("demo-checkout-2026");
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

  // A 7-day trip with activities on the first two days only.
  const tripId = await page.evaluate(async () => {
    const response = await fetch("/api/v1/trips", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cityId: "lagos",
        draftName: "Checkout check",
        startDate: "2026-11-10",
        endDate: "2026-11-16",
        adults: 2,
        interests: ["nature", "culture"],
        occasion: "",
        pace: "BALANCED",
        accommodation: "Fictional hotel, Lekki",
        zoneId: "LEKKI",
        assistance: "DRIVER_ONLY",
        budgetMinor: 0,
        budgetBasis: "PARTY",
        dietary: "",
        alcohol: "OPTIONAL",
        walking: "MODERATE",
        selectedOfferIds: [],
      }),
    });
    const created = await response.json();
    if (!response.ok) throw Error(JSON.stringify(created));
    const id = created.data.id;
    const workspace = await (
      await fetch(`/api/v1/trips/${id}/workspace`)
    ).json();
    const item = (localDate, offerId, startTime, endTime) => ({
      id: crypto.randomUUID(),
      localDate,
      startTime,
      endTime,
      kind: "EXPERIENCE",
      offerId,
      title: offerId,
      locked: false,
    });
    const window = { startTime: "08:00", hours: 8 };
    const saved = await fetch(`/api/v1/trips/${id}/workspace`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        expectedVersion: workspace.data.trip.version,
        items: [
          item("2026-11-10", "offer-nature-walk", "09:00", "11:00"),
          item("2026-11-10", "offer-gallery", "13:00", "14:30"),
          item("2026-11-11", "offer-beach", "10:00", "13:00"),
        ],
        services: {
          assistance: "DRIVER_ONLY",
          vehicleWindows: { "2026-11-10": window, "2026-11-11": window },
          guideItemIds: [],
          guideDays: [],
        },
      }),
    });
    if (!saved.ok) throw Error(await saved.text());
    return id;
  });

  // The cost panel sits beside a narrower day timeline.
  await page.goto(`${base}/trips/${tripId}/plan`);
  const panel = page.locator(".planner-cost-panel");
  await expect(panel.locator(".trip-cost-days > li")).toHaveCount(7);
  await expect(panel.locator(".trip-cost-sub")).toContainText(
    "2 of 7 days planned",
  );
  const [schedule, cost] = [
    await page.locator(".planner-schedule").boundingBox(),
    await panel.boundingBox(),
  ];
  expect(cost.x).toBeGreaterThan(schedule.x + schedule.width);
  expect(Math.abs(cost.height - schedule.height)).toBeLessThan(4);
  checks.push("Planner: per-day cost panel beside the timeline.");

  // Empty days prompt, never block.
  await panel.getByRole("button", { name: "Review and checkout" }).click();
  const prompt = page.locator(".checkout-prompt");
  await expect(prompt.locator("h2")).toHaveText(
    "5 of 7 days have nothing planned",
  );
  await prompt
    .locator(".checkout-prompt-days li")
    .first()
    .getByRole("button", { name: "Plan this day" })
    .click();
  await expect(prompt).toBeHidden();
  await expect(page.locator(".schedule-heading h2").first()).toHaveText(
    "Thursday 12 November",
  );
  await panel.getByRole("button", { name: "Review and checkout" }).click();
  await prompt.getByRole("button", { name: "Continue to checkout" }).click();
  await page.waitForURL(/\/checkout$/);
  await expect(page.locator(".checkout-free-days")).toContainText(
    "5 days are left free",
  );
  await expect(page.locator(".checkout-blockers")).toHaveCount(0);
  await expect(page.locator(".checkout-pay > button")).toBeDisabled();
  checks.push("Checkout: empty-day prompt, plan-this-day, continue anyway.");

  // Guides combine; a full-day guide is never charged twice.
  await page.goto(`${base}/trips/${tripId}/services`);
  await page.getByText("Guides for chosen activities").click();
  await page.getByText("Full-day guide", { exact: true }).click();
  await page.getByText("Full-day guide on this day").click();
  await expect(
    page.locator(".service-day label.check", { hasText: "covered by" }),
  ).toHaveCount(2);
  await expect(page.locator(".trip-cost-totals")).toContainText("₦25,000");
  checks.push("Services: driver, activity guides and full-day guide combine.");

  // Narrow screens: the panel stacks under the planner without overflow.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${base}/trips/${tripId}/plan`);
  await page.locator(".trip-cost").waitFor();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - innerWidth,
    ),
  ).toBeLessThanOrEqual(0);
  checks.push("Mobile: cost panel stacks; no page overflow.");

  expect(errors).toEqual([]);
  console.log(checks.map((check) => `✓ ${check}`).join("\n"));
} finally {
  await browser.close();
}
