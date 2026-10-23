import assert from "node:assert/strict";
const base = process.env.PUBLIC_APP_URL ?? "http://127.0.0.1:3000";
const profile = {
  cityId: "lagos",
  startDate: "2026-11-10",
  endDate: "2026-11-16",
  adults: 2,
  interests: ["nature", "culture"],
  occasion: "Integration check — fictional",
  pace: "BALANCED",
  accommodation: "",
  zoneId: "UNDECIDED",
  assistance: "DRIVER_ONLY",
  budgetMinor: 150000000,
  budgetBasis: "PARTY",
  dietary: "",
  alcohol: "OPTIONAL",
  walking: "MODERATE",
  selectedOfferIds: [],
};
async function call(path, method = "GET", body, cookie, origin = base) {
  return fetch(base + path, {
    method,
    headers: {
      Origin: origin,
      "Content-Type": "application/json",
      ...(cookie ? { Cookie: cookie } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}
const created = await call("/api/v1/trips", "POST", profile);
assert.equal(created.status, 201, await created.clone().text());
const cookie = created.headers.get("set-cookie").split(";")[0];
const { data: trip } = await created.json();
const loaded = await call(`/api/v1/trips/${trip.id}`, "GET", undefined, cookie);
assert.deepEqual((await loaded.json()).data.profile, profile);
assert.equal((await call(`/api/v1/trips/${trip.id}`)).status, 401);
const second = await call("/api/v1/trips", "POST", profile);
const secondCookie = second.headers.get("set-cookie").split(";")[0];
assert.equal(
  (await call(`/api/v1/trips/${trip.id}`, "GET", undefined, secondCookie))
    .status,
  404,
);
assert.equal(
  (
    await call(
      `/api/v1/trips/${trip.id}`,
      "PATCH",
      { expectedVersion: 1, profile },
      secondCookie,
    )
  ).status,
  404,
);
assert.equal(
  (
    await call(
      `/api/v1/trips/${trip.id}`,
      "PATCH",
      {
        expectedVersion: 1,
        profile: { ...profile, occasion: "Updated fictional trip" },
      },
      cookie,
    )
  ).status,
  200,
);
assert.equal(
  (
    await call(
      `/api/v1/trips/${trip.id}`,
      "PATCH",
      { expectedVersion: 1, profile },
      cookie,
    )
  ).status,
  409,
);
assert.equal(
  (await call("/api/v1/trips", "POST", { ...profile, adults: 9 }, cookie))
    .status,
  422,
);
assert.equal(
  (
    await call(
      "/api/v1/trips",
      "POST",
      profile,
      cookie,
      "https://untrusted.example",
    )
  ).status,
  403,
);
assert.equal(
  (await call("/api/v1/admin/catalogue", "GET", undefined, cookie)).status,
  403,
);
assert.equal(
  (await call("/api/v1/admin/catalogue", "PATCH", {}, cookie)).status,
  403,
);
assert.equal(
  (await call("/api/v1/session", "DELETE", undefined, cookie)).status,
  200,
);
assert.equal(
  (await call(`/api/v1/trips/${trip.id}`, "GET", undefined, cookie)).status,
  401,
);
console.log(
  "PASS: persisted draft reload, cross-session GET/PATCH denial, optimistic conflict, validation, CSRF origin, admin GET/PATCH denial and session invalidation.",
);
console.log(
  "Two fictional test drafts retained in local demo DB. No payment, supplier or model called.",
);
