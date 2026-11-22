import { and, gte, inArray, lte, sql } from "drizzle-orm";
import type { Database } from "@/database/client";
import { sqlRows } from "@/database/sql-rows";
import type { ListingStatsRepository } from "../../application/ports/partner-repository";
import type { ProductType } from "../../domain/partner";
import { listingVisits } from "./schema";

function counts(rows: Record<string, unknown>[]) {
  return Object.fromEntries(
    rows.map((r) => [String(r.offer_id), Number(r.count)]),
  );
}

export class DrizzleListingStatsRepository implements ListingStatsRepository {
  constructor(private readonly db: () => Database) {}

  async recordVisit(input: {
    productType: ProductType;
    productId: string;
    day: string;
    visitor: string;
  }) {
    await this.db()
      .insert(listingVisits)
      .values(input)
      .onConflictDoUpdate({
        target: [
          listingVisits.productType,
          listingVisits.productId,
          listingVisits.day,
          listingVisits.visitor,
        ],
        set: { views: sql`${listingVisits.views} + 1` },
      });
  }

  async visits(
    products: { productType: ProductType; productId: string }[],
    from: string,
    to: string,
  ) {
    if (!products.length) return { perProduct: [], visitors: 0, daily: [] };
    const where = and(
      inArray(
        listingVisits.productId,
        products.map((p) => p.productId),
      ),
      gte(listingVisits.day, from),
      lte(listingVisits.day, to),
    );
    const db = this.db();
    const [perProduct, [total], daily] = await Promise.all([
      db
        .select({
          productType: listingVisits.productType,
          productId: listingVisits.productId,
          views: sql<number>`sum(${listingVisits.views})::int`,
          visitors: sql<number>`count(*)::int`,
        })
        .from(listingVisits)
        .where(where)
        .groupBy(listingVisits.productType, listingVisits.productId),
      db
        .select({
          visitors: sql<number>`count(distinct ${listingVisits.visitor})::int`,
        })
        .from(listingVisits)
        .where(where),
      db
        .select({
          day: listingVisits.day,
          views: sql<number>`sum(${listingVisits.views})::int`,
        })
        .from(listingVisits)
        .where(where)
        .groupBy(listingVisits.day),
    ]);
    // Ids are unique across types (uuids and slugs), but match both anyway.
    const wanted = new Set(
      products.map((p) => `${p.productType}:${p.productId}`),
    );
    return {
      perProduct: perProduct
        .filter((r) => wanted.has(`${r.productType}:${r.productId}`))
        .map((r) => ({
          ...r,
          productType: r.productType as ProductType,
          views: Number(r.views),
          visitors: Number(r.visitors),
        })),
      visitors: Number(total?.visitors ?? 0),
      daily: daily.map((d) => ({ day: d.day, views: Number(d.views) })),
    };
  }

  // Reads the bucket and trips tables; their modules own the writes.
  async saves(offerIds: string[]) {
    if (!offerIds.length) return {};
    return counts(
      sqlRows(
        await this.db().execute(sql`
          SELECT o AS offer_id, count(*)::int AS count
          FROM account_buckets, jsonb_array_elements_text(offer_ids) AS o
          WHERE o IN ${offerIds}
          GROUP BY o`),
      ),
    );
  }

  async tripPlans(offerIds: string[]) {
    if (!offerIds.length) return {};
    return counts(
      sqlRows(
        await this.db().execute(sql`
          SELECT i->>'offerId' AS offer_id, count(DISTINCT t.id)::int AS count
          FROM trips AS t, jsonb_array_elements(t.items) AS i
          WHERE i->>'offerId' IN ${offerIds}
          GROUP BY 1`),
      ),
    );
  }
}
