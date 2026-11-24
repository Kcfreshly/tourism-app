// The cart: dated selections to buy, each becoming its own booking. Lines are
// independent; there is no itinerary, accommodation or vehicle behind them.
// The browser and the server price lines with the same functions; the server
// reprices at checkout and holds places only then.
import { z } from "zod";
import { feeHalfUp } from "../../trips/domain/planner";
import rules from "../../../../tourism-v1-handoff/data/pricing.demo.json";

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const cartLineSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("EXPERIENCE"),
      id: z.string().min(1).max(64),
      offerId: z.string().min(1).max(100),
      date,
      time: z.string().regex(/^\d{2}:\d{2}$/),
      adults: z.number().int().min(0).max(20),
      children: z.number().int().min(0).max(20),
      // One age per child, for partner age rules and child pricing.
      childAges: z.array(z.number().int().min(0).max(17)).max(20).default([]),
      pickup: z.boolean(),
      pickupAddress: z.string().max(300),
    })
    .strict(),
  z
    .object({
      kind: z.literal("PACKAGE"),
      id: z.string().min(1).max(64),
      packageSlug: z.string().min(1).max(100),
      date,
      travellers: z.number().int().min(1).max(12),
      singleRooms: z.number().int().min(0).max(12),
    })
    .strict(),
]);
export type CartLine = z.infer<typeof cartLineSchema>;
export const cartLimit = 20;

const uniqueIds = (lines: { id: string }[]) =>
  new Set(lines.map((l) => l.id)).size === lines.length;

export const cartLinesSchema = z
  .array(cartLineSchema)
  .max(cartLimit)
  .refine(uniqueIds, "Duplicate cart line id");

export const cartWriteSchema = z
  .object({
    lines: cartLinesSchema,
    expectedVersion: z.number().int().min(0),
  })
  .strict();

export type Cart = { lines: CartLine[]; version: number };

// The same booking twice: same product, date and start.
function sameBooking(a: CartLine, b: CartLine) {
  if (a.kind === "PACKAGE")
    return (
      b.kind === "PACKAGE" &&
      a.packageSlug === b.packageSlug &&
      a.date === b.date
    );
  if (b.kind === "PACKAGE") return false;
  return a.offerId === b.offerId && a.date === b.date && a.time === b.time;
}

// At sign-in (C2): the guest's lines are newer, so they replace an account
// line for the same booking; the rest keep their order, up to the limit.
// Returns how many lines were left out by the limit.
export function mergeCarts(saved: CartLine[], guest: CartLine[]) {
  const merged = [
    ...saved.filter(
      (s) => !guest.some((g) => g.id === s.id || sameBooking(s, g)),
    ),
    ...guest,
  ];
  return {
    lines: merged.slice(0, cartLimit),
    dropped: Math.max(0, merged.length - cartLimit),
  };
}

export type PriceRow = { label: string; totalMinor: number };

export function experienceLinePrice(
  line: Pick<
    CartLine & { kind: "EXPERIENCE" },
    "adults" | "children" | "pickup"
  >,
  offer: { priceBasis: string; rateMinor: number },
  details: { childRateMinor: number; pickupRateMinor: number },
): PriceRow[] {
  const rows: PriceRow[] =
    offer.priceBasis === "PER_ADULT"
      ? [
          {
            label: `${line.adults} ${line.adults === 1 ? "adult" : "adults"}`,
            totalMinor: line.adults * offer.rateMinor,
          },
          ...(line.children
            ? [
                {
                  label: `${line.children} ${line.children === 1 ? "child" : "children"}`,
                  totalMinor: line.children * details.childRateMinor,
                },
              ]
            : []),
        ]
      : [
          {
            label: `Group of ${line.adults + line.children}`,
            totalMinor: offer.rateMinor,
          },
        ];
  if (line.pickup && details.pickupRateMinor)
    rows.push({ label: "Pickup", totalMinor: details.pickupRateMinor });
  return rows;
}

export function packageLinePrice(
  line: Pick<CartLine & { kind: "PACKAGE" }, "travellers" | "singleRooms">,
  p: { priceMinor: number; singleSupplementMinor: number },
): PriceRow[] {
  return [
    {
      label: `${line.travellers} ${line.travellers === 1 ? "traveller" : "travellers"}`,
      totalMinor: line.travellers * p.priceMinor,
    },
    ...(line.singleRooms
      ? [
          {
            label: `${line.singleRooms} single ${line.singleRooms === 1 ? "room" : "rooms"}`,
            totalMinor: line.singleRooms * p.singleSupplementMinor,
          },
        ]
      : []),
  ];
}

export function sumRows(rows: PriceRow[]) {
  return rows.reduce((n, row) => n + row.totalMinor, 0);
}

// Service fee per line, so one line's fee can be refunded on its own later.
export function lineFee(lineTotalMinor: number) {
  return feeHalfUp(lineTotalMinor, rules.feeBps);
}

export function cartTotals(lineTotals: number[]) {
  const subtotalMinor = lineTotals.reduce((n, t) => n + t, 0);
  const feeMinor = lineTotals.reduce((n, t) => n + lineFee(t), 0);
  return { subtotalMinor, feeMinor, totalMinor: subtotalMinor + feeMinor };
}

// The server's price and availability for a cart, shown before Pay.
export type QuotedLine = {
  id: string;
  title: string;
  rows: PriceRow[];
  totalMinor: number;
  feeMinor: number;
  problem?: string;
  // "2 places left" when few remain (C5).
  low?: string;
};

export type Quote = {
  lines: QuotedLine[];
  // Lines without a problem only.
  totals: ReturnType<typeof cartTotals>;
};
