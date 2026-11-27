// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import StayFields from "../src/components/intake-stay";
import {
  initialProfile,
  stayLabel,
  type Profile,
} from "../src/modules/trips/domain/profile";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

let latest: Profile;
function Form() {
  const [profile, setProfile] = useState<Profile>({
    ...initialProfile,
    accommodationBy: "FASTLIFE",
    zoneId: "LEKKI",
    // What choosing "Book it for me" sets.
    stay: { type: "HOTEL", choice: { kind: "RECOMMEND" } },
  });
  latest = profile;
  return (
    <StayFields
      profile={profile}
      onChange={(stay) => setProfile((p) => ({ ...p, stay }))}
    />
  );
}

describe("stay preference form", () => {
  it("invites a link or hotel and a nightly budget without extra clicks", () => {
    render(<Form />);
    expect(
      screen.getByText(/any hotel, Booking.com or Airbnb listing/),
    ).toBeTruthy();
    const box = screen.getByLabelText(
      /Somewhere you’d like us to consider/,
    ) as HTMLInputElement;
    expect(box.getAttribute("aria-describedby")).toBeTruthy();
    expect(
      screen.getByText(/paste a link to a Booking.com or Airbnb listing/),
    ).toBeTruthy();
    expect(screen.getByLabelText(/Most you’d spend per night/)).toBeTruthy();
  });

  it("keeps a pasted Airbnb link and the budget as the traveller's taste", () => {
    vi.stubGlobal("fetch", vi.fn());
    render(<Form />);
    fireEvent.change(screen.getByLabelText(/Most you’d spend per night/), {
      target: { value: "80000" },
    });
    fireEvent.change(
      screen.getByLabelText(/Somewhere you’d like us to consider/),
      { target: { value: "https://www.airbnb.com/rooms/42" } },
    );
    fireEvent.click(
      screen.getByRole("button", { name: /Use this Airbnb listing/ }),
    );
    expect(latest.stay).toEqual({
      type: "HOTEL",
      budgetPerNightMinor: 8_000_000,
      choice: {
        kind: "LINK",
        url: "https://www.airbnb.com/rooms/42",
        source: "AIRBNB",
      },
    });
    expect(screen.getByText(/we’ll use it as a guide/)).toBeTruthy();
    // Links are never fetched by the server or the page.
    expect(fetch).not.toHaveBeenCalled();
    expect(stayLabel(latest)).toMatch(/up to ₦80,000 a night · Airbnb listing/);
  });
});
