import { beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import * as schema from "../src/database/schema";
import type { Database } from "../src/database/client";
import { sqlStatements } from "../src/database/sql-statements";
import {
  escapeRegExp,
  hotelScore,
  matchHotels,
  type Hotel,
} from "../src/modules/trips/domain/hotels";
import {
  initialProfile,
  profileSchema,
  readStayLink,
  stayLabel,
} from "../src/modules/trips/domain/profile";
import { extractProfile } from "../src/modules/trips/domain/intake";
import { DrizzleHotelRepository } from "../src/modules/trips/infrastructure/persistence/drizzle-hotel-repository";
import {
  SaveHotel,
  SearchHotels,
} from "../src/modules/trips/application/use-cases/hotels";
import { ListStayOrders } from "../src/modules/bookings/application/use-cases/stay-offers";
import type {
  StayOfferRepository,
  StayTripOrder,
} from "../src/modules/bookings/application/ports/stay-offer-repository";

let n = 0;
const hotel = (name: string, more: Partial<Hotel> = {}): Hotel => ({
  id: `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`,
  version: 1,
  name,
  aliases: [],
  zoneId: "VI",
  type: "HOTEL",
  address: "1 Fictional Close",
  active: true,
  ...more,
});

const list = [
  hotel("Eko Hotel & Suites", { aliases: ["Eko"] }),
  hotel("Radisson Blu Anchorage"),
  hotel("The Wheatbaker", { zoneId: "LEKKI" }),
  hotel("Lagos Continental Hotel"),
  hotel("Lekki Short-let Apartments", { zoneId: "LEKKI", type: "APARTMENT" }),
  hotel("Closed Hotel", { active: false }),
];

describe("closest hotel match", () => {
  it("ignores case, accents, punctuation and filler words", () => {
    expect(hotelScore(list[0], "EKO hotel")).toBe(4);
    expect(hotelScore(list[0], "the éko, lagos")).toBe(4);
    expect(hotelScore(list[2], "wheatbaker")).toBe(4);
    expect(matchHotels(list, "continental")[0].name).toBe(
      "Lagos Continental Hotel",
    );
  });

  it("ranks starts-with, then every word, then some words, then typos", () => {
    expect(hotelScore(list[1], "radisson")).toBe(4);
    expect(hotelScore(list[1], "anchorage radisson")).toBe(3);
    expect(hotelScore(list[1], "radisson ikoyi")).toBe(2);
    expect(hotelScore(list[1], "radison")).toBe(1);
    expect(hotelScore(list[1], "rdsn")).toBe(0);
    expect(hotelScore(list[2], "wheatbakker")).toBe(1);
  });

  it("treats typed regular expression characters literally", () => {
    expect(escapeRegExp("a.*(b)[c]")).toBe("a\\.\\*\\(b\\)\\[c\\]");
    expect(() => matchHotels(list, "(((")).not.toThrow();
    expect(() => matchHotels(list, "eko[")).not.toThrow();
    expect(matchHotels(list, ".*")).toEqual([]);
    expect(matchHotels(list, "eko[").map((h) => h.name)).toEqual([
      "Eko Hotel & Suites",
    ]);
  });

  it("puts the chosen area and type first, hides inactive ones, and shows at most 8", () => {
    const names = matchHotels(list, "l", "LEKKI", "APARTMENT").map(
      (h) => h.name,
    );
    expect(names[0]).toBe("Lekki Short-let Apartments");
    expect(matchHotels(list, "closed")).toEqual([]);
    const many = Array.from({ length: 12 }, (_, i) =>
      hotel(`Harbour Hotel ${i + 1}`),
    );
    expect(matchHotels(many, "harbour")).toHaveLength(8);
  });
});

describe("stay links", () => {
  it("recognises Booking.com and Airbnb, and calls anything else a hotel website", () => {
    expect(
      readStayLink("https://www.booking.com/hotel/ng/fictional.html")?.source,
    ).toBe("BOOKING");
    expect(readStayLink("https://airbnb.co.uk/rooms/123")?.source).toBe(
      "AIRBNB",
    );
    expect(readStayLink("https://fictionalhotel.ng/rooms")?.source).toBe(
      "WEBSITE",
    );
  });

  it("accepts https only, up to 500 characters", () => {
    expect(readStayLink("http://booking.com/x")).toBeNull();
    expect(readStayLink("javascript:alert(1)")).toBeNull();
    expect(readStayLink("https://user:pw@booking.com/x")).toBeNull();
    expect(readStayLink(`https://a.ng/${"x".repeat(500)}`)).toBeNull();
    // A link's source must be the one its host says.
    expect(
      profileSchema.safeParse({
        ...initialProfile,
        accommodationBy: "FASTLIFE",
        stay: {
          type: "HOTEL",
          choice: { kind: "LINK", url: "https://evil.ng", source: "BOOKING" },
        },
      }).success,
    ).toBe(false);
  });
});

describe("stay preference", () => {
  it("summarises what Fastlife is looking for", () => {
    expect(
      stayLabel({
        accommodation: "",
        accommodationBy: "FASTLIFE",
        zoneId: "VI",
        stay: {
          type: "APARTMENT",
          choice: { kind: "NAMED", name: "My cousin's place" },
        },
      }),
    ).toBe(
      "Stay booked by Fastlife · Victoria Island · Serviced apartment or short-let · My cousin's place (their own choice)",
    );
  });

  it("is understood from a chat message", () => {
    const base = { ...initialProfile, accommodationBy: "FASTLIFE" as const };
    const named = extractProfile(
      base,
      "A serviced apartment around 80,000 a night. Hotel: Fictional Lagoon View",
    ).profile;
    expect(named.stay).toEqual({
      type: "APARTMENT",
      budgetPerNightMinor: 8_000_000,
      choice: { kind: "NAMED", name: "Fictional Lagoon View" },
    });
    expect(named.accommodation).toBe("");
    const link = extractProfile(
      base,
      "This one please https://www.airbnb.com/rooms/42.",
    ).profile;
    expect(link.stay?.choice).toEqual({
      kind: "LINK",
      url: "https://www.airbnb.com/rooms/42",
      source: "AIRBNB",
    });
    const own = extractProfile(
      initialProfile,
      "A serviced apartment, hotel: Somewhere",
    ).profile;
    expect(own.stay).toBeUndefined();
  });
});

describe("hotel list and stay requests", () => {
  const pg = new PGlite();
  const db = drizzle(pg, {
    schema,
    casing: "snake_case",
  }) as unknown as Database;
  const run = async (file: string) => {
    for (const statement of sqlStatements(
      readFileSync(`migrations/${file}`, "utf8"),
    ))
      await pg.exec(statement);
  };
  const fastlifeTrip = randomUUID();
  const ownTrip = randomUUID();

  beforeAll(async () => {
    const files = readdirSync("migrations").filter((f) => f.endsWith(".sql"));
    for (const file of files.filter((f) => f < "0016")) await run(file);
    const profile = (extra: object) =>
      JSON.stringify({ ...initialProfile, ...extra });
    await pg.query(
      "INSERT INTO trips (id, owner_id, profile) VALUES ($1, $2, $3), ($4, $2, $5)",
      [
        fastlifeTrip,
        randomUUID(),
        profile({
          accommodationBy: "FASTLIFE",
          accommodation: "Near the beach",
        }),
        ownTrip,
        profile({ accommodation: "12 Fictional Road" }),
      ],
    );
    for (const file of files.filter((f) => f >= "0016")) await run(file);
  });

  it("moves existing Fastlife stay preferences into the stay request", async () => {
    const rows = (
      await pg.query<{ id: string; profile: Record<string, unknown> }>(
        "SELECT id, profile FROM trips",
      )
    ).rows;
    const fastlife = rows.find((r) => r.id === fastlifeTrip)!.profile;
    expect(fastlife.stay).toEqual({
      type: "HOTEL",
      choice: { kind: "NAMED", name: "Near the beach" },
    });
    expect(fastlife.accommodation).toBe("");
    expect(profileSchema.safeParse(fastlife).success).toBe(true);
    const own = rows.find((r) => r.id === ownTrip)!.profile;
    expect(own.stay).toBeUndefined();
    expect(own.accommodation).toBe("12 Fictional Road");
  });

  it("is kept by staff, with an audit trail, and searched by travellers", async () => {
    const repo = new DrizzleHotelRepository(() => db);
    const save = new SaveHotel(repo);
    const created = await save.execute("staff-1", {
      hotel: {
        name: "Fictional Lagoon View Hotel",
        aliases: ["Lagoon View"],
        zoneId: "VI",
        type: "HOTEL",
        address: "1 Fictional Close, Victoria Island",
        active: true,
      },
    });
    const search = new SearchHotels(repo);
    expect(
      (await search.execute({ q: "lagoon", zoneId: "VI" })).map((h) => h.name),
    ).toEqual(["Fictional Lagoon View Hotel"]);
    await save.execute("staff-1", {
      id: created.id,
      expectedVersion: 1,
      hotel: { ...created, active: false },
    });
    expect(await search.execute({ q: "lagoon" })).toEqual([]);
    await expect(
      save.execute("staff-1", {
        id: created.id,
        expectedVersion: 1,
        hotel: { ...created },
      }),
    ).rejects.toThrow(/changed/);
    const audits = await pg.query<{ action: string }>(
      "SELECT action FROM audit_events WHERE entity_id = $1",
      [created.id],
    );
    expect(audits.rows.map((r) => r.action).sort()).toEqual([
      "HOTEL_CREATED",
      "HOTEL_UPDATED",
    ]);
  });

  it("show staff what was asked for, waiting requests first, due 48 hours after payment", async () => {
    const order = (o: Partial<StayTripOrder>): StayTripOrder => ({
      orderId: randomUUID(),
      reference: "FL-1",
      tripId: null,
      paidAt: "2027-04-30T10:00:00.000Z",
      contact: { name: "A", phone: "+234", email: "a@example.test" },
      from: "2027-05-08",
      to: "2027-05-10",
      offers: [],
      ...o,
    });
    const repo = {
      tripOrders: async () => [
        order({ reference: "OWN", tripId: ownTrip }),
        order({ reference: "ASKED", tripId: fastlifeTrip }),
      ],
    } as unknown as StayOfferRepository;
    const listed = await new ListStayOrders(repo, {
      arrangements: async () =>
        new Map([
          [
            fastlifeTrip,
            {
              ...initialProfile,
              accommodationBy: "FASTLIFE" as const,
              stay: {
                type: "HOTEL" as const,
                choice: { kind: "RECOMMEND" as const },
              },
            },
          ],
          [ownTrip, { ...initialProfile }],
        ]),
    }).execute();
    expect(listed.map((o) => o.reference)).toEqual(["ASKED", "OWN"]);
    expect(listed[0].respondBy).toBe("2027-05-02T10:00:00.000Z");
    expect(listed[0].request?.stay?.choice.kind).toBe("RECOMMEND");
    expect(listed[1].request).toBeUndefined();
  });
});
