// Fastlife's own list of places to stay, entered by staff, and the "closest
// match" search travellers use when they say where they'd like to stay.
// Search only works as well as this list.
import { z } from "zod";
import { stayTypes, type Profile, type StayType } from "./profile";

export const hotelZones = ["LEKKI", "VI", "MAINLAND"] as const;
type HotelZone = (typeof hotelZones)[number];

export const hotelInputSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    // Other names people use for it: "Eko", "Eko Hotel and Suites".
    aliases: z.array(z.string().trim().min(2).max(120)).max(10).default([]),
    zoneId: z.enum(hotelZones),
    type: z.enum(Object.keys(stayTypes) as [StayType]),
    address: z.string().trim().min(5).max(300),
    active: z.boolean().default(true),
  })
  .strict();
export type HotelInput = z.infer<typeof hotelInputSchema>;

export type Hotel = HotelInput & { id: string; version: number };

// What travellers see in search results.
export type HotelMatch = Pick<Hotel, "id" | "name" | "zoneId" | "type">;

export const maxHotelMatches = 8;

// Words that don't tell hotels apart.
const filler = new Set(["hotel", "hotels", "the", "lagos", "and", "&"]);

// Lower case, accents and punctuation removed, filler words dropped.
export function hotelWords(text: string) {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter((w) => w && !filler.has(w));
}

// Escapes every regular expression character, so typed text is only ever
// matched literally.
export const escapeRegExp = (text: string) =>
  text.replace(/[.*+?^${}()|[\]\\/-]/g, "\\$&");

// Edit distance, stopping early once it is past `max`.
function distance(a: string, b: string, max: number) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++)
      row[j] = Math.min(
        previous[j] + 1,
        row[j - 1] + 1,
        previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    if (Math.min(...row) > max) return max + 1;
    previous = row;
  }
  return previous[b.length];
}

// How well a hotel matches the typed words: 4 its name starts with them,
// 3 every word found, 2 some words found, 1 a word is a small typo away
// (two edits, one for short words), 0 no match.
export function hotelScore(
  hotel: Pick<Hotel, "name" | "aliases">,
  query: string,
) {
  const typed = hotelWords(query);
  if (!typed.length) return 0;
  const names = [hotel.name, ...hotel.aliases].map((n) =>
    hotelWords(n).join(" "),
  );
  const startsWith = new RegExp(`^${escapeRegExp(typed.join(" "))}`);
  if (names.some((n) => startsWith.test(n))) return 4;
  const words = new Set(names.flatMap((n) => n.split(" ")));
  // A typed word is found when a hotel word starts with it ("eko" in "eko",
  // "radis" in "radisson").
  const found = typed.filter((t) =>
    [...words].some((w) => new RegExp(`^${escapeRegExp(t)}`).test(w)),
  );
  if (found.length === typed.length) return 3;
  if (found.length) return 2;
  const typo = typed.some((t) =>
    [...words].some(
      (w) => distance(t, w, t.length <= 4 ? 1 : 2) <= (t.length <= 4 ? 1 : 2),
    ),
  );
  return typo ? 1 : 0;
}

// The closest active hotels, best first: those in the chosen area and of the
// chosen type rank above the rest, then by how well the name matches, then
// alphabetically. At most eight.
export function matchHotels(
  hotels: Hotel[],
  query: string,
  zoneId?: Profile["zoneId"],
  type?: StayType,
): HotelMatch[] {
  return hotels
    .filter((h) => h.active)
    .map((h) => ({
      h,
      score: hotelScore(h, query),
      near:
        Number(!zoneId || zoneId === "UNDECIDED" || h.zoneId === zoneId) +
        Number(!type || h.type === type),
    }))
    .filter((m) => m.score > 0)
    .sort(
      (a, b) =>
        b.near - a.near ||
        b.score - a.score ||
        a.h.name.localeCompare(b.h.name),
    )
    .slice(0, maxHotelMatches)
    .map(({ h }) => ({
      id: h.id,
      name: h.name,
      zoneId: h.zoneId,
      type: h.type,
    }));
}

export type { HotelZone };
