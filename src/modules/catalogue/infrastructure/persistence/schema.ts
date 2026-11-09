import { pgTable, uuid, text, integer, jsonb } from "drizzle-orm/pg-core";
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
