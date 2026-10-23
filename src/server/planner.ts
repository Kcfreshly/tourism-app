import { randomUUID } from "node:crypto";
import Ajv from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import contract from "../../tourism-v1-handoff/contracts/planner-output.schema.json";
import {
  assess,
  placementIssues,
  minutes,
  time,
  tripDays,
  travelMinutes,
  type Item,
  type Services,
} from "../domain/planner";
import type { Profile } from "../domain/profile";
import type { Experience } from "./catalogue";
const ajv = new Ajv();
addFormats(ajv);
const valid = ajv.compile(contract);
export function assertPlannerContract(items: Item[]) {
  const payload = {
    items: items.map(
      ({ localDate, startTime, endTime, kind, offerId, title, reason }) => ({
        localDate,
        startTime,
        endTime,
        kind,
        offerId,
        title,
        reason: reason ?? "Kept from your existing plan.",
      }),
    ),
    assumptions: [],
    questions: [],
  };
  if (!valid(payload)) throw Error("Planner output failed shared contract");
}
export function lockedItemsUnchanged(before: Item[], after: Item[]) {
  return before
    .filter((i) => i.locked)
    .every((old) => {
      const next = after.find((i) => i.id === old.id);
      return next && JSON.stringify(next) === JSON.stringify(old);
    });
}
export function propose(
  profile: Profile,
  existing: Item[],
  services: Services,
  offers: Experience[],
) {
  const days = tripDays(profile),
    items = existing.filter((i) => i.locked || i.kind === "CUSTOM"),
    nextServices: Services = structuredClone(services),
    used = new Set(items.map((i) => i.offerId));
  const eligible = offers.filter(
    (e) =>
      e.cityId === profile.cityId &&
      profile.interests.includes(
        e.categoryId as Profile["interests"][number],
      ) &&
      profile.adults >= e.offer.minParty &&
      profile.adults <= e.offer.maxParty,
  );
  for (const [dayIndex, day] of days.entries()) {
    const retained = items.filter((i) => i.localDate === day);
    if (
      retained.some(
        (i) =>
          i.kind === "EXPERIENCE" &&
          offers.find((e) => e.offer.id === i.offerId)?.kind === "FULL_DAY",
      )
    )
      continue;
    const lightDay =
      days.length > 1 && (dayIndex === 0 || dayIndex === days.length - 1);
    const candidates = eligible
      .filter((e) => !used.has(e.offer.id))
      .sort(
        (a, b) =>
          Number(profile.selectedOfferIds.includes(b.offer.id)) -
            Number(profile.selectedOfferIds.includes(a.offer.id)) ||
          Number(b.zoneId === profile.zoneId) -
            Number(a.zoneId === profile.zoneId),
      );
    let cursor = Math.max(
      dayIndex > 0 &&
        items.some(
          (i) =>
            i.localDate === days[dayIndex - 1] && minutes(i.endTime) >= 1320,
        )
        ? 660
        : 540,
      ...retained
        .filter((i) => i.kind === "EXPERIENCE")
        .map((i) => minutes(i.endTime) + 60),
    );
    let mainCount = retained.filter(
        (i) =>
          i.kind === "EXPERIENCE" &&
          offers.find((e) => e.offer.id === i.offerId)?.kind !== "LIGHT",
      ).length,
      lightCount = 0,
      hasFullDay = false;
    for (const e of candidates) {
      if (
        (lightDay && e.kind !== "LIGHT") ||
        (e.kind === "LIGHT" && lightCount >= 1) ||
        (e.kind !== "LIGHT" && (hasFullDay || mainCount >= 2)) ||
        (e.kind === "FULL_DAY" && mainCount > 0)
      )
        continue;
      const session =
        e.schedulingType === "FIXED"
          ? e.sessions?.find(
              (s) =>
                minutes(s.startTime) >= cursor &&
                (!s.dates || s.dates.includes(day)),
            )
          : undefined;
      if (e.schedulingType === "FIXED" && !session) continue;
      const start = session
        ? minutes(session.startTime)
        : Math.max(cursor, minutes(e.availabilityLocal.opensAt));
      const end = start + (session?.durationMinutes ?? e.durationMinMinutes);
      if (end > minutes(e.availabilityLocal.closesAt)) continue;
      const candidate: Item = {
        id: randomUUID(),
        localDate: day,
        startTime: time(start),
        endTime: time(end),
        kind: "EXPERIENCE",
        offerId: e.offer.id,
        title: e.name,
        locked: false,
        reason: `Matches ${e.categoryId}; a fictional catalogue offer. ${lightDay ? "A light arrival/departure day." : "Grouped into your editable day."}`,
      };
      const dayItems = [
        ...items.filter((i) => i.localDate === day && i.kind === "EXPERIENCE"),
        candidate,
      ].sort((a, b) => a.startTime.localeCompare(b.startTime));
      const first = offers.find((o) => o.offer.id === dayItems[0].offerId)!;
      const outbound = travelMinutes(profile.zoneId, first.zoneId, 480) ?? 60;
      nextServices.vehicleWindows[day] = {
        startTime: time(
          Math.max(0, minutes(dayItems[0].startTime) - outbound - 15),
        ),
        hours: 8,
      };
      const trial = assess(
        profile,
        [...items, candidate],
        nextServices,
        offers,
      );
      if (
        placementIssues(profile, [...items, candidate], nextServices, offers)
          .length ||
        trial.blockers.some((b) => b.code === "SERVICE_WINDOW")
      )
        continue;
      items.push(candidate);
      used.add(e.offer.id);
      cursor = end + (travelMinutes(e.zoneId, e.zoneId, end) ?? 60) + 30;
      if (e.kind === "LIGHT") lightCount++;
      else mainCount++;
      if (e.kind === "FULL_DAY") hasFullDay = true;
    }
    if (
      nextServices.assistance === "FULL_DAY_GUIDE" &&
      items.some((i) => i.localDate === day && i.kind === "EXPERIENCE") &&
      !nextServices.guideDays.includes(day)
    )
      nextServices.guideDays.push(day);
  }
  // Render supplied transfer estimates only where the interval is genuinely free.
  for (const day of days) {
    const dayItems = items
      .filter((i) => i.localDate === day && i.kind === "EXPERIENCE")
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
    for (let i = 1; i < dayItems.length; i++) {
      const from = dayItems[i - 1],
        to = dayItems[i],
        a = offers.find((e) => e.offer.id === from.offerId),
        b = offers.find((e) => e.offer.id === to.offerId);
      if (!a || !b) continue;
      const duration = travelMinutes(a.zoneId, b.zoneId, minutes(from.endTime));
      if (duration === null) continue;
      const end = minutes(from.endTime) + duration;
      if (
        end <= minutes(to.startTime) &&
        !items.some(
          (item) =>
            item.localDate === day &&
            minutes(item.startTime) < end &&
            minutes(item.endTime) > minutes(from.endTime),
        )
      )
        items.push({
          id: randomUUID(),
          localDate: day,
          startTime: from.endTime,
          endTime: time(end),
          kind: "TRAVEL",
          offerId: null,
          title: "Estimated transfer — fictional demo matrix",
          locked: false,
          reason: "Configured zone/time-band buffer; not live traffic.",
        });
    }
  }
  items.sort(
    (a, b) =>
      a.localDate.localeCompare(b.localDate) ||
      a.startTime.localeCompare(b.startTime),
  );
  assertPlannerContract(items);
  return {
    items,
    services: nextServices,
    assumptions: [
      "Deterministic catalogue planner; no AI model is connected.",
      "First and last days are light; two main plus one optional light is a default, not a quota.",
      "Unallocated time remains free. Transport estimates and all supply are fictional.",
    ],
    questions:
      profile.zoneId === "UNDECIDED" || !profile.accommodation.trim()
        ? ["Confirm your fixed accommodation base before transport checkout."]
        : [],
  };
}
