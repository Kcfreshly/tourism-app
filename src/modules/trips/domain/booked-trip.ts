// A trip that has been paid for is fixed: its bookings and driver/guide
// requests were made from it. Only details that change neither prices nor
// the schedule can still be edited, chiefly the pickup address, which may be
// added after booking.
import type { Profile } from "./profile";

export const editableWhenBooked = [
  "draftName",
  "accommodation",
  "dietary",
  "accessibility",
] as const;

// True when only the fields above differ.
export function onlyBookedEditsChanged(before: Profile, after: Profile) {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const k of editableWhenBooked) keys.delete(k);
  return [...keys].every(
    (k) =>
      JSON.stringify(before[k as keyof Profile]) ===
      JSON.stringify(after[k as keyof Profile]),
  );
}
