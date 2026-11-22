import { photoById, photoForExperience, type Photo } from "./photos";
import type { EventInfo } from "./events";
import type { CatalogueEdit } from "./catalogue";
import type { ListingDetails } from "./listing-details";
import { imageUrl, type ListingImage } from "./images";
import fixture from "../../../../tourism-v1-handoff/data/experiences.demo.json";
export type Experience = (typeof fixture.experiences)[number] & {
  schedulingType?: "FLEXIBLE" | "FIXED";
  sessions?: {
    startTime: string;
    durationMinutes: number;
    dates?: string[];
    capacity?: number;
  }[];
  unavailableDates?: string[];
  videoUrl?: string;
  // Derived for display from `images`; not stored.
  photos?: string[];
  photoAlts?: string[];
  // Staff-uploaded photos, primary first.
  images?: ListingImage[];
  inspirationPhoto?: Photo;
  photoId?: string;
  event?: EventInfo;
  // Passed the night-time security review (see catalogue.ts).
  nightVisitAllowed?: boolean;
  // Staff-written copy and booking details. Listings without them fall back
  // to the labelled samples in experience-content.ts and listing-details.ts.
  story?: { teaser: string; summary: string; why: string };
  details?: Omit<ListingDetails, "minAge" | "familySuitable">;
};
// One stored catalogue row: the listing payload plus its review state.
export type CatalogueRecord = {
  id: string;
  seedKey: string;
  status: string;
  version: number;
  record: unknown;
  review: unknown;
};
export type PublishedExperience = Experience & { seedKey: string };
// Adds display and scheduling defaults to a published row.
export function toPublishedExperience(
  row: Pick<CatalogueRecord, "id" | "seedKey" | "record">,
): PublishedExperience {
  const record = row.record as Experience;
  const fixed = ["cooking", "music", "local-market"].includes(row.seedKey);
  // Uploaded photos come first. Otherwise events may name a licensed photo or
  // keep their own labelled illustration.
  const uploaded = record.images?.length ? record.images : undefined;
  const inspiration = uploaded
    ? undefined
    : record.photoId
      ? photoById(record.photoId)
      : record.imagePath.startsWith("/assets/illustrations/category-")
        ? photoForExperience(row.seedKey, record.categoryId)
        : undefined;
  return {
    ...record,
    imagePath: uploaded
      ? imageUrl(uploaded[0].id)
      : (inspiration?.src ?? record.imagePath),
    photos: uploaded?.map((i) => imageUrl(i.id)),
    photoAlts: uploaded?.map((i) => i.alt),
    inspirationPhoto: inspiration,
    schedulingType: record.schedulingType ?? (fixed ? "FIXED" : "FLEXIBLE"),
    sessions:
      record.sessions ??
      (fixed
        ? [0, 180]
            .map((offset) => {
              const [h, m] = record.availabilityLocal.opensAt
                .split(":")
                .map(Number);
              const start = h * 60 + m + offset;
              return {
                startTime: `${Math.floor(start / 60)
                  .toString()
                  .padStart(
                    2,
                    "0",
                  )}:${(start % 60).toString().padStart(2, "0")}`,
                durationMinutes: record.durationMinMinutes,
                capacity: record.offer.capacityPerSlot,
              };
            })
            .filter((session) => {
              const [h, m] = session.startTime.split(":").map(Number);
              const [closeH, closeM] = record.availabilityLocal.closesAt
                .split(":")
                .map(Number);
              return (
                h * 60 + m + session.durationMinutes <= closeH * 60 + closeM
              );
            })
        : []),
    id: row.id,
    seedKey: row.seedKey,
  } as PublishedExperience;
}
export function publishBlockers(record: Experience) {
  return [
    ...(record.isDemo
      ? ["Fictional demo supply cannot be published live."]
      : []),
    ...(!record.verifiedAt || !record.verificationExpiresAt
      ? ["Current verification required."]
      : []),
    ...(!record.evidence.length
      ? ["Supplier, rate, capacity, policy and media evidence required."]
      : []),
  ];
}
// The listing after a staff edit; names always carry the demo marker.
// Optional edit fields that were not sent keep their stored values.
export function editedRecord(old: Experience, edit: CatalogueEdit) {
  const next: Experience = {
    ...old,
    name: edit.name.endsWith("— DEMO") ? edit.name : `${edit.name} — DEMO`,
    categoryId: edit.categoryId,
    zoneId: edit.zoneId,
    kind: edit.kind,
    durationMinMinutes: edit.durationMinMinutes,
    durationMaxMinutes: edit.durationMaxMinutes,
    status: edit.status,
    nightVisitAllowed: edit.nightVisitAllowed ?? old.nightVisitAllowed,
    imagePath: `/assets/illustrations/category-${edit.categoryId}.svg`,
    story: edit.story ?? old.story,
    details: edit.details ?? old.details,
    tags: edit.tags ?? old.tags,
    availabilityLocal: edit.availability ?? old.availabilityLocal,
    schedulingType: edit.schedulingType ?? old.schedulingType,
    sessions: edit.sessions ?? old.sessions,
    unavailableDates: edit.unavailableDates ?? old.unavailableDates,
    mobility: edit.mobility ?? old.mobility,
    inclusions: edit.inclusions ?? old.inclusions,
    exclusions: edit.exclusions ?? old.exclusions,
    offer: {
      ...old.offer,
      rateMinor: edit.rateMinor,
      capacityPerSlot: edit.capacityPerSlot,
      bookingCutoffHours:
        edit.bookingCutoffHours ?? old.offer.bookingCutoffHours,
      priceBasis: edit.priceBasis ?? old.offer.priceBasis,
      capacityUnit: edit.capacityUnit ?? old.offer.capacityUnit,
      minParty: edit.minParty ?? old.offer.minParty,
      maxParty: edit.maxParty ?? old.offer.maxParty,
      minAge: edit.minAge ?? old.offer.minAge,
      hostIncluded: edit.hostIncluded ?? old.offer.hostIncluded,
    },
  };
  if (edit.photoId !== undefined) next.photoId = edit.photoId || undefined;
  if (edit.images !== undefined)
    next.images = edit.images.length ? edit.images : undefined;
  if (edit.videoUrl !== undefined) next.videoUrl = edit.videoUrl || undefined;
  if (edit.event !== undefined) next.event = edit.event ?? undefined;
  return JSON.parse(JSON.stringify(next)) as Experience;
}

// Names of the listing fields an edit changed, for the audit trail.
export function changedFields(old: Experience, next: Experience) {
  const keys = new Set([...Object.keys(old), ...Object.keys(next)]);
  const changed: string[] = [];
  for (const key of keys) {
    const a = old[key as keyof Experience];
    const b = next[key as keyof Experience];
    if (key === "offer")
      for (const k of Object.keys({ ...old.offer, ...next.offer })) {
        const field = k as keyof Experience["offer"];
        if (
          JSON.stringify(old.offer[field]) !== JSON.stringify(next.offer[field])
        )
          changed.push(`offer.${k}`);
      }
    else if (JSON.stringify(a) !== JSON.stringify(b)) changed.push(key);
  }
  return changed.sort();
}

// A new fictional draft built from the first demo listing.
export function draftRecord(id: string, name: string) {
  const template = fixture.experiences[0];
  return {
    ...template,
    id: `demo-${id}`,
    name: `${name} — DEMO`,
    status: "DRAFT",
    supplierId: `fictional-${id}`,
    offer: {
      ...template.offer,
      id: `demo-offer-${id}`,
      rateMinor: 0,
      capacityPerSlot: 1,
    },
  };
}
