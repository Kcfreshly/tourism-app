import type { Metadata } from "next";
import { pages } from "@/bootstrap/container";
import PartnerApply from "@/components/partner-apply";
import PartnerPortal from "@/components/partner-portal";
import PartnerWelcome from "@/components/partner-welcome";
import { partnerStatusLabels } from "@/modules/partners/domain/partner";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Partner portal" };

// Partners sign in with an ordinary account. Signed out, this page explains
// partnering and links to apply or sign in. Until staff verify the business
// it shows the application; afterwards the dashboard and listings.
export default async function Partner() {
  const actor = await pages.currentActor();
  if (!actor) return <PartnerWelcome />;
  const partner = actor ? await pages.partnerFor(actor.id) : null;
  const verified = partner?.status === "VERIFIED";
  return (
    <section className="admin-page partner-page">
      <header className="admin-header">
        <div>
          <p className="eyebrow">Fastlife partners</p>
          <h1>{verified ? partner.businessName : "Partner portal"}</h1>
          <p>
            {verified
              ? "Plan activities and ready-made trips, send them to Fastlife for approval, and see how travellers respond."
              : "Run activities or multi-day trips? List them on Fastlife. Tell us about your business and we'll verify it."}
          </p>
        </div>
        {partner && (
          <p className="admin-demo">{partnerStatusLabels[partner.status]}</p>
        )}
      </header>
      {verified ? (
        <PartnerPortal />
      ) : (
        <PartnerApply
          partner={
            partner && {
              status: partner.status,
              businessName: partner.businessName,
              contactEmail: partner.contactEmail,
              phone: partner.phone,
              offering: partner.offering,
              decisionReason: partner.decisionReason,
              isOwner: partner.memberRole === "OWNER",
            }
          }
        />
      )}
    </section>
  );
}
