// The cart: dated selections to buy, each becoming its own booking. Lines are
// independent; there is no itinerary, accommodation or vehicle behind them.
// Prices here are previews from sample rates; nothing is held or charged.
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
export function cartTotals(lineTotals: number[]) {
  const subtotalMinor = lineTotals.reduce((n, t) => n + t, 0);
  const feeMinor = lineTotals.reduce(
    (n, t) => n + feeHalfUp(t, rules.feeBps),
    0,
  );
  return { subtotalMinor, feeMinor, totalMinor: subtotalMinor + feeMinor };
}
