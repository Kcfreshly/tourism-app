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
import ExperienceOverlay, {
  ExperienceOverlayProvider,
} from "../src/components/experience-overlay";
import CatalogueBrowser, {
  ExperienceCard,
} from "../src/components/catalogue-browser";

// A signed-in traveller, so Add to trip opens its plan picker.
vi.mock("../src/components/auth-client", () => ({
  authClient: { useSession: () => ({ data: { user: { id: "u1" } } }) },
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/explore",
  useSearchParams: () => null,
}));

type Listing = ReturnType<typeof toPublishedExperience> & { seedKey: string };
const records = [...fixture.experiences, ...events.experiences].map((record) =>
  toPublishedExperience({ id: record.id, seedKey: record.id, record }),
) as Listing[];
const byId = (id: string) => records.find((r) => r.id === id)!;

function open(experience: Listing, onAdd?: () => void) {
  render(
    <main tabIndex={-1}>
      <ExperienceOverlay experience={experience} onAdd={onAdd} />
    </main>,
  );
  fireEvent.click(screen.getByRole("button", { name: "View details" }));
  return screen.getByRole("dialog");
}

beforeEach(() => {
  localStorage.clear();
  window.history.replaceState(null, "", "/explore");
  // jsdom has no modal dialogs: open them, and fire close like a browser.
  HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
    this.removeAttribute("open");
    this.dispatchEvent(new Event("close"));
  };
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
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("experience overlay", () => {
  it("closes from its button, restores scroll and returns focus", () => {
    const dialog = open(byId("gallery"));
    expect(document.body.style.overflow).toBe("hidden");
    expect(within(dialog).getByText("Flexible start")).toBeTruthy();
    expect(within(dialog).getByText(/Pick your own start time/)).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.body.style.overflow).toBe("");
    expect(window.scrollTo).toHaveBeenCalled();
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "View details" }),
    );
  });

  it("returns focus to the page when the trigger has gone", () => {
    render(
      <ExperienceOverlayProvider>
        <main tabIndex={-1}>
          <ExperienceCard experience={byId("gallery")} />
        </main>
      </ExperienceOverlayProvider>,
    );
    fireEvent.click(
      screen.getByRole("button", { name: displayName(byId("gallery").name) }),
    );
    const dialog = screen.getByRole("dialog");
    document.querySelector("article")!.remove();
    fireEvent.click(within(dialog).getByRole("button", { name: "Close" }));
    expect(document.activeElement).toBe(document.querySelector("main"));
  });

  it("lists fixed sessions and full-day timing", () => {
    let dialog = open(byId("cooking"));
    expect(within(dialog).getByText("Fixed sessions")).toBeTruthy();
    expect(
      within(
        within(dialog).getByRole("list", { name: "Sessions" }),
      ).getAllByRole("listitem").length,
    ).toBeGreaterThan(0);
    cleanup();
    dialog = open({
      ...byId("cooking"),
      sessions: [
        {
          startTime: "10:00",
          durationMinutes: 120,
          capacity: 4,
          dates: ["2026-11-20"],
        },
      ],
    } as Listing);
    expect(within(dialog).getByText("2026-11-20")).toBeTruthy();
    cleanup();
    dialog = open({
      ...byId("history"),
      schedulingType: "FLEXIBLE",
    } as Listing);
    expect(within(dialog).getAllByText("Full day").length).toBeGreaterThan(0);
    expect(within(dialog).getByText(/Takes up the main part/)).toBeTruthy();
  });

  it("shows an event's dates and what is guaranteed", () => {
    const studio = byId("event-studio-set");
    const dialog = open({
      ...studio,
      event: { ...studio.event!, bonus: "A cameo in the shoot." },
      offer: { ...studio.offer, hostIncluded: true },
      videoUrl: "/video.mp4",
    } as Listing);
    expect(within(dialog).getByText("What’s guaranteed")).toBeTruthy();
    expect(within(dialog).getByText(/A cameo in the shoot/)).toBeTruthy();
    expect(
      within(dialog).getByRole("list", { name: "Event dates" }),
    ).toBeTruthy();
    expect(within(dialog).getByText(/Sample event/)).toBeTruthy();
    expect(within(dialog).getByText("A local host joins you.")).toBeTruthy();
    expect(within(dialog).getByLabelText("Experience video")).toBeTruthy();
  });

  it("steps through venue photos and falls back when one fails", () => {
    const dialog = open({
      ...byId("gallery"),
      photos: ["/a.jpg", "/b.jpg"],
      inspirationPhoto: undefined,
      categoryId: "mystery",
    } as unknown as Listing);
    const image = () =>
      dialog.querySelector<HTMLImageElement>(".gallery-image")!;
    expect(image().getAttribute("src")).toBe("/a.jpg");
    expect(
      within(dialog).getByText("mystery ·", { exact: false }),
    ).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: "Next photo" }));
    expect(image().getAttribute("src")).toBe("/b.jpg");
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Previous photo" }),
    );
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Previous photo" }),
    );
    expect(image().getAttribute("src")).toBe("/b.jpg");
    fireEvent.error(image());
    fireEvent.error(image());
    expect(image().getAttribute("alt")).toBe("Illustrated activity fallback");
    expect(image().getAttribute("src")).toBe(
      "/assets/illustrations/category-mystery.svg",
    );
  });

  it("labels a listing with no photos as an illustration", () => {
    const dialog = open({
      ...byId("gallery"),
      inspirationPhoto: undefined,
    } as Listing);
    expect(dialog.querySelector(".gallery-image")!.getAttribute("alt")).toBe(
      "Category illustration; venue photos not supplied",
    );
  });

  it("keeps Tab inside the dialog", () => {
    vi.spyOn(Element.prototype, "getClientRects").mockReturnValue([
      {},
    ] as unknown as DOMRectList);
    const dialog = open(byId("gallery"));
    const controls = [
      ...dialog.querySelectorAll<HTMLElement>("button, a[href], [tabindex]"),
    ].filter((element) => element.tabIndex >= 0);
    const first = controls[0],
      last = controls.at(-1)!;
    last.focus();
    fireEvent.keyDown(dialog, { key: "Tab" });
    expect(document.activeElement).toBe(first);
    fireEvent.keyDown(dialog, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(last);
    // Other keys and Tab from the middle are left to the browser.
    fireEvent.keyDown(dialog, { key: "Enter" });
    controls[1].focus();
    fireEvent.keyDown(dialog, { key: "Tab" });
    expect(document.activeElement).toBe(controls[1]);
  });

  it("closes on a backdrop click but not a drag or a click inside", () => {
    const dialog = open(byId("gallery"));
    vi.spyOn(dialog, "getBoundingClientRect").mockReturnValue({
      left: 100,
      right: 500,
      top: 100,
      bottom: 500,
    } as DOMRect);
    const press = (x: number, y: number, extra = {}) =>
      fireEvent.pointerDown(dialog, {
        button: 0,
        pointerId: 1,
        clientX: x,
        clientY: y,
        ...extra,
      });
    const release = (x: number, y: number, id = 1) =>
      fireEvent.pointerUp(dialog, { pointerId: id, clientX: x, clientY: y });
    // Inside the box, a dragged press, another pointer or a cancel: stays open.
    press(200, 200);
    release(200, 200);
    press(10, 10);
    release(60, 60);
    press(10, 10);
    release(10, 10, 2);
    press(10, 10);
    fireEvent.pointerCancel(dialog);
    release(10, 10);
    press(10, 10, { button: 2 });
    release(10, 10);
    expect(screen.getByRole("dialog")).toBeTruthy();
    press(10, 10);
    release(12, 12);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("adds to the trip being planned instead of linking to booking", () => {
    const onAdd = vi.fn();
    const dialog = open(byId("gallery"), onAdd);
    expect(
      within(dialog).queryByRole("link", { name: /Choose date/ }),
    ).toBeNull();
    fireEvent.click(
      within(dialog).getByRole("button", { name: /Add to this trip/ }),
    );
    expect(onAdd).toHaveBeenCalledOnce();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("stays open when the Add to trip picker inside it is closed", async () => {
    const dialog = open(byId("cooking"));
    fireEvent.click(
      within(dialog).getByRole("button", { name: /Add to trip/ }),
    );
    const picker = await screen.findByRole("dialog", {
      name: /Which plan is .* for\?/,
    });
    expect(picker.hasAttribute("open")).toBe(true);
    fireEvent.click(within(picker).getByRole("button", { name: "Close" }));
    expect(picker.hasAttribute("open")).toBe(false);
    // The experience overlay is still showing.
    expect(
      screen.getByRole("dialog", { name: displayName(byId("cooking").name) }),
    ).toBeTruthy();
    expect(document.body.style.overflow).toBe("hidden");
  });

  it("closes when the traveller goes to choose a date", () => {
    const dialog = open(byId("gallery"));
    fireEvent.click(within(dialog).getByRole("link", { name: /Choose date/ }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

describe("explore cards with unusual listings", () => {
  it("fall back for a missing seed key, an unknown category and a full day", () => {
    const odd = {
      ...byId("gallery"),
      id: "uuid-odd",
      seedKey: undefined,
      categoryId: "mystery",
      zoneId: "MAINLAND",
      kind: "FULL_DAY",
      offer: { ...byId("gallery").offer, hostIncluded: false },
    } as unknown as Listing;
    render(
      <CatalogueBrowser
        records={[odd]}
        initial={{ date: "2026-11-20", q: "mainland" }}
        today="2026-11-18"
      />,
    );
    const card = document.getElementById("exp-uuid-odd")!;
    expect(within(card).getByText(/^mystery ·/)).toBeTruthy();
    expect(
      within(card)
        .getByRole("link", { name: /Book for/ })
        .getAttribute("href"),
    ).toMatch(/^\/experiences\/uuid-odd\?date=2026-11-20&book=1&back=/);
    cleanup();
    render(<ExperienceCard experience={odd} />);
    expect(screen.getByText("Full day")).toBeTruthy();
  });
});
