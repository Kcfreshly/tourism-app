import { fileURLToPath } from "node:url";
import { mkdir, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
process.env.PLAYWRIGHT_BROWSERS_PATH ??= fileURLToPath(
  new URL("../.local/playwright-browsers", import.meta.url),
);
const { chromium, expect } = await import("@playwright/test");
const base = process.env.PUBLIC_APP_URL ?? "http://127.0.0.1:3000";
const output = new URL("../artifacts/overlays/", import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  channel: "chromium",
  ignoreDefaultArgs: ["--hide-scrollbars"],
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
});
const page = await context.newPage(),
  errors = [],
  checks = [];
page.on("pageerror", (error) => errors.push(error.message));
async function api(path, method = "GET", data) {
  const response = await context.request.fetch(base + path, {
    method,
    headers: { Origin: base },
    ...(data ? { data } : {}),
  });
  if (!response.ok()) throw Error(await response.text());
  return (await response.json()).data;
}
const date = new Date(Date.now() + 40 * 86400000).toISOString().slice(0, 10);
const profile = {
  cityId: "lagos",
  draftName: "Overlay context check",
  startDate: date,
  endDate: date,
  adults: 2,
  interests: ["nature", "culture"],
  occasion: "",
  pace: "BALANCED",
  accommodation: "Lekki base",
  zoneId: "LEKKI",
  assistance: "DRIVER_ONLY",
  budgetMinor: 150000000,
  budgetBasis: "PARTY",
  dietary: "",
  alcohol: "OPTIONAL",
  walking: "MODERATE",
  selectedOfferIds: [],
};
const trip = await api("/api/v1/trips", "POST", profile);
const item = {
  id: randomUUID(),
  localDate: date,
  startTime: "09:00",
  endTime: "11:00",
  kind: "EXPERIENCE",
  offerId: "offer-nature-walk",
  title: "Nature visit",
  locked: false,
};
await api(`/api/v1/trips/${trip.id}/workspace`, "PUT", {
  expectedVersion: trip.version,
  items: [item],
  services: {
    assistance: "DRIVER_ONLY",
    vehicleWindows: { [date]: { startTime: "08:00", hours: 8 } },
    guideItemIds: [],
    guideDays: [],
  },
});
await context.addInitScript((id) => {
  if (!localStorage.getItem("tourism.overlay-test")) {
    localStorage.setItem("tourism.overlay-test", "1");
    localStorage.setItem(
      "tourism.bucket.v1",
      JSON.stringify(["offer-nature-walk"]),
    );
    localStorage.setItem("tourism.onboardedTrip", id);
  }
}, trip.id);
// Wait for the dialog's opening animation so measurements are of its resting layout.
const settled = () =>
  page
    .locator(".reading-overlay")
    .evaluate((el) =>
      Promise.all(el.getAnimations({ subtree: true }).map((a) => a.finished)),
    );
const modal = page.locator(".reading-overlay"),
  library = page.locator("#planner-library-panel");
