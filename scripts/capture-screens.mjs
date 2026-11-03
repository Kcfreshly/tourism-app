// Captures the key customer screens at desktop, tablet and mobile widths.
// Usage (dev server running): node scripts/capture-screens.mjs <label>
// Writes to artifacts/redesign/<label>/. Creates one retained fictional draft.
import { fileURLToPath } from "node:url";
process.env.PLAYWRIGHT_BROWSERS_PATH ??= fileURLToPath(
  new URL("../.local/playwright-browsers", import.meta.url),
);
const { chromium } = await import("@playwright/test");
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";

const label = process.argv[2] ?? "current";
const base = process.env.PUBLIC_APP_URL ?? "http://127.0.0.1:3000";
const output = new URL(`../artifacts/redesign/${label}/`, import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: "chromium" });
const viewports = {
  desktop: { width: 1440, height: 900 },
  tablet: { width: 768, height: 1024 },
  mobile: { width: 390, height: 844 },
};
const errors = [];
const day = (offset) =>
  new Date(Date.now() + (35 + offset) * 86400000).toISOString().slice(0, 10);
const setup = await browser.newContext();
async function api(path, method = "GET", data) {
  const response = await setup.request.fetch(base + path, {
    method,
    headers: { Origin: base },
    ...(data ? { data } : {}),
  });
  if (!response.ok())
    throw Error(
      `${method} ${path}: ${response.status()} ${await response.text()}`,
    );
  return (await response.json()).data;
}
const offers = await api("/api/v1/experiences");
const find = (id) => offers.find((e) => e.offer.id === id);
const nature = find("offer-nature-walk"),
  gallery = find("offer-gallery"),
  cooking = find("offer-cooking");
const block = (offer, start, end, date = day(0)) => ({
  id: randomUUID(),
  localDate: date,
  startTime: start,
  endTime: end,
  kind: "EXPERIENCE",
  offerId: offer.offer.id,
  title: offer.name.replace(/\s*[—-]\s*DEMO$/, ""),
  locked: false,
});
const trip = await api("/api/v1/trips", "POST", {
  cityId: "lagos",
  draftName: "A week of Lagos discoveries",
  startDate: day(0),
  endDate: day(6),
  adults: 2,
  interests: ["nature", "culture", "local-life", "food"],
  occasion: "",
  pace: "BALANCED",
  accommodation: "Lekki starting area",
  zoneId: "LEKKI",
  assistance: "DRIVER_ONLY",
  budgetMinor: 150000000,
  budgetBasis: "PARTY",
  dietary: "",
  alcohol: "OPTIONAL",
  walking: "MODERATE",
  selectedOfferIds: [],
});
await api(`/api/v1/trips/${trip.id}/workspace`, "PUT", {
  expectedVersion: trip.version,
  items: [
    block(nature, "09:00", "11:00"),
    {
      id: randomUUID(),
      localDate: day(0),
      startTime: "12:00",
      endTime: "12:45",
      kind: "CUSTOM",
      offerId: null,
      title: "Lunch with family",
      locked: true,
    },
    block(gallery, "14:00", "15:30"),
  ],
  services: {
    assistance: "DRIVER_ONLY",
    vehicleWindows: { [day(0)]: { startTime: "08:00", hours: 8 } },
    guideItemIds: [],
    guideDays: [],
  },
});
const cookies = await setup.cookies();
const bucket = [nature.offer.id, gallery.offer.id, cooking.offer.id];

async function shoot(
  name,
  viewport,
  path,
  { trip: withTrip = true, full = false, act } = {},
) {
  const context = await browser.newContext({ viewport: viewports[viewport] });
  await context.addCookies(cookies);
  await context.addInitScript(
    ({ id, bucket }) => {
      localStorage.setItem("tourism.bucket.v1", JSON.stringify(bucket));
      if (id) localStorage.setItem("tourism.onboardedTrip", id);
    },
    { id: withTrip ? trip.id : "", bucket },
  );
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(`${name}: ${error.message}`));
  await page.goto(base + path.replace("{trip}", trip.id), {
    waitUntil: "networkidle",
  });
  await page.waitForTimeout(400);
  if (act) await act(page);
  await page.waitForTimeout(300);
  await page.screenshot({
    path: fileURLToPath(new URL(`${name}-${viewport}.png`, output)),
    fullPage: full,
  });
  await context.close();
}
const openDetail = async (page) => {
  await page.locator(".experience-trigger--title").first().click();
  await page.locator("dialog[open]").waitFor();
};
for (const viewport of Object.keys(viewports)) {
  await shoot("01-home", viewport, "/", { trip: false, full: true });
  await shoot("02-explore", viewport, "/explore", { full: true });
  await shoot("03-detail-overlay", viewport, "/explore", { act: openDetail });
  await shoot("04-onboarding", viewport, "/explore", {
    trip: false,
    act: async (page) => {
      await page.getByRole("button", { name: "Plan my trip" }).first().click();
      await page.locator("dialog[open]").waitFor();
    },
  });
  await shoot("05-kemi-intake", viewport, "/plan/new?mode=chat&fresh=1", {
    trip: false,
  });
  await shoot("06-planner", viewport, "/trips/{trip}/plan", {
    act: async (page) => page.locator(".schedule-block").first().waitFor(),
  });
  if (viewport !== "desktop")
    await shoot("07-planner-library", viewport, "/trips/{trip}/plan", {
      act: async (page) => {
        await page
          .locator(".schedule-block")
          .first()
          .waitFor({ state: "attached" });
        await page
          .getByRole("button", { name: /^Activities/ })
          .first()
          .click();
      },
    });
  await shoot("08-price-summary", viewport, "/trips/{trip}/plan", {
    act: async (page) => {
      await page
        .locator(".schedule-block")
        .first()
        .waitFor({ state: "attached" });
      // Wide screens show the breakdown panel instead of the pop-over.
      const popover = page.locator(".price-popover summary");
      if (await popover.isVisible()) await popover.click();
    },
  });
  await shoot("09-my-trips", viewport, "/trips", { full: true });
  await shoot("10-services", viewport, "/trips/{trip}/services", {
    full: true,
  });
  await shoot("11-experience-page", viewport, "/experiences/gallery", {
    full: true,
  });
  await shoot("12-day-view", viewport, "/trips/{trip}/today", { full: true });
}
await writeFile(
  fileURLToPath(new URL("errors.json", output)),
  JSON.stringify({ trip: trip.id, errors }, null, 2),
);
console.log(
  `Captured to artifacts/redesign/${label}; ${errors.length} page errors`,
);
await browser.close();
