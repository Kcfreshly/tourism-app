// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import Planner from "../src/components/planner";
import fixture from "../tourism-v1-handoff/data/experiences.demo.json";
import { initialProfile } from "../src/modules/trips/domain/profile";
import {
  assess,
  defaultServices,
  type Item,
} from "../src/modules/trips/domain/planner";
import { resizedBlock } from "../src/modules/trips/domain/planner-interactions";
import PlannerActivityCard from "../src/components/planner-activity-card";
import { lagosToday } from "../src/modules/catalogue/domain/events";
import { addDays } from "../src/modules/catalogue/domain/schedule";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
const profile = {
  ...initialProfile,
  startDate: "2027-05-10",
  endDate: "2027-05-10",
  accommodation: "Lekki base",
  zoneId: "LEKKI" as const,
};
const items: Item[] = [
  {
    id: "00000000-0000-4000-8000-000000000001",
    localDate: profile.startDate,
    startTime: "09:00",
    endTime: "11:00",
    title: "Nature visit",
    kind: "EXPERIENCE",
    offerId: "offer-nature-walk",
    locked: false,
  },
];
const services = {
  ...defaultServices,
  vehicleWindows: {
    [profile.startDate]: { startTime: "08:00", hours: 8 as const },
  },
};
beforeEach(() => {
  localStorage.clear();
  localStorage.setItem(
    "tourism.bucket.v1",
    JSON.stringify(["offer-nature-walk", "offer-gallery"]),
  );
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
    this.dispatchEvent(new Event("close"));
  };
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      json: async () => ({
        data: {
          trip: { id: "trip-test", version: 1, profile, items, services },
          offers: fixture.experiences,
          price: assess(profile, items, services, fixture.experiences),
        },
      }),
    })),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it("clears only bucket selections after confirmation, supports cancel and undo, and retains the itinerary", async () => {
  const { container } = render(<Planner id="trip-test" />);
  await screen.findByRole("heading", { name: "My trip planner" });
  fireEvent.click(screen.getByRole("button", { name: /^Saved 2/ }));
  const originalCount = container.querySelectorAll(".schedule-block").length;
  fireEvent.click(screen.getByRole("button", { name: "Clear saved activities" }));
  fireEvent.click(
    within(screen.getByRole("dialog", { name: "Clear your saved activities" })).getByRole(
      "button",
      { name: "Keep activities" },
    ),
  );
  expect(JSON.parse(localStorage.getItem("tourism.bucket.v1")!)).toHaveLength(
    2,
  );
  fireEvent.click(screen.getByRole("button", { name: "Clear saved activities" }));
  fireEvent.click(
    within(screen.getByRole("dialog", { name: "Clear your saved activities" })).getByRole(
      "button",
      { name: "Clear all" },
    ),
  );
  expect(screen.getAllByText("No saved activities yet.").length).toBeGreaterThan(
    0,
  );
  expect(container.querySelectorAll(".schedule-block")).toHaveLength(
    originalCount,
  );
  expect(
    (screen.getByRole("button", { name: "Clear saved activities" }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Undo clear saved activities" }));
  expect(JSON.parse(localStorage.getItem("tourism.bucket.v1")!)).toHaveLength(
    2,
  );
  expect(container.querySelectorAll(".schedule-block")).toHaveLength(
    originalCount,
  );
  expect(vi.mocked(fetch).mock.calls).toHaveLength(1);
});

it("offers keyboard split adjustment and retains the ratio on this device", async () => {
  render(<Planner id="trip-test" />);
  const divider = await screen.findByRole("separator", {
    name: "Resize activity library",
  });
  fireEvent.keyDown(divider, { key: "ArrowRight" });
  expect(divider.getAttribute("aria-valuenow")).toBe("37");
  expect(localStorage.getItem("tourism.planner.split")).toBe("37");
});

it("snaps independent start and end resizing to quarter hours without changing other block data", () => {
  expect(resizedBlock(items[0], "end", 23)).toEqual({
    ...items[0],
    endTime: "11:30",
  });
  expect(resizedBlock(items[0], "start", -16)).toEqual({
    ...items[0],
    startTime: "08:45",
  });
  expect(items[0].endTime).toBe("11:00");
});

it("replaces failed activity images with an intentional illustrated fallback", () => {
  render(
    <PlannerActivityCard
      experience={{
        ...fixture.experiences[0],
        imagePath: "/missing-image.jpg",
      }}
      saved={false}
      busy={false}
      available={true}
      onAdd={() => {}}
      onDrag={() => {}}
    />,
  );
  fireEvent.error(screen.getByRole("img"));
  expect(screen.getByRole("img").getAttribute("src")).toBe(
    "/assets/illustrations/category-nature.svg",
  );
  expect(screen.getByRole("img").getAttribute("alt")).toBe(
    "Illustrated experience fallback",
  );
});

it("shows travellers making their own way no vehicle to book or pay for", async () => {
  const own = { ...profile, transport: "OWN" as const };
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      json: async () => ({
        data: {
          trip: { id: "trip-test", version: 1, profile: own, items, services },
          offers: fixture.experiences,
          price: assess(own, items, services, fixture.experiences),
        },
      }),
    })),
  );
  render(<Planner id="trip-test" servicesOnly />);
  expect(await screen.findByText("Your own way, usually")).toBeTruthy();
  expect(screen.getByRole("link", { name: "the whole trip" })).toHaveProperty(
    "href",
    expect.stringContaining("/trips/trip-test/profile"),
  );
  // The day follows the trip: own way, with no car times to choose.
  expect(
    screen
      .getByRole("button", { name: "Our own way" })
      .getAttribute("aria-pressed"),
  ).toBe("true");
  expect(screen.queryByLabelText("Car from")).toBeNull();
  expect(screen.getAllByText("Your own").length).toBeGreaterThan(0);
});

