// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import Intake from "../src/components/intake";
import { BucketButton } from "../src/components/bucket";
import { extractProfile } from "../src/domain/intake";
import type { Profile } from "../src/domain/profile";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

const writes: { path: string; payload: unknown }[] = [];
beforeEach(() => {
  localStorage.clear();
  writes.length = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (path: string, init?: RequestInit) => {
      const payload = JSON.parse(String(init?.body || "{}"));
      writes.push({ path, payload });
      const data =
        path === "/api/v1/intake"
          ? extractProfile(payload.profile as Profile, payload.message)
          : {
              id: `draft-${writes.filter((write) => write.path === "/api/v1/trips").length}`,
              version: 1,
              profile: payload.profile ?? payload,
            };
      return { ok: true, json: async () => ({ data }) };
    }),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("trip journey", () => {
  it("keeps the form out of the agent stage, supports summary edits and preserves the bucket across independent drafts", async () => {
    render(
      <>
        <BucketButton id="offer-gallery" />
        <Intake mode="chat" fresh />
      </>,
    );
    fireEvent.click(screen.getByRole("button", { name: /Add to bucket/ }));
    expect(screen.queryByLabelText("Arrival date")).toBeNull();
    fireEvent.change(screen.getByLabelText("Your trip, in your own words"), {
      target: {
        value:
          "2026-11-10 to 2026-11-16, 3 adults. We love art and nature. Budget: NGN 500000.",
      },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Review my trip summary" }),
    );
    await screen.findByRole("heading", {
      name: "Does this feel like your trip?",
    });
    expect(screen.getByText("3 adults")).toBeTruthy();
    expect(screen.queryByLabelText("Arrival date")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Ask Kemi to edit" }));
    fireEvent.change(screen.getByLabelText("Ask Kemi to edit your trip"), {
      target: { value: "Make the pace relaxed." },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Review Kemi's changes" }),
    );
    await screen.findByText("relaxed");
    expect(screen.getByText("3 adults")).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", { name: "Edit details manually" }),
    );
    fireEvent.change(screen.getByLabelText("Adults (18+)"), {
      target: { value: "4" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Review trip summary" }),
    );
    expect(screen.getByText("4 adults")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Give this draft a name"), {
      target: { value: "Family art week" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save my trip draft" }));
    await screen.findByRole("heading", { name: "Your trip draft is ready." });
    expect(
      screen
        .getByRole("link", { name: "Explore & add to bucket" })
        .getAttribute("href"),
    ).toBe("/explore?trip=draft-1");
    expect(
      screen.getByRole("link", { name: "Go to my trip" }).getAttribute("href"),
    ).toBe("/trips/draft-1/plan");
    const first = writes.find((write) => write.path === "/api/v1/trips")!
      .payload as Profile;
    expect(first.selectedOfferIds).toEqual(["offer-gallery"]);
    expect(first.adults).toBe(4);
    fireEvent.click(
      screen.getByRole("button", { name: "Review or create another draft" }),
    );
    fireEvent.change(screen.getByLabelText("Give this draft a name"), {
      target: { value: "Alternative dates" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Save as another draft" }),
    );
    await waitFor(() =>
      expect(
        screen
          .getByRole("link", { name: "Go to my trip" })
          .getAttribute("href"),
      ).toBe("/trips/draft-2/plan"),
    );
    expect(first.draftName).toBe("Family art week");
    expect(localStorage.getItem("tourism.bucket.v1")).toBe('["offer-gallery"]');
    expect(
      writes.filter((write) => write.path === "/api/v1/trips"),
    ).toHaveLength(2);
  });

  it("allows manual onboarding and reports unavailable voice without losing the conversation", () => {
    render(<Intake mode="chat" fresh />);
    fireEvent.click(screen.getByRole("button", { name: "Use voice" }));
    expect(screen.getByRole("status").textContent).toContain(
      "Voice is unavailable",
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Enter details manually" }),
    );
    expect(screen.getByLabelText("Arrival date")).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", { name: "Review trip summary" }),
    );
    expect(
      screen.getByRole("heading", { name: "Does this feel like your trip?" }),
    ).toBeTruthy();
    expect(writes).toHaveLength(0);
  });

  it("synchronises selected bucket controls and restores their default state on removal", () => {
    render(
      <>
        <BucketButton id="offer-gallery" />
        <BucketButton id="offer-gallery" />
      </>,
    );
    const buttons = screen.getAllByRole("button", { name: /Add to bucket/ });
    fireEvent.click(buttons[0]);
    expect(
      screen
        .getAllByRole("button", { name: /Remove from bucket/ })
        .every((button) => button.getAttribute("aria-pressed") === "true"),
    ).toBe(true);
    fireEvent.click(
      screen.getAllByRole("button", { name: /Remove from bucket/ })[1],
    );
    expect(
      screen
        .getAllByRole("button", { name: /Add to bucket/ })
        .every((button) => button.getAttribute("aria-pressed") === "false"),
    ).toBe(true);
    expect(localStorage.getItem("tourism.bucket.v1")).toBe("[]");
  });
});
