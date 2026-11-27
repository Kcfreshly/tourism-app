"use client";
import { guestKeyCookie } from "@/modules/bookings/domain/checkout";

// Gives this browser a random key that owns the tickets it buys without an
// account, so the payment, order and My bookings pages can find them again.
// Kept for a year; the server only ever stores its hash.
export function ensureGuestKey() {
  if (
    document.cookie.split("; ").some((c) => c.startsWith(`${guestKeyCookie}=`))
  )
    return;
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const key = btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  const secure = location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${guestKeyCookie}=${key}; Path=/; Max-Age=31536000; SameSite=Lax${secure}`;
}
