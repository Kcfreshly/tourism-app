import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Icon from "@/components/icons";
import PackageBooking from "@/components/package-booking";
import { PackageCover } from "@/components/package-card";
import { lagosToday } from "@/modules/catalogue/domain/events";
import {
  fastlifeSupport,
  inclusionLabels,
  inclusionStatusLabels,
  packageBySlug,
  packageLength,
  packageRoute,
  seatLabels,
  type InclusionStatus,
} from "@/modules/catalogue/domain/packages";
import { shortDay } from "@/modules/catalogue/domain/schedule";

const statusIcon: Record<InclusionStatus, "check" | "close" | "info"> = {
  INCLUDED: "check",
  PARTIAL: "check",
  ON_REQUEST: "info",
  NOT_INCLUDED: "close",
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const p = packageBySlug((await params).slug);
  return { title: p?.title ?? "Ready-made trip" };
}

export default async function PackageDetail({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ edit?: string }>;
}) {
  const p = packageBySlug((await params).slug);
  if (!p) notFound();
  const { edit } = await searchParams;
  return (
    <section className="detail-page package-detail">
      <Link className="text-link back-link" href="/packages">
        <Icon name="arrowLeft" size={16} /> Ready-made trips
      </Link>
      <div className="detail">
        <div className="detail-content">
          <PackageCover p={p} />
          <div className="detail-text">
            <p className="eyebrow">
              {packageLength(p)} · Starts in {p.startCity}
            </p>
            <h1>{p.title}</h1>
            <p className="detail-operator">
              Run by <strong>{p.operator}</strong>
            </p>
            <p className="experience-introduction">{p.summary}</p>
            <p className="muted">{p.operatorNote}</p>

            <section className="info-section">
              <h2>Route</h2>
              <p className="package-route">
                <Icon name="compass" size={16} />
                {packageRoute(p)}
              </p>
              <ol className="route-days">
                {p.route.map((r) => (
                  <li key={r.day}>
                    <span className="route-day">Day {r.day}</span>
                    <div>
                      <strong>{r.place}</strong>
                      <p>{r.plan}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </section>

            <section className="info-section">
              <h2>What’s included</h2>
              <dl className="inclusion-matrix">
                {p.inclusions.map((i) => {
                  const status = i.status as InclusionStatus;
                  return (
                    <div key={i.item} data-status={status}>
                      <dt>{inclusionLabels[i.item]}</dt>
                      <dd>
                        <span className="inclusion-status">
                          <Icon name={statusIcon[status]} size={14} />
                          {inclusionStatusLabels[status]}
                        </span>
                        <span>{i.detail}</span>
                      </dd>
                    </div>
                  );
                })}
              </dl>
            </section>

            <section className="info-section">
              <h2>Departures</h2>
              <ul className="plain-list">
                {p.departures.map((d) => (
                  <li key={d.date}>
                    {shortDay(d.date)} · {seatLabels[d.seats]}
                  </li>
                ))}
              </ul>
            </section>

            <section className="info-section fastlife-support">
              <h2>Fastlife support for this trip</h2>
              <ul className="support-list">
                {fastlifeSupport.map((s) => (
                  <li key={s.title}>
                    <strong>{s.title}</strong>
                    <span>{s.text}</span>
                  </li>
                ))}
              </ul>
              <p className="muted">Sample commitments, pending agreement.</p>
            </section>

            <section className="info-section">
              <h2>Booking terms</h2>
              <ul className="plain-list">
                {p.bookingTerms.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </section>

            <section className="compare-custom card">
              <div>
                <h2>Prefer to build your own?</h2>
                <p>
                  Start a custom plan with the same dates and length. Kemi helps
                  you choose each day, and you can add drivers and guides.
                </p>
              </div>
              <Link
                className="button secondary"
                href={`/plan/new?mode=chat&from=${p.slug}`}
              >
                Build my own version
                <Icon name="arrowRight" size={16} />
              </Link>
            </section>
          </div>
        </div>
        <PackageBooking p={p} today={lagosToday()} editId={edit} />
      </div>
    </section>
  );
}
