"use client";
import { useEffect, useState } from "react";
import PartnerBookings from "./partner-bookings";
import PartnerDashboard from "./partner-dashboard";
import PartnerListings from "./partner-listings";

const tabs = [
  { id: "overview", label: "Overview" },
  { id: "bookings", label: "Bookings" },
  { id: "listings", label: "Listings & trips" },
] as const;
type Tab = (typeof tabs)[number]["id"];

// A verified partner's workspace: figures, bookings to answer, listings.
// Bookings waiting for an answer are flagged on every tab.
export default function PartnerPortal() {
  const [tab, setTab] = useState<Tab>("overview");
  const [waiting, setWaiting] = useState(0);
  useEffect(() => {
    let active = true;
    fetch("/api/v1/partner/bookings")
      .then((r) => (r.ok ? r.json() : { data: [] }))
      .then(
        (body: { data: { status: string }[] }) =>
          active &&
          setWaiting(
            body.data.filter((b) => b.status === "AWAITING_PARTNER").length,
          ),
      )
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);
  return (
    <>
      <nav className="admin-jump partner-tabs" aria-label="Partner portal">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            aria-pressed={tab === t.id}
            onClick={() => setTab(t.id)}
          >
            {t.label}
            {t.id === "bookings" && waiting > 0 && (
              <span className="partner-tab-count">
                {waiting}
                <span className="sr-only"> waiting</span>
              </span>
            )}
          </button>
        ))}
      </nav>
      {waiting > 0 && tab !== "bookings" && (
        <div className="notice notice-warning partner-waiting" role="status">
          <p>
            <strong>
              {waiting} {waiting === 1 ? "booking needs" : "bookings need"} your
              answer.
            </strong>{" "}
            Travellers have paid; confirm or decline before the deadline.
          </p>
          <button
            type="button"
            className="secondary"
            onClick={() => setTab("bookings")}
          >
            Answer now
          </button>
        </div>
      )}
      {tab === "overview" ? (
        <PartnerDashboard onOpenListings={() => setTab("listings")} />
      ) : tab === "bookings" ? (
        <PartnerBookings onCount={setWaiting} />
      ) : (
        <PartnerListings />
      )}
    </>
  );
}
