"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BucketNav } from "./bucket";
import { CartNav } from "./cart";
import Icon from "./icons";
import { authClient } from "./auth-client";
import { usePartnerMembership } from "./partner-portal-link";
import { useBucketSync } from "@/hooks/use-bucket-sync";
import { useCartSync } from "@/hooks/use-cart-sync";

// Two top-level choices: find something to do, or work with a trip. The trip
// paths sit together in one menu; anyone can take any of them.
const explore = {
  href: "/explore",
  label: "Things to do",
  match: ["/explore", "/experiences", "/destinations"],
};
const tripLinks = [
  {
    href: "/packages",
    label: "Ready-made trips",
    hint: "Multi-day trips run by local operators",
    match: ["/packages"],
  },
  {
    href: "/plan/new",
    label: "Plan your trip",
    hint: "Build your own day-by-day plan",
    match: ["/plan"],
  },
  {
    href: "/trips",
    label: "My plans",
    hint: "Pick up a plan you started",
    match: ["/trips"],
  },
  {
    href: "/bookings",
    label: "My bookings",
    hint: "Activities and trips you’ve paid for",
    match: ["/bookings"],
  },
];

export function BrandMark() {
  return (
    <span className="brand-lockup">
      <span className="brand-word" aria-hidden="true">
        fastlife
      </span>
      <span className="brand-tag" aria-hidden="true">
        Things to do in Nigeria
      </span>
    </span>
  );
}

export default function SiteChrome() {
  // The header is on every page, so it keeps a signed-in bucket and cart saved.
  useBucketSync();
  useCartSync();
  const ref = useRef<HTMLDivElement>(null);
  const group = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const { data: session } = authClient.useSession();
  // Partner accounts get a way back to their portal.
  const partner = usePartnerMembership();
  // Both menus close themselves when navigation changes the path.
  const [openPath, setOpenPath] = useState<string | null>(null);
  const [tripsPath, setTripsPath] = useState<string | null>(null);
  const open = openPath === pathname;
  const tripsOpen = tripsPath === pathname;
  const at = (match: string[]) => match.some((m) => pathname.startsWith(m));
  const inTrips = tripLinks.some((l) => at(l.match));
  useLayoutEffect(() => {
    function measure() {
      if (ref.current)
        document.documentElement.style.setProperty(
          "--site-header-height",
          `${ref.current.getBoundingClientRect().height}px`,
        );
    }
    measure();
    const observer = new ResizeObserver(measure);
    if (ref.current) observer.observe(ref.current);
    return () => {
      observer.disconnect();
      document.documentElement.style.removeProperty("--site-header-height");
    };
  }, []);
  useEffect(() => {
    if (!tripsOpen) return;
    function outside(event: PointerEvent) {
      if (!group.current?.contains(event.target as Node)) setTripsPath(null);
    }
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [tripsOpen]);
  function close() {
    setOpenPath(null);
    setTripsPath(null);
  }
  return (
    <div ref={ref} className="site-chrome" data-menu-open={open}>
      <p className="preview-notice">
        <strong>Preview</strong>
        <span className="notice-long">
          Sample experiences and prices. Nothing here is booked or charged.
        </span>
        <span className="notice-short">
          Sample prices · nothing is booked or charged
        </span>
      </p>
      <header className="site-header">
        <div className="site-header-inner">
          <Link className="brand" href="/" aria-label="Fastlife home">
            <BrandMark />
          </Link>
          <nav
            id="site-nav"
            className="site-nav"
            aria-label="Main navigation"
            onKeyDown={(event) => {
              if (event.key !== "Escape") return;
              if (tripsOpen) {
                setTripsPath(null);
                document.getElementById("trips-menu-toggle")?.focus();
              } else if (open) {
                setOpenPath(null);
                document.getElementById("site-menu-toggle")?.focus();
              }
            }}
          >
            <Link
              href={explore.href}
              aria-current={at(explore.match) ? "page" : undefined}
              onClick={close}
            >
              {explore.label}
            </Link>
            <div className="nav-group" ref={group} data-open={tripsOpen}>
              <button
                id="trips-menu-toggle"
                type="button"
                className="nav-group-toggle"
                aria-expanded={tripsOpen}
                aria-controls="trips-menu"
                data-current={inTrips || undefined}
                onClick={() => setTripsPath(tripsOpen ? null : pathname)}
              >
                Trips
                <Icon name="chevronDown" size={16} />
              </button>
              <p className="nav-group-label" aria-hidden="true">
                Trips
              </p>
              <ul id="trips-menu" className="nav-menu">
                {tripLinks.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      aria-current={at(link.match) ? "page" : undefined}
                      onClick={close}
                    >
                      <strong>{link.label}</strong>
                      <small>{link.hint}</small>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            {partner && (
              <Link
                className="nav-partner"
                href="/partner"
                aria-current={at(["/partner"]) ? "page" : undefined}
                onClick={close}
              >
                {partner.status === "VERIFIED"
                  ? "Partner portal"
                  : "Partner application"}
              </Link>
            )}
            {/* Header controls fold into the menu on narrow screens. */}
            <Link
              className="nav-mobile-only"
              href="/account"
              aria-current={at(["/account", "/admin"]) ? "page" : undefined}
              onClick={close}
            >
              <Icon name="user" size={18} />
              {session ? "Account" : "Sign in"}
            </Link>
            <Link
              className="nav-mobile-only"
              href="/destinations/lagos"
              onClick={close}
            >
              <Icon name="pin" size={18} />
              Destination: Lagos
            </Link>
          </nav>
          <div className="header-actions">
            <Link
              className="destination-chip"
              href="/destinations/lagos"
              aria-label="Destination: Lagos"
            >
              <Icon name="pin" size={16} />
              Lagos
            </Link>
            <BucketNav />
            <CartNav />
            <Link
              className="account-link icon-button"
              href="/account"
              aria-current={at(["/account", "/admin"]) ? "page" : undefined}
              title={session ? "Account" : "Sign in"}
            >
              <Icon name="user" size={20} />
              <span className="sr-only">{session ? "Account" : "Sign in"}</span>
            </Link>
            <button
              id="site-menu-toggle"
              type="button"
              className="menu-toggle icon-button"
              aria-expanded={open}
              aria-controls="site-nav"
              onClick={() => setOpenPath(open ? null : pathname)}
            >
              <Icon name={open ? "close" : "menu"} size={20} />
              <span className="sr-only">Menu</span>
            </button>
          </div>
        </div>
      </header>
    </div>
  );
}
