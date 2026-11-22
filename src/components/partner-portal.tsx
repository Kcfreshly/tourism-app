"use client";
import { useState } from "react";
import PartnerDashboard from "./partner-dashboard";
import PartnerListings from "./partner-listings";

const tabs = [
  { id: "overview", label: "Overview" },
  { id: "listings", label: "Listings & trips" },
] as const;

// A verified partner's workspace: figures first, then their listings.
export default function PartnerPortal() {
  const [tab, setTab] = useState<(typeof tabs)[number]["id"]>("overview");
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
          </button>
        ))}
      </nav>
      {tab === "overview" ? (
        <PartnerDashboard onOpenListings={() => setTab("listings")} />
      ) : (
        <PartnerListings />
      )}
    </>
  );
}
