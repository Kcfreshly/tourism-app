import { photoById, photoForExperience, type Photo } from "./photos";
import type { EventInfo } from "./events";
import type { CatalogueEdit } from "./catalogue";
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
  photos?: string[];
  inspirationPhoto?: Photo;
  photoId?: string;
  event?: EventInfo;
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
  // Events may name a specific photo or keep their own labelled illustration.
  const inspiration = record.photoId
    ? photoById(record.photoId)
    : record.imagePath.startsWith("/assets/illustrations/category-")
      ? photoForExperience(row.seedKey, record.categoryId)
      : undefined;
  return {
    ...record,
    imagePath: inspiration?.src ?? record.imagePath,
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
export function editedRecord(old: Experience, edit: CatalogueEdit) {
  return {
    ...old,
    name: edit.name.endsWith("— DEMO") ? edit.name : `${edit.name} — DEMO`,
    categoryId: edit.categoryId,
    zoneId: edit.zoneId,
    kind: edit.kind,
    durationMinMinutes: edit.durationMinMinutes,
    durationMaxMinutes: edit.durationMaxMinutes,
    status: edit.status,
    imagePath: `/assets/illustrations/category-${edit.categoryId}.svg`,
    offer: {
      ...old.offer,
      rateMinor: edit.rateMinor,
      capacityPerSlot: edit.capacityPerSlot,
    },
  };
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
