import {
  pgTable,
  uuid,
  text,
  integer,
  jsonb,
  timestamp,
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
