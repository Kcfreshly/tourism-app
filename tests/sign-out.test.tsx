// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";
import { useBucket } from "../src/hooks/use-bucket";
import { useActiveTrip } from "../src/hooks/use-active-trip";
import { useSignOut } from "../src/hooks/use-sign-out";

const signOut = vi.fn();
vi.mock("../src/components/auth-client", () => ({
  authClient: { signOut: () => signOut() },
}));

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem("tourism.bucket.v1", '["offer-gallery","offer-suya"]');
  localStorage.setItem("tourism.onboardedTrip", "trip-1");
  localStorage.setItem("tourism.profile", '{"startDate":"2026-11-10"}');
  localStorage.setItem("tourism.planner.split", "40");
  signOut.mockReset();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("sign out", () => {
  it("empties the bucket and forgets the trip, but keeps layout preferences", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("{}", { status: 200 })),
    );
    const bucket = renderHook(() => useBucket());
    const trip = renderHook(() => useActiveTrip());
    const { result } = renderHook(() => useSignOut());
    expect(bucket.result.current.ids).toHaveLength(2);
    expect(trip.result.current).toBe("trip-1");

    let ok = false;
    await act(async () => {
      ok = await result.current.signOut();
    });

    expect(ok).toBe(true);
    expect(signOut).toHaveBeenCalledOnce();
    // Open views update straight away, not only after a reload.
    expect(bucket.result.current.ids).toEqual([]);
    expect(trip.result.current).toBe("");
    expect(localStorage.getItem("tourism.bucket.v1")).toBeNull();
    expect(localStorage.getItem("tourism.profile")).toBeNull();
    expect(localStorage.getItem("tourism.planner.split")).toBe("40");
  });

  it("keeps everything when the session could not be ended", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("{}", { status: 503 })),
    );
    const { result } = renderHook(() => useSignOut());
    let ok = true;
    await act(async () => {
      ok = await result.current.signOut();
    });
    expect(ok).toBe(false);
    expect(signOut).not.toHaveBeenCalled();
    expect(localStorage.getItem("tourism.bucket.v1")).toContain(
      "offer-gallery",
    );
    expect(localStorage.getItem("tourism.onboardedTrip")).toBe("trip-1");
  });
});
