// A trip that has been paid for is fixed: its bookings and driver/guide
// requests were made from it. Only details that change neither prices nor
// the schedule can still be edited, chiefly the pickup address and the
// flight details, which may be added after booking.
import type { Profile } from "./profile";

export const editableWhenBooked = [
  "draftName",
  "accommodation",
  "dietary",
  "accessibility",
] as const;

// Parts of a booked airport pickup that can still be filled in: the price
// and the day stay as paid.
const editablePickup = ["flight", "landingTime", "bags"] as const;

function fixedPickup(p: Profile["airportPickup"]) {
  if (!p) return p;
  const fixed: Record<string, unknown> = { ...p };
  for (const k of editablePickup) delete fixed[k];
  return fixed;
}

// True when only the fields above differ.
export function onlyBookedEditsChanged(before: Profile, after: Profile) {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const k of editableWhenBooked) keys.delete(k);
  return [...keys].every((k) =>
    k === "airportPickup"
      ? JSON.stringify(fixedPickup(before.airportPickup)) ===
        JSON.stringify(fixedPickup(after.airportPickup))
      : JSON.stringify(before[k as keyof Profile]) ===
        JSON.stringify(after[k as keyof Profile]),
  );
}
