import { z } from "zod";
import type { Profile } from "./profile";
import type { Experience } from "../../catalogue/domain/experience";
import {
  clockLabel,
  lagosInstant,
  serviceDayEnd,
  shortestVisit,
} from "../../catalogue/domain/schedule";
import {
  defaultTransportSettings,
  type TransportSettings,
} from "./transport-settings";
import rules from "../../../../tourism-v1-handoff/data/pricing.demo.json";
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (v) =>
      !Number.isNaN(Date.parse(v)) &&
      new Date(v).toISOString().slice(0, 10) === v,
  );
// 00:00 to 30:00: times past 24:00 are the early hours of the next morning,
// kept on the day the night out started.
export const localTime = z
  .string()
  .regex(/^(?:([01][0-9]|2[0-9]):[0-5][0-9]|30:00)$/);
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
          // One of the car blocks in the transport settings.
          hours: z.number().int().min(1).max(16),
        })
        .strict(),
    ),
    guideItemIds: z.array(z.uuid()).max(240),
    guideDays: z.array(date).max(30),
    // Days that differ from the trip's transport choice.
    dayTransport: z.record(date, z.enum(["CAR", "OWN"])).optional(),
    // A night car on a day, for the configured night block.
    nightWindows: z
      .record(date, z.object({ startTime: localTime }).strict())
      .optional(),
    // Late activities the traveller will get back from on their own.
    ownWayBack: z.array(z.uuid()).max(240).optional(),
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
// A day's transport: a car for the day or the traveller's own way. The trip
// sets the default; each day can differ.
export function dayTransport(
  profile: Pick<Profile, "transport">,
  services: Pick<Services, "dayTransport">,
  day: string,
): "CAR" | "OWN" {
  return (
    services.dayTransport?.[day] ??
    (profile.transport === "OWN" ? "OWN" : "CAR")
  );
}
function zonePair(from: string, to: string) {
  return rules.travelMatrixMinutes.find(
    (r) => (r.from === from && r.to === to) || (r.from === to && r.to === from),
  );
}
// The activities a night car covers: those starting from the night start
// time, on a day that has a night car. Everything else is the day's.
export function nightGroup<T extends Pick<Item, "startTime">>(
  schedule: T[],
  services: Pick<Services, "nightWindows">,
  day: string,
  settings: TransportSettings,
) {
  return services.nightWindows?.[day]
    ? schedule.filter(
        (i) => minutes(i.startTime) >= minutes(settings.night.startsFrom),
      )
    : [];
}
// The car that covers a run of activities: pickup in time for the first in
// traffic, and the trip back after the last. A day car uses the shortest
// block that fits; a night car starts no earlier than the night start time.
// Null when nothing fits or a route isn't configured.
export function fitCar(
  base: string,
  schedule: Pick<Item, "id" | "startTime" | "endTime">[],
  offerFor: (itemId: string) => Pick<Experience, "zoneId">,
  settings: TransportSettings,
  kind: "DAY" | "NIGHT" = "DAY",
) {
  if (!schedule.length) return null;
  const first = schedule[0],
    last = schedule.at(-1)!;
  const out = zonePair(base, offerFor(first.id).zoneId);
  const back = travelMinutes(
    offerFor(last.id).zoneId,
    base,
    minutes(last.endTime),
  );
  if (!out || back === null) return null;
  const pickup = minutes(first.startTime) - Math.max(out.peak, out.offPeak);
  const end = minutes(last.endTime) + back;
  if (end > minutes(serviceDayEnd)) return null;
  if (kind === "NIGHT") {
    const start = Math.max(
      Math.floor(pickup / 15) * 15,
      minutes(settings.night.startsFrom),
    );
    return start <= pickup && end <= start + settings.night.hours * 60
      ? { startTime: time(start), hours: settings.night.hours }
      : null;
  }
  const start = Math.max(0, Math.floor(pickup / 15) * 15);
  const block = settings.dayBlocks.find((b) => start + b.hours * 60 >= end);
  return block ? { startTime: time(start), hours: block.hours } : null;
}
// Whether a car window covers pickup for the first activity in traffic and
// the trip back after the last. Unconfigured routes are reported elsewhere.
export function carCovers(
  base: string,
  schedule: Pick<Item, "id" | "startTime" | "endTime">[],
  offerFor: (itemId: string) => Pick<Experience, "zoneId">,
  window: { startTime: string; hours: number },
) {
  if (!schedule.length) return true;
  const first = schedule[0],
    last = schedule.at(-1)!;
  const out = zonePair(base, offerFor(first.id).zoneId);
  const back = travelMinutes(
    offerFor(last.id).zoneId,
    base,
    minutes(last.endTime),
  );
  if (!out || back === null) return true;
  const from = minutes(window.startTime);
  return (
    from + Math.max(out.peak, out.offPeak) <= minutes(first.startTime) &&
    minutes(last.endTime) + back <= from + window.hours * 60
  );
}
// Guides are arranged with a local partner, so they need notice before the
// activity (or the start of a full-day guide's day).
export function guideTooLate(
  day: string,
  startTime: string,
  now = Date.now(),
  noticeHours = defaultTransportSettings.guideNoticeHours,
) {
  return lagosInstant(day, startTime) - now < noticeHours * 3600000;
}
export function guideNoticeMessage(noticeHours: number) {
  return `Guides need booking at least ${noticeHours} hours ahead.`;
}
// Guides are add-ons that combine freely: full-day guides on chosen days and
// activity guides on chosen experiences. The legacy single choice is derived
// so saved profiles and planner proposals keep a sensible summary.
export function assistanceFor(
  services: Pick<Services, "guideDays" | "guideItemIds">,
): Services["assistance"] {
  return services.guideDays.length
    ? "FULL_DAY_GUIDE"
    : services.guideItemIds.length
      ? "ACTIVITY_GUIDE"
      : "DRIVER_ONLY";
}
// How full a suggested day gets at each pace: activities per day, the
// earliest start (minutes after midnight) and the breather between activities.
export const paceRules: Record<
  Profile["pace"],
  { main: number; light: number; start: number; gap: number; label: string }
