import { pgTable, uuid, text, jsonb, timestamp } from "drizzle-orm/pg-core";
export const audit = pgTable("audit_events", {
  id: uuid().primaryKey(),
  actorId: text().notNull(),
  action: text().notNull(),
  entityId: text().notNull(),
  details: jsonb().notNull(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});
