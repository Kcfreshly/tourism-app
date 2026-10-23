import { fileURLToPath } from "node:url";
process.env.PLAYWRIGHT_BROWSERS_PATH ??= fileURLToPath(
  new URL("../.local/playwright-browsers", import.meta.url),
);
const { chromium, expect } = await import("@playwright/test");
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";

const base = process.env.PUBLIC_APP_URL ?? "http://127.0.0.1:3000";
const output = new URL("../artifacts/planner/", import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  channel: "chromium",
  ignoreDefaultArgs: ["--hide-scrollbars"],
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
const day = (offset) => {
  const value = new Date(Date.now() + (35 + offset) * 86400000);
  return value.toISOString().slice(0, 10);
};
const profile = {
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
};
async function api(path, method = "GET", data) {
  const response = await context.request.fetch(base + path, {
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
const nature = offers.find((e) => e.offer.id === "offer-nature-walk");
const gallery = offers.find((e) => e.offer.id === "offer-gallery");
const cooking = offers.find((e) => e.offer.id === "offer-cooking");
const full = offers.find((e) => e.kind === "FULL_DAY");
const fixedDay = Array.from({ length: 7 }, (_, i) => day(i)).find(
  (date) =>
    date !== day(0) &&
    cooking.availabilityLocal.days.includes(
      new Date(date + "T12:00:00Z").getUTCDay() || 7,
    ),
);
const fullDay = Array.from({ length: 7 }, (_, i) => day(i)).find(
  (date) =>
    date !== day(0) &&
    date !== fixedDay &&
    full.availabilityLocal.days.includes(
      new Date(date + "T12:00:00Z").getUTCDay() || 7,
    ),
);
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
const endOf = (start, duration) => {
  const [h, m] = start.split(":").map(Number);
  const n = h * 60 + m + duration;
  return `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`;
};
const natureItem = block(nature, "09:00", "11:00");
const galleryItem = block(gallery, "13:00", "14:30");
const fixedItem = block(
  cooking,
  cooking.sessions[0].startTime,
  endOf(cooking.sessions[0].startTime, cooking.sessions[0].durationMinutes),
  fixedDay,
);
const fullItem = block(
  full,
  full.availabilityLocal.opensAt,
  endOf(full.availabilityLocal.opensAt, full.durationMinMinutes),
  fullDay,
);
const items = [
  natureItem,
  galleryItem,
  {
    id: randomUUID(),
    localDate: day(0),
    startTime: "12:00",
    endTime: "12:30",
    kind: "CUSTOM",
    offerId: null,
    title: "Lunch with friends",
    locked: true,
  },
  fixedItem,
  fullItem,
];
const services = {
  assistance: "DRIVER_ONLY",
  vehicleWindows: {
    [day(0)]: { startTime: "08:00", hours: 8 },
    [fixedDay]: { startTime: "08:00", hours: 8 },
    [fullDay]: { startTime: "08:00", hours: 8 },
  },
  guideItemIds: [],
  guideDays: [],
};
const trip = await api("/api/v1/trips", "POST", profile);
await api(`/api/v1/trips/${trip.id}/workspace`, "PUT", {
  expectedVersion: trip.version,
  items,
  services,
});
await context.addInitScript(
  ({ id, bucket }) => {
    if (!localStorage.getItem("tourism.workspace-test-ready")) {
      localStorage.setItem("tourism.bucket.v1", JSON.stringify(bucket));
      localStorage.setItem("tourism.onboardedTrip", id);
      localStorage.setItem("tourism.workspace-test-ready", "1");
    }
  },
  {
    id: trip.id,
    bucket: [nature.offer.id, gallery.offer.id, cooking.offer.id],
  },
);
await page.goto(`${base}/trips/${trip.id}/plan`);
await expect(page.locator(".planner-activity-card").first()).toBeVisible();
const report = [];
async function saved() {
  await expect(page.locator(".planner-save-state")).toContainText("Saved", {
    timeout: 15000,
  });
}
async function screenAt(width, height, name, tab) {
  await page.setViewportSize({ width, height });
  if (tab) await page.getByRole("button", { name: tab, exact: true }).click();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.locator(".planner-workspace").waitFor();
  await page
    .locator("#planner-library-panel .library-items")
    .evaluate((el) => (el.scrollTop = 0));
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    )
    .toBe(true);
  const metrics = await page.evaluate(() => {
    const lib = document.querySelector(".planner-library");
    const schedule = document.querySelector(".planner-schedule");
    const card = document.querySelector(".planner-activity-card");
    return {
      library: lib.getBoundingClientRect().toJSON(),
      schedule: schedule.getBoundingClientRect().toJSON(),
      card: card?.getBoundingClientRect().toJSON(),
      columns: getComputedStyle(document.querySelector(".activity-card-grid"))
        .gridTemplateColumns,
    };
  });
  if (!tab || tab === "Activities") {
    const clipped = await page
      .locator("#planner-library-panel .planner-activity-card")
      .evaluateAll((cards) =>
        cards.some((card) => {
          const box = card.getBoundingClientRect();
          if (!box.width) return false;
          return [...card.querySelectorAll("button")].some(
            (button) => button.getBoundingClientRect().bottom > box.bottom + 1,
          );
        }),
      );
    expect(clipped, `Card actions fit their cards at ${width}px`).toBe(false);
  }
  await page.screenshot({
    path: new URL(name, output).pathname.replace(/^\/(\w:)/, "$1"),
    fullPage: false,
  });
  report.push({ width, height, name, metrics });
}
try {
  await screenAt(1440, 1000, "desktop-1440.png");
  const divider = page.getByRole("separator", {
    name: "Resize activity library",
  });
  const bounds = await divider.boundingBox();
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + 80);
  await page.mouse.down();
  await page.mouse.move(bounds.x + 110, bounds.y + 80, { steps: 8 });
  await page.mouse.up();
  const ratio = Number(await divider.getAttribute("aria-valuenow"));
  expect(ratio).toBeGreaterThan(35);
  await page.reload();
  await expect(page.getByRole("separator")).toHaveAttribute(
    "aria-valuenow",
    String(ratio),
  );
  await page.getByRole("separator").focus();
  await page.keyboard.press("ArrowLeft");
  await expect
    .poll(async () =>
      Number(await page.getByRole("separator").getAttribute("aria-valuenow")),
    )
    .toBeLessThan(ratio);
  await page.getByRole("button", { name: "Reset layout" }).click();
  await expect(page.getByRole("separator")).toHaveAttribute(
    "aria-valuenow",
    "35",
  );
  report.push({
    check: "pointer and keyboard divider, persistence, reset",
    passed: true,
  });

  const natureBlock = page.locator(`[data-item-id="${natureItem.id}"]`);
  const resize = natureBlock.getByRole("button", { name: /Resize end/ });
  await resize.scrollIntoViewIfNeeded();
  const edge = await resize.boundingBox();
  await page.mouse.move(edge.x + edge.width / 2, edge.y + edge.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    edge.x + edge.width / 2,
    edge.y + edge.height / 2 + 30,
    { steps: 5 },
  );
  await expect(page.locator(".schedule-feedback")).toContainText("150 min");
  await page.mouse.up();
  await saved();
  let workspace = await api(`/api/v1/trips/${trip.id}/workspace`);
  expect(workspace.trip.items.find((i) => i.id === natureItem.id).endTime).toBe(
    "11:30",
  );
  const startHandle = natureBlock.getByRole("button", { name: /Resize start/ });
  await startHandle.focus();
  await page.keyboard.press("ArrowUp");
  await expect(page.locator(".planner-save-state")).toContainText("opening");
  expect(
    (await api(`/api/v1/trips/${trip.id}/workspace`)).trip.items.find(
      (i) => i.id === natureItem.id,
    ).startTime,
  ).toBe("09:00");
  report.push({
    check:
      "flexible pointer resize, 15-minute keyboard resize and opening-hours rejection",
    passed: true,
  });

  await natureBlock.getByRole("button", { name: "Edit", exact: true }).click();
  const edit = page.locator(".edit-dialog");
  await edit.getByLabel("End time").fill("13:30");
  await edit.getByRole("button", { name: "Save block" }).click();
  await expect(edit).toBeVisible();
  expect(
    (await api(`/api/v1/trips/${trip.id}/workspace`)).trip.items.find(
      (i) => i.id === natureItem.id,
    ).endTime,
  ).toBe("11:30");
  await edit.getByRole("button", { name: "Cancel", exact: true }).click();

  const galleryBlock = page.locator(`[data-item-id="${galleryItem.id}"]`);
  const target = page.locator('.time-slot[data-at="14:00"]');
  await target.scrollIntoViewIfNeeded();
  await galleryBlock
    .getByRole("button", { name: /Move/ })
    .dragTo(target, { force: true, targetPosition: { x: 150, y: 1 } });
  await saved();
  workspace = await api(`/api/v1/trips/${trip.id}/workspace`);
  expect(
    workspace.trip.items.find((i) => i.id === galleryItem.id).startTime,
  ).toBe("14:00");
  report.push({
    check:
      "schedule drag move and invalid manual edits leave saved blocks intact",
    passed: true,
  });

  await page
    .locator(".compact-days button")
    .nth(Math.round((Date.parse(fixedDay) - Date.parse(day(0))) / 86400000))
    .click();
  const fixedBlock = page.locator(`[data-item-id="${fixedItem.id}"]`);
  await expect(fixedBlock).toBeVisible();
  expect(await fixedBlock.locator(".block-resize").count()).toBe(0);
  await fixedBlock.getByRole("button", { name: "Edit", exact: true }).click();
  await expect(edit.getByLabel("Start time")).toBeDisabled();
  await expect(edit.getByLabel("End time")).toBeDisabled();
  await expect(edit.getByLabel("Available sessions")).toBeVisible();
  const alternatives = await edit
    .getByLabel("Available sessions")
    .locator("option:not([disabled])")
    .evaluateAll((options) => options.map((option) => option.value));
  if (alternatives.length > 1) {
    const nextSession = alternatives.find(
      (value) => value !== fixedItem.startTime,
    );
    await edit.getByLabel("Available sessions").selectOption(nextSession);
    await edit.getByRole("button", { name: "Save block" }).click();
    await saved();
    const changed = (
      await api(`/api/v1/trips/${trip.id}/workspace`)
    ).trip.items.find((item) => item.id === fixedItem.id);
    expect(changed.startTime).toBe(nextSession);
    const session = cooking.sessions.find(
      (session) => session.startTime === nextSession,
    );
    expect(changed.endTime).toBe(endOf(nextSession, session.durationMinutes));
  } else
    await edit.getByRole("button", { name: "Cancel", exact: true }).click();
  report.push({
    check:
      "fixed session edges absent, arbitrary time controls disabled, valid alternative session preserves its duration",
    passed: true,
  });
  await page
    .locator(".compact-days button")
    .nth(Math.round((Date.parse(fullDay) - Date.parse(day(0))) / 86400000))
    .click();
  await expect(
    page.locator(".compact-days button[aria-pressed=true]"),
  ).toContainText("Full");
  const fullBlock = page.locator(`[data-item-id="${fullItem.id}"]`);
  expect(await fullBlock.locator(".block-resize").count()).toBe(0);
  await page
    .getByRole("button", { name: "Add personal time", exact: true })
    .click();
  await edit.getByLabel("Start time").fill("20:00");
  await edit.getByLabel("End time").fill("21:00");
  await edit.getByRole("button", { name: "Save block" }).click();
  await expect(edit).toBeVisible();
  await expect(edit.getByRole("status")).toContainText("day is full");
  await edit.getByRole("button", { name: "Cancel", exact: true }).click();
  report.push({
    check:
      "full-day block marks the day full, has no resize edge and rejects additional personal time",
    passed: true,
  });
  const emptyDayIndex = Array.from({ length: 7 }, (_, i) => i).find(
    (i) => day(i) !== day(0) && day(i) !== fixedDay && day(i) !== fullDay,
  );
  await page.locator(".compact-days button").nth(emptyDayIndex).click();
  await expect(
    page.getByText(
      "Your day is open. Drag an activity here, or use Add to day.",
    ),
  ).toBeVisible();
  const natureCard = page.locator(
    `#planner-library-panel [data-offer-id="${nature.offer.id}"]`,
  );
  await natureCard
    .locator(".activity-drag-handle")
    .dragTo(page.locator('.time-slot[data-at="09:00"]'), {
      force: true,
      targetPosition: { x: 140, y: 1 },
    });
  await saved();
  expect(
    (await api(`/api/v1/trips/${trip.id}/workspace`)).trip.items.filter(
      (item) =>
        item.localDate === day(emptyDayIndex) &&
        item.offerId === nature.offer.id,
    ),
  ).toHaveLength(1);
  await page
    .locator(`#planner-library-panel [data-offer-id="${gallery.offer.id}"]`)
    .getByRole("button", { name: "Add to day", exact: true })
    .click();
  await expect(edit).toBeVisible();
  expect(await page.locator(".drop-preview").count()).toBe(0);
  await edit.getByRole("button", { name: "Cancel", exact: true }).click();
  report.push({
    check:
      "library drag schedules an activity; Add to day opens the edit alternative without starting a drag",
    passed: true,
  });
  await page.locator(".compact-days button").first().click();

  const library = page.locator("#planner-library-panel");
  await library.getByRole("button", { name: /My Bucket/ }).click();
  const before = JSON.stringify(
    (await api(`/api/v1/trips/${trip.id}/workspace`)).trip.items,
  );
  await library
    .getByRole("button", { name: "Clear bucket", exact: true })
    .click();
  await page
    .getByRole("dialog", { name: "Clear your bucket" })
    .getByRole("button", { name: "Keep activities" })
    .click();
  await library
    .getByRole("button", { name: "Clear bucket", exact: true })
    .click();
  await page
    .getByRole("dialog", { name: "Clear your bucket" })
    .getByRole("button", { name: "Clear bucket", exact: true })
    .click();
  await expect(library.getByText("Your bucket is empty.")).toBeVisible();
  expect(
    JSON.stringify(
      (await api(`/api/v1/trips/${trip.id}/workspace`)).trip.items,
    ),
  ).toBe(before);
  await library.getByRole("button", { name: "Undo clear bucket" }).click();
  await expect(library.locator(".planner-activity-card")).toHaveCount(3);
  report.push({
    check: "clear/cancel/undo update bucket only and preserve itinerary",
    passed: true,
  });

  await library.getByRole("link", { name: "Explore more experiences" }).click();
  await expect(page).toHaveURL(new RegExp(`/explore\\?trip=${trip.id}`));
  const add = page
    .locator(".experience.card")
    .filter({
      has: page.getByRole("button", { name: "Add to bucket", exact: false }),
    })
    .first();
  await add.getByRole("button", { name: /Add to bucket/ }).click();
  await page.getByRole("button", { name: "Open trip planner" }).click();
  await expect(page.locator(".planner-workspace")).toBeVisible();
  expect(
    JSON.stringify(
      (await api(`/api/v1/trips/${trip.id}/workspace`)).trip.items,
    ),
  ).toBe(before);
  await page
    .locator("#planner-library-panel")
    .getByRole("button", { name: /My Bucket/ })
    .click();
  await expect(
    page.locator("#planner-library-panel .planner-activity-card"),
  ).toHaveCount(4);
  report.push({
    check:
      "Explore to bucket to planner retains all saved edits and new selections",
    passed: true,
  });

  await library
    .getByRole("button", { name: "All Experiences", exact: true })
    .click();
  await library.getByLabel("Search activities").fill("Conservation");
  await library.locator(".activity-card-content h3 button").first().click();
  await expect(page.locator(".experience-overlay")).toBeVisible();
  await page
    .locator(".experience-overlay")
    .getByRole("button", { name: "Close", exact: true })
    .click();
  await expect(library.getByLabel("Search activities")).toHaveValue(
    "Conservation",
  );
  await library.getByLabel("Search activities").fill("");
  report.push({
    check: "detail overlay retains filters and planner context",
    passed: true,
  });
  await page
    .locator("#planner-library-panel .planner-activity-card")
    .last()
    .scrollIntoViewIfNeeded();
  await expect(
    page
      .locator("#planner-library-panel .planner-activity-card")
      .last()
      .getByRole("button", { name: "Add to day", exact: true }),
  ).toBeInViewport();
  report.push({
    check: "last activity card and its actions remain reachable by scrolling",
    passed: true,
  });
  await page.locator(".schedule-scroll").evaluate((el) => (el.scrollTop = 0));
  await screenAt(1440, 1000, "desktop-1440.png");
  await screenAt(1280, 900, "laptop-1280.png");
  await screenAt(768, 1024, "tablet-768-activities.png", "Activities");
  await screenAt(768, 1024, "tablet-768-schedule.png", "My schedule");
  await screenAt(390, 844, "mobile-390-activities.png", "Activities");
  await screenAt(390, 844, "mobile-390-schedule.png", "My schedule");
  expect(errors).toEqual([]);
  await writeFile(
    new URL("checks.json", output),
    JSON.stringify(
      {
        tripId: trip.id,
        report,
        errors,
        limitations: [
          "Local demo inventory; checkout is unavailable.",
          "Desktop Chromium plus responsive viewports; native iOS/Android touch behaviour is not emulated.",
        ],
      },
      null,
      2,
    ),
  );
  console.log(
    "PASS: workspace interactions, schedule protection, bucket journey and screenshots at 1440, 1280, 768 and 390px.",
  );
} catch (error) {
  await page.screenshot({
    path: new URL("failure.png", output).pathname.replace(/^\/(\w:)/, "$1"),
    fullPage: true,
  });
  await writeFile(
    new URL("failure.json", output),
    JSON.stringify({ message: String(error), errors, report }, null, 2),
  );
  throw error;
} finally {
  await browser.close();
}
