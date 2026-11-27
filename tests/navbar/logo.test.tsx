// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import SiteChrome from "../../src/components/site-chrome";

vi.mock("next/navigation", () => ({ usePathname: () => "/" }));
vi.mock("../../src/components/auth-client", () => ({
  authClient: { useSession: () => ({ data: null }) },
}));
// The header is under test, not the bucket and cart it hosts.
vi.mock("../../src/hooks/use-bucket-sync", () => ({ useBucketSync: () => {} }));
vi.mock("../../src/components/bucket", () => ({ BucketNav: () => null }));
vi.mock("../../src/components/cart", () => ({ CartNav: () => null }));

beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("site header", () => {
  it("links the logo home", () => {
    render(<SiteChrome />);
    const logo = screen.getByRole("link", { name: "Fastlife home" });
    expect(logo.getAttribute("href")).toBe("/");
  });

  it("renders the main navigation links", () => {
    render(<SiteChrome />);
    const nav = within(
      screen.getByRole("navigation", { name: "Main navigation" }),
    );
    const href = (name: RegExp) =>
      nav.getByRole("link", { name }).getAttribute("href");

    expect(href(/things to do/i)).toBe("/explore");
    expect(href(/ready-made trips/i)).toBe("/packages");
    expect(href(/plan your trip/i)).toBe("/plan/new");
    expect(href(/my plans/i)).toBe("/trips");
  });
});
