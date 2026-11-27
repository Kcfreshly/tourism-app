// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import fixture from "../tourism-v1-handoff/data/experiences.demo.json";
import events from "../src/data/events.demo.json";
import { toPublishedExperience } from "../src/modules/catalogue/domain/experience";
import { displayName } from "../src/modules/catalogue/domain/experience-content";
import { isEvent } from "../src/modules/catalogue/domain/events";
import { storeKeys } from "../src/hooks/browser-store";
import CatalogueBrowser, {
  ExperienceCard,
  money,
} from "../src/components/catalogue-browser";

const push = vi.fn();
// The live address; null renders from the server-supplied filters.
let live: URLSearchParams | null = null;
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh: vi.fn() }),
  usePathname: () => "/explore",
  useSearchParams: () => live,
}));

const records = [...fixture.experiences, ...events.experiences].map((record) =>
  toPublishedExperience({ id: record.id, seedKey: record.id, record }),
) as (ReturnType<typeof toPublishedExperience> & { seedKey: string })[];
const byId = (id: string) => records.find((r) => r.id === id)!;
const nameOf = (id: string) => displayName(byId(id).name);
// A Wednesday; its weekend is 21–22 Nov.
const today = "2026-11-18";

function explore(initial = {}, tripId?: string) {
  return render(
    <CatalogueBrowser
      records={records}
      initial={initial}
      tripId={tripId}
      today={today}
    />,
  );
}
const address = () =>
  `${window.location.pathname}${window.location.search}${window.location.hash}`;
const params = () => new URLSearchParams(window.location.search);
const cardTitles = () =>
  [...document.querySelectorAll(".experience-grid article h3")].map(
    (h) => h.textContent,
  );
const results = () =>
  Number(
    screen
      .getByText(/experiences?$/, { selector: "strong" })
      .textContent!.split(" ")[0],
  );

