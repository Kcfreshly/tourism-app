import { z } from "zod";
import type { Profile } from "./profile";
import type { Experience } from "../server/catalogue";
import rules from "../../tourism-v1-handoff/data/pricing.demo.json";
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (v) =>
      !Number.isNaN(Date.parse(v)) &&
      new Date(v).toISOString().slice(0, 10) === v,
  );
export const localTime = z.string().regex(/^([01][0-9]|2[0-3]):[0-5][0-9]$/);
export const itemSchema = z
  .object({
    id: z.uuid(),
    localDate: date,
    startTime: localTime,
    endTime: localTime,
    kind: z.enum(["EXPERIENCE", "CUSTOM", "BREAK", "TRAVEL"]),
    offerId: z.string().max(100).nullable(),
    title: z.string().min(1).max(160),
    locked: z.boolean(),
    reason: z.string().max(500).optional(),
  })
  .strict();
export const servicesSchema = z
  .object({
    assistance: z.enum(["DRIVER_ONLY", "ACTIVITY_GUIDE", "FULL_DAY_GUIDE"]),
    vehicleWindows: z.record(
      date,
      z
        .object({
          startTime: localTime,
          hours: z.union([z.literal(4), z.literal(8)]),
        })
        .strict(),
    ),
    guideItemIds: z.array(z.uuid()).max(240),
    guideDays: z.array(date).max(30),
  })
  .strict();
