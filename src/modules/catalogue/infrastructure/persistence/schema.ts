import {
  pgTable,
  uuid,
  text,
  integer,
  jsonb,
  timestamp,
} from "drizzle-orm/pg-core";
export const catalogue = pgTable("catalogue", {
  id: uuid().primaryKey(),
  seedKey: text().notNull().unique(),
  status: text().notNull(),
  version: integer().notNull().default(1),
  record: jsonb().notNull(),
  review: jsonb().notNull().default({
    content: false,
    rates: false,
    capacity: false,
    policy: false,
    media: false,
  }),
});
// Ready-made trips. `record` holds a TripPackage; the slug is fixed at
// creation because cart lines refer to it.
export const packages = pgTable("packages", {
  id: uuid().primaryKey(),
  slug: text().notNull().unique(),
  status: text().notNull(),
  version: integer().notNull().default(1),
  record: jsonb().notNull(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});
