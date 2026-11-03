// Browser journey check for dated events (What's on).
// Run with the dev server up: node scripts/check-events.mjs
// Creates one fictional demo account and guest draft. No payments or bookings.
import { fileURLToPath } from "node:url";
process.env.PLAYWRIGHT_BROWSERS_PATH ??= fileURLToPath(
  new URL("../.local/playwright-browsers", import.meta.url),
);
const { chromium, expect } = await import("@playwright/test");

const base = process.env.PUBLIC_APP_URL ?? "http://127.0.0.1:3000";
const browser = await chromium.launch({ headless: true, channel: "chromium" });
const checks = [];
const errors = [];
const titles = (locator) =>
  locator
    .locator(".event-card h3")
    .allInnerTexts()
    .then((all) => all.map((t) => t.trim()));
try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(error.message));

  // Explore without trip dates shows everything coming up.
  await page.goto(`${base}/explore`);
  const whatsOn = page.locator(".whats-on");
  await expect(whatsOn).toContainText("Coming up in Lagos");
  // The agenda opens with 4 dated rows, then reveals the rest on request.
  await expect(whatsOn.locator(".event-card")).toHaveCount(4);
  await whatsOn.getByRole("button", { name: "Show all 6 events" }).click();
  await expect(whatsOn.locator(".event-card")).toHaveCount(6);
  await page.getByRole("button", { name: "What’s on" }).click();
  await expect(page.locator(".experience.card")).toHaveCount(6);
  checks.push("Explore: upcoming events agenda, Show all, What’s on filter.");

  // Onboarding lists events for the chosen dates and saves them to the bucket.
  await page.goto(`${base}/plan/new?mode=form&fresh=1`);
  await page.waitForLoadState("networkidle");
  if (await page.getByRole("heading", { name: /Sign in to start/ }).count()) {
    await page.getByRole("button", { name: "Create account" }).click();
    await page.getByLabel("Display name").fill("Events check");
    await page.getByLabel("Email").fill(`events-${Date.now()}@example.test`);
    await page.getByLabel("Password").fill("demo-events-2026");
    await page.locator("main form button[type=submit]").click();
    await page.waitForURL(/\/plan\/new/);
  }
  const tripEvents = page.locator(".trip-events");
  await expect(tripEvents.locator(".event-card")).toHaveCount(4);
  expect(await titles(tripEvents)).toEqual([
    "Highlife & jazz night",
    "Creative & tech conference day pass",
    "Music studio & video set visit",
    "Afrobeats open-air concert",
  ]);
  await tripEvents
    .locator(".event-card", { hasText: "Afrobeats" })
    .getByRole("button", { name: /Add to bucket/ })
    .click();
  await expect(page.locator(".bucket-pill .bucket-count")).toHaveText("1");
  await page.getByLabel("Arrival date").fill("2026-12-18");
  await page.getByLabel("Departure date").fill("2026-12-28");
  await expect(tripEvents.locator(".event-card")).toHaveCount(2);
  await page.getByLabel("Arrival date").fill("2026-11-10");
  await page.getByLabel("Departure date").fill("2026-11-16");
  checks.push("Onboarding: events follow the chosen dates; saving to bucket.");

  await page.locator(".intake-form button[type=submit]").last().click();
  await expect(page.locator(".trip-review .event-card")).toHaveCount(4);
  await page.getByRole("button", { name: /Save my trip draft/ }).click();
  await expect
    .poll(() =>
      page.evaluate(() => localStorage.getItem("tourism.onboardedTrip")),
    )
    .toBeTruthy();
  const tripId = await page.evaluate(() =>
    localStorage.getItem("tourism.onboardedTrip"),
  );
  checks.push("Review: events shown in the summary; draft saved.");

  // Explore now narrows to the trip, with a way back to all upcoming.
  await page.goto(`${base}/explore`);
  await expect(whatsOn).toContainText("Happening during your trip");
  await expect(whatsOn.locator(".event-card")).toHaveCount(4);
  await whatsOn.getByRole("button", { name: "All upcoming" }).click();
  await whatsOn.getByRole("button", { name: "Show all 6 events" }).click();
  await expect(whatsOn.locator(".event-card")).toHaveCount(6);
  checks.push("Explore: During my dates and All upcoming.");

  // Planner: events marked on day tabs, only within the trip, jump to day.
  await page.goto(`${base}/trips/${tripId}/plan`);
  const library = page.locator(".library-items").first();
  await library.locator(".planner-activity-card").first().waitFor();
  await expect(page.locator(".day-chips").first()).toContainText("2 events");
  await page.getByLabel("Category").first().selectOption("events");
  const cards = library.locator(".planner-activity-card");
  await expect(cards).toHaveCount(4);
  const concert = cards.filter({ hasText: "Afrobeats" });
  await expect(concert.locator(".activity-unavailable")).toContainText(
    "Runs on Sat 14 Nov",
  );
  await concert.getByRole("button", { name: "Go to that day" }).click();
  await expect(concert.locator(".activity-fit")).toContainText(
    "fits from 19:00",
  );
  checks.push("Planner: day markers, trip-only events, Go to that day.");

  // Mobile: the agenda stacks within the page width; the last row and its
  // save button are reachable.
  const mobile = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const m = await mobile.newPage();
  m.on("pageerror", (error) => errors.push(error.message));
  await m.goto(`${base}/explore`);
  const last = m.locator(".whats-on .agenda-item").last();
  await last.scrollIntoViewIfNeeded();
  const lastBox = await last.boundingBox();
  expect(lastBox.x + lastBox.width).toBeLessThanOrEqual(390);
  await expect(
    last.getByRole("button", { name: /Add to bucket|Saved/ }),
  ).toBeInViewport();
  expect(
    await m.evaluate(() => document.documentElement.scrollWidth - innerWidth),
  ).toBeLessThanOrEqual(0);
  checks.push("Mobile: no page overflow; last event reachable.");

  expect(errors).toEqual([]);
  console.log(checks.map((check) => `✓ ${check}`).join("\n"));
} finally {
  await browser.close();
}
