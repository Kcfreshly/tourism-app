"use client";

import { useEffect, useState } from "react";

const queues = [
  {
    endpoint: "service-requests",
    href: "#services",
    label: "Drivers & guides",
    action: "Requests to match",
    pending: "REQUESTED",
    statuses: {
      REQUESTED: "Requested",
      MATCHED: "Matched",
      UNMATCHED: "Refund due",
    },
  },
  {
    endpoint: "partner-bookings",
    href: "#partner-bookings",
    label: "Partner bookings",
    action: "Awaiting partner response",
    pending: "AWAITING_PARTNER",
    statuses: {
      AWAITING_PARTNER: "Awaiting response",
      CONFIRMED: "Confirmed",
      DECLINED: "Declined",
      COMPLETED: "Completed",
      CANCELLED: "Cancelled",
      NO_SHOW: "No-show",
    },
  },
  {
    endpoint: "partners",
    href: "#partners",
    label: "Partner businesses",
    action: "Applications to review",
    pending: "PENDING",
    statuses: {
      PENDING: "Pending",
      VERIFIED: "Verified",
      DECLINED: "Declined",
      SUSPENDED: "Suspended",
    },
  },
  {
    endpoint: "submissions",
    href: "#partners",
    label: "Listing submissions",
    action: "Submissions to review",
    pending: "PENDING",
    statuses: null,
  },
] satisfies {
  endpoint: string;
  href: string;
  label: string;
  action: string;
  pending: string;
  statuses: Record<string, string> | null;
}[];

export default function AdminOverview() {
  const [counts, setCounts] = useState<
    (Record<string, number> | null)[] | null
  >(null);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    Promise.allSettled(
      queues.map(async ({ endpoint }) => {
        const response = await fetch(`/api/v1/admin/${endpoint}`, {
          signal: controller.signal,
          cache: "no-store",
        });
        if (!response.ok) throw new Error("Could not load queue");
        const { data } = (await response.json()) as {
          data: { status: string }[];
        };
        return data.reduce<Record<string, number>>((result, { status }) => {
          result[status] = (result[status] ?? 0) + 1;
          return result;
        }, {});
      }),
    ).then((results) => {
      if (!controller.signal.aborted) {
        setCounts(
          results.map((result) =>
            result.status === "fulfilled" ? result.value : null,
          ),
        );
      }
    });
    return () => controller.abort();
  }, [revision]);

  return (
    <>
      <section
        id="dashboard"
        className="workspace-section"
        aria-labelledby="staff-dashboard"
      >
        <div className="workspace-heading">
          <div>
            <h2 id="staff-dashboard">Dashboard</h2>
            <p className="muted">
              See which queues need attention and jump straight to them.
            </p>
          </div>
          <button
            type="button"
            className="secondary"
            disabled={!counts}
            onClick={() => {
              setCounts(null);
              setRevision((value) => value + 1);
            }}
          >
            Refresh figures
          </button>
        </div>
        <ul
          className="partner-stats"
          aria-label="Operational queues"
          aria-busy={!counts}
        >
          {queues.map(({ endpoint, href, label, action, pending }, index) => {
            const queue = counts?.[index];
            return (
              <li className="card workspace-stat" key={endpoint}>
                <span>{action}</span>
                <strong>
                  {queue ? (queue[pending] ?? 0).toLocaleString() : "—"}
                </strong>
                <a href={href}>
                  {label} <span aria-hidden="true">→</span>
                </a>
              </li>
            );
          })}
        </ul>
        <div role="status">
          {!counts && <p className="muted">Loading queue figures…</p>}
          {counts?.some((queue) => queue === null) && (
            <p className="muted">
              Some queues are unavailable. Refresh figures to try again.
            </p>
          )}
        </div>
      </section>
      <section
        id="analytics"
        className="workspace-section"
        aria-labelledby="staff-analytics"
      >
        <div className="workspace-heading">
          <div>
            <h2 id="staff-analytics">Analytics</h2>
            <p className="muted">
              Status breakdown for records in the staff queues.
            </p>
          </div>
        </div>
        <div className="workspace-analytics-grid" aria-busy={!counts}>
          {queues.map(({ endpoint, label, statuses }, index) => {
            if (!statuses) return null;
            const queue = counts?.[index];
            const total = queue
              ? Object.values(queue).reduce((sum, value) => sum + value, 0)
              : 0;
            const known = queue
              ? Object.entries(statuses).map(
                  ([status, name]) => [name, queue[status] ?? 0] as const,
                )
              : [];
            const other =
              total - known.reduce((sum, [, value]) => sum + value, 0);
            const rows = other ? [...known, ["Other", other] as const] : known;
            return (
              <section className="card partner-panel" key={endpoint}>
                <h3>{label}</h3>
                {queue ? (
                  <>
                    <p className="muted">{total.toLocaleString()} total</p>
                    <dl className="workspace-breakdown">
                      {rows.map(([name, value]) => (
                        <div key={name}>
                          <dt>{name}</dt>
                          <dd>{value.toLocaleString()}</dd>
                          <span aria-hidden="true">
                            <i
                              style={{
                                width: `${total ? (value / total) * 100 : 0}%`,
                              }}
                            />
                          </span>
                        </div>
                      ))}
                    </dl>
                  </>
                ) : (
                  <p className="muted">
                    {counts ? "Figures unavailable" : "Loading…"}
                  </p>
                )}
              </section>
            );
          })}
        </div>
      </section>
    </>
  );
}
