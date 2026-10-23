import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import "./planner.css";
import "./overlays.css";
import { ExperienceOverlayProvider } from "@/components/experience-overlay";
import SiteChrome from "@/components/site-chrome";
import { BucketNav } from "@/components/bucket";
export const metadata: Metadata = {
  title: "Lagos, Your Way — local demo",
  description: "A fictional tourism planning demo. No real bookings.",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ExperienceOverlayProvider>
          <a className="skip" href="#main">
            Skip to content
          </a>
          <SiteChrome>
            <div className="demo">
              DEMO EXPERIENCE · Sample prices and availability. No real booking
              will be made.
            </div>
            <header>
              <Link className="brand" href="/">
                <span aria-hidden="true">✳</span> Lagos, Your Way
                <small>WORKING IDENTITY</small>
              </Link>
              <nav aria-label="Main navigation">
                <Link href="/explore">Explore</Link>
                <BucketNav />
                <Link href="/plan/new">Plan a trip</Link>
                <Link href="/trips">My trips</Link>
                <Link href="/account">Account</Link>
              </nav>
            </header>
          </SiteChrome>
          <main id="main" tabIndex={-1}>
            {children}
          </main>
          <footer>
            <span>Lagos first. At your pace.</span>
            <span>
              Fictional supply / Africa/Lagos time / NGN /{" "}
              <Link href="/photo-credits">Photo credits</Link>
            </span>
          </footer>
        </ExperienceOverlayProvider>
      </body>
    </html>
  );
}