export type Item = z.infer<typeof itemSchema>;
export type Services = z.infer<typeof servicesSchema>;
export const defaultServices: Services = {
  assistance: "DRIVER_ONLY",
  vehicleWindows: {},
  guideItemIds: [],
  guideDays: [],
};
export type Issue = { code: string; message: string; itemId?: string };
export type PriceLine = {
  key: string;
  label: string;
  group: "activities" | "transport" | "hosting";
  quantity: number;
  unitRateMinor: number;
  totalMinor: number;
  rule: string;
};
export function minutes(time: string) {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}
export function time(value: number) {
  return `${Math.floor(value / 60)
    .toString()
    .padStart(2, "0")}:${(value % 60).toString().padStart(2, "0")}`;
}
export function tripDays(profile: Pick<Profile, "startDate" | "endDate">) {
  const days: string[] = [];
  for (
    let ms = Date.parse(profile.startDate + "T00:00:00Z");
    ms <= Date.parse(profile.endDate + "T00:00:00Z");
    ms += 86400000
  )
    days.push(new Date(ms).toISOString().slice(0, 10));
  return days;
}
export function travelMinutes(from: string, to: string, departure: number) {
  const pair = rules.travelMatrixMinutes.find(
    (r) => (r.from === from && r.to === to) || (r.from === to && r.to === from),
  );
  if (!pair) return null;
  const peak =
    (departure >= 420 && departure < 600) ||
    (departure >= 960 && departure < 1200);
  return peak ? pair.peak : pair.offPeak;
}
export function feeHalfUp(subtotal: number, bps: number) {
  if (
    !Number.isSafeInteger(subtotal) ||
    subtotal < 0 ||
    !Number.isSafeInteger(bps) ||
    bps < 0
  )
    throw Error("Invalid integer money");
  return Number((BigInt(subtotal) * BigInt(bps) + 5000n) / 10000n);
}
export function arithmetic(input: {
  adults: number;
  activities: { rateMinor: number; basis: string }[];
  vehicleRateMinor: number;
  vehicleCount: number;
  guideMinor: number;
  feeBps: number;
}) {
  const activitiesMinor = input.activities.reduce(
      (n, a) => n + a.rateMinor * (a.basis === "PER_ADULT" ? input.adults : 1),
      0,
    ),
    transportMinor = input.vehicleRateMinor * input.vehicleCount,
    hostingMinor = input.guideMinor,
    subtotalMinor = activitiesMinor + transportMinor + hostingMinor,
    feeMinor = feeHalfUp(subtotalMinor, input.feeBps),
    taxMinor = 0;
  return {
    activitiesMinor,
    transportMinor,
    hostingMinor,
    subtotalMinor,
    feeMinor,
    taxMinor,
    totalMinor: subtotalMinor + feeMinor + taxMinor,
  };
}
export function assess(
  profile: Profile,
  items: Item[],
  services: Services,
  offers: Experience[],
  now = Date.now(),
) {
  const blockers: Issue[] = [],
    warnings: Issue[] = [],
    lines: PriceLine[] = [];
  const days = tripDays(profile);
  const add = (code: string, message: string, itemId?: string) =>
    blockers.push({ code, message, itemId });
  if (new Set(items.map((i) => i.id)).size !== items.length)
    add("DUPLICATE_ITEM", "Every schedule item must have a unique identifier.");
  const resolved = new Map<string, Experience>();
  for (const item of items) {
    if (!days.includes(item.localDate))
      add("OUTSIDE_TRIP", "Move this item within your trip dates.", item.id);
    const duration = minutes(item.endTime) - minutes(item.startTime);
    if (duration <= 0)
      add(
        "INVALID_TIME",
        "End time must be after start time on the same day.",
        item.id,
      );
    if (item.kind !== "EXPERIENCE") {
      if (item.offerId !== null)
        add(
          "INVALID_OFFER",
          "Personal, travel and break blocks cannot reserve an offer.",
          item.id,
        );
      continue;
    }
    const offer = offers.find((e) => e.offer.id === item.offerId);
    if (!offer) {
      add(
        "OFFER_UNAVAILABLE",
        "This experience is paused or unavailable. Choose another experience.",
        item.id,
      );
      continue;
    }
    resolved.set(item.id, offer);
    if (offer.unavailableDates?.includes(item.localDate))
      add("CLOSED", "This experience is unavailable on this date.", item.id);
    if (
      offer.schedulingType === "FIXED" &&
      !offer.sessions?.some(
        (session) =>
          session.startTime === item.startTime &&
          session.durationMinutes === duration &&
          (!session.dates || session.dates.includes(item.localDate)) &&
          (session.capacity === undefined ||
            session.capacity >= profile.adults),
      )
    )
      add(
        "SESSION",
        "Choose an available session; its start time and duration are fixed.",
        item.id,
      );
    if (offer.cityId !== profile.cityId)
      add("CITY_MISMATCH", "Choose an experience in your trip city.", item.id);
    if (
      duration < offer.durationMinMinutes ||
      duration > offer.durationMaxMinutes
    )
      add("DURATION", "Duration is outside the offer limits.", item.id);
    if (
      profile.adults < offer.offer.minParty ||
      profile.adults > offer.offer.maxParty
    )
      add("PARTY", "Party does not match the offer limits.", item.id);
    const weekday = new Date(item.localDate + "T12:00:00Z").getUTCDay() || 7;
    if (
      !offer.availabilityLocal.days.includes(weekday) ||
      item.startTime < offer.availabilityLocal.opensAt ||
      item.endTime > offer.availabilityLocal.closesAt
    )
      add(
        "CLOSED",
        "This experience is outside its demo opening window.",
        item.id,
      );
    if (
      Date.parse(`${item.localDate}T${item.startTime}:00+01:00`) - now <
      offer.offer.bookingCutoffHours * 3600000
    )
      add("CUTOFF", "This experience is inside its booking cutoff.", item.id);
    const quantity =
      offer.offer.priceBasis === "PER_ADULT" ? profile.adults : 1;
    if (
      (offer.offer.capacityUnit === "PERSON" &&
        profile.adults > offer.offer.capacityPerSlot) ||
      (offer.offer.capacityUnit === "GROUP" && offer.offer.capacityPerSlot < 1)
    )
      add(
        "CAPACITY",
        "Party exceeds the configured demo slot capacity.",
        item.id,
      );
    lines.push({
      key: item.id,
      label: offer.name,
      group: "activities",
      quantity,
      unitRateMinor: offer.offer.rateMinor,
      totalMinor: quantity * offer.offer.rateMinor,
      rule: `offer:${offer.offer.id}; demo-48h`,
    });
  }
  const vehicles = Math.ceil(profile.adults / rules.vehiclePassengerCapacity);
  for (const day of days) {
    const schedule = items
      .filter((i) => i.localDate === day)
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
    for (let a = 0; a < schedule.length; a++)
      for (let b = a + 1; b < schedule.length; b++)
        if (schedule[a].endTime > schedule[b].startTime)
          add(
            "OVERLAP",
            `Overlaps with “${schedule[a].title}”.`,
            schedule[b].id,
          );
    const experiences = schedule.filter((i) => resolved.has(i.id));
    if (
      experiences.some((i) => resolved.get(i.id)!.kind === "FULL_DAY") &&
      schedule.filter((i) => i.kind !== "TRAVEL").length > 1
    )
      add(
        "FULL_DAY",
        "This day is full: a full-day experience occupies the usable day.",
      );
    if (!experiences.length) continue;
    for (let i = 1; i < experiences.length; i++) {
      const before = experiences[i - 1],
        after = experiences[i];
      const travel = travelMinutes(
        resolved.get(before.id)!.zoneId,
        resolved.get(after.id)!.zoneId,
        minutes(before.endTime),
      );
      if (travel === null)
        add(
          "ROUTE_UNSUPPORTED",
          "No configured transfer route between these experiences.",
          after.id,
        );
      else if (
        schedule.some(
          (block) =>
            block.kind !== "EXPERIENCE" &&
            block.kind !== "TRAVEL" &&
            minutes(block.startTime) < minutes(before.endTime) + travel &&
            minutes(block.endTime) > minutes(before.endTime),
        )
      )
        add(
          "TRANSIT",
          "This block occupies the required travel buffer. Choose another time.",
          after.id,
        );
      else if (minutes(after.startTime) - minutes(before.endTime) < travel)
        add(
          "TRANSIT",
          `Allow at least ${travel} minutes estimated travel after the previous experience.`,
          after.id,
        );
    }
    if (
      experiences.filter((i) => resolved.get(i.id)!.kind === "MAIN").length > 2
    )
      warnings.push({
        code: "DENSITY",
        message: `${day}: more than two main experiences. Consider a lighter day.`,
      });
    const first = experiences[0],
      last = experiences.at(-1)!;
    if (profile.zoneId === "UNDECIDED" || !profile.accommodation.trim())
      add(
        "MISSING_BASE",
        "Confirm your accommodation and service zone before reserving transport.",
      );
    const outbound = travelMinutes(
        profile.zoneId,
        resolved.get(first.id)!.zoneId,
        minutes(first.startTime) - 60,
      ),
      inbound = travelMinutes(
        resolved.get(last.id)!.zoneId,
        profile.zoneId,
        minutes(last.endTime),
      );
    if (outbound === null || inbound === null)
      add(
        "ROUTE_UNSUPPORTED",
        `${day}: the accommodation route is not configured.`,
      );
    const window = services.vehicleWindows[day];
    if (!window) {
      add(
        "MISSING_WINDOW",
        `${day}: select a 4-hour or 8-hour dedicated vehicle window.`,
      );
      continue;
    }
    const start = minutes(window.startTime),
      end = start + window.hours * 60;
    if (end > 1440)
      add(
        "SERVICE_WINDOW",
        `${day}: vehicle coverage cannot extend beyond the service day.`,
      );
    // Use the greater peak/off-peak buffer to avoid optimistic pickup estimates.
    const outPair = rules.travelMatrixMinutes.find(
      (r) =>
        (r.from === profile.zoneId &&
          r.to === resolved.get(first.id)!.zoneId) ||
        (r.to === profile.zoneId && r.from === resolved.get(first.id)!.zoneId),
    );
    const out = outPair ? Math.max(outPair.peak, outPair.offPeak) : 0;
    if (
      start + out > minutes(first.startTime) ||
      (inbound !== null && minutes(last.endTime) + inbound > end)
    )
      add(
        "SERVICE_WINDOW",
        `${day}: coverage must include pickup, all gaps and return travel. More than 8 hours needs an unavailable overtime product.`,
      );
    lines.push({
      key: `vehicle:${day}`,
      label: `${day} · ${vehicles} vehicle(s) · ${window.startTime}–${time(Math.min(end, 1439))}`,
      group: "transport",
      quantity: vehicles,
      unitRateMinor: rules.vehicleBlocks.find((b) => b.hours === window.hours)!
        .rateMinor,
      totalMinor:
        vehicles *
        rules.vehicleBlocks.find((b) => b.hours === window.hours)!.rateMinor,
      rule: `${rules.version}:vehicle-${window.hours}h`,
    });
    const zones = new Set([
      profile.zoneId,
      ...experiences.map((i) => resolved.get(i.id)!.zoneId),
    ]);
    if (zones.size > 1)
      lines.push({
        key: `cross-zone:${day}`,
        label: `${day} · cross-zone vehicle surcharge`,
        group: "transport",
        quantity: vehicles,
        unitRateMinor: rules.crossZoneSurchargePerVehicleMinor,
        totalMinor: vehicles * rules.crossZoneSurchargePerVehicleMinor,
        rule: `${rules.version}:cross-zone`,
      });
    if (
      services.assistance === "FULL_DAY_GUIDE" &&
      services.guideDays.includes(day)
    ) {
      const fullyHosted = experiences.every(
        (i) => resolved.get(i.id)!.offer.hostIncluded,
      );
      if (!fullyHosted)
        lines.push({
          key: `guide:${day}`,
          label: `${day} · full-day guide · ${window.startTime}–${time(Math.min(start + 480, 1439))}`,
          group: "hosting",
          quantity: 1,
          unitRateMinor: rules.guideDayBlock.rateMinor,
          totalMinor: rules.guideDayBlock.rateMinor,
          rule: `${rules.version}:guide-day; hosted offer overlap excluded`,
        });
      else
        warnings.push({
          code: "HOST_INCLUDED",
          message: `${day}: guide add-on suppressed because every experience already includes a host.`,
        });
    }
    if (
      services.assistance === "FULL_DAY_GUIDE" &&
      !services.guideDays.includes(day)
    )
      warnings.push({
        code: "GUIDE_UNCOVERED",
        message: `${day}: full-day guide not selected for this day; driver coverage only.`,
      });
    if (services.assistance === "ACTIVITY_GUIDE")
      for (const item of experiences.filter((i) =>
        services.guideItemIds.includes(i.id),
      )) {
        const e = resolved.get(item.id)!;
        if (e.offer.hostIncluded) continue;
        if (
          minutes(item.endTime) - minutes(item.startTime) + 30 >
          rules.activityGuideBlock.hours * 60
        )
          add(
            "GUIDE_WINDOW",
            "Experience and guide handoff buffer exceed the available 3-hour guide block.",
            item.id,
          );
        else
          lines.push({
            key: `guide:${item.id}`,
            label: `${e.name} · activity guide (3h including handoff)`,
            group: "hosting",
            quantity: 1,
            unitRateMinor: rules.activityGuideBlock.rateMinor,
            totalMinor: rules.activityGuideBlock.rateMinor,
            rule: `${rules.version}:activity-guide`,
          });
      }
  }
  const activitiesMinor = lines
      .filter((l) => l.group === "activities")
      .reduce((n, l) => n + l.totalMinor, 0),
    transportMinor = lines
      .filter((l) => l.group === "transport")
      .reduce((n, l) => n + l.totalMinor, 0),
    hostingMinor = lines
      .filter((l) => l.group === "hosting")
      .reduce((n, l) => n + l.totalMinor, 0),
    subtotalMinor = activitiesMinor + transportMinor + hostingMinor,
    feeMinor = feeHalfUp(subtotalMinor, rules.feeBps),
    taxMinor = 0,
    totalMinor = subtotalMinor + feeMinor;
  const budget =
    profile.budgetMinor *
    (profile.budgetBasis === "PERSON" ? profile.adults : 1);
  if (budget > 0 && totalMinor > budget)
    warnings.push({
      code: "BUDGET",
      message: "This plan exceeds your declared platform-services budget.",
    });
  return {
    currency: "NGN" as const,
    priceVersion: rules.version,
    lines,
    activitiesMinor,
    transportMinor,
    hostingMinor,
    subtotalMinor,
    feeMinor,
    taxMinor,
    totalMinor,
    blockers,
    warnings,
    inventoryHeld: false as const,
    isDemo: true as const,
  };
}

