// Turns a stored listing into the editor's state and back. Shared by the
// staff workspace and the partner portal.
import { emptyReview } from "@/modules/catalogue/domain/catalogue";
import {
  toPublishedExperience,
  type CatalogueRecord,
  type Experience,
} from "@/modules/catalogue/domain/experience";
import { storyFor } from "@/modules/catalogue/domain/experience-content";
import { listingDetails } from "@/modules/catalogue/domain/listing-details";
import { knownTags } from "@/modules/catalogue/domain/tags";
import type { Edit, FullEdit } from "./admin-listing-form";

export type Row = Omit<CatalogueRecord, "record" | "review"> & {
  record: Experience;
  review: Edit["review"] | null;
};

// The editor starts from what travellers see today, including sample copy and
// derived sessions, so saving a listing stores its effective values.
export function editRow(row: Row): FullEdit {
  const r = row.record;
  const live = toPublishedExperience(row);
  const details = listingDetails(live);
  return {
    id: row.id,
    expectedVersion: row.version,
    name: r.name,
    categoryId: r.categoryId as Edit["categoryId"],
    zoneId: r.zoneId as Edit["zoneId"],
    kind: r.kind as Edit["kind"],
    durationMinMinutes: r.durationMinMinutes,
    durationMaxMinutes: r.durationMaxMinutes,
    rateMinor: r.offer.rateMinor,
    capacityPerSlot: r.offer.capacityPerSlot,
    bookingCutoffHours: r.offer.bookingCutoffHours,
    nightVisitAllowed: r.nightVisitAllowed ?? false,
    status: row.status as Edit["status"],
    review: row.review ?? emptyReview,
    story: storyFor(live),
    tags: knownTags(r.tags),
    priceBasis: r.offer.priceBasis as Edit["priceBasis"],
    capacityUnit: r.offer.capacityUnit as Edit["capacityUnit"],
    minParty: r.offer.minParty,
    maxParty: r.offer.maxParty,
    minAge: details.minAge,
    hostIncluded: r.offer.hostIncluded,
    details: {
      operator: details.operator,
      venue: details.venue,
      arrival: details.arrival,
      pickupRateMinor: details.pickupRateMinor,
      childRateMinor: details.childRateMinor,
      confirmation: details.confirmation,
      partnerHours: details.partnerHours,
      freeCancellationHours: details.freeCancellationHours,
    },
    availability: r.availabilityLocal,
    schedulingType: live.schedulingType,
    sessions: live.sessions ?? [],
    unavailableDates: r.unavailableDates ?? [],
    mobility: r.mobility as FullEdit["mobility"],
    inclusions: r.inclusions,
    exclusions: r.exclusions,
    photoId: r.photoId ?? "",
    images: r.images ?? [],
    videoUrl: r.videoUrl ?? "",
    event: r.event ?? null,
  };
}

const tidy = (values: string[]) => values.map((v) => v.trim()).filter(Boolean);

// Drops blank lines and empty optional text before validation.
export function cleanEdit(edit: FullEdit): Edit {
  const fixed = edit.schedulingType === "FIXED" || !!edit.event;
  return {
    ...edit,
    tags: edit.tags,
    inclusions: tidy(edit.inclusions),
    exclusions: tidy(edit.exclusions),
    unavailableDates: tidy(edit.unavailableDates),
    sessions: fixed
      ? edit.sessions.map((s) => {
          const dates = s.dates ? tidy(s.dates) : [];
          return { ...s, dates: dates.length ? dates : undefined };
        })
      : [],
    event: edit.event && {
      type: edit.event.type,
      guaranteed: edit.event.guaranteed?.trim() || undefined,
      bonus: edit.event.bonus?.trim() || undefined,
      guestCheckout: edit.event.guestCheckout || undefined,
    },
  };
}
