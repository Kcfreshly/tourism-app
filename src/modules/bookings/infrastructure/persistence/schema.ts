import {
  pgTable,
  uuid,
  text,
  integer,
  bigint,
  jsonb,
  timestamp,
  date,
  char,
} from "drizzle-orm/pg-core";
import { user } from "../../../identity/infrastructure/persistence/schema";
import type { CartLine, PriceRow } from "../../domain/cart";
import type { LineTerms } from "../../domain/resolve-line";
import type { ServiceLine } from "../../domain/trip-checkout";

// See migrations/0010_cart_checkout.sql and 0011_trip_checkout.sql.
const money = () => bigint({ mode: "number" });

export const accountCarts = pgTable("account_carts", {
  userId: text()
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  lines: jsonb().$type<CartLine[]>().notNull().default([]),
  version: integer().notNull().default(0),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const inventorySlots = pgTable("inventory_slots", {
  id: uuid().primaryKey(),
  productType: text().notNull(),
  productId: text().notNull(),
  partnerId: uuid(),
  localDate: date().notNull(),
  startTime: text().notNull(),
  capacity: integer().notNull(),
  capacityUnit: text().notNull(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

// A guest checkout (0012) has no user; its browser's key hash owns it.
export const checkouts = pgTable("checkouts", {
  id: uuid().primaryKey(),
  userId: text(),
  guestKeyHash: text(),
  status: text().notNull(),
  subtotalMinor: money().notNull(),
  feeMinor: money().notNull(),
  totalMinor: money().notNull(),
  currency: char({ length: 3 }).notNull().default("NGN"),
  priceVersion: text().notNull(),
  expiresAt: timestamp({ withTimezone: true }).notNull(),
  idempotencyKey: text().notNull().unique(),
  contactName: text().notNull(),
  contactEmail: text().notNull(),
  contactPhone: text().notNull(),
  reviewReason: text(),
  // Set when a planned trip was paid; the version it was priced from.
  tripId: uuid(),
  tripVersion: integer(),
  version: integer().notNull().default(1),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const checkoutLines = pgTable("checkout_lines", {
  id: uuid().primaryKey(),
  checkoutId: uuid().notNull(),
  lineNo: integer().notNull(),
  cartLineId: text().notNull(),
  productType: text().notNull(),
  productId: text().notNull(),
  partnerId: uuid(),
  // Null for service lines (cars, guides), which hold no places.
  slotId: uuid(),
  localDate: date().notNull(),
  startTime: text().notNull(),
  units: integer().notNull(),
  title: text().notNull(),
  // What was bought: a cart line, or a trip's car or guide.
  cartLine: jsonb().$type<CartLine | ServiceLine>().notNull(),
  priceRows: jsonb().$type<PriceRow[]>().notNull(),
  subtotalMinor: money().notNull(),
  feeMinor: money().notNull(),
  totalMinor: money().notNull(),
  terms: jsonb().$type<LineTerms>().notNull(),
});

export const orders = pgTable("orders", {
  id: uuid().primaryKey(),
  checkoutId: uuid().notNull().unique(),
  userId: text(),
  reference: text().notNull().unique(),
  tripId: uuid(),
  totalMinor: money().notNull(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const bookings = pgTable("bookings", {
  id: uuid().primaryKey(),
  orderId: uuid().notNull(),
  checkoutLineId: uuid().notNull().unique(),
  userId: text(),
  slotId: uuid().notNull(),
  productType: text().notNull(),
  productId: text().notNull(),
  localDate: date().notNull(),
  startTime: text().notNull(),
  units: integer().notNull(),
  partnerId: uuid(),
  commissionBps: integer(),
  status: text().notNull(),
  partnerDeadline: timestamp({ withTimezone: true }),
  totalMinor: money().notNull(),
  feeMinor: money().notNull(),
  version: integer().notNull().default(1),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const bookingStatusHistory = pgTable("booking_status_history", {
  id: uuid().primaryKey(),
  bookingId: uuid().notNull(),
  fromStatus: text(),
  toStatus: text().notNull(),
  actorType: text().notNull(),
  actorId: text().notNull(),
  reason: text(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const payments = pgTable("payments", {
  id: uuid().primaryKey(),
  checkoutId: uuid().notNull(),
  provider: text().notNull(),
  reference: text().notNull().unique(),
  accessCode: text(),
  authorizationUrl: text(),
  amountMinor: money().notNull(),
  currency: char({ length: 3 }).notNull(),
  status: text().notNull(),
  channel: text(),
  paidAt: timestamp({ withTimezone: true }),
  providerPayload: jsonb(),
  version: integer().notNull().default(1),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const paymentEvents = pgTable("payment_events", {
  id: uuid().primaryKey(),
  provider: text().notNull(),
  event: text().notNull(),
  reference: text(),
  payloadSha256: text().notNull().unique(),
  payload: jsonb().notNull(),
  receivedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  processedAt: timestamp({ withTimezone: true }),
  error: text(),
});

export const serviceRequests = pgTable("service_requests", {
  id: uuid().primaryKey(),
  orderId: uuid().notNull(),
  checkoutLineId: uuid().notNull().unique(),
  userId: text().notNull(),
  tripId: uuid(),
  service: text().notNull(),
  localDate: date().notNull(),
  startTime: text().notNull(),
  status: text().notNull(),
  matchBy: timestamp({ withTimezone: true }).notNull(),
  assignee: jsonb().$type<Record<string, string>>(),
  totalMinor: money().notNull(),
  feeMinor: money().notNull(),
  version: integer().notNull().default(1),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const serviceRequestHistory = pgTable("service_request_history", {
  id: uuid().primaryKey(),
  serviceRequestId: uuid().notNull(),
  fromStatus: text(),
  toStatus: text().notNull(),
  actorType: text().notNull(),
  actorId: text().notNull(),
  note: text(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});
