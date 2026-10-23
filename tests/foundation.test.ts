import { describe, it, expect } from "vitest";
import Ajv from "ajv/dist/2020.js";
import { initialProfile, profileSchema } from "../src/domain/profile";
import fixture from "../tourism-v1-handoff/data/experiences.demo.json";
import contract from "../tourism-v1-handoff/contracts/catalogue.schema.json";
import { publishBlockers } from "../src/server/catalogue";
import { assertDemo } from "../src/server/config";
describe("foundation trust boundaries", () => {
  it("fully validates supplied catalogue fixture schema", () =>
    expect(new Ajv().compile(contract)(fixture)).toBe(true));
  it("rejects impossible dates, long stays, child parties and untrusted fields", () => {
    for (const patch of [
      { startDate: "2026-02-30" },
      { endDate: "2027-01-01" },
      { adults: 0 },
      { adults: 9 },
      { role: "ADMIN" },
      { endDate: "2026-11-09" },
    ])
      expect(
        profileSchema.safeParse({ ...initialProfile, ...patch }).success,
      ).toBe(false);
    expect(profileSchema.safeParse(initialProfile).success).toBe(true);
  });
  it("refuses to promote fictional fixtures", () => {
    for (const record of fixture.experiences)
      expect(publishBlockers(record)).toContain(
        "Fictional demo supply cannot be published live.",
      );
  });
  it("refuses a live checkout flag", () => {
    const old = process.env.LIVE_CHECKOUT_ENABLED;
    process.env.LIVE_CHECKOUT_ENABLED = "true";
    expect(assertDemo).toThrow("Live operation refused");
    if (old === undefined) delete process.env.LIVE_CHECKOUT_ENABLED;
    else process.env.LIVE_CHECKOUT_ENABLED = old;
  });
});
