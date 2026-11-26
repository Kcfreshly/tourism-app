import type { Metadata } from "next";
import Link from "next/link";
import { pages } from "@/bootstrap/container";
import PartnerInviteAccept from "@/components/partner-invite-accept";
import { AppError } from "@/shared/application/app-error";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Partner invitation" };

const lagosDay = (d: Date) =>
  d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    timeZone: "Africa/Lagos",
  });

// A business Fastlife staff already vetted opens its invitation link here,
// signs in or creates an account, and accepts.
export default async function PartnerInvite({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const here = `/partner/invite/${encodeURIComponent(token)}`;
  let invite;
  try {
    invite = await pages.partnerInvite(token);
  } catch (e) {
    if (!(e instanceof AppError && e.kind === "NOT_FOUND")) throw e;
  }
  const actor = await pages.currentActor();
  const partner = actor ? await pages.partnerFor(actor.id) : null;
  const already =
    partner?.status === "VERIFIED" || partner?.status === "SUSPENDED";

  return (
    <section className="admin-page partner-page">
      <header className="admin-header">
        <div>
          <p className="eyebrow">Fastlife partners</p>
          <h1>
            {invite
              ? `You’re invited to list ${invite.businessName}`
              : "Invitation not found"}
          </h1>
          <p>
            {invite
              ? "Fastlife has already checked your business. Accept to open your partner portal and start adding listings."
              : "This link isn’t valid. Check you copied all of it, or ask Fastlife for a new one."}
          </p>
        </div>
      </header>
      <div className="card form-card partner-invite">
        {!invite ? (
          <p>
            <Link className="text-link" href="/partner">
              About partnering with Fastlife
            </Link>
          </p>
        ) : invite.status === "EXPIRED" ? (
          <p>
            This invitation expired on {lagosDay(invite.expiresAt)}. Ask your
            Fastlife contact to send a new one.
          </p>
        ) : invite.status !== "OPEN" ? (
          <>
            <p>This invitation has already been used or was cancelled.</p>
            <Link className="button" href="/partner">
              Go to the partner portal
            </Link>
          </>
        ) : !actor ? (
          <>
            <p>
              Create an account for your business, or sign in if you already
              have one. Then you’ll come back here to accept. The link works
              until {lagosDay(invite.expiresAt)}.
            </p>
            <div className="actions">
              <Link
                className="button"
                href={`/account?next=${encodeURIComponent(here)}&mode=signup`}
              >
                Create account
              </Link>
              <Link
                className="button secondary"
                href={`/account?next=${encodeURIComponent(here)}`}
              >
                Sign in
              </Link>
            </div>
          </>
        ) : already ? (
          <>
            <p>
              You’re signed in as {actor.email ?? "an account"}, which already
              runs <strong>{partner.businessName}</strong>. Sign out and use
              another account to accept this invitation.
            </p>
            <Link className="button secondary" href="/account">
              Account
            </Link>
          </>
        ) : (
          <PartnerInviteAccept
            token={token}
            email={actor.email ?? "this account"}
            businessName={invite.businessName}
            replacesApplication={!!partner}
          />
        )}
      </div>
    </section>
  );
}
