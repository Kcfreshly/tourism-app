import type { Metadata } from "next";
import { pages } from "@/bootstrap/container";
import AdminCatalogue from "@/components/admin-catalogue";
import AdminPackages from "@/components/admin-packages";
import AdminPartners from "@/components/admin-partners";
import AdminServiceRequests from "@/components/admin-service-requests";
import PartnerBookings from "@/components/partner-bookings";
import AdminTransportSettings from "@/components/admin-transport-settings";
import Link from "next/link";
import { isSuperAdmin } from "@/modules/identity/domain/actor";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Staff workspace" };
export default async function Admin() {
  const actor = await pages.requireAdmin().catch(() => null);
  if (!actor)
    return (
      <section className="page">
        <div className="empty-state">
          <h1>Staff access required</h1>
          <p>
            This workspace is for operations staff. Customer and guest sessions
            can’t view or change catalogue data. Sign in with an account that
            has been granted the administrator role.
          </p>
          <Link className="button" href="/account">
            Sign in
          </Link>
        </div>
      </section>
    );
  return (
    <section className="admin-page">
      <header className="admin-header">
        <div>
          <p className="eyebrow">Fastlife operations</p>
          <h1>Staff workspace</h1>
          <p>
            Create and publish activities and ready-made trips, and set
            transport rates and guide availability for the Fastlife demo.
          </p>
        </div>
        <p className="admin-demo">Demo catalogue</p>
      </header>
      <nav className="admin-jump" aria-label="Staff workspace sections">
        <a href="#services">Drivers &amp; guides</a>
        <a href="#partner-bookings">Partner bookings</a>
        <a href="#listings">Activities</a>
        <a href="#partners">Partners</a>
        <a href="#packages">Ready-made trips</a>
        <a href="#transport">Transport &amp; guides</a>
      </nav>
      <section
        id="services"
        className="admin-section"
        aria-labelledby="admin-services-heading"
      >
        <div className="admin-section-heading">
          <h2 id="admin-services-heading">Drivers &amp; guides</h2>
          <p className="muted">
            Match a driver or guide to each paid trip at least 48 hours before
            it starts. The traveller sees who it is as soon as you match.
          </p>
        </div>
        <AdminServiceRequests />
      </section>
      <section
        id="partner-bookings"
        className="admin-section"
        aria-labelledby="admin-partner-bookings-heading"
      >
        <div className="admin-section-heading">
          <h2 id="admin-partner-bookings-heading">Partner bookings</h2>
          <p className="muted">
            Paid bookings partners must confirm. Unanswered ones are declined at
            their deadline and the traveller is due a full refund.
          </p>
        </div>
        <PartnerBookings staff />
      </section>
      <section id="listings" aria-labelledby="admin-listings-heading">
        <AdminCatalogue canDelete={isSuperAdmin(actor)} />
      </section>
      <section
        id="partners"
        className="admin-section"
        aria-labelledby="admin-partners-heading"
      >
        <div className="admin-section-heading">
          <h2 id="admin-partners-heading">Partners</h2>
          <p className="muted">
            Verify partner businesses, and approve or send back the activities
            and trips they submit. Approved ones go live straight away.
          </p>
        </div>
        <AdminPartners />
      </section>
      <section
        id="packages"
        className="admin-section"
        aria-labelledby="admin-packages-heading"
      >
        <AdminPackages />
      </section>
      <section
        id="transport"
        className="admin-section"
        aria-labelledby="transport-heading"
      >
        <div className="admin-section-heading">
          <h2 id="transport-heading">Transport &amp; guides</h2>
          <p className="muted">
            Set demo car rates and booking rules used in planner estimates.
          </p>
        </div>
        <AdminTransportSettings />
      </section>
    </section>
  );
}
