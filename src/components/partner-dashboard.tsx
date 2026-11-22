"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { displayName } from "@/modules/catalogue/domain/experience-content";
import {
  productTypeLabels,
  trend,
  type ProductType,
} from "@/modules/partners/domain/partner";

type Dashboard = {
  period: { from: string; to: string; days: number };
  totals: {
    views: number;
    viewsBefore: number;
    visitors: number;
    visitorsBefore: number;
    saves: number;
    tripPlans: number;
    live: number;
    inReview: number;
    changesRequested: number;
    drafts: number;
  };
  daily: { day: string; views: number }[];
  listings: {
    productType: ProductType;
    productId: string;
    name: string;
    status: string;
    slug: string;
    views: number;
    visitors: number;
    saves: number | null;
    tripPlans: number | null;
  }[];
  sales: null;
};

const shortDate = (day: string) =>
  new Date(day + "T12:00:00Z").toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });

function Change({ now, before }: { now: number; before: number }) {
  const change = trend(now, before);
  if (change === null) return <small className="muted">No earlier data</small>;
  return (
    <small className={change >= 0 ? "partner-up" : "partner-down"}>
      {change >= 0 ? "▲" : "▼"} {Math.abs(change)}% on the previous period
    </small>
  );
}

const liveHref = (l: Dashboard["listings"][number]) =>
  l.productType === "PACKAGE"
    ? `/packages/${l.slug}`
    : `/experiences/${l.slug}`;

// Basic figures for a partner's own listings over the last 30 days. Views and
// visitors come from listing pages and quick views; bookings and sales start
// when checkout goes live.
export default function PartnerDashboard({
  onOpenListings,
}: {
  onOpenListings: () => void;
}) {
  const [data, setData] = useState<Dashboard | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    fetch("/api/v1/partner/dashboard")
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok) throw Error(body.error.message);
        if (active) setData(body.data);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, []);

  if (error)
    return (
      <p className="field-error" role="alert">
        {error}
      </p>
    );
  if (!data) return <p className="muted">Loading your figures…</p>;
  const { totals } = data;
  const peak = Math.max(1, ...data.daily.map((d) => d.views));

  return (
    <div className="partner-dashboard">
      <p className="muted">
        Last {data.period.days} days, {shortDate(data.period.from)} to{" "}
        {shortDate(data.period.to)}. Views by Fastlife staff and partners are
        not counted.
      </p>
      <ul className="partner-stats" aria-label="Key figures">
        <li className="card">
          <span>Views</span>
          <strong>{totals.views}</strong>
          <Change now={totals.views} before={totals.viewsBefore} />
        </li>
        <li className="card">
          <span>Visitors</span>
          <strong>{totals.visitors}</strong>
          <Change now={totals.visitors} before={totals.visitorsBefore} />
        </li>
        <li className="card">
          <span>Saved by travellers</span>
          <strong>{totals.saves}</strong>
          <small className="muted">Activities in travellers’ buckets</small>
        </li>
        <li className="card">
          <span>In trip plans</span>
          <strong>{totals.tripPlans}</strong>
          <small className="muted">Plans that include your activities</small>
        </li>
        <li className="card partner-stat-pending">
          <span>Bookings</span>
          <strong>—</strong>
          <small className="muted">Starts when online payment goes live</small>
        </li>
        <li className="card partner-stat-pending">
          <span>Sales</span>
          <strong>—</strong>
          <small className="muted">Starts when online payment goes live</small>
        </li>
      </ul>

      <section className="card partner-panel" aria-labelledby="views-heading">
        <h2 id="views-heading">Views per day</h2>
        <ol
          className="partner-chart"
          aria-label={`Views per day, highest ${peak}`}
        >
          {data.daily.map((d) => (
            <li key={d.day} title={`${shortDate(d.day)}: ${d.views} views`}>
              <span
                style={{ height: `${(d.views / peak) * 100}%` }}
                data-empty={d.views === 0 || undefined}
              />
              <span className="sr-only">
                {shortDate(d.day)}: {d.views}
              </span>
            </li>
          ))}
        </ol>
        <p className="partner-chart-axis muted" aria-hidden="true">
          <span>{shortDate(data.period.from)}</span>
          <span>Today</span>
        </p>
      </section>

      <section
        className="card partner-panel"
        aria-labelledby="partner-listings-heading"
      >
        <div className="admin-editor-head">
          <h2 id="partner-listings-heading">Your listings</h2>
          <p className="muted">
            {totals.live} live · {totals.inReview} in review ·{" "}
            {totals.changesRequested} with changes requested · {totals.drafts}{" "}
            drafts
          </p>
        </div>
        {data.listings.length ? (
          <div className="partner-table-wrap">
            <table className="partner-table">
              <thead>
                <tr>
                  <th scope="col">Listing</th>
                  <th scope="col">Views</th>
                  <th scope="col">Visitors</th>
                  <th scope="col">Saved</th>
                  <th scope="col">In plans</th>
                </tr>
              </thead>
              <tbody>
                {data.listings.map((l) => (
                  <tr key={l.productId}>
                    <th scope="row">
                      {l.status === "DEMO_PUBLISHED" ? (
                        <Link href={liveHref(l)} target="_blank">
                          {displayName(l.name)}
                        </Link>
                      ) : (
                        displayName(l.name)
                      )}
                      <small className="muted">
                        {productTypeLabels[l.productType]}
                        {l.status === "DEMO_PUBLISHED" ? "" : " · not on sale"}
                      </small>
                    </th>
                    <td>{l.views}</td>
                    <td>{l.visitors}</td>
                    <td>{l.saves ?? "—"}</td>
                    <td>{l.tripPlans ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="admin-editor-empty">
            <p>
              Nothing live yet. Figures appear here once Fastlife approves your
              first listing.
            </p>
            <button type="button" onClick={onOpenListings}>
              Add an activity or trip
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
