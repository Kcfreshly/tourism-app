"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authClient as client } from "./auth-client";
import { useSignOut } from "@/hooks/use-sign-out";
export default function Account({ next }: { next?: string }) {
  const router = useRouter();
  const { signOut, signingOut } = useSignOut();
  const { data: session, isPending } = client.useSession();
  const planning = !!next && /^\/(plan|trips)/.test(next);
  const [signup, setSignup] = useState(false),
    [name, setName] = useState(""),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [status, setStatus] = useState(""),
    [busy, setBusy] = useState(false);
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
        <p className="eyebrow">{planning ? "Before you plan" : "Account"}</p>
        <h1>
          {session
            ? "Welcome back."
            : planning
              ? "Sign in to start planning."
              : "Keep your trips with you."}
        </h1>
        <p className="lede">
          {session
            ? "Your trip drafts are saved to this account."
            : planning
              ? "Your trip drafts are saved to your account so you can pick them up anytime. Your bucket is kept while you sign in."
              : "Exploring is open to everyone. Sign in to plan a trip and keep your drafts."}
        </p>
      </div>
      <div className="card form-card">
        {isPending ? (
          <p role="status">Checking session…</p>
        ) : session ? (
          <>
            <h2>{session.user.name}</h2>
            <p>{session.user.email}</p>
            <p className="notice">
              Local demo account. Email ownership is not verified; no emails or
              password-reset links are sent.
            </p>
            <div className="actions">
              {next && (
                <Link className="button" href={next}>
                  Continue planning
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
