import type { Metadata } from "next";
import Link from "next/link";
import Icon from "@/components/icons";
import PackageCard from "@/components/package-card";
import { packages } from "@/modules/catalogue/domain/packages";

export const metadata: Metadata = { title: "Ready-made trips" };

export default function Packages() {
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
      <div className="package-grid">
        {packages.map((p) => (
          <PackageCard key={p.slug} p={p} />
        ))}
      </div>
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
