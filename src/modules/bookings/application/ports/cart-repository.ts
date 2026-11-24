import type { Cart, CartLine } from "../../domain/cart";

export interface CartRepository {
  load(userId: string): Promise<Cart>;
  // Replaces the saved cart while `expectedVersion` still matches; null when
  // another device saved first.
  save(
    userId: string,
    lines: CartLine[],
    expectedVersion: number,
  ): Promise<Cart | null>;
}