beforeEach(() => {
  localStorage.clear();
  window.history.replaceState(null, "", "/explore");
  push.mockReset();
  live = null;
  // jsdom has no modal dialogs; the overlay needs showModal and close.
  HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
    this.removeAttribute("open");
  };
  Element.prototype.scrollIntoView ??= vi.fn();
  window.scrollTo = vi.fn() as typeof window.scrollTo;
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

describe("explore link state", () => {
  it("writes each filter into the address as it changes", () => {
    explore();
    expect(address()).toBe("/explore");
    fireEvent.click(screen.getByRole("button", { name: "Nature & outdoors" }));
    expect(params().get("category")).toBe("nature");
    fireEvent.change(screen.getByRole("searchbox"), {
      target: { value: "garden" },
    });
    expect(params().get("q")).toBe("garden");
    fireEvent.change(screen.getByLabelText("Length"), {
      target: { value: "LIGHT" },
    });
    fireEvent.change(screen.getByLabelText("Price"), {
      target: { value: "under-10k" },
    });
    fireEvent.change(screen.getByLabelText("Area"), {
      target: { value: "LEKKI" },
    });
    fireEvent.change(screen.getByLabelText("Getting there"), {
      target: { value: "SELF" },
    });
    expect(Object.fromEntries(params())).toEqual({
      category: "nature",
      q: "garden",
      kind: "LIGHT",
      price: "under-10k",
      area: "LEKKI",
      arrival: "SELF",
    });
    expect(cardTitles()).toEqual([nameOf("gardens")]);
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(address()).toBe("/explore");
  });

  it("restores every filter from the address after a reload or return", () => {
    explore({
      category: "nature",
      q: "garden",
      kind: "LIGHT",
      price: "under-10k",
      area: "LEKKI",
      arrival: "SELF",
      family: "1",
    });
    expect(screen.getByRole("searchbox")).toHaveProperty("value", "garden");
    expect(
      screen.getByRole("button", { name: "Nature & outdoors" }),
    ).toHaveProperty("ariaPressed", "true");
    expect(screen.getByLabelText("Length")).toHaveProperty("value", "LIGHT");
    expect(screen.getByLabelText("Price")).toHaveProperty("value", "under-10k");
    expect(screen.getByLabelText("Area")).toHaveProperty("value", "LEKKI");
    expect(screen.getByLabelText("Getting there")).toHaveProperty(
      "value",
      "SELF",
    );
    expect(screen.getByLabelText("Good for kids")).toHaveProperty(
      "checked",
      true,
    );
    // Five refining filters are active behind the Filters button.
    expect(
      within(screen.getByRole("button", { name: /Filters/ })).getByText("5"),
    ).toBeTruthy();
    expect(params().get("q")).toBe("garden");
    expect(params().get("family")).toBe("1");
  });

  it("keeps a return anchor in the address while filters change", () => {
    window.history.replaceState(
      null,
      "",
      "/explore?category=nature#exp-gardens",
    );
    explore({ category: "nature" });
    expect(document.getElementById("exp-gardens")).toBeTruthy();
    fireEvent.change(screen.getByRole("searchbox"), {
      target: { value: "walk" },
    });
    expect(address()).toBe("/explore?category=nature&q=walk#exp-gardens");
  });

  it("links a card's booking to the experience with a way back to these results", () => {
    explore({ category: "nature", date: "2026-11-20" });
    const card = document.getElementById("exp-nature-walk")!;
    const book = within(card).getByRole("link", { name: /Book for/ });
    const url = new URL(book.getAttribute("href")!, "https://example.test");
    expect(url.pathname).toBe("/experiences/nature-walk");
    expect(url.searchParams.get("date")).toBe("2026-11-20");
    expect(url.searchParams.get("book")).toBe("1");
    expect(url.searchParams.get("back")).toBe(
      "/explore?category=nature&date=2026-11-20#exp-nature-walk",
    );
  });

  it("carries a visit range to booking and back", () => {
    explore({ from: "2026-11-20", to: "2026-11-22" });
    const book = within(document.getElementById("exp-gallery")!).getByRole(
      "link",
      { name: /Book for/ },
    );
    const url = new URL(book.getAttribute("href")!, "https://example.test");
    expect(url.searchParams.get("from")).toBe("2026-11-20");
    expect(url.searchParams.get("to")).toBe("2026-11-22");
    expect(url.searchParams.get("back")).toBe(
      "/explore?from=2026-11-20&to=2026-11-22#exp-gallery",
    );
  });

  it("gives the overlay's booking links the same way back", () => {
    window.history.replaceState(null, "", "/explore?category=nature");
    explore({ category: "nature" });
    fireEvent.click(
      within(document.getElementById("exp-gardens")!).getByRole("button", {
        name: nameOf("gardens"),
      }),
    );
    const dialog = screen.getByRole("dialog");
    const back = encodeURIComponent("/explore?category=nature#exp-gardens");
    expect(
      within(dialog).getByRole("link", { name: /Choose date/ }),
    ).toHaveProperty(
      "href",
      `${window.location.origin}/experiences/gardens?book=1&back=${back}`,
    );
    expect(
      within(dialog).getByRole("link", { name: /Open in new tab/ }),
    ).toHaveProperty(
      "href",
      `${window.location.origin}/experiences/gardens?back=${back}`,
    );
  });

  it("leaves overlay links plain away from Explore", () => {
    window.history.replaceState(null, "", "/");
    render(<ExperienceCard experience={byId("gardens")} />);
    const card = document.querySelector("article")!;
    expect(card.id).toBe("");
    fireEvent.click(
      within(card).getByRole("button", { name: nameOf("gardens") }),
    );
    expect(
      within(screen.getByRole("dialog")).getByRole("link", {
        name: /Choose date/,
      }),
    ).toHaveProperty(
      "href",
      `${window.location.origin}/experiences/gardens?book=1`,
    );
  });
  it("starts from the live address over a stale server render", () => {
    // Browser back replays the page's first render, without later filters.
    live = new URLSearchParams("category=nature&q=garden&trip=trip-2");
    explore({}, "stale-trip");
    expect(screen.getByRole("searchbox")).toHaveProperty("value", "garden");
    expect(
      screen.getByRole("button", { name: "Nature & outdoors" }),
    ).toHaveProperty("ariaPressed", "true");
    expect(Object.fromEntries(params())).toEqual({
      category: "nature",
      q: "garden",
      trip: "trip-2",
    });
    cleanup();
    // A cleared address stays cleared even if the server render had filters.
    live = new URLSearchParams();
    explore({ category: "nature" }, "stale-trip");
    expect(window.location.search).toBe("");
  });
});

describe("explore browsing", () => {
  it("shows what's on and all non-event experiences before filtering", () => {
    explore();
    expect(
      screen.getByRole("heading", { name: "All experiences" }),
    ).toBeTruthy();
    expect(results()).toBe(records.filter((r) => !isEvent(r)).length);
    expect(
      document.querySelector(".experience-grid #exp-event-conference"),
    ).toBeNull();
  });

  it("lists events under the Events category", () => {
    explore();
    fireEvent.click(screen.getByRole("button", { name: "Events" }));
    expect(params().get("category")).toBe("events");
    expect(results()).toBe(records.filter(isEvent).length);
    expect(screen.getByRole("heading", { name: "Results" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "All categories" }));
    expect(params().get("category")).toBeNull();
  });

  it("browses by today, this weekend, a picked day and the visit dates", () => {
    explore();
    fireEvent.click(screen.getByRole("button", { name: "Today" }));
    expect(params().get("date")).toBe(today);
    expect(screen.getByRole("heading", { name: /^On Wed/ })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "This weekend" }));
    expect(params().get("date")).toBe("weekend");
    expect(
      screen.getByRole("heading", { name: /^On Sat.* or Sun/ }),
    ).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Pick a date"), {
      target: { value: "2026-11-25" },
    });
    expect(params().get("date")).toBe("2026-11-25");
    fireEvent.click(screen.getByRole("button", { name: "My dates" }));
    expect(screen.queryByLabelText("Pick a date")).toBeNull();
    expect(screen.getByText(/Add the dates you’re in Lagos/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Here from"), {
      target: { value: "2026-11-20" },
    });
    fireEvent.change(screen.getByLabelText("Until"), {
      target: { value: "2026-11-20" },
    });
    expect(screen.getByText(/during your 1 day,/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Until"), {
      target: { value: "2026-11-22" },
    });
    expect(screen.getByText(/during your 3 days,/)).toBeTruthy();
    expect(
      screen.getByRole("heading", { name: /^During your dates:/ }),
    ).toBeTruthy();
    expect(Object.fromEntries(params())).toEqual({
      from: "2026-11-20",
      to: "2026-11-22",
    });
    // Moving the start past the end pulls the end along.
    fireEvent.change(screen.getByLabelText("Here from"), {
      target: { value: "2026-11-24" },
    });
    expect(screen.getByLabelText("Until")).toHaveProperty(
      "value",
      "2026-11-24",
    );
    fireEvent.click(screen.getByRole("button", { name: "Any date" }));
    expect(address()).toBe("/explore");
  });

  it("restores the visit-dates panel from the address", () => {
    explore({ when: "range" });
    expect(screen.getByLabelText("Here from")).toHaveProperty("value", "");
    cleanup();
    explore({ date: "not-a-date", from: "bad", to: "bad" });
    expect(screen.getByLabelText("Here from")).toHaveProperty("value", "");
    cleanup();
    explore({ date: "weekend" });
    expect(screen.getByRole("button", { name: "This weekend" })).toHaveProperty(
      "ariaPressed",
      "true",
    );
    cleanup();
    explore({ date: "garbage" });
    expect(screen.getByRole("button", { name: "Any date" })).toHaveProperty(
      "ariaPressed",
      "true",
    );
  });

  it("matches search on story, category and area as well as name", () => {
    explore();
    const search = screen.getByRole("searchbox");
    fireEvent.change(search, { target: { value: "Victoria Island" } });
    expect(results()).toBe(records.filter((r) => r.zoneId === "VI").length);
    fireEvent.change(search, { target: { value: "zzzz-nothing" } });
    expect(
      screen.getByRole("heading", { name: "Nothing matches those filters" }),
    ).toBeTruthy();
    expect(
      screen.getByText("Try a different category or search term."),
    ).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", { name: "Browse all experiences" }),
    );
    expect(address()).toBe("/explore");
  });

  it("explains an empty day and refuses to relax wheelchair access", () => {
    explore({ category: "nature", kind: "FULL_DAY", date: today });
    expect(
      screen.getByText(/Nothing runs then with these filters/),
    ).toBeTruthy();
    cleanup();
    explore();
    fireEvent.click(screen.getByLabelText(/Wheelchair access/));
    expect(params().get("access")).toBe("1");
    expect(
      screen.getByRole("heading", {
        name: "No confirmed wheelchair access yet",
      }),
    ).toBeTruthy();
  });

  it("filters by kids, pickup and price band", () => {
    explore();
    fireEvent.click(screen.getByLabelText("Good for kids"));
    expect(params().get("family")).toBe("1");
    fireEvent.change(screen.getByLabelText("Getting there"), {
      target: { value: "PICKUP" },
    });
    fireEvent.change(screen.getByLabelText("Price"), {
      target: { value: "over-25k" },
    });
    expect(Object.fromEntries(params())).toEqual({
      family: "1",
      arrival: "PICKUP",
      price: "over-25k",
    });
    for (const title of cardTitles())
      expect(records.map((r) => displayName(r.name))).toContain(title);
  });

  it("opens and closes the filters panel on small screens", () => {
    explore();
    const toggle = screen.getByRole("button", { name: /Filters/ });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(document.getElementById("explore-filters")!.dataset.open).toBe(
      "true",
    );
  });

  it("shows the Bucket view, its empty state and the way back to exploring", () => {
    explore();
    fireEvent.click(screen.getByRole("button", { name: /^Saved \d/ }));
    expect(params().get("view")).toBe("saved");
    expect(
      screen.getByRole("heading", { name: "No saved activities yet" }),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Keep exploring" }));
    expect(params().get("view")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /^Saved \d/ }));
    fireEvent.click(
      screen.getByRole("button", { name: "Browse all experiences" }),
    );
    expect(address()).toBe("/explore");
  });

  it("lists saved ideas in the Bucket and opens it from the tray", () => {
    localStorage.setItem(
      storeKeys.bucket,
      JSON.stringify([byId("gallery").offer.id, byId("suya").offer.id]),
    );
    explore({ view: "bucket" }, "trip-9");
    expect(
      screen.getByRole("heading", { name: "Saved activities" }),
    ).toBeTruthy();
    expect(cardTitles().sort()).toEqual(
      [nameOf("gallery"), nameOf("suya")].sort(),
    );
    expect(Object.fromEntries(params())).toEqual({
      view: "saved",
      trip: "trip-9",
    });
    fireEvent.click(screen.getByRole("button", { name: "All experiences" }));
    fireEvent.click(screen.getByRole("button", { name: "Nature & outdoors" }));
    expect(params().get("category")).toBe("nature");
    // The tray's view button resets filters and shows the Bucket.
    const tray = document.querySelector(".bucket-tray") as HTMLElement;
    fireEvent.click(within(tray).getAllByRole("button")[0]);
    expect(Object.fromEntries(params())).toEqual({
      view: "saved",
      trip: "trip-9",
    });
    // Filtering inside the Bucket finds nothing: the filters message shows.
    fireEvent.change(screen.getByRole("searchbox"), {
      target: { value: "zzzz" },
    });
    expect(
      screen.getByRole("heading", { name: "Nothing matches those filters" }),
    ).toBeTruthy();
  });

  it("formats money for other screens", () => {
    expect(money(1200000)).toMatch(/12,000/);
  });
});
