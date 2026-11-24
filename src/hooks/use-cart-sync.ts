"use client";
import { useEffect } from "react";
import { authClient } from "@/components/auth-client";
import { showToast } from "@/components/toast";
import {
  mergeCarts,
  type Cart,
  type CartLine,
} from "@/modules/bookings/domain/cart";
import { readCart, writeCart } from "./use-cart";
import { storeKeys } from "./browser-store";

// Changes are saved this long after the traveller's last change.
const saveDelay = 600;

class SyncError extends Error {
  constructor(public status: number) {
    super(`Cart sync failed (${status})`);
  }
}
async function request(method: "GET" | "PUT", body?: unknown) {
  const response = await fetch("/api/v1/cart", {
    method,
    headers: { "Content-Type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!response.ok) throw new SyncError(response.status);
  return (await response.json()).data as Cart;
}

const same = (a: CartLine[], b: CartLine[]) =>
  JSON.stringify(a) === JSON.stringify(b);
function setPending(pending: boolean) {
  if (pending) localStorage.setItem(storeKeys.cartPending, "1");
  else localStorage.removeItem(storeKeys.cartPending);
}

// Sends any unsaved change straight away; sign-out awaits it.
let flushActive: (() => Promise<void>) | null = null;
export async function flushCartSync() {
  await flushActive?.();
}

// Keeps a signed-in traveller's cart in the database, like useBucketSync.
// At sign-in the guest cart merges into the saved one (C2); after that the
// device in use wins a conflict. Paid lines are removed on the server, so a
// reload drops them here too. Mount once, in the site header.
export function useCartSync() {
  const { data: session } = authClient.useSession();
  const userId = session?.user.id;
  useEffect(() => {
    if (!userId) return;
    const account = userId;
    let active = true;
    let ready = false;
    let version = 0;
    let known = readCart();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let queue: Promise<void> = Promise.resolve();

    async function save(retry = true): Promise<void> {
      const lines = readCart();
      try {
        const saved = await request("PUT", { lines, expectedVersion: version });
        version = saved.version;
        if (same(readCart(), lines)) setPending(false);
      } catch (error) {
        if (error instanceof SyncError && error.status === 409 && retry) {
          version = (await request("GET")).version;
          return save(false);
        }
        // Offline or failing: the pending flag stays for the next try.
      }
    }
    function flush() {
      clearTimeout(timer);
      timer = undefined;
      if (!ready || !localStorage.getItem(storeKeys.cartPending)) return queue;
      queue = queue.then(() => save());
      return queue;
    }
    function onChange() {
      const now = readCart();
      if (same(now, known)) return;
      known = now;
      setPending(true);
      if (!ready) return;
      clearTimeout(timer);
      timer = setTimeout(() => void flush(), saveDelay);
    }
    async function load() {
      try {
        const server = await request("GET");
        if (!active) return;
        version = server.version;
        const owner = localStorage.getItem(storeKeys.cartOwner) ?? "";
        const cached = readCart();
        let next = server.lines;
        if (!owner) {
          // Just signed in: bring the guest cart along.
          const merged = mergeCarts(server.lines, cached);
          next = merged.lines;
          if (merged.dropped)
            showToast({
              message: `Your cart is full, so ${merged.dropped} ${merged.dropped === 1 ? "item" : "items"} from before you signed in ${merged.dropped === 1 ? "wasn’t" : "weren’t"} added.`,
            });
        } else if (
          owner === account &&
          localStorage.getItem(storeKeys.cartPending)
        )
          next = cached; // unsaved changes from an earlier visit
        localStorage.setItem(storeKeys.cartOwner, account);
        known = next;
        if (!same(cached, next)) writeCart(next);
        ready = true;
        if (same(next, server.lines)) setPending(false);
        else {
          setPending(true);
          await flush();
        }
      } catch {
        // Keep showing the cache; the next load tries again.
      }
    }

    window.addEventListener("bucket-change", onChange);
    flushActive = flush;
    void load();
    return () => {
      active = false;
      window.removeEventListener("bucket-change", onChange);
      clearTimeout(timer);
      if (flushActive === flush) flushActive = null;
    };
  }, [userId]);
}
