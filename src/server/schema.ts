import {
  pgTable,
  uuid,
  text,
  integer,
  jsonb,
  timestamp,
  boolean,
} from "drizzle-orm/pg-core";
export const sessions = pgTable("sessions", {
  id: uuid().primaryKey(),
  tokenHash: text().notNull().unique(),
  role: text().notNull().default("GUEST"),
  expiresAt: timestamp({ withTimezone: true }).notNull(),
});
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
export const user = pgTable("auth_user", {
  id: text().primaryKey(),
  name: text().notNull(),
  email: text().notNull().unique(),
  emailVerified: boolean().notNull().default(false),
  image: text(),
  role: text().notNull().default("CUSTOMER"),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});
export const session = pgTable("auth_session", {
  id: text().primaryKey(),
  token: text().notNull().unique(),
  expiresAt: timestamp({ withTimezone: true }).notNull(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  ipAddress: text(),
  userAgent: text(),
  userId: text()
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});
export const account = pgTable("auth_account", {
  id: text().primaryKey(),
  accountId: text().notNull(),
  providerId: text().notNull(),
  userId: text()
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text(),
  refreshToken: text(),
  idToken: text(),
  accessTokenExpiresAt: timestamp({ withTimezone: true }),
  refreshTokenExpiresAt: timestamp({ withTimezone: true }),
  scope: text(),
  password: text(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});
export const verification = pgTable("auth_verification", {
  id: text().primaryKey(),
  identifier: text().notNull(),
  value: text().notNull(),
  expiresAt: timestamp({ withTimezone: true }).notNull(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});
// One saved bucket per account. The browser keeps a cache for fast render.
export const accountBuckets = pgTable("account_buckets", {
  userId: text()
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  offerIds: jsonb().$type<string[]>().notNull().default([]),
  version: integer().notNull().default(0),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});
export const audit = pgTable("audit_events", {
  id: uuid().primaryKey(),
  actorId: text().notNull(),
  action: text().notNull(),
  entityId: text().notNull(),
  details: jsonb().notNull(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});
export const rateLimits = pgTable("request_limits", {
  key: text().primaryKey(),
  count: integer().notNull(),
  resetAt: timestamp({ withTimezone: true }).notNull(),
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
