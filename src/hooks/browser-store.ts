"use client";
// Per-browser traveller state kept in localStorage, and the change event the
// hooks below subscribe to. Same-tab writes dispatch "bucket-change"; other
// tabs are covered by the native "storage" event.

export const storeKeys = {
  bucket: "tourism.bucket.v1",
  // Whose bucket the cache holds: an account id, or empty for a guest.
  bucketOwner: "tourism.bucket.owner",
  // Set while a signed-in change has not reached the server yet.
  bucketPending: "tourism.bucket.pending",
  activeTrip: "tourism.onboardedTrip",
  profile: "tourism.profile",
} as const;

export function subscribeToStore(fn: () => void) {
  window.addEventListener("storage", fn);
  window.addEventListener("bucket-change", fn);
  return () => {
    window.removeEventListener("storage", fn);
    window.removeEventListener("bucket-change", fn);
  };
}

export function notifyStore() {
  window.dispatchEvent(new Event("bucket-change"));
}

// Signing out leaves nothing of the traveller behind on a shared device: the
// bucket cache, the active trip and the profile draft all go. A signed-in
// bucket is safe on the server and returns at the next sign-in. Layout preferences
// such as the planner split stay, as they say nothing about the person.
export function forgetTravellerState() {
  try {
    for (const key of Object.values(storeKeys)) localStorage.removeItem(key);
    notifyStore();
  } catch {
    /* Storage may be unavailable; nothing to forget. */
  }
}
