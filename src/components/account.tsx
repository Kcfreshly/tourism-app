"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authClient as client } from "./auth-client";
import { useSignOut } from "@/hooks/use-sign-out";
import { PartnerPortalLink, usePartnerMembership } from "./partner-portal-link";
export default function Account({
  next,
  startWithSignup = false,
}: {
  next?: string;
  startWithSignup?: boolean;
}) {
  const router = useRouter();
  const { signOut, signingOut } = useSignOut();
  const { data: session, isPending } = client.useSession();
  const planning = !!next && /^\/(plan|trips)/.test(next);
  // Partner links (apply, sign in, invitations) come back to /partner.
  const partnering = !!next && next.startsWith("/partner");
  const partner = usePartnerMembership();
  const [signup, setSignup] = useState(startWithSignup),
    [name, setName] = useState(""),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [status, setStatus] = useState(""),
    [busy, setBusy] = useState(false);
  // The signed-in display name being edited, or null when not editing.
  const [rename, setRename] = useState<string | null>(null);
  async function saveName(e: React.FormEvent) {
    e.preventDefault();
    const value = rename?.trim();
    if (!value) return;
    setBusy(true);
    setStatus("Saving your name…");
    try {
      const result = await client.updateUser({ name: value });
      if (result.error) throw Error(result.error.message);
      setRename(null);
      setStatus("Name updated.");
    } catch (e) {
      setStatus(
        e instanceof Error && e.message
          ? e.message
          : "Unable to save your name. Retry.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function merge() {
    const r = await fetch("/api/v1/account/merge", { method: "POST" });
    const body = await r.json();
    if (!r.ok) throw Error(body.error.message);
    return body.data.merged as number;
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setStatus(signup ? "Creating your account…" : "Signing in…");
    try {
      const result = signup
        ? await client.signUp.email({ name, email, password })
        : await client.signIn.email({ email, password });
      if (result.error) throw Error(result.error.message);
      setPassword("");
      // Older guest drafts in this browser move into the account; a failure
      // here must not block sign-in.
      const count = await merge().catch(() => 0);
      setStatus(
        count
          ? `Signed in. ${count} earlier draft${count === 1 ? "" : "s"} linked to your account.`
          : "Signed in.",
      );
      if (next) {
        router.replace(next);
        router.refresh();
      }
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Unable to sign in. Retry.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="account-page">
      <div className="page-intro">
        <p className="eyebrow">
          {partnering
            ? "Fastlife partners"
            : planning
              ? "Before you plan"
              : "Account"}
        </p>
        <h1>
          {session
            ? "Welcome back."
            : partnering
              ? signup
                ? "Create your partner account."
                : "Sign in to your partner account."
              : planning
                ? "Sign in to start planning."
                : "Keep your trips with you."}
        </h1>
        <p className="lede">
          {session
            ? partnering
              ? "Continue to the partner portal."
              : "Your trip drafts are saved to this account."
            : partnering
              ? "Partners use the same Fastlife account as travellers. Use an email you check: bookings and updates go there."
              : planning
                ? "Your trip drafts are saved to your account so you can pick them up anytime. Your saved activities are kept while you sign in."
                : "Exploring is open to everyone. Sign in to plan a trip and keep your drafts."}
        </p>
      </div>
      <div className="card form-card">
        {isPending ? (
          <p role="status">Checking session…</p>
        ) : session ? (
          <>
            {rename === null ? (
              <div className="account-name">
                <h2>{session.user.name}</h2>
                <button
                  type="button"
                  className="text-button"
                  onClick={() => {
                    setRename(session.user.name);
                    setStatus("");
                  }}
                >
                  Change name
                </button>
              </div>
            ) : (
              <form className="account-name-form" onSubmit={saveName}>
                <label>
                  Display name
                  <input
                    required
                    autoFocus
                    maxLength={100}
                    autoComplete="name"
                    value={rename}
                    onChange={(e) => setRename(e.target.value)}
                  />
                </label>
                <div className="actions">
                  <button disabled={busy || !rename.trim()} type="submit">
                    {busy ? "Saving…" : "Save name"}
                  </button>
                  <button
                    type="button"
                    className="secondary"
                    disabled={busy}
                    onClick={() => {
                      setRename(null);
                      setStatus("");
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
            <p>{session.user.email}</p>
            <p className="notice">
              Local demo account. Email ownership is not verified; no emails or
              password-reset links are sent.
            </p>
            <div className="actions">
              {next && (
                <Link className="button" href={next}>
                  {partnering
                    ? "Continue to partner portal"
                    : "Continue planning"}
                </Link>
              )}
              <Link
                className={next ? "button secondary" : "button"}
                href="/trips"
              >
                My trip drafts
              </Link>
              <Link className="button secondary" href="/explore">
                Explore experiences
              </Link>
              <button
                className="secondary"
                disabled={signingOut}
                onClick={async () => {
                  if (!(await signOut())) {
                    setStatus("Unable to sign out. Retry.");
                    return;
                  }
                  router.replace("/account");
                  router.refresh();
                }}
              >
                Sign out
              </button>
            </div>
            {partner && (
              <p>
                <PartnerPortalLink />
              </p>
            )}
            {(session.user as { role?: string }).role === "ADMIN" && (
              <p>
                <Link className="text-link" href="/admin">
                  Staff workspace
                </Link>
              </p>
            )}
          </>
        ) : (
          <>
            <div className="segmented" role="group" aria-label="Account">
              <button
                type="button"
                aria-pressed={!signup}
                onClick={() => setSignup(false)}
              >
                Sign in
              </button>
              <button
                type="button"
                aria-pressed={signup}
                onClick={() => setSignup(true)}
              >
                Create account
              </button>
            </div>
            <form onSubmit={submit}>
              {signup && (
                <label>
                  Display name
                  <input
                    required
                    maxLength={100}
                    autoComplete="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </label>
              )}
              <label>
                Email
                <input
                  required
                  type="email"
                  autoComplete="email"
                  maxLength={254}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>
              <label>
                Password
                <input
                  required
                  type="password"
                  minLength={8}
                  maxLength={128}
                  autoComplete={signup ? "new-password" : "current-password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </label>
              <p className="muted">
                Use fictional details and a unique demo password (8+
                characters). Email delivery, verification and password recovery
                are not configured.
              </p>
              <button disabled={busy} type="submit">
                {busy
                  ? "Please wait…"
                  : signup
                    ? planning
                      ? "Create account & start planning"
                      : partnering
                        ? "Create account & continue"
                        : "Create account"
                    : planning
                      ? "Sign in & start planning"
                      : "Sign in"}
              </button>
            </form>
          </>
        )}
        <p role="status" className="muted">
          {status}
        </p>
      </div>
    </section>
  );
}
