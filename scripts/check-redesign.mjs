// Browser journey check for the redesigned customer screens.
// Run with the dev server up: node scripts/check-redesign.mjs
// Creates one retained fictional guest draft. No payments or bookings.
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

  // Explore: save two activities; tray, pill and bucket view agree.
  await page.goto(`${base}/explore`);
  const cards = page.locator(".experience.card");
  await cards
    .nth(0)
    .getByRole("button", { name: /Add to bucket/ })
    .click();
  await cards
    .nth(1)
    .getByRole("button", { name: /Add to bucket/ })
    .click();
  await expect(page.locator(".bucket-pill .bucket-count")).toHaveText("2");
  const tray = page.getByRole("region", { name: "Your bucket" });
  await expect(tray).toContainText("2");
  await tray.getByRole("button", { name: "View bucket" }).click();
  await expect(page.locator(".results-bar")).toContainText(
    "2 experiences in your bucket",
  );
  await page.getByRole("button", { name: "Clear bucket" }).click();
  const clear = page.getByRole("dialog", { name: "Clear your bucket" });
  await clear.getByRole("button", { name: "Keep activities" }).click();
  await expect(cards).toHaveCount(2);
  await page.getByRole("button", { name: "Keep exploring" }).click();
  await expect(cards).toHaveCount(12);
  checks.push(
    "Explore: save, bucket tray/pill count, bucket view, clear cancel, return to all.",
  );

  // Onboarding overlay: Escape, Close and backdrop all dismiss.
  const plan = tray.getByRole("button", { name: "Plan my trip" });
  const sheet = page.locator(".onboarding-overlay");
  await plan.click();
  await expect(sheet).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(sheet).toBeHidden();
  await plan.click();
  await sheet.getByRole("button", { name: "Close" }).click();
  await expect(sheet).toBeHidden();
  await plan.click();
  await expect(sheet).toBeVisible();
  await page.waitForTimeout(300);
  await page.mouse.click(8, 450);
  await expect(sheet).toBeHidden();
  checks.push(
    "Onboarding overlay closes with Escape, Close and a backdrop click.",
  );

  // Kemi -> review -> save opens the planner with the bucket preserved.
  await plan.click();
  await sheet
    .getByLabel("Your trip, in your own words")
    .fill(
      "2026-12-04 to 2026-12-08, 2 adults. We love art and food. Base: Lekki.",
    );
  await sheet.getByRole("button", { name: "Review my trip summary" }).click();
  await expect(
    sheet.getByRole("heading", { name: "Does this feel like your trip?" }),
  ).toBeVisible();
  await expect(sheet.locator(".trip-summary-grid")).toContainText("2 adults");
  await sheet.getByRole("button", { name: "Save and open planner" }).click();
  await page.waitForURL(/\/trips\/[^/]+\/plan$/);
  const library = page.locator("#planner-library-panel");
  await library.getByRole("button", { name: /My Bucket/ }).click();
  await expect(library.locator(".planner-activity-card")).toHaveCount(2);
  checks.push(
    "Kemi onboarding saves the profile and opens the planner with both bucket items.",
  );

  // Price summary opens; day view renders the same trip.
  await page.locator(".price-popover summary").click();
  await expect(
    page.getByRole("heading", { name: "Cost breakdown" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("link", { name: "Day view" }).click();
  await expect(page.locator(".pocket h1")).toBeVisible();
  await expect(page.locator(".pocket-nav")).toBeVisible();
  checks.push("Price breakdown and pocket day view render for the new trip.");

  // Skip link is the first tab stop.
  await page.goto(`${base}/`);
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Skip to content" }),
  ).toBeFocused();
  checks.push("Skip link is the first keyboard stop.");

  // Mobile menu and horizontal overflow at three widths.
  for (const [width, height] of [
    [1440, 900],
    [768, 1024],
    [390, 844],
  ]) {
    await page.setViewportSize({ width, height });
    for (const path of [
      "/",
      "/explore",
      "/plan/new?fresh=1",
      "/trips",
      "/account",
      "/photo-credits",
    ]) {
      await page.goto(base + path);
      await page.waitForLoadState("networkidle");
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      );
      if (overflow > 0)
        throw Error(`${path} overflows by ${overflow}px at ${width}px`);
    }
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${base}/explore`);
  const toggle = page.getByRole("button", { name: "Menu" });
  await toggle.click();
  await expect(page.locator("#site-nav")).toBeVisible();
  await page.locator("#site-nav a").first().focus();
  await page.keyboard.press("Escape");
  await expect(page.locator("#site-nav")).toBeHidden();
  await expect(toggle).toBeFocused();
  checks.push(
    "No horizontal overflow on public pages at 1440/768/390px; mobile menu opens and closes with Escape.",
  );

  if (errors.length) throw Error(`Page errors: ${errors.join("; ")}`);
  console.log(
    `PASS: ${checks.length} redesign journey checks.\n- ${checks.join("\n- ")}`,
  );
} finally {
  await browser.close();
}
