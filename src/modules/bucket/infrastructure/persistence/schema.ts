import { pgTable, text, integer, jsonb, timestamp } from "drizzle-orm/pg-core";
import { user } from "../../../identity/infrastructure/persistence/schema";
// One saved bucket per account. The browser keeps a cache for fast render.
export const accountBuckets = pgTable("account_buckets", {
  userId: text()
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  offerIds: jsonb().$type<string[]>().notNull().default([]),
  version: integer().notNull().default(0),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});
