"use client";
import { useEffect } from "react";

const key = "fastlife-visitor";

// A random id for this browser, so partner dashboards can count visitors
// without knowing who they are. Falls back to one per page view.
function visitorId() {
  try {
    const saved = localStorage.getItem(key);
    if (saved) return saved;
    const id = crypto.randomUUID();
    localStorage.setItem(key, id);
    return id;
  } catch {
    return crypto.randomUUID();
  }
}

// Counts one view of a listing for its partner's dashboard. Fire and forget:
// a failed count never affects the page.
export default function ViewBeacon({
  productType,
  productId,
}: {
  productType: "EXPERIENCE" | "PACKAGE";
  productId: string;
}) {
  useEffect(() => {
    fetch("/api/v1/views", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productType, productId, visitor: visitorId() }),
      keepalive: true,
    }).catch(() => {});
  }, [productType, productId]);
  return null;
}
