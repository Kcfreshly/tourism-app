// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import Pocket from "../src/components/pocket";
import { initialProfile } from "../src/modules/trips/domain/profile";
import { defaultServices } from "../src/modules/trips/domain/planner";
import type { OrderView } from "../src/modules/bookings/domain/checkout";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

const profile = {
  ...initialProfile,
  startDate: "2027-05-08",
  endDate: "2027-05-10",
  accommodationBy: "FASTLIFE" as const,
  zoneId: "VI" as const,
};
const order: OrderView = {
  reference: "FL-ABC123",
  tripId: "trip-1",
  createdAt: "2027-04-30T10:00:00.000Z",
  totalMinor: 10_000_000,
  contact: { name: "Ada", email: "ada@example.test", phone: "+2348000000" },
  bookings: [],
  services: [
    {
      id: "s1",
      service: "AIRPORT_PICKUP",
      date: "2027-05-08",
      startTime: "06:10",
      label: "Airport pickup",
      status: "MATCHED",
      matchBy: "2027-05-06T05:10:00.000Z",
      assignee: {
        name: "Tunde Bakare",
        phone: "+234 801 234 5678",
        vehicle: "Toyota Sienna",
        plate: "LAG 123 AB",
      },
      totalMinor: 4_100_000,
      feeMinor: 100_000,
      rows: [],
    },
  ],
  stays: [
    {
      id: "st1",
      version: 1,
      propertyName: "Fictional Lagoon Hotel",
      area: "Victoria Island",
      address: "1 Fictional Close",
      room: "Deluxe double",
      checkIn: "2027-05-08",
      checkOut: "2027-05-10",
      note: "",
      priceMinor: 18_000_000,
      availableUntil: "2027-05-03T12:00:00.000Z",
      status: "BOOKED",
    },
  ],
  trip: {
    ...profile,
    airportPickup: {
      airport: "LOS",
      flight: "BA75",
      landingDate: "2027-05-08",
      landingTime: "06:10",
      travellers: 2,
      bags: 3,
    },
  },
};

function serve() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) =>
      Response.json({
        data: url.includes("/orders/")
          ? order
          : {
              trip: {
                id: "trip-1",
                profile,
                items: [],
                services: defaultServices,
              },
              booking: { orderReference: order.reference },
              offers: [],
              price: { warnings: [] },
            },
      }),
    ),
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("day view of a booked trip", () => {
  it("shows what we're arranging and a countdown before the trip", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2027-05-01T12:00:00+01:00"));
    serve();
    render(<Pocket id="trip-1" />);
    expect(
      await screen.findByRole("heading", {
        name: "Your trip starts in 7 days",
      }),
    ).toBeTruthy();
    expect(screen.getByText("What we’re arranging")).toBeTruthy();
    expect(screen.getByText("Driver matched")).toBeTruthy();
    // They can still look at the days ahead.
    fireEvent.click(screen.getByRole("button", { name: "Preview your days" }));
    expect(await screen.findByText("Arranged for you")).toBeTruthy();
  });

  it("starts arrival day with the pickup, then check-in", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2027-05-08T08:00:00+01:00"));
    serve();
    render(<Pocket id="trip-1" />);
    await screen.findByText("Arranged for you");
    const items = screen
      .getAllByRole("listitem")
      .filter((li) => li.closest(".pocket-arranged"))
      .map((li) => li.textContent);
    expect(items).toHaveLength(2);
    expect(items[0]).toMatch(
      /Airport pickup.*Flight BA75.*Driver: Tunde Bakare/,
    );
    expect(items[1]).toMatch(/Check in at Fictional Lagoon Hotel/);
    expect(screen.queryByText(/Your trip starts in/)).toBeNull();
  });
});