async function snapshot() {
  return page.evaluate(() => ({
    x: window.scrollX,
    y: window.scrollY,
    library: document.querySelector("#planner-library-panel .library-items")
      ?.scrollTop,
    schedule: document.querySelector(".schedule-scroll")?.scrollTop,
  }));
}
async function capture(name) {
  await page.screenshot({
    path: fileURLToPath(new URL(name, output)),
    fullPage: false,
  });
}
try {
  await page.goto(`${base}/trips/${trip.id}/plan`);
  await expect(library.locator(".planner-activity-card").first()).toBeVisible();
  await library.getByLabel("Search activities").fill("DEMO");
  await page.locator(".schedule-scroll").evaluate((el) => (el.scrollTop = 80));
  // The second card's title stays fully visible after the list scrolls by 40px, so
  // the click does not auto-scroll the list before measuring.
  const trigger = library.locator(".activity-card-content h3 button").nth(1);
  await trigger.scrollIntoViewIfNeeded();
  await library.locator(".library-items").evaluate((el) => (el.scrollTop = 40));
  await page.evaluate(() => window.scrollTo(0, 40));
  const before = await snapshot(),
    saved = JSON.stringify(
      (await api(`/api/v1/trips/${trip.id}/workspace`)).trip.items,
    );
  await trigger.click();
  await expect(modal).toBeVisible();
  await settled();
  const info = modal.getByRole("region", { name: "Activity information" });
  const galleryBefore = await modal
    .locator(".experience-gallery")
    .boundingBox();
  const headerBefore = await modal.locator(".overlay-header").boundingBox(),
    footerBefore = await modal.locator(".overlay-footer").boundingBox();
  await info.click();
  await page.mouse.wheel(0, 500);
  await expect
    .poll(() => info.evaluate((el) => el.scrollTop))
    .toBeGreaterThan(0);
  expect(await modal.locator(".experience-gallery").boundingBox()).toEqual(
    galleryBefore,
  );
  expect(await modal.locator(".overlay-header").boundingBox()).toEqual(
    headerBefore,
  );
  expect(await modal.locator(".overlay-footer").boundingBox()).toEqual(
    footerBefore,
  );
  await expect(modal).toBeVisible();
  await settled();
  expect(await snapshot()).toEqual(before);
  expect(
    await page.evaluate(
      () => !!document.elementFromPoint(30, 65)?.closest(".site-chrome"),
    ),
  ).toBe(false);
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press("Tab");
    expect(
      await page.evaluate(() =>
        document
          .querySelector(".reading-overlay")
          .contains(document.activeElement),
      ),
    ).toBe(true);
  }
  await capture("desktop-reading.png");
  const content = await info.boundingBox();
  await page.mouse.move(content.x + 25, content.y + 35);
  await page.mouse.down();
  await page.mouse.move(4, 4, { steps: 8 });
  await page.mouse.up();
  await expect(modal).toBeVisible();
  await settled();
  await page.mouse.click(4, 4);
  await expect(modal).toHaveCount(0);
  await expect(trigger).toBeFocused();
  expect(await snapshot()).toEqual(before);
  checks.push(
    "Backdrop closes; inside click/scroll and inside-to-outside drag do not; gallery/header/footer remain stationary; background is inert; focus and all scroll positions restored.",
  );
  for (const method of ["Close", "Escape"]) {
    await trigger.click();
    await expect(modal).toBeVisible();
    await settled();
    if (method === "Close")
      await modal.getByRole("button", { name: "Close", exact: true }).click();
    else await page.keyboard.press("Escape");
    await expect(modal).toHaveCount(0);
    await expect(trigger).toBeFocused();
    expect(await snapshot()).toEqual(before);
  }
  await expect(library.getByLabel("Search activities")).toHaveValue("DEMO");
  expect(
    JSON.stringify(
      (await api(`/api/v1/trips/${trip.id}/workspace`)).trip.items,
    ),
  ).toBe(saved);
  checks.push(
    "Close and Escape restore focus, filters, page/panel scrolling and unchanged itinerary.",
  );
  for (const [width, height, name] of [
    [1280, 800, "laptop-overlay.png"],
    [768, 1024, "tablet-overlay.png"],
    [390, 844, "mobile-overlay.png"],
    [390, 480, "short-mobile-overlay.png"],
    [844, 390, "landscape-overlay.png"],
  ]) {
    await page.setViewportSize({ width, height });
    if (width <= 900)
      await page
        .getByRole("button", { name: "Activities", exact: true })
        .click();
    await trigger.click();
    await expect(modal).toBeVisible();
    await settled();
    const gallery = await modal.locator(".experience-gallery").boundingBox();
    const frame = await modal.boundingBox();
    expect(frame.y).toBeGreaterThanOrEqual(0);
    expect(frame.y + frame.height).toBeLessThanOrEqual(height + 1);
    for (const button of await modal
      .locator(
        ".overlay-header button,.overlay-actions button,.overlay-actions a",
      )
      .all()) {
      const box = await button.boundingBox();
      expect(box.y).toBeGreaterThanOrEqual(frame.y);
      expect(box.y + box.height).toBeLessThanOrEqual(frame.y + frame.height);
    }
    const reading = modal.locator(".experience-information");
    const readable = await reading.boundingBox();
    expect(readable.height).toBeGreaterThan(60);
    await reading.evaluate((el) => (el.scrollTop = el.scrollHeight));
    expect(await modal.locator(".experience-gallery").boundingBox()).toEqual(
      gallery,
    );
    if (width === 390 && height === 480)
      expect(gallery.height).toBeLessThanOrEqual(65);
    await reading.evaluate((el) => (el.scrollTop = 0));
    await capture(name);
    await page.keyboard.press("Escape");
    await expect(modal).toHaveCount(0);
    checks.push(
      `${width}x${height}: stationary image, reachable actions, scrollable information, modal within viewport.`,
    );
  }
  // Removing a saved card while reading must not unmount the overlay host.
  await page.setViewportSize({ width: 1440, height: 900 });
  await library.getByRole("button", { name: /My Bucket/ }).click();
  await library.locator(".activity-card-content h3 button").first().click();
  await modal.getByRole("button", { name: /Remove from bucket/ }).click();
  await expect(modal).toBeVisible();
  await settled();
  await page.keyboard.press("Escape");
  await expect(modal).toHaveCount(0);
  await expect(library.getByText("Your bucket is empty.")).toBeVisible();
  await expect(
    library.getByRole("region", { name: "Scrollable experience list" }),
  ).toBeFocused();
  expect(
    JSON.stringify(
      (await api(`/api/v1/trips/${trip.id}/workspace`)).trip.items,
    ),
  ).toBe(saved);
  checks.push(
    "Removing the originating card from My Bucket leaves the open dialog intact and returns focus to the activity list on close.",
  );
  await page.goto(`${base}/explore`);
  await expect(page.locator(".experience.card").first()).toBeVisible();
  for (const [width, height, name] of [
    [1440, 900, "header-desktop-scrolled.png"],
    [390, 844, "header-mobile-scrolled.png"],
  ]) {
    await page.setViewportSize({ width, height });
    await page.evaluate(() => window.scrollTo(0, 650));
    await expect
      .poll(() => page.evaluate(() => window.scrollY))
      .toBeGreaterThan(400);
    await expect
      .poll(() =>
        page
          .locator(".site-chrome")
          .evaluate((el) => Math.round(el.getBoundingClientRect().top)),
      )
      .toBe(0);
    await capture(name);
    checks.push(
      `${width}px: opaque website header remains at viewport top while the page scrolls.`,
    );
  }
  await page.goto(`${base}/explore#main`);
  await expect(page.locator(".experience.card").first()).toBeVisible();
  await expect
    .poll(() =>
      page.locator("main").evaluate((el) => el.getBoundingClientRect().top),
    )
    .toBeGreaterThanOrEqual(
      (await page
        .locator(".site-chrome")
        .evaluate((el) => el.getBoundingClientRect().bottom)) - 1,
    );
  const focusTarget = page.locator(".experience.card h3 button").first();
  await focusTarget.evaluate((element) =>
    window.scrollTo(
      0,
      window.scrollY + element.getBoundingClientRect().top - 35,
    ),
  );
  await focusTarget.focus();
  await expect
    .poll(async () => (await focusTarget.boundingBox()).y)
    .toBeGreaterThanOrEqual(
      (await page
        .locator(".site-chrome")
        .evaluate((el) => el.getBoundingClientRect().bottom)) - 1,
    );
  checks.push(
    "Keyboard-focused activity links scroll into view below the fixed header.",
  );
  expect(errors).toEqual([]);
  await writeFile(
    new URL("checks.json", output),
    JSON.stringify(
      {
        checks,
        errors,
        limitation:
          "Chromium responsive viewports; native mobile browsers were not exercised.",
      },
      null,
      2,
    ),
  );
  console.log(
    "PASS: overlay dismissal, drag guard, focus/state restoration, stationary media, short-screen actions and fixed-header layering/offset.",
  );
} catch (error) {
  await capture("failure.png");
  throw error;
} finally {
  await browser.close();
}
