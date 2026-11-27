// Transport and guide rules staff can change in the admin panel. The planner,
// pricing and checkout read these instead of constants, so a saved change
// applies to the next estimate. Values are demo rates until partners agree
// real ones.
import { z } from "zod";
import rules from "../../../../tourism-v1-handoff/data/pricing.demo.json";

const clock = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM times");
const minor = z.number().int().min(0).max(100000000);

export const transportSettingsSchema = z
  .object({
    seatsPerCar: z.number().int().min(1).max(20),
    // Car-for-the-day blocks travellers can choose, shortest first.
    dayBlocks: z
      .array(
        z
          .object({ hours: z.number().int().min(1).max(16), rateMinor: minor })
          .strict(),
      )
      .min(1)
      .max(6)
      .refine(
        (blocks) =>
          blocks.every((b, i) => i === 0 || b.hours > blocks[i - 1].hours),
        "List car blocks from shortest to longest, each length once",
      ),
    crossZoneSurchargeMinor: minor,
    // A separate car and driver for a night out. It can start from
    // `startsFrom` and run past midnight, up to 06:00.
    night: z
      .object({
        hours: z.number().int().min(2).max(10),
        rateMinor: minor,
        startsFrom: clock,
      })
      .strict(),
    // On a make-your-own-way day, anything ending at or after this time needs
    // a night car or the traveller's "I'll arrange my own way back".
    lateReturnFrom: clock,
    guideNoticeHours: z.number().int().min(0).max(168),
    // Travellers who book their own stay are reminded to add a pickup
    // address until this many hours before their first pickup.
    pickupAddressNoticeHours: z.number().int().min(0).max(168),
    // A flat price per airport pickup for travellers arriving from abroad,
    // copied onto the checkout line when they pay.
    airportPickupMinor: minor,
  })
  .strict();

export type TransportSettings = z.infer<typeof transportSettingsSchema>;

export const defaultTransportSettings: TransportSettings = {
  seatsPerCar: rules.vehiclePassengerCapacity,
  dayBlocks: [
    ...rules.vehicleBlocks,
    // Longer days are overtime on top of the 8-hour block.
    { hours: 10, rateMinor: 5500000 },
    { hours: 12, rateMinor: 6500000 },
  ],
  crossZoneSurchargeMinor: rules.crossZoneSurchargePerVehicleMinor,
  night: { hours: 6, rateMinor: 4000000, startsFrom: "20:00" },
  lateReturnFrom: "22:00",
  guideNoticeHours: 24,
  pickupAddressNoticeHours: 12,
  airportPickupMinor: 4_000_000,
};

// Settings saved before a field existed take its default; stored settings
// that no longer validate fall back to the defaults rather than breaking
// pricing.
export function readTransportSettings(value: unknown): TransportSettings {
  const parsed = transportSettingsSchema.safeParse({
    ...defaultTransportSettings,
    ...(value && typeof value === "object" ? value : {}),
  });
  return parsed.success ? parsed.data : defaultTransportSettings;
}

export function longestDayBlock(settings: TransportSettings) {
  return settings.dayBlocks.at(-1)!.hours;
}