> = {
  RELAXED: { main: 1, light: 1, start: 600, gap: 60, label: "relaxed" },
  BALANCED: { main: 2, light: 1, start: 540, gap: 30, label: "balanced" },
  FULL: { main: 3, light: 2, start: 510, gap: 15, label: "full" },
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
  settings: TransportSettings = defaultTransportSettings,
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
      add("INVALID_TIME", "End time must be after start time.", item.id);
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
    if (duration < shortestVisit(offer) || duration > offer.durationMaxMinutes)
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
      lagosInstant(item.localDate, item.startTime) - now <
      offer.offer.bookingCutoffHours * 3600000
    )
      add(
        "CUTOFF",
        offer.offer.bookingCutoffHours
          ? `This experience needs booking at least ${offer.offer.bookingCutoffHours} hours before it starts.`
          : "This start time has already passed.",
        item.id,
      );
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
  const cars = Math.ceil(profile.adults / settings.seatsPerCar);
  for (const [index, day] of days.entries()) {
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
    // A night out from the day before may still be running this morning.
    for (const night of items.filter(
      (i) => i.localDate === days[index - 1] && minutes(i.endTime) > 1440,
    ))
      for (const block of schedule)
        if (minutes(night.endTime) - 1440 > minutes(block.startTime))
          add(
            "OVERLAP",
            `Overlaps with “${night.title}” from the night before.`,
            block.id,
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
    const pace = paceRules[profile.pace];
    if (
      experiences.filter((i) => resolved.get(i.id)!.kind === "MAIN").length >
      pace.main
    )
      warnings.push({
        code: "DENSITY",
        message: `${day}: busier than your ${pace.label} pace. Consider a lighter day.`,
      });
    const first = experiences[0],
      last = experiences.at(-1)!;
    const offerFor = (id: string) => resolved.get(id)!;
    const mode = dayTransport(profile, services, day);
    const night = nightGroup(experiences, services, day, settings);
    const daytime = experiences.filter((i) => !night.includes(i));
    const nightWindow = services.nightWindows?.[day];
    const dayWindow =
      mode === "CAR" && daytime.length
        ? services.vehicleWindows[day]
        : undefined;
    // A full-day guide starts with the day car, or at the first activity.
    const start = dayWindow
      ? minutes(dayWindow.startTime)
      : minutes(first.startTime);
    if (
      ((mode === "CAR" && daytime.length) || nightWindow) &&
      (profile.zoneId === "UNDECIDED" || !profile.accommodation.trim())
    )
      add(
        "MISSING_BASE",
        "Add where you’re staying, so your driver knows where to pick you up.",
      );
    if (mode === "CAR" && daytime.length && !dayWindow)
      add(
        "MISSING_WINDOW",
        `${day}: choose when your driver starts and for how many hours.`,
      );
    // Checks one car against the activities it covers, then prices it.
    const cover = (
      group: Item[],
      window: { startTime: string; hours: number },
      label: string,
      key: "vehicle" | "night",
      rateMinor: number | undefined,
    ) => {
      if (rateMinor === undefined) {
        add(
          "SERVICE_WINDOW",
          `${day}: a ${window.hours}-hour ${label} isn’t offered. Choose another length.`,
        );
        return;
      }
      const from = minutes(window.startTime),
        to = from + window.hours * 60;
      if (to > minutes(serviceDayEnd))
        add("SERVICE_WINDOW", `${day}: your ${label} can’t run past 06:00.`);
      if (group.length) {
        const out = zonePair(profile.zoneId, offerFor(group[0].id).zoneId);
        const back = travelMinutes(
          offerFor(group.at(-1)!.id).zoneId,
          profile.zoneId,
          minutes(group.at(-1)!.endTime),
        );
        if (!out || back === null)
          add(
            "ROUTE_UNSUPPORTED",
            `${day}: the accommodation route is not configured.`,
          );
        // Use the greater peak/off-peak buffer to avoid optimistic pickups.
        else if (
          from + Math.max(out.peak, out.offPeak) >
            minutes(group[0].startTime) ||
          minutes(group.at(-1)!.endTime) + back > to
        )
          add(
            "SERVICE_WINDOW",
            `${day}: your ${label} doesn’t cover the pickup, the time between activities and the trip back. Use “Fit to my plan”.`,
          );
      }
      // Cost lines start a sentence: "Car for the day", "Night car".
      const title = label[0].toUpperCase() + label.slice(1);
      lines.push({
        key: `${key}:${day}`,
        label: `${day} · ${title} · ${cars} ${cars === 1 ? "car" : "cars"} · ${clockLabel(window.startTime)}–${clockLabel(time(to))}`,
        group: "transport",
        quantity: cars,
        unitRateMinor: rateMinor,
        totalMinor: cars * rateMinor,
        rule: `transport-settings:${key}-${window.hours}h`,
      });
      const zones = new Set([
        profile.zoneId,
        ...group.map((i) => offerFor(i.id).zoneId),
      ]);
      if (zones.size > 1)
        lines.push({
          key: `${key === "vehicle" ? "cross-zone" : "night-cross-zone"}:${day}`,
          label: `${day} · ${title} cross-area surcharge`,
          group: "transport",
          quantity: cars,
          unitRateMinor: settings.crossZoneSurchargeMinor,
          totalMinor: cars * settings.crossZoneSurchargeMinor,
          rule: "transport-settings:cross-zone",
        });
    };
    if (dayWindow)
      cover(
        daytime,
        dayWindow,
        "car for the day",
        "vehicle",
        settings.dayBlocks.find((b) => b.hours === dayWindow.hours)?.rateMinor,
      );
    if (nightWindow) {
      if (minutes(nightWindow.startTime) < minutes(settings.night.startsFrom))
        add(
          "SERVICE_WINDOW",
          `${day}: the night car starts from ${settings.night.startsFrom}.`,
        );
      if (!night.length)
        warnings.push({
          code: "NIGHT_UNUSED",
          message: `${day}: your night car has no activities starting from ${settings.night.startsFrom}.`,
        });
      cover(
        night,
        { startTime: nightWindow.startTime, hours: settings.night.hours },
        "night car",
        "night",
        settings.night.rateMinor,
      );
    }
    // Making their own way: late finishes need a night car or the
    // traveller's word that they'll arrange the trip back.
    if (mode === "OWN")
      for (const item of daytime)
        if (
          minutes(item.endTime) >= minutes(settings.lateReturnFrom) &&
          !services.ownWayBack?.includes(item.id)
        )
          add(
            "LATE_RETURN",
            `“${item.title}” ends at ${clockLabel(item.endTime)}. Add a night car, or confirm you’ll arrange your own way back.`,
            item.id,
          );
    if (
      !dayWindow &&
      services.guideDays.includes(day) &&
      minutes(last.endTime) > start + 480
    )
      add(
        "GUIDE_WINDOW",
        `${day}: a full-day guide covers 8 hours from your first activity.`,
      );
    const guidedDay = services.guideDays.includes(day);
    if (
      guidedDay &&
      guideTooLate(day, time(start), now, settings.guideNoticeHours)
    )
      add(
        "GUIDE_NOTICE",
        `${day}: ${guideNoticeMessage(settings.guideNoticeHours)} Remove the full-day guide.`,
      );
    else if (guidedDay) {
      const fullyHosted = experiences.every(
        (i) => resolved.get(i.id)!.offer.hostIncluded,
      );
      if (!fullyHosted)
        lines.push({
          key: `guide:${day}`,
          label: `${day} · full-day guide · ${clockLabel(time(start))}–${clockLabel(time(start + 480))}`,
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
    for (const item of experiences.filter((i) =>
      services.guideItemIds.includes(i.id),
    )) {
      const e = resolved.get(item.id)!;
      if (e.offer.hostIncluded) continue;
      // Never charge twice: the full-day guide already covers this activity.
      if (guidedDay) {
        warnings.push({
          code: "GUIDE_COVERED",
          message: `${day}: the full-day guide already covers “${item.title}”, so no separate activity guide is charged.`,
        });
        continue;
      }
      if (guideTooLate(day, item.startTime, now, settings.guideNoticeHours))
        add(
          "GUIDE_NOTICE",
          `${guideNoticeMessage(settings.guideNoticeHours)} Remove the guide for “${item.title}”.`,
          item.id,
        );
      else if (
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

// True when every start an experience could have on `day` is already inside
// its booking cutoff: the day is too soon, rather than too full.
export function pastBookingCutoff(
  offer: Experience,
  day: string,
  now = Date.now(),
) {
  const latest = (
    offer.schedulingType === "FIXED"
      ? (offer.sessions ?? [])
          .filter((s) => !s.dates || s.dates.includes(day))
          .map((s) => s.startTime)
      : [time(minutes(offer.availabilityLocal.closesAt) - shortestVisit(offer))]
  )
    .sort()
    .at(-1);
  return (
    !!latest &&
    lagosInstant(day, latest) - now < offer.offer.bookingCutoffHours * 3600000
  );
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
                  shortestVisit(offer)) /
                  15,
              ) + 1,
            ),
          },
          // Late arrivals at a drop-in listing get a shorter visit that
          // still ends by closing time.
          (_, i) => {
            const start = minutes(offer.availabilityLocal.opensAt) + i * 15;
            return {
              start,
              duration: Math.min(
                offer.durationMinMinutes,
                minutes(offer.availabilityLocal.closesAt) - start,
              ),
            };
          },
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
