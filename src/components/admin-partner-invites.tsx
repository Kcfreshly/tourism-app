"use client";
import { useEffect, useState } from "react";
import { showToast } from "./toast";
import {
  inviteDays,
  inviteStatusLabels,
  partnerInviteSchema,
  type InviteStatus,
  type PartnerApplication,
} from "@/modules/partners/domain/partner";

type InviteRow = PartnerApplication & {
  id: string;
  status: InviteStatus;
  createdAt: string;
  expiresAt: string;
};

const blank: PartnerApplication = {
  businessName: "",
  contactEmail: "",
  phone: "",
  offering: "",
};

const day = (value: string) =>
  new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "Africa/Lagos",
  });

async function call(method: string, body?: unknown) {
  const r = await fetch("/api/v1/admin/partner-invites", {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await r.json();
  if (!r.ok) throw Error(json.error.message);
  return json.data;
}

// Staff invite a business they've already vetted. The link is shown once,
// to send by WhatsApp or email; accepting it sets up a verified partner.
export default function AdminPartnerInvites() {
  const [invites, setInvites] = useState<InviteRow[] | null>(null),
    [form, setForm] = useState<PartnerApplication | null>(null),
    [problems, setProblems] = useState<string[]>([]),
    [busy, setBusy] = useState(false),
    [link, setLink] = useState<{ url: string; businessName: string } | null>(
      null,
    ),
    [error, setError] = useState("");
  const set = (patch: Partial<PartnerApplication>) =>
    setForm((f) => (f ? { ...f, ...patch } : f));

  useEffect(() => {
    let active = true;
    call("GET")
      .then((rows) => active && setInvites(rows))
      .catch((e) => active && setError(e.message));
    return () => {
      active = false;
    };
  }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    const parsed = partnerInviteSchema.safeParse(form);
    if (!parsed.success) {
      setProblems(parsed.error.issues.map((i) => i.message));
      return;
    }
    setProblems([]);
    setBusy(true);
    try {
      const made = await call("POST", parsed.data);
      setInvites((list) => [made.invite, ...(list ?? [])]);
      setLink({ url: made.url, businessName: made.invite.businessName });
      setForm(null);
    } catch (e) {
      setProblems([e instanceof Error ? e.message : "Unable to invite."]);
    } finally {
      setBusy(false);
    }
  }

  async function revoke(invite: InviteRow) {
    try {
      const next = await call("DELETE", { id: invite.id });
      setInvites((list) =>
        (list ?? []).map((i) => (i.id === next.id ? next : i)),
      );
      showToast({
        message: `Invitation for ${invite.businessName} cancelled.`,
      });
    } catch (e) {
      showToast({
        message: e instanceof Error ? e.message : "Unable to cancel.",
      });
    }
  }

  async function copy(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      showToast({ message: "Link copied." });
    } catch {
      showToast({ message: "Select the link and copy it." });
    }
  }

  return (
    <section aria-labelledby="invites-heading" className="admin-invites">
      <div className="admin-invites-head">
        <h3 id="invites-heading">Invitations</h3>
        {!form && (
          <button
            type="button"
            className="secondary"
            onClick={() => {
              setForm(blank);
              setLink(null);
            }}
          >
            Invite a partner
          </button>
        )}
      </div>
      <p className="muted">
        For businesses you’ve already checked. They open the link, create an
        account or sign in, and their partner account is verified straight away.
        Links work for {inviteDays} days.
      </p>

      {link && (
        <div className="notice admin-invite-link" role="status">
          <h3>Send this link to {link.businessName}</h3>
          <p>It’s shown only once. Send it by WhatsApp or email.</p>
          <div className="admin-invite-copy">
            <input
              readOnly
              aria-label="Invitation link"
              value={link.url}
              onFocus={(e) => e.target.select()}
            />
            <button type="button" onClick={() => copy(link.url)}>
              Copy link
            </button>
          </div>
        </div>
      )}

      {form && (
        <form className="card partner-apply" noValidate onSubmit={create}>
          <fieldset disabled={busy} className="partner-apply-fields">
            <legend>
              <h2>Invite a partner</h2>
            </legend>
            <label>
              Business name
              <input
                required
                maxLength={120}
                value={form.businessName}
                onChange={(e) => set({ businessName: e.target.value })}
              />
            </label>
            <div className="field-grid">
              <label>
                Contact email
                <input
                  required
                  type="email"
                  maxLength={160}
                  value={form.contactEmail}
                  onChange={(e) => set({ contactEmail: e.target.value })}
                />
              </label>
              <label>
                Phone
                <input
                  required
                  type="tel"
                  maxLength={20}
                  value={form.phone}
                  onChange={(e) => set({ phone: e.target.value })}
                />
              </label>
            </div>
            <label>
              What they run
              <textarea
                required
                rows={3}
                maxLength={600}
                placeholder="For example: weekend kayak tours on the Lekki lagoon."
                value={form.offering}
                onChange={(e) => set({ offering: e.target.value })}
              />
            </label>
            {problems.length > 0 && (
              <ul className="field-error" role="alert">
                {problems.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            )}
            <div className="actions">
              <button type="submit">
                {busy ? "Creating…" : "Create invitation link"}
              </button>
              <button
                type="button"
                className="secondary"
                onClick={() => {
                  setForm(null);
                  setProblems([]);
                }}
              >
                Cancel
              </button>
            </div>
          </fieldset>
        </form>
      )}

      {error ? (
        <p className="field-error" role="alert">
          {error}
        </p>
      ) : !invites ? (
        <p className="muted">Loading invitations…</p>
      ) : invites.length === 0 ? (
        <p className="muted">No invitations yet.</p>
      ) : (
        <ul className="admin-invite-list">
          {invites.map((i) => (
            <li key={i.id} className="card">
              <div>
                <strong>{i.businessName}</strong>
                <p className="muted">
                  {i.contactEmail} · {i.phone}
                </p>
                <p className="muted">
                  {inviteStatusLabels[i.status]} · sent {day(i.createdAt)}
                  {i.status === "OPEN" && ` · expires ${day(i.expiresAt)}`}
                </p>
              </div>
              {i.status === "OPEN" && (
                <button
                  type="button"
                  className="secondary"
                  onClick={() => revoke(i)}
                >
                  Cancel invitation
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
