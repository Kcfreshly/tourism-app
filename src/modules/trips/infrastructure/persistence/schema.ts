import {
  pgTable,
  uuid,
  text,
  integer,
  jsonb,
  timestamp,
  boolean,
} from "drizzle-orm/pg-core";
export const trips = pgTable("trips", {
  id: uuid().primaryKey(),
  ownerId: uuid().notNull(),
  ownerType: text().notNull().default("GUEST"),
  version: integer().notNull().default(1),
  profile: jsonb().notNull(),
  items: jsonb().notNull().default([]),
  services: jsonb().notNull().default({
    assistance: "DRIVER_ONLY",
    vehicleWindows: {},
    guideItemIds: [],
    guideDays: [],
  }),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});
export const proposals = pgTable("planner_proposals", {
  id: uuid().primaryKey(),
  tripId: uuid()
    .notNull()
    .references(() => trips.id),
  tripVersion: integer().notNull(),
  payload: jsonb().notNull(),
  expiresAt: timestamp({ withTimezone: true }).notNull(),
  appliedAt: timestamp({ withTimezone: true }),
});
// One row ("default") of staff-editable transport and guide rules. No row
// means the defaults in transport-settings.ts apply.
export const transportSettings = pgTable("transport_settings", {
  id: text().primaryKey(),
  settings: jsonb().notNull(),
  version: integer().notNull().default(1),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});
// Places to stay, entered by staff. See migrations/0016.
export const hotels = pgTable("hotels", {
  id: uuid().primaryKey(),
  name: text().notNull(),
  aliases: text().array().notNull().default([]),
  zoneId: text().notNull(),
  type: text().notNull(),
  address: text().notNull(),
  active: boolean().notNull().default(true),
  version: integer().notNull().default(1),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});
