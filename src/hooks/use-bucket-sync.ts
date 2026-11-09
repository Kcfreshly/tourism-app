"use client";
import { useEffect } from "react";
import { authClient } from "@/components/auth-client";
import { mergeBuckets, type Bucket } from "@/modules/bucket/domain/bucket";
import { readBucket, writeBucket } from "./use-bucket";
import { storeKeys } from "./browser-store";

// Changes are saved this long after the traveller's last tap.
const saveDelay = 600;

class SyncError extends Error {
  constructor(public status: number) {
    super(`Bucket sync failed (${status})`);
  }
}
async function request(method: "GET" | "PUT", body?: unknown) {
  const response = await fetch("/api/v1/bucket", {
    method,
    headers: { "Content-Type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!response.ok) throw new SyncError(response.status);
  return (await response.json()).data as Bucket;
}

const same = (a: string[], b: string[]) =>
  JSON.stringify(a) === JSON.stringify(b);
function setPending(pending: boolean) {
  if (pending) localStorage.setItem(storeKeys.bucketPending, "1");
  else localStorage.removeItem(storeKeys.bucketPending);
}

// Sends any unsaved change straight away. Sign-out awaits this so the last
// tap before signing out is not lost.
let flushActive: (() => Promise<void>) | null = null;
export async function flushBucketSync() {
  await flushActive?.();
}

// Keeps a signed-in traveller's bucket in the database. The browser cache
// stays the render source, so pages paint instantly; this reconciles it with
// the server after sign-in and on every load, then saves changes shortly
// after they are made. Mount once, in the site header.
export function useBucketSync() {
  const { data: session } = authClient.useSession();
  const userId = session?.user.id;
  useEffect(() => {
    if (!userId) return;
    const account = userId;
    let active = true;
    let ready = false;
    let version = 0;
    let known = readBucket();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let queue: Promise<void> = Promise.resolve();
    // Taps made before the saved bucket has loaded, replayed onto it so a
    // stale cache can't overwrite changes made on another device.
    const earlyAdds = new Set<string>();
    const earlyRemoves = new Set<string>();

    async function save(retry = true): Promise<void> {
      const ids = readBucket();
      try {
        const saved = await request("PUT", {
          offerIds: ids,
          expectedVersion: version,
        });
        version = saved.version;
        if (!same(readBucket(), ids)) return; // newer taps follow in their own save
        setPending(false);
        // The server drops offers that are no longer published.
        if (!same(saved.offerIds, ids)) {
          known = saved.offerIds;
          writeBucket(saved.offerIds);
        }
      } catch (error) {
        // Another tab or device saved first. The device in use wins: take the
        // new version and send this list again, once.
        if (error instanceof SyncError && error.status === 409 && retry) {
          version = (await request("GET")).version;
          return save(false);
        }
        // Offline or failing: the pending flag stays, and the next change or
        // page load tries again. The cache still shows the traveller's picks.
      }
    }
    function flush() {
      clearTimeout(timer);
      timer = undefined;
      if (!ready || !localStorage.getItem(storeKeys.bucketPending))
        return queue;
      queue = queue.then(() => save());
      return queue;
    }
    function onChange() {
      const now = readBucket();
      if (same(now, known)) return;
      if (!ready) {
        for (const id of now)
          if (!known.includes(id)) {
            earlyAdds.add(id);
            earlyRemoves.delete(id);
          }
        for (const id of known)
          if (!now.includes(id)) {
            earlyRemoves.add(id);
            earlyAdds.delete(id);
          }
      }
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
        const owner = localStorage.getItem(storeKeys.bucketOwner) ?? "";
        const cached = readBucket();
        let next = server.offerIds;
        if (!owner)
          next = mergeBuckets(server.offerIds, cached); // just signed in
        else if (owner === account && (earlyAdds.size || earlyRemoves.size))
          next = mergeBuckets(
            server.offerIds.filter((id) => !earlyRemoves.has(id)),
            [...earlyAdds],
          );
        else if (
          owner === account &&
          localStorage.getItem(storeKeys.bucketPending)
        )
          next = cached; // unsaved taps from an earlier visit
        localStorage.setItem(storeKeys.bucketOwner, account);
        known = next;
        if (!same(cached, next)) writeBucket(next);
        ready = true;
        if (same(next, server.offerIds)) setPending(false);
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
