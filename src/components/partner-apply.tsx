"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  partnerApplicationSchema,
  type PartnerApplication,
  type PartnerStatus,
} from "@/modules/partners/domain/partner";

type Existing = PartnerApplication & {
  status: PartnerStatus;
  decisionReason: string | null;
  isOwner: boolean;
};

const blank: PartnerApplication = {
  businessName: "",
  contactEmail: "",
  phone: "",
  offering: "",
};

// Applying is the first step for a partner; staff verify the business before
// it can submit listings. A pending application can still be corrected.
export default function PartnerApply({
  partner,
}: {
  partner: Existing | null;
}) {
  const router = useRouter();
  const [form, setForm] = useState<PartnerApplication>(
    partner
      ? {
          businessName: partner.businessName,
          contactEmail: partner.contactEmail,
          phone: partner.phone,
          offering: partner.offering,
        }
      : blank,
  );
  const [problems, setProblems] = useState<string[]>([]),
    [busy, setBusy] = useState(false),
    [sent, setSent] = useState(false);
  const set = (patch: Partial<PartnerApplication>) =>
    setForm((f) => ({ ...f, ...patch }));

  if (partner?.status === "SUSPENDED")
    return (
      <div className="card empty-state">
        <h2>Partner account suspended</h2>
        <p>
          {partner.decisionReason ??
            "Your listings can't be changed while the account is suspended."}{" "}
          Contact Fastlife operations to reinstate it.
        </p>
      </div>
    );
  const editable = !partner || partner.isOwner;

  return (
    <div className="card partner-apply">
      {partner?.status === "PENDING" && (
        <div className="notice" role="status">
          <h3>Application received</h3>
          <p>
            We’re checking {partner.businessName}. You’ll be able to add
            activities and trips once it’s verified. You can still correct the
            details below.
          </p>
        </div>
      )}
      {partner?.status === "DECLINED" && (
        <div className="notice notice-warning" role="status">
          <h3>We couldn’t verify this application</h3>
          {partner.decisionReason && <p>{partner.decisionReason}</p>}
          <p>Update the details and send it again.</p>
        </div>
      )}
      <form
        noValidate
        onSubmit={async (e) => {
          e.preventDefault();
          const parsed = partnerApplicationSchema.safeParse(form);
          if (!parsed.success) {
            setProblems(parsed.error.issues.map((i) => i.message));
            return;
          }
          setProblems([]);
          setBusy(true);
          try {
            const r = await fetch("/api/v1/partner", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(parsed.data),
            });
            const body = await r.json();
            if (!r.ok) throw Error(body.error.message);
            setSent(true);
            router.refresh();
          } catch (error) {
            setProblems([
              error instanceof Error ? error.message : "Unable to apply.",
            ]);
          } finally {
            setBusy(false);
          }
        }}
      >
        <fieldset disabled={busy || !editable} className="partner-apply-fields">
          <legend>
            <h2>{partner ? "Your application" : "Apply as a partner"}</h2>
          </legend>
          <label>
            Business name
            <input
              required
              maxLength={120}
              autoComplete="organization"
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
                autoComplete="email"
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
                autoComplete="tel"
                value={form.phone}
                onChange={(e) => set({ phone: e.target.value })}
              />
            </label>
          </div>
          <label>
            What do you run?
            <textarea
              required
              rows={4}
              maxLength={600}
              placeholder="For example: three-day trips to Obudu every month, and weekend kayak tours on the Lekki lagoon."
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
          {sent && !problems.length && (
            <p role="status" className="muted">
              Sent. We’ll review it shortly.
            </p>
          )}
          <button>
            {!partner
              ? "Send application"
              : partner.status === "DECLINED"
                ? "Send again"
                : "Update application"}
          </button>
        </fieldset>
      </form>
    </div>
  );
}
