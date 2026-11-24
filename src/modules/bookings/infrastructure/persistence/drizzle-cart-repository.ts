import { eq, sql } from "drizzle-orm";
import type { Database } from "@/database/client";
import type { CartRepository } from "../../application/ports/cart-repository";
import type { CartLine } from "../../domain/cart";
import { accountCarts } from "./schema";

export class DrizzleCartRepository implements CartRepository {
  constructor(private readonly db: () => Database) {}

  async load(userId: string) {
    const [row] = await this.db()
      .select({ lines: accountCarts.lines, version: accountCarts.version })
      .from(accountCarts)
      .where(eq(accountCarts.userId, userId));
    return row ?? { lines: [], version: 0 };
  }

  async save(userId: string, lines: CartLine[], expectedVersion: number) {
    const [row] = await this.db()
      .insert(accountCarts)
      .values({ userId, lines, version: 1 })
      .onConflictDoUpdate({
        target: accountCarts.userId,
        set: {
          lines,
          version: sql`${accountCarts.version} + 1`,
          updatedAt: sql`now()`,
        },
        setWhere: eq(accountCarts.version, expectedVersion),
      })
      .returning();
    return row ? { lines: row.lines, version: row.version } : null;
  }
}
