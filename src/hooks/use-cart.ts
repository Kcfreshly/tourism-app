"use client";
import { useSyncExternalStore } from "react";
import {
  cartLimit,
  cartLineSchema,
  type CartLine,
} from "@/modules/bookings/domain/cart";
import { notifyStore, storeKeys, subscribeToStore } from "./browser-store";

const empty: CartLine[] = [];
let cached = "";
let value = empty;
function snapshot() {
  try {
    const raw = localStorage.getItem(storeKeys.cart) || "[]";
    if (raw !== cached) {
      cached = raw;
      const parsed: unknown = JSON.parse(raw);
      value = Array.isArray(parsed)
        ? parsed
            .map((line) => cartLineSchema.safeParse(line))
            .filter((r) => r.success)
            .map((r) => r.data)
            .filter((l, i, all) => all.findIndex((x) => x.id === l.id) === i)
            .slice(0, cartLimit)
        : empty;
    }
  } catch {
    return value;
  }
  return value;
}

export function readCart() {
  return snapshot();
}

export function writeCart(next: CartLine[]) {
  try {
    localStorage.setItem(
      storeKeys.cart,
      JSON.stringify(next.slice(0, cartLimit)),
    );
    notifyStore();
  } catch {
    /* Storage unavailable: the cart lasts for this page only. */
  }
}

export type NewCartLine =
  | Omit<CartLine & { kind: "EXPERIENCE" }, "id">
  | Omit<CartLine & { kind: "PACKAGE" }, "id">;

// Dated selections to buy. Reads come from the browser cache so pages render
// at once; useCartSync keeps a signed-in traveller's cart on the server.
// Each line is booked on its own; the cart never becomes an itinerary.
export function useCart() {
  const lines = useSyncExternalStore(subscribeToStore, snapshot, () => empty);
  function add(line: NewCartLine) {
    const id = crypto.randomUUID();
    writeCart([...snapshot(), { ...line, id } as CartLine]);
    return id;
  }
  function update(id: string, line: NewCartLine) {
    writeCart(
      snapshot().map((l) => (l.id === id ? ({ ...line, id } as CartLine) : l)),
    );
  }
  function remove(id: string) {
    writeCart(snapshot().filter((l) => l.id !== id));
  }
  // Lines that became bookings.
  function removeMany(ids: string[]) {
    const gone = new Set(ids);
    if (snapshot().some((l) => gone.has(l.id)))
      writeCart(snapshot().filter((l) => !gone.has(l.id)));
  }
  return {
    lines,
    add,
    update,
    remove,
    removeMany,
    full: lines.length >= cartLimit,
  };
}
