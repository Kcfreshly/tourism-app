"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

// The signed-in person accepts the invitation; the portal opens next.
export default function PartnerInviteAccept({
  token,
  email,
  businessName,
  replacesApplication,
}: {
  token: string;
  email: string;
  businessName: string;
  replacesApplication: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false),
    [problem, setProblem] = useState("");
  async function accept() {
    setBusy(true);
    setProblem("");
    try {
      const r = await fetch("/api/v1/partner/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const body = await r.json();
      if (!r.ok) throw Error(body.error?.message ?? "Unable to accept.");
      router.push("/partner");
      router.refresh();
    } catch (e) {
      setProblem(e instanceof Error ? e.message : "Unable to accept. Retry.");
      setBusy(false);
    }
  }
  return (
    <>
      <p>
        You’re signed in as <strong>{email}</strong>. This account will own{" "}
        <strong>{businessName}</strong> on Fastlife.
        {replacesApplication &&
          " Your earlier application is replaced by this verified one."}
      </p>
      <div className="actions">
        <button type="button" disabled={busy} onClick={accept}>
          {busy ? "Accepting…" : "Accept invitation"}
        </button>
        <Link className="button secondary" href="/account">
          Use another account
        </Link>
      </div>
      {problem && (
        <p className="field-error" role="alert">
          {problem}
        </p>
      )}
    </>
  );
}
