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

// See migrations/0010_cart_checkout.sql.
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

export const checkouts = pgTable("checkouts", {
  id: uuid().primaryKey(),
  userId: text().notNull(),
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
  slotId: uuid().notNull(),
  localDate: date().notNull(),
  startTime: text().notNull(),
  units: integer().notNull(),
  title: text().notNull(),
  cartLine: jsonb().$type<CartLine>().notNull(),
  priceRows: jsonb().$type<PriceRow[]>().notNull(),
  subtotalMinor: money().notNull(),
  feeMinor: money().notNull(),
  totalMinor: money().notNull(),
  terms: jsonb().$type<LineTerms>().notNull(),
});

export const orders = pgTable("orders", {
  id: uuid().primaryKey(),
  checkoutId: uuid().notNull().unique(),
  userId: text().notNull(),
  reference: text().notNull().unique(),
  totalMinor: money().notNull(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const bookings = pgTable("bookings", {
  id: uuid().primaryKey(),
  orderId: uuid().notNull(),
  checkoutLineId: uuid().notNull().unique(),
  userId: text().notNull(),
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
