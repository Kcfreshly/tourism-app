"use client";
import { useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BucketNav } from "./bucket";
import Icon from "./icons";

const links = [
  { href: "/explore", label: "Explore", match: ["/explore", "/experiences"] },
  { href: "/plan/new?mode=chat", label: "Plan with Kemi", match: ["/plan"] },
  { href: "/trips", label: "My trips", match: ["/trips"] },
  { href: "/account", label: "Account", match: ["/account", "/admin"] },
];

export function BrandMark() {
  return (
    <span className="brand-lockup">
      <span className="brand-word" aria-hidden="true">
        ọ̀nà
      </span>
      <span className="brand-tag" aria-hidden="true">
        Lagos, your way
      </span>
    </span>
  );
}

export default function SiteChrome() {
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const [openPath, setOpenPath] = useState<string | null>(null);
  // The menu closes itself when navigation changes the path.
  const open = openPath === pathname;
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
          <Link className="brand" href="/" aria-label="Ọ̀nà home">
            <BrandMark />
          </Link>
          <nav
            id="site-nav"
            className="site-nav"
            aria-label="Main navigation"
            onKeyDown={(event) => {
              if (event.key === "Escape" && open) {
                setOpenPath(null);
                document.getElementById("site-menu-toggle")?.focus();
              }
            }}
          >
            {links.map((link) => {
              const current = link.match.some((m) => pathname.startsWith(m));
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={current ? "page" : undefined}
                  onClick={() => setOpenPath(null)}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
          <div className="header-actions">
            <BucketNav />
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
