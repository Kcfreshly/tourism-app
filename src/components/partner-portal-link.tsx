"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { authClient } from "./auth-client";

type Membership = { status: string } | null;

// One lookup per signed-in account per page load, shared by the header and
// the account page.
let cached: { userId: string; result: Promise<Membership> } | null = null;
function membership(userId: string) {
  if (cached?.userId !== userId)
    cached = {
      userId,
      result: fetch("/api/v1/partner")
        .then((r) => (r.ok ? r.json() : { data: null }))
        .then((body) => (body.data as Membership) ?? null)
        .catch(() => null),
    };
  return cached.result;
}

// Whether the signed-in account belongs to a partner business (any status).
export function usePartnerMembership() {
  const { data: session } = authClient.useSession();
  const userId = session?.user.id ?? null;
  const [found, setFound] = useState<{ userId: string; m: Membership }>();
  useEffect(() => {
    if (!userId) return;
    let live = true;
    membership(userId).then((m) => live && setFound({ userId, m }));
    return () => {
      live = false;
    };
  }, [userId]);
  return userId && found?.userId === userId ? found.m : null;
}

export function PartnerPortalLink({
  className = "text-link",
  onClick,
}: {
  className?: string;
  onClick?: () => void;
}) {
  const partner = usePartnerMembership();
  if (!partner) return null;
  return (
    <Link className={className} href="/partner" onClick={onClick}>
      {partner.status === "VERIFIED" ? "Partner portal" : "Partner application"}
    </Link>
  );
}
