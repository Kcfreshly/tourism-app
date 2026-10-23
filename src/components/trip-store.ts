"use client";
import { useSyncExternalStore } from "react";
const key = "tourism.bucket.v1";
const empty: string[] = [];
let cached = "";
let value = empty;
function snapshot() {
  try {
    const raw = localStorage.getItem(key) || "[]";
    if (raw !== cached) {
      cached = raw;
      const parsed: unknown = JSON.parse(raw);
      value = Array.isArray(parsed)
        ? [
            ...new Set(
              parsed.filter((x): x is string => typeof x === "string"),
            ),
          ].slice(0, 30)
        : empty;
    }
  } catch {
    return value;
  }
  return value;
}
function subscribe(fn: () => void) {
  window.addEventListener("storage", fn);
  window.addEventListener("bucket-change", fn);
  return () => {
    window.removeEventListener("storage", fn);
    window.removeEventListener("bucket-change", fn);
  };
}
export function useBucket() {
  const ids = useSyncExternalStore(subscribe, snapshot, () => empty);
  function toggle(id: string) {
    const current = snapshot();
    const next = current.includes(id)
      ? current.filter((x) => x !== id)
      : [...current, id].slice(0, 30);
    localStorage.setItem(key, JSON.stringify(next));
    window.dispatchEvent(new Event("bucket-change"));
  }
  function replace(next: string[]) {
    localStorage.setItem(key, JSON.stringify([...new Set(next)].slice(0, 30)));
    window.dispatchEvent(new Event("bucket-change"));
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

export function useActiveTrip() {
  return useSyncExternalStore(
    subscribe,
    () => localStorage.getItem("tourism.onboardedTrip") || "",
    () => "",
  );
}
export function activateTrip(id: string) {
  localStorage.setItem("tourism.onboardedTrip", id);
  window.dispatchEvent(new Event("bucket-change"));
}
