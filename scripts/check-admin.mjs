import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const state = JSON.parse(await readFile(".local/qa-account.json", "utf8"));
const base = process.env.PUBLIC_APP_URL ?? "http://127.0.0.1:3000";
async function call(method, body) {
  return fetch(base + "/api/v1/admin/catalogue", {
    method,
    headers: {
      Origin: base,
      "Content-Type": "application/json",
      Cookie: state.cookie,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}
const all = await call("GET");
assert.equal(
  all.status,
  200,
  "Grant the existing QA account demo admin using the offline CLI first.",
);
const create = await call("POST", { name: "Fictional unpublished QA record" });
assert.equal(create.status, 201, await create.clone().text());
const row = (await create.json()).data;
assert.equal(
  (await fetch(`${base}/api/v1/experiences/${row.seedKey}`)).status,
  404,
);
const edit = {
  id: row.id,
  expectedVersion: 1,
  name: row.record.name,
  categoryId: "nature",
  zoneId: "LEKKI",
  kind: "MAIN",
  durationMinMinutes: 120,
  durationMaxMinutes: 180,
  rateMinor: 0,
  capacityPerSlot: 2,
  status: "DEMO_PUBLISHED",
  review: {
    content: false,
    rates: false,
    capacity: false,
    policy: false,
    media: false,
  },
};
// Publishing records the staff member's approval: every review check ticked.
assert.equal((await call("PATCH", edit)).status, 422);
edit.review = {
  content: true,
  rates: true,
  capacity: true,
  policy: true,
  media: true,
};
// Not ready: no price yet.
assert.equal((await call("PATCH", edit)).status, 422);
edit.tags = ["not-a-tag"];
edit.rateMinor = 12345;
assert.equal((await call("PATCH", edit)).status, 422);
edit.tags = ["hosted", "family"];
// Staff publish straight from draft; there is no separate verify step.
assert.equal((await call("PATCH", edit)).status, 200);
assert.equal((await call("PATCH", edit)).status, 409);
assert.equal(
  (await fetch(`${base}/api/v1/experiences/${row.seedKey}`)).status,
  200,
);
edit.expectedVersion = 2;
edit.status = "PAUSED";
assert.equal((await call("PATCH", edit)).status, 200);
assert.equal(
  (await fetch(`${base}/api/v1/experiences/${row.seedKey}`)).status,
  404,
);
assert.equal(
  (
    await call("PATCH", {
      ...edit,
      expectedVersion: 3,
      status: "PUBLISHED",
      isDemo: false,
    })
  ).status,
  422,
);

// Deleting is for super admins; the QA account is a plain admin.
assert.equal(
  (await call("DELETE", { id: row.id, expectedVersion: 3 })).status,
  403,
);
// Every admin can read a listing's history from the audit trail.
const history = await fetch(
  `${base}/api/v1/admin/catalogue/history?id=${row.id}`,
  { headers: { Cookie: state.cookie } },
);
assert.equal(history.status, 200);
assert.ok((await history.json()).data.length >= 4);

// Ready-made trips: create, refuse an incomplete publish, publish, unpublish.
async function trips(method, body) {
  return fetch(base + "/api/v1/admin/packages", {
    method,
    headers: {
      Origin: base,
      "Content-Type": "application/json",
      Cookie: state.cookie,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}
const published = async () =>
  (await (await fetch(`${base}/api/v1/packages`)).json()).data.map(
    (p) => p.slug,
  );
const made = await trips("POST", { title: "QA Obudu mountain weekend" });
assert.equal(made.status, 201, await made.clone().text());
const trip = (await made.json()).data;
assert.ok(!(await published()).includes(trip.slug));
const tripEdit = {
  id: trip.id,
  expectedVersion: 1,
  status: "DEMO_PUBLISHED",
  trip: trip.record,
};
assert.equal((await trips("PATCH", tripEdit)).status, 422);
const soon = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
tripEdit.trip = {
  ...trip.record,
  summary: "Three cool days on the Obudu plateau with a guide and driver.",
  operator: "QA Highland Tours (fictional)",
  route: [
    { day: 1, place: "Calabar → Obudu", plan: "Drive up to the plateau." },
    { day: 2, place: "Obudu", plan: "Canopy walk and waterfall hike." },
    {
      day: 3,
      place: "Obudu → Calabar",
      plan: "Morning cable car, then return.",
    },
  ],
  departures: [{ date: soon, seats: "OPEN" }],
  priceMinor: 25000000,
  bookingTerms: ["Pay in full to book (sample terms)."],
  tags: ["mountains", "nature"],
};
assert.equal((await trips("PATCH", tripEdit)).status, 200);
assert.ok((await published()).includes(trip.slug));
tripEdit.expectedVersion = 2;
tripEdit.status = "PAUSED";
assert.equal((await trips("PATCH", tripEdit)).status, 200);
assert.ok(!(await published()).includes(trip.slug));
console.log(
  "PASS: administrator-only draft creation, approval and readiness before publish, tag vocabulary, direct publish, optimistic conflict, publish/detail visibility, pause removes sales visibility, live-promotion refusal, delete refused for plain admins, readable history, and ready-made trip create/publish/unpublish. Fictional test records retained as PAUSED.",
);
