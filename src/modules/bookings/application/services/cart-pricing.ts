import {
  cartTotals,
  lineFee,
  type CartLine,
  type Quote,
  type QuotedLine,
} from "../../domain/cart";
import {
  availabilityNote,
  productRef,
  resolveLine,
  slotKey,
  type Bookable,
} from "../../domain/resolve-line";
import type { BookableCatalogue } from "../ports/bookable-catalogue";
import type {
  CheckoutRepository,
  HeldLine,
} from "../ports/checkout-repository";

// Prices a cart on the server from current listings, trips and capacity.
// Used for the quote shown before Pay and again when Pay is pressed.
export class CartPricing {
  constructor(
    private readonly catalogue: BookableCatalogue,
    private readonly checkouts: CheckoutRepository,
  ) {}

  async price(lines: CartLine[], now: Date) {
    const bookables = await this.catalogue.load();
    const find = (line: CartLine): Bookable | undefined => {
      const ref = productRef(line);
      return bookables.find((b) =>
        b.kind === "PACKAGE"
          ? ref.kind === "PACKAGE" && b.productId === ref.key
          : ref.kind === "EXPERIENCE" && b.listing.offer.id === ref.key,
      );
    };
    const resolved = lines.map((l) => resolveLine(l, find(l), now.getTime()));
    const remaining = await this.checkouts.remaining(
      resolved.flatMap((r) => (r.slot && !r.problem ? [r.slot] : [])),
      now,
    );
    // Lines in this cart for the same slot share what's left.
    const asked = new Map<string, number>();
    const quoted: QuotedLine[] = [];
    const held: HeldLine[] = [];
    for (const r of resolved) {
      let problem = r.problem;
      let low: string | undefined;
      if (!problem && r.slot && r.terms) {
        const key = slotKey(r.slot);
        const before = asked.get(key) ?? 0;
        const note = availabilityNote(
          r.slot,
          (remaining.get(key) ?? r.slot.capacity) - before,
        );
        problem = note.problem;
        low = note.low;
        if (!problem) {
          asked.set(key, before + r.slot.units);
          held.push({
            line: r.line,
            title: r.title,
            rows: r.rows,
            subtotalMinor: r.totalMinor,
            feeMinor: lineFee(r.totalMinor),
            totalMinor: r.totalMinor + lineFee(r.totalMinor),
            terms: r.terms,
            slot: r.slot,
          });
        }
      }
      quoted.push({
        id: r.line.id,
        title: r.title,
        rows: r.rows,
        totalMinor: r.totalMinor,
        feeMinor: problem ? 0 : lineFee(r.totalMinor),
        ...(problem ? { problem } : {}),
        ...(low ? { low } : {}),
      });
    }
    const quote: Quote = {
      lines: quoted,
      totals: cartTotals(held.map((h) => h.subtotalMinor)),
    };
    return { quote, held };
  }
}