// Placement blockers are enforced identically by the editor, proposal engine and API.
export function placementIssues(
  profile: Profile,
  items: Item[],
  services: Services,
  offers: Experience[],
) {
  return assess(profile, items, services, offers).blockers.filter((b) =>
    [
      "DUPLICATE_ITEM",
      "OUTSIDE_TRIP",
      "INVALID_TIME",
      "INVALID_OFFER",
      "OFFER_UNAVAILABLE",
      "CITY_MISMATCH",
      "DURATION",
      "PARTY",
      "CLOSED",
      "SESSION",
      "CUTOFF",
      "CAPACITY",
      "OVERLAP",
      "TRANSIT",
      "FULL_DAY",
    ].includes(b.code),
  );
}
export function placementMessage(issue: Issue) {
  return issue.code === "OVERLAP"
    ? "This time is already occupied. Choose another time or day."
    : issue.message;
}

export function availableStarts(
  profile: Profile,
  offer: Experience,
  day: string,
  items: Item[],
  services: Services,
  offers: Experience[],
  replacingId?: string,
) {
  const options =
    offer.schedulingType === "FIXED"
      ? (offer.sessions ?? [])
          .filter((s) => !s.dates || s.dates.includes(day))
          .map((s) => ({
            start: minutes(s.startTime),
            duration: s.durationMinutes,
          }))
      : Array.from(
          {
            length: Math.max(
              0,
              Math.floor(
                (minutes(offer.availabilityLocal.closesAt) -
                  minutes(offer.availabilityLocal.opensAt) -
                  offer.durationMinMinutes) /
                  15,
              ) + 1,
            ),
          },
          (_, i) => ({
            start: minutes(offer.availabilityLocal.opensAt) + i * 15,
            duration: offer.durationMinMinutes,
          }),
        );
  return options
    .map((option) => ({
      id: replacingId ?? "00000000-0000-4000-8000-000000000000",
      localDate: day,
      startTime: time(option.start),
      endTime: time(option.start + option.duration),
      kind: "EXPERIENCE" as const,
      offerId: offer.offer.id,
      title: offer.name,
      locked: false,
    }))
    .filter(
      (candidate) =>
        !placementIssues(
          profile,
          [...items.filter((i) => i.id !== replacingId), candidate],
          services,
          offers,
        ).length,
    );
}
