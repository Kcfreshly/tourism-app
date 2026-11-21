// Where a traveller is in Explore, written into the address so back, reload,
// sharing and the experience page's back link all return them to the same
// filtered results.
export type ExploreState = {
  category?: string;
  q?: string;
  // "", "weekend", a day, or "range" for the dates of a visit.
  date?: string;
  from?: string;
  to?: string;
  price?: string;
  family?: boolean;
  arrival?: string;
  area?: string;
  kind?: string;
  access?: boolean;
  bucket?: boolean;
  trip?: string;
};

export const explorePath = "/explore";

export function exploreQuery(s: ExploreState) {
  const range = s.date === "range";
  return new URLSearchParams(
    Object.entries({
      category: s.category,
      q: s.q?.trim(),
      date: range ? "" : s.date,
      from: range ? s.from : "",
      to: range ? s.to : "",
      price: s.price,
      family: s.family ? "1" : "",
      arrival: s.arrival,
      area: s.area,
      kind: s.kind,
      access: s.access ? "1" : "",
      view: s.bucket ? "bucket" : "",
      trip: s.trip,
    }).filter((entry): entry is [string, string] => !!entry[1]),
  ).toString();
}

export function exploreHref(s: ExploreState) {
  const query = exploreQuery(s);
  return `${explorePath}${query ? `?${query}` : ""}`;
}

// The id a results card carries, so a return link can scroll back to it.
export function cardAnchor(e: { id: string; seedKey?: string }) {
  return `exp-${e.seedKey ?? e.id}`;
}

// Only an Explore address is a valid return target; anything else (another
// site, a protocol-relative URL, another page) falls back to plain Explore.
const exploreReturn = /^\/explore(?:[?#][^\\\s]*)?$/;
export function safeExploreHref(back?: string | string[]) {
  return typeof back === "string" && exploreReturn.test(back)
    ? back
    : explorePath;
}

// Adds the return address to an experience link, pointing at the card.
export function withBack(
  href: string,
  back: string | undefined,
  e: { id: string; seedKey?: string },
) {
  if (!back) return href;
  const target = `${back.split("#")[0]}#${cardAnchor(e)}`;
  return `${href}${href.includes("?") ? "&" : "?"}back=${encodeURIComponent(target)}`;
}
