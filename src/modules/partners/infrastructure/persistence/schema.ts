import {
  pgTable,
  uuid,
  text,
  integer,
  jsonb,
  timestamp,
  date,
  primaryKey,
} from "drizzle-orm/pg-core";
import { user } from "../../../identity/infrastructure/persistence/schema";

// See migrations/0009_partners.sql.
export const partners = pgTable("partners", {
  id: uuid().primaryKey(),
  businessName: text().notNull(),
  contactEmail: text().notNull(),
  phone: text().notNull(),
  offering: text().notNull(),
  status: text().notNull(),
  decisionReason: text(),
  decidedBy: text(),
  decidedAt: timestamp({ withTimezone: true }),
  version: integer().notNull().default(1),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const partnerMembers = pgTable(
  "partner_members",
  {
    partnerId: uuid()
      .notNull()
      .references(() => partners.id, { onDelete: "cascade" }),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: text().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.partnerId, t.userId] })],
);

export const listingSubmissions = pgTable("listing_submissions", {
  id: uuid().primaryKey(),
  partnerId: uuid()
    .notNull()
    .references(() => partners.id),
  productType: text().notNull(),
  productId: uuid(),
  baseVersion: integer(),
  name: text().notNull(),
  proposed: jsonb().notNull(),
  status: text().notNull(),
  reason: text(),
  version: integer().notNull().default(1),
  createdBy: text().notNull(),
  submittedAt: timestamp({ withTimezone: true }),
  decidedBy: text(),
  decidedAt: timestamp({ withTimezone: true }),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const listingVisits = pgTable(
  "listing_visits",
  {
    productType: text().notNull(),
    productId: text().notNull(),
    day: date({ mode: "string" }).notNull(),
    visitor: text().notNull(),
    views: integer().notNull().default(1),
  },
  (t) => [
    primaryKey({
      columns: [t.productType, t.productId, t.day, t.visitor],
    }),
  ],
);
