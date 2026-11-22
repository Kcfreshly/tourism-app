import type { Metadata } from "next";
import Link from "next/link";
import Icon from "@/components/icons";
import PackageCard from "@/components/package-card";
import { pages } from "@/bootstrap/container";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Ready-made trips" };

export default async function Packages() {
  const packages = await pages.listPublishedPackages().catch(() => []);
  return (
    <section className="page packages-page">
      <header className="page-intro">
        <p className="eyebrow">Ready-made trips</p>
        <h1>Multi-day trips, run by local operators</h1>
        <p className="lede">
          Each trip shows its route, dates, who runs it and what’s included.
          Prefer to shape your own days? Plan with Kemi instead.
        </p>
      </header>
      {packages.length ? (
        <div className="package-grid">
          {packages.map((p) => (
            <PackageCard key={p.slug} p={p} />
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <h2>No ready-made trips right now</h2>
          <p>New trips from our partner operators are added regularly.</p>
        </div>
      )}
      <aside className="kemi-card">
        <span className="kemi-avatar" aria-hidden="true">
          K
        </span>
        <div>
          <h2>Not quite right?</h2>
          <p>
            Build your own trip with Kemi: your dates, your pace, and only the
            things you want.
          </p>
        </div>
        <Link className="button" href="/plan/new?mode=chat">
          Plan with Kemi
          <Icon name="arrowRight" size={16} />
        </Link>
      </aside>
      <p className="sample-note">
        <Icon name="info" size={16} />
        Sample trips. Operators, departures and prices are fictional.
      </p>
    </section>
  );
}