it("says why nothing fits once the trip dates have passed", async () => {
  const past = { ...profile, startDate: "2020-01-10", endDate: "2020-01-10" };
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      json: async () => ({
        data: {
          trip: {
            id: "trip-test",
            version: 1,
            profile: past,
            items: [],
            services,
          },
          offers: fixture.experiences,
          price: assess(past, [], services, fixture.experiences),
        },
      }),
    })),
  );
  render(<Planner id="trip-test" />);
  expect(
    (await screen.findAllByText(/These trip dates have passed/)).length,
  ).toBeGreaterThan(0);
  expect(screen.getAllByText("This day has passed.").length).toBeGreaterThan(0);
  expect(screen.queryByText(/Doesn’t fit this day/)).toBeNull();
  expect(
    screen.getAllByRole("link", { name: "Change trip dates" })[0],
  ).toHaveProperty("href", expect.stringContaining("/trips/trip-test/profile"));
});

it("opens a trip that starts today on today, judging each experience by its cutoff", async () => {
  const today = lagosToday();
  const now = { ...profile, startDate: today, endDate: addDays(today, 2) };
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      json: async () => ({
        data: {
          trip: {
            id: "trip-test",
            version: 1,
            profile: now,
            items: [],
            services,
          },
          offers: fixture.experiences,
          price: assess(now, [], services, fixture.experiences),
        },
      }),
    })),
  );
  render(<Planner id="trip-test" />);
  await screen.findByRole("heading", { name: "My trip planner" });
  const date = new Date(today + "T12:00:00Z").getUTCDate();
  expect(
    screen
      .getAllByRole("button", { pressed: true })
      .some((b) => b.textContent?.includes(String(date))),
  ).toBe(true);
  // No blanket "day closed" notice: today stays open for later slots.
  expect(screen.queryByText(/This day has passed/)).toBeNull();
});

it("lets travellers add where they're staying from the warning, and shows driver times", async () => {
  const noBase = { ...profile, accommodation: "" };
  const calls: { url: string; method: string; body?: unknown }[] = [];
  let current = noBase;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      const body = init?.body ? JSON.parse(String(init.body)) : undefined;
      calls.push({ url, method, body });
      if (method === "PATCH") current = body.profile;
      return {
        ok: true,
        json: async () => ({
          data: {
            trip: {
              id: "trip-test",
              version: method === "PATCH" ? 2 : calls.length > 1 ? 2 : 1,
              profile: current,
              items,
              services,
            },
            offers: fixture.experiences,
            price: assess(current, items, services, fixture.experiences),
          },
        }),
      };
    }),
  );
  render(<Planner id="trip-test" />);
  // The day says when the driver comes.
  expect((await screen.findByText(/Driver 08:00–16:00/)).textContent).toContain(
    "Driver 08:00–16:00",
  );
  expect(screen.getByRole("link", { name: "Driver & guides" })).toHaveProperty(
    "href",
    expect.stringContaining("/trips/trip-test/services"),
  );
  // A missing address is a reminder, not something blocking the booking.
  expect(screen.queryByText(/to sort out before booking/)).toBeNull();
  fireEvent.click(screen.getByText("Pickup address needed"));
  fireEvent.change(screen.getByLabelText("Where you’re staying"), {
    target: { value: "Fictional Lekki Suites" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save address" }));
  expect(
    await screen.findByText(/Saved · pickups from Fictional Lekki Suites/),
  ).toBeTruthy();
  const patch = calls.find((c) => c.method === "PATCH")!;
  expect(patch.url).toBe("/api/v1/trips/trip-test");
  expect(patch.body).toMatchObject({
    expectedVersion: 1,
    profile: { accommodation: "Fictional Lekki Suites", zoneId: "LEKKI" },
  });
  expect(screen.queryByText("Pickup address needed")).toBeNull();
});
