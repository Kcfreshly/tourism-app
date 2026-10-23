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
  rateMinor: 12345,
  capacityPerSlot: 2,
  status: "DEMO_VERIFIED",
  review: {
    content: false,
    rates: false,
    capacity: false,
    policy: false,
    media: false,
  },
};
assert.equal((await call("PATCH", edit)).status, 422);
edit.review = {
  content: true,
  rates: true,
  capacity: true,
  policy: true,
  media: true,
};
edit.status = "DEMO_PUBLISHED";
assert.equal((await call("PATCH", edit)).status, 422);
edit.status = "DEMO_VERIFIED";
assert.equal((await call("PATCH", edit)).status, 200);
assert.equal((await call("PATCH", edit)).status, 409);
edit.expectedVersion = 2;
edit.status = "DEMO_PUBLISHED";
assert.equal((await call("PATCH", edit)).status, 200);
assert.equal(
  (await fetch(`${base}/api/v1/experiences/${row.seedKey}`)).status,
  200,
);
edit.expectedVersion = 3;
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
      expectedVersion: 4,
      status: "PUBLISHED",
      isDemo: false,
    })
  ).status,
  422,
);
console.log(
  "PASS: administrator-only draft creation, incomplete review denial, verify-before-publish, optimistic conflict, demo publish/detail visibility, pause removes sales visibility and live-promotion refusal. Fictional test draft retained as PAUSED.",
);
