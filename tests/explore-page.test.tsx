// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import fixture from "../tourism-v1-handoff/data/experiences.demo.json";
import { toPublishedExperience } from "../src/modules/catalogue/domain/experience";

const listPublishedExperiences = vi.fn();
vi.mock("@/bootstrap/container", () => ({
  pages: {
    listPublishedExperiences: () => listPublishedExperiences(),
    transportSettings: async () => ({ lateReturnFrom: "22:00" }),
  },
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/explore",
  useSearchParams: () => null,
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

const records = fixture.experiences.map((record) =>
  toPublishedExperience({ id: record.id, seedKey: record.id, record }),
);
const { default: Explore } = await import("../src/app/explore/page");
const { default: Detail } = await import("../src/app/experiences/[slug]/page");

beforeEach(() => {
  localStorage.clear();
  window.history.replaceState(null, "", "/explore");
  listPublishedExperiences.mockReset();
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: true, json: async () => ({ data: [] }) })),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("explore page", () => {
  it("opens with the filters in the address", async () => {
    listPublishedExperiences.mockResolvedValue(records);
    render(
      await Explore({
        searchParams: Promise.resolve({
          city: "lagos",
          category: "nature",
          q: "garden",
          kind: "LIGHT",
        }),
      }),
    );
    expect(screen.getByRole("searchbox")).toHaveProperty("value", "garden");
    expect(screen.getByLabelText("Length")).toHaveProperty("value", "LIGHT");
    expect(window.location.search).toBe("?category=nature&q=garden&kind=LIGHT");
  });

  it("keeps a trip in the address while browsing for it", async () => {
    listPublishedExperiences.mockResolvedValue(records);
    render(
      await Explore({ searchParams: Promise.resolve({ trip: "trip-3" }) }),
    );
    expect(window.location.search).toBe("?trip=trip-3");
  });

  it("says when a city has no listings yet", async () => {
    render(
      await Explore({ searchParams: Promise.resolve({ city: "atlantis" }) }),
    );
    expect(
      screen.getByRole("heading", { name: "Nothing listed there yet" }),
    ).toBeTruthy();
    expect(listPublishedExperiences).not.toHaveBeenCalled();
  });

  it("says when the catalogue cannot load", async () => {
    listPublishedExperiences.mockRejectedValue(new Error("down"));
    render(await Explore({ searchParams: Promise.resolve({}) }));
    expect(
      screen.getByRole("heading", {
        name: "Experiences are unavailable right now",
      }),
    ).toBeTruthy();
  });
});

describe("experience page back link", () => {
  async function detail(searchParams: Record<string, string>) {
    listPublishedExperiences.mockResolvedValue(records);
    render(
      await Detail({
        params: Promise.resolve({ slug: "gardens" }),
        searchParams: Promise.resolve(searchParams),
      }),
    );
    return screen
      .getByRole("link", { name: "Things to do" })
      .getAttribute("href");
  }

  it("returns to the traveller's filtered results and card", async () => {
    expect(
      await detail({
        book: "1",
        back: "/explore?category=nature&q=garden#exp-gardens",
      }),
    ).toBe("/explore?category=nature&q=garden#exp-gardens");
  });

  it("falls back to Explore without a safe return address", async () => {
    expect(await detail({})).toBe("/explore");
    cleanup();
    expect(await detail({ back: "https://evil.example/explore" })).toBe(
      "/explore",
    );
  });
});
