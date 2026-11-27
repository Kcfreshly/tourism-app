import { createHash } from "node:crypto";
import { guestKeyCookie } from "../../domain/checkout";

// Showing the guest key again proves the browser owns a guest checkout and
// its order. Only the hash is compared or stored.
export { guestKeyCookie };
const format = /^[A-Za-z0-9_-]{32,128}$/;

export function guestKeyHash(key: string | undefined | null) {
  return key && format.test(key)
    ? createHash("sha256").update(key).digest("hex")
    : null;
}

export function guestKeyFromCookies(cookieHeader: string | null) {
  for (const part of (cookieHeader ?? "").split(";")) {
    const [name, ...value] = part.trim().split("=");
    if (name === guestKeyCookie) return value.join("=");
  }
  return null;
}
