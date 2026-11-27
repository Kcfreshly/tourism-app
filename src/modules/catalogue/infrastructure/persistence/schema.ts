import {
  pgTable,
  uuid,
  text,
  integer,
  jsonb,
  timestamp,
  customType,
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
  // The partner who runs it; null for listings Fastlife runs itself.
  partnerId: uuid(),
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
  partnerId: uuid(),
});
// Uploaded listing photos. Rows are never deleted, so a listing restored from
// the audit trail gets its photos back.
const bytea = customType<{ data: Uint8Array; driverData: Uint8Array }>({
  dataType: () => "bytea",
});
export const media = pgTable("media", {
  id: uuid().primaryKey(),
  contentType: text().notNull(),
  bytes: integer().notNull(),
  sha256: text().notNull().unique(),
  data: bytea().notNull(),
  uploadedBy: text().notNull(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});
