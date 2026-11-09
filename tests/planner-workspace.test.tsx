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
import { initialProfile } from "../src/domain/profile";
import { assess, defaultServices, type Item } from "../src/domain/planner";
import { resizedBlock } from "../src/domain/planner-interactions";
import PlannerActivityCard from "../src/components/planner-activity-card";

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
  fireEvent.click(screen.getByRole("button", { name: /My Bucket 2/ }));
  const originalCount = container.querySelectorAll(".schedule-block").length;
  fireEvent.click(screen.getByRole("button", { name: "Clear bucket" }));
  fireEvent.click(
    within(screen.getByRole("dialog", { name: "Clear your bucket" })).getByRole(
      "button",
      { name: "Keep activities" },
    ),
  );
  expect(JSON.parse(localStorage.getItem("tourism.bucket.v1")!)).toHaveLength(
    2,
  );
  fireEvent.click(screen.getByRole("button", { name: "Clear bucket" }));
  fireEvent.click(
    within(screen.getByRole("dialog", { name: "Clear your bucket" })).getByRole(
      "button",
      { name: "Clear bucket" },
    ),
  );
  expect(screen.getAllByText("Your bucket is empty.").length).toBeGreaterThan(
    0,
  );
  expect(container.querySelectorAll(".schedule-block")).toHaveLength(
    originalCount,
  );
  expect(
    (screen.getByRole("button", { name: "Clear bucket" }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Undo clear bucket" }));
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
