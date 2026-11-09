"use client";
import { useSyncExternalStore } from "react";
import { bucketLimit } from "@/modules/bucket/domain/bucket";
import { notifyStore, storeKeys, subscribeToStore } from "./browser-store";

const empty: string[] = [];
let cached = "";
let value = empty;
function snapshot() {
  try {
    const raw = localStorage.getItem(storeKeys.bucket) || "[]";
    if (raw !== cached) {
      cached = raw;
      const parsed: unknown = JSON.parse(raw);
      value = Array.isArray(parsed)
        ? [
            ...new Set(
              parsed.filter((x): x is string => typeof x === "string"),
            ),
          ].slice(0, bucketLimit)
        : empty;
    }
  } catch {
    return value;
  }
  return value;
}

export function readBucket() {
  return snapshot();
}
export function writeBucket(next: string[]) {
  localStorage.setItem(
    storeKeys.bucket,
    JSON.stringify([...new Set(next)].slice(0, bucketLimit)),
  );
  notifyStore();
}

// The traveller's shortlist of offer ids: saved ideas, not bookings. Reads
// come from the browser cache so pages render at once; useBucketSync keeps a
// signed-in traveller's cache in step with the server.
export function useBucket() {
  const ids = useSyncExternalStore(subscribeToStore, snapshot, () => empty);
  function toggle(id: string) {
    const current = snapshot();
    writeBucket(
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id],
    );
  }
  function replace(next: string[]) {
    writeBucket(next);
  }
  function clear() {
    const previous = [...snapshot()];
    replace([]);
    return previous;
  }
  function restore(previous: string[]) {
    replace([...snapshot(), ...previous]);
  }
  return { ids, toggle, clear, restore };
}
