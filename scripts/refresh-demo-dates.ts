import { eq, inArray } from "drizzle-orm";
import events from "../src/data/events.demo.json";
import { db } from "../src/database/client";
import { catalogue } from "../src/database/schema";
import { assertDemo } from "../src/config/environment";
import {
  demoDateShift,
  lagosToday,
  sessionDates,
  shiftSessionDates,
} from "../src/modules/catalogue/domain/events";
assertDemo();
// Moves the seeded demo events' session dates so the earliest is tomorrow or
// later. Dates are always recomputed from src/data/events.demo.json, so running
// it every day is safe and the JSON (and tests) keep their fixed dates. Only
// session dates change; staff edits to a listing are kept.
const today = process.argv[2] ?? lagosToday();
if (!/^\d{4}-\d{2}-\d{2}$/.test(today))
  throw Error("Usage: npm run db:refresh-dates -- [YYYY-MM-DD]");
const days = demoDateShift(sessionDates(events.experiences), today);
const byKey = new Map(events.experiences.map((e) => [e.id, e]));
const rows = await db()
  .select()
  .from(catalogue)
  .where(inArray(catalogue.seedKey, [...byKey.keys()]));
for (const row of rows) {
  const record = row.record as Record<string, unknown>;
  const { sessions } = shiftSessionDates(byKey.get(row.seedKey)!, days);
  await db()
    .update(catalogue)
    .set({ record: { ...record, sessions }, version: row.version + 1 })
    .where(eq(catalogue.id, row.id));
}
const dates = sessionDates(
  events.experiences.map((e) => shiftSessionDates(e, days)),
);
console.log(
  rows.length
    ? `${rows.length} demo events moved ${days} days: sessions now run ${dates[0]} to ${dates.at(-1)}.`
    : "No seeded demo events found. Run npm run db:seed:demo first.",
);
process.exit(0);
