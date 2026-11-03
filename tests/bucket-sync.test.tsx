// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { useBucket } from "../src/hooks/use-bucket";
import { useBucketSync, flushBucketSync } from "../src/hooks/use-bucket-sync";
import { mergeBuckets, bucketWriteSchema } from "../src/domain/bucket";

let session: { user: { id: string } } | null = null;
vi.mock("../src/components/auth-client", () => ({
  authClient: { useSession: () => ({ data: session }) },
}));

// A fake /api/v1/bucket with version checks, like the real route.
let server = { offerIds: [] as string[], version: 0 };
const puts: string[][] = [];
function fakeApi() {
  return vi.fn(async (_url: string, init?: RequestInit) => {
    if (init?.method === "PUT") {
      const body = JSON.parse(String(init.body));
      if (body.expectedVersion !== server.version)
        return new Response("{}", { status: 409 });
      puts.push(body.offerIds);
      server = {
        offerIds: body.offerIds.filter((id: string) => id !== "offer-paused"),
        version: server.version + 1,
      };
    }
    return new Response(JSON.stringify({ data: server }), { status: 200 });
  });
}
const cache = () => JSON.parse(localStorage.getItem("tourism.bucket.v1")!);

beforeEach(() => {
  localStorage.clear();
  session = { user: { id: "user-1" } };
  server = { offerIds: ["offer-gallery"], version: 3 };
  puts.length = 0;
  vi.stubGlobal("fetch", fakeApi());
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("bucket helpers", () => {
  it("merges guest picks after saved ones, without duplicates, up to 30", () => {
    expect(mergeBuckets(["a", "b"], ["b", "c"])).toEqual(["a", "b", "c"]);
    const many = Array.from({ length: 40 }, (_, i) => `offer-${i}`);
    expect(mergeBuckets(many.slice(0, 25), many.slice(20))).toHaveLength(30);
  });
  it("rejects oversized or duplicate writes", () => {
    const ids = Array.from({ length: 31 }, (_, i) => `offer-${i}`);
    expect(
      bucketWriteSchema.safeParse({ offerIds: ids, expectedVersion: 0 })
        .success,
    ).toBe(false);
    expect(
      bucketWriteSchema.safeParse({ offerIds: ["a", "a"], expectedVersion: 0 })
        .success,
    ).toBe(false);
  });
});

describe("useBucketSync", () => {
  it("adds a guest's picks to the saved bucket at sign-in", async () => {
    localStorage.setItem("tourism.bucket.v1", '["offer-suya"]');
    renderHook(() => useBucketSync());
    await waitFor(() => expect(puts).toHaveLength(1));
    expect(puts[0]).toEqual(["offer-gallery", "offer-suya"]);
    expect(cache()).toEqual(["offer-gallery", "offer-suya"]);
    expect(localStorage.getItem("tourism.bucket.owner")).toBe("user-1");
    expect(localStorage.getItem("tourism.bucket.pending")).toBeNull();
  });

  it("replaces a cache that belonged to another account", async () => {
    localStorage.setItem("tourism.bucket.v1", '["offer-beach"]');
    localStorage.setItem("tourism.bucket.owner", "user-2");
    renderHook(() => useBucketSync());
    await waitFor(() => expect(cache()).toEqual(["offer-gallery"]));
    expect(puts).toEqual([]);
  });

  it("saves once after the traveller pauses, and drops paused offers", async () => {
    localStorage.setItem("tourism.bucket.owner", "user-1");
    renderHook(() => useBucketSync());
    const bucket = renderHook(() => useBucket());
    await waitFor(() =>
      expect(bucket.result.current.ids).toEqual(["offer-gallery"]),
    );
    await new Promise((r) => setTimeout(r, 0));
    act(() => bucket.result.current.toggle("offer-paused"));
    act(() => bucket.result.current.toggle("offer-suya"));
    expect(puts).toHaveLength(0); // still inside the pause
    await waitFor(() => expect(puts).toHaveLength(1), { timeout: 2000 });
    expect(puts[0]).toEqual(["offer-gallery", "offer-paused", "offer-suya"]);
    await waitFor(() =>
      expect(cache()).toEqual(["offer-gallery", "offer-suya"]),
    );
  });

  it("re-sends this device's list when another device saved first", async () => {
    localStorage.setItem("tourism.bucket.owner", "user-1");
    renderHook(() => useBucketSync());
    const bucket = renderHook(() => useBucket());
    await waitFor(() =>
      expect(bucket.result.current.ids).toEqual(["offer-gallery"]),
    );
    await new Promise((r) => setTimeout(r, 0));
    server = { offerIds: ["offer-beach"], version: 9 }; // saved elsewhere
    act(() => bucket.result.current.toggle("offer-suya"));
    await act(() => flushBucketSync());
    expect(puts).toEqual([["offer-gallery", "offer-suya"]]);
    expect(server.version).toBe(10);
  });

  it("keeps a tap made before the saved bucket has loaded", async () => {
    localStorage.setItem("tourism.bucket.owner", "user-1");
    let release: () => void = () => {};
    const api = fakeApi();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        if (!init?.method || init.method === "GET")
          await new Promise<void>((resolve) => (release = resolve));
        return api(url, init);
      }),
    );
    renderHook(() => useBucketSync());
    const bucket = renderHook(() => useBucket());
    act(() => bucket.result.current.toggle("offer-suya")); // load still pending
    await act(async () => release());
    await waitFor(() => expect(puts).toHaveLength(1));
    // The tap is added to the saved bucket, not swapped for the stale cache.
    expect(puts[0]).toEqual(["offer-gallery", "offer-suya"]);
    expect(cache()).toEqual(["offer-gallery", "offer-suya"]);
  });

  it("does nothing for guests", async () => {
    session = null;
    localStorage.setItem("tourism.bucket.v1", '["offer-suya"]');
    renderHook(() => useBucketSync());
    await new Promise((r) => setTimeout(r, 50));
    expect(fetch).not.toHaveBeenCalled();
    expect(cache()).toEqual(["offer-suya"]);
  });
});
