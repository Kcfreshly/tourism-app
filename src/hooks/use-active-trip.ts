"use client";
import { useSyncExternalStore } from "react";
import { notifyStore, storeKeys, subscribeToStore } from "./browser-store";

// The trip the traveller is currently planning in this browser, if any.
export function useActiveTrip() {
  return useSyncExternalStore(
    subscribeToStore,
    () => localStorage.getItem(storeKeys.activeTrip) || "",
    () => "",
  );
}

export function activateTrip(id: string) {
  localStorage.setItem(storeKeys.activeTrip, id);
  notifyStore();
}

// Stops pointing at a trip that no longer exists.
export function forgetTrip(id: string) {
  if (localStorage.getItem(storeKeys.activeTrip) !== id) return;
  localStorage.removeItem(storeKeys.activeTrip);
  notifyStore();
}
