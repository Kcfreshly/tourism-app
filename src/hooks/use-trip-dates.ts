"use client";
import { useSyncExternalStore } from "react";
import { profileSchema } from "@/domain/profile";
import { storeKeys, subscribeToStore } from "./browser-store";

function readProfile() {
  try {
    return localStorage.getItem(storeKeys.profile) || "";
  } catch {
    return "";
  }
}

// The draft trip dates the traveller last entered, if any.
export function useTripDates() {
  const raw = useSyncExternalStore(subscribeToStore, readProfile, () => "");
  if (!raw) return null;
  try {
    const parsed = profileSchema.safeParse(JSON.parse(raw));
    return parsed.success
      ? { start: parsed.data.startDate, end: parsed.data.endDate }
      : null;
  } catch {
    return null;
  }
}
