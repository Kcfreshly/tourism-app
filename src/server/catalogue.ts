import { eq } from "drizzle-orm";
import { db } from "./db";
import { catalogue } from "./schema";
import { photoForCategory, type Photo } from "../domain/photos";
import fixture from "../../tourism-v1-handoff/data/experiences.demo.json";
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
};
export async function listCatalogue() {
  return (
    await db()
      .select()
      .from(catalogue)
      .where(eq(catalogue.status, "DEMO_PUBLISHED"))
  ).map((r) => {
    const record = r.record as Experience;
    const fixed = ["cooking", "music", "local-market"].includes(r.seedKey);
    const inspiration = record.imagePath.startsWith("/assets/illustrations/")
      ? photoForCategory(record.categoryId)
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
      id: r.id,
      seedKey: r.seedKey,
    } as Experience & { seedKey: string };
  });
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
