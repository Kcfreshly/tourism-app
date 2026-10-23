import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
const base = process.env.PUBLIC_APP_URL ?? "http://127.0.0.1:3000";
async function call(path, method = "GET", body, cookie) {
  return fetch(base + path, {
    method,
    headers: {
      Origin: base,
      "Content-Type": "application/json",
      ...(cookie ? { Cookie: cookie } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}
const profile = {
  cityId: "lagos",
  startDate: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
  endDate: new Date(Date.now() + 36 * 86400000).toISOString().slice(0, 10),
  adults: 2,
  interests: ["nature", "culture", "local-life"],
  occasion: "Fictional planner QA",
  pace: "BALANCED",
  accommodation: "Fictional test base",
  zoneId: "LEKKI",
  assistance: "DRIVER_ONLY",
  budgetMinor: 150000000,
  budgetBasis: "PARTY",
  dietary: "",
  alcohol: "OPTIONAL",
  walking: "MODERATE",
  selectedOfferIds: [],
};
const created = await call("/api/v1/trips", "POST", profile);
assert.equal(created.status, 201, await created.clone().text());
const cookie = created.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; "),
  trip = (await created.json()).data,
  root = `/api/v1/trips/${trip.id}`;
const item = (offerId, startTime, endTime, extra = {}) => ({
  id: randomUUID(),
  localDate: profile.startDate,
  startTime,
  endTime,
  kind: "EXPERIENCE",
  offerId,
  title: "Fictional QA activity",
  locked: false,
  ...extra,
});
const locked = item("offer-nature-walk", "09:00", "11:00", { locked: true });
const items = [locked, item("offer-gallery", "13:00", "14:30")];
const services = {
  assistance: "DRIVER_ONLY",
  vehicleWindows: { [profile.startDate]: { startTime: "08:00", hours: 8 } },
  guideItemIds: [],
  guideDays: [],
};
const save = await call(
  `${root}/workspace`,
  "PUT",
  { expectedVersion: 1, items, services },
  cookie,
);
assert.equal(save.status, 200, await save.clone().text());
const saved = (await save.json()).data;
assert.equal(saved.price.totalMinor, 9350000);
assert.deepEqual(saved.price.blockers, []);
const reload = (
  await (await call(`${root}/workspace`, "GET", undefined, cookie)).json()
).data;
assert.deepEqual(reload.trip.items, items);
assert.equal(reload.trip.version, 2);
assert.equal(
  (
    await call(
      `${root}/workspace`,
      "PUT",
      { expectedVersion: 1, items, services },
      cookie,
    )
  ).status,
  409,
);
assert.equal((await call(`${root}/workspace`)).status, 401);
const forged = await call(
  `${root}/workspace`,
  "PUT",
  {
    expectedVersion: 2,
    items: [...items, item("imaginary", "16:00", "17:00")],
    services,
  },
  cookie,
);
assert.equal(forged.status, 422);
assert.equal((await forged.json()).error.code, "OFFER_UNAVAILABLE");
const conflict = await call(
  `${root}/workspace`,
  "PUT",
  {
    expectedVersion: 2,
    items: [...items, item("offer-gallery", "10:00", "11:30")],
    services,
  },
  cookie,
);
assert.equal(conflict.status, 422);
assert.equal(
  (await conflict.json()).error.message,
  "This time is already occupied. Choose another time or day.",
);
const unchanged = (
  await (await call(`${root}/workspace`, "GET", undefined, cookie)).json()
).data;
assert.deepEqual(unchanged.trip.items, items);
assert.equal(unchanged.trip.version, 2);
const preview = await call(`${root}/plan`, "POST", {}, cookie);
assert.equal(preview.status, 200, await preview.clone().text());
const proposal = (await preview.json()).data;
assert(
  proposal.items.some(
    (i) => i.id === locked.id && i.startTime === locked.startTime,
  ),
);
assert.equal(
  (await (await call(`${root}/workspace`, "GET", undefined, cookie)).json())
    .data.trip.version,
  2,
  "Preview must not silently change a draft",
);
const apply = await call(
  `${root}/plan/apply`,
  "POST",
  { proposalId: proposal.id, expectedVersion: proposal.expectedVersion },
  cookie,
);
assert.equal(apply.status, 200, await apply.clone().text());
assert.equal((await apply.json()).data.trip.version, 3);
assert.equal(
  (
    await call(
      `${root}/plan/apply`,
      "POST",
      { proposalId: proposal.id, expectedVersion: proposal.expectedVersion },
      cookie,
    )
  ).status,
  409,
);
const stale = (await (await call(`${root}/plan`, "POST", {}, cookie)).json())
  .data;
const current = (
  await (await call(`${root}/workspace`, "GET", undefined, cookie)).json()
).data;
assert.equal(
  (
    await call(
      `${root}/workspace`,
      "PUT",
      {
        expectedVersion: 3,
        items: current.trip.items,
        services: current.trip.services,
      },
      cookie,
    )
  ).status,
  200,
);
assert.equal(
  (
    await call(
      `${root}/plan/apply`,
      "POST",
      { proposalId: stale.id, expectedVersion: stale.expectedVersion },
      cookie,
    )
  ).status,
  409,
);
console.log(
  "PASS: persisted multi-day schedule, exact automatic price, missing/forged offer blockers, stale save conflict, owner access denial, lock-aware preview/apply, one-time apply and stale proposal rollback.",
);
