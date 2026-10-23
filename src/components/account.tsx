"use client";
import { useState } from "react";
import { createAuthClient } from "better-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
const client = createAuthClient();
export default function Account() {
  const router = useRouter();
  const { data: session, isPending } = client.useSession();
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
    setStatus("Signing in…");
    try {
      const result = signup
        ? await client.signUp.email({ name, email, password })
        : await client.signIn.email({ email, password });
      if (result.error) throw Error(result.error.message);
      setPassword("");
      const count = await merge();
      setStatus(
        `Signed in. ${count} guest draft${count === 1 ? "" : "s"} linked to your account.`,
      );
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Unable to sign in. Retry.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="account-page">
      <p className="eyebrow">YOUR PLANS, TOGETHER</p>
      <h1>{session ? "Welcome back." : "Keep your stay close."}</h1>
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
              <Link className="button" href="/trips">
                Open my trips
              </Link>
              <button
                className="secondary"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    setStatus(`${await merge()} guest drafts linked.`);
                  } catch (e) {
                    setStatus(
                      e instanceof Error ? e.message : "Retry linking drafts.",
                    );
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Link guest drafts
              </button>
              <button
                className="secondary"
                onClick={async () => {
                  const r = await fetch("/api/v1/session", {
                    method: "DELETE",
                  });
                  if (!r.ok) {
                    setStatus("Unable to sign out. Retry.");
                    return;
                  }
                  await client.signOut();
                  router.replace("/account");
                  router.refresh();
                }}
              >
                Sign out
              </button>
            </div>
            <Link href="/admin">Staff workspace →</Link>
          </>
        ) : (
          <>
            <div className="chips">
              <button aria-pressed={!signup} onClick={() => setSignup(false)}>
                Sign in
              </button>
              <button aria-pressed={signup} onClick={() => setSignup(true)}>
                Create demo account
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
                  minLength={12}
                  maxLength={128}
                  autoComplete={signup ? "new-password" : "current-password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </label>
              <p className="muted">
                Use fictional details and a unique demo password (12+
                characters). Email delivery, verification and password recovery
                are not configured.
              </p>
              <button disabled={busy} type="submit">
                {busy
                  ? "Please wait…"
                  : signup
                    ? "Create demo account"
                    : "Sign in & link my drafts"}
              </button>
            </form>
          </>
        )}
        <p role="status">{status}</p>
      </div>
    </section>
  );
}
