import type { Metadata } from "next";
import { pages } from "@/bootstrap/container";
import AdminCatalogue from "@/components/admin-catalogue";
import AdminPackages from "@/components/admin-packages";
import AdminTransportSettings from "@/components/admin-transport-settings";
import Link from "next/link";
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
        <a href="#listings">Activities</a>
        <a href="#packages">Ready-made trips</a>
        <a href="#transport">Transport &amp; guides</a>
      </nav>
      <section id="listings" aria-labelledby="admin-listings-heading">
        <AdminCatalogue />
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
