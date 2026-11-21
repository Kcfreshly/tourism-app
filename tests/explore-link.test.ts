import { describe, expect, it } from "vitest";
import {
  cardAnchor,
  exploreHref,
  exploreQuery,
  safeExploreHref,
  withBack,
} from "../src/modules/catalogue/domain/explore-link";

describe("explore link state", () => {
  it("writes only the filters that are set, in a stable order", () => {
    expect(exploreHref({})).toBe("/explore");
    expect(
      exploreQuery({
        category: "nature",
        q: "  kayak  ",
        date: "2026-11-20",
        price: "under-10k",
        family: true,
        arrival: "SELF",
        area: "LEKKI",
        kind: "MAIN",
        access: true,
        bucket: true,
        trip: "trip-1",
      }),
    ).toBe(
      "category=nature&q=kayak&date=2026-11-20&price=under-10k&family=1&arrival=SELF&area=LEKKI&kind=MAIN&access=1&view=bucket&trip=trip-1",
    );
  });

  it("writes a visit range as from/to and never as a date", () => {
    expect(
      exploreHref({ date: "range", from: "2026-11-20", to: "2026-11-22" }),
    ).toBe("/explore?from=2026-11-20&to=2026-11-22");
    // Range fields are ignored unless the range is the chosen date.
    expect(
      exploreHref({ date: "weekend", from: "2026-11-20", to: "2026-11-22" }),
    ).toBe("/explore?date=weekend");
    expect(exploreHref({ q: "   ", family: false, access: false })).toBe(
      "/explore",
    );
  });

  it("encodes search text so it survives the address bar", () => {
    expect(exploreHref({ q: "art & food" })).toBe("/explore?q=art+%26+food");
  });

  it("anchors cards by seed key, falling back to the id", () => {
    expect(cardAnchor({ id: "uuid-1", seedKey: "nature-walk" })).toBe(
      "exp-nature-walk",
    );
    expect(cardAnchor({ id: "uuid-1" })).toBe("exp-uuid-1");
  });

  it("only accepts Explore addresses as a return target", () => {
    for (const ok of [
      "/explore",
      "/explore?category=nature",
      "/explore?category=nature&q=art#exp-gallery",
      "/explore#exp-gallery",
    ])
      expect(safeExploreHref(ok)).toBe(ok);
    for (const bad of [
      undefined,
      "",
      ["/explore?category=nature"],
      "//evil.example/explore",
      "https://evil.example/explore",
      "/explore.evil.example",
      "/explorer",
      "/cart",
      "/explore?x=\\evil",
      "/explore?x=a b",
      "javascript:alert(1)",
    ])
      expect(safeExploreHref(bad)).toBe("/explore");
  });

  it("adds the return address to experience links, pointing at the card", () => {
    const e = { id: "uuid-1", seedKey: "gallery" };
    expect(withBack("/experiences/gallery", undefined, e)).toBe(
      "/experiences/gallery",
    );
    expect(
      withBack("/experiences/gallery", "/explore?category=culture", e),
    ).toBe(
      `/experiences/gallery?back=${encodeURIComponent("/explore?category=culture#exp-gallery")}`,
    );
    // An existing query gets the parameter appended; an old anchor is replaced.
    expect(withBack("/experiences/gallery?book=1", "/explore#exp-old", e)).toBe(
      `/experiences/gallery?book=1&back=${encodeURIComponent("/explore#exp-gallery")}`,
    );
    const back = new URL(
      withBack("/experiences/gallery?book=1", "/explore?q=art", e),
      "https://example.test",
    ).searchParams.get("back");
    expect(safeExploreHref(back ?? undefined)).toBe(
      "/explore?q=art#exp-gallery",
    );
  });
});
