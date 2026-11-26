import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";
import "./planner.css";
import "./overlays.css";
import "./booking.css";
import { ExperienceOverlayProvider } from "@/components/experience-overlay";
import SiteChrome, { BrandMark } from "@/components/site-chrome";
import Toaster from "@/components/toast";
export const metadata: Metadata = {
  title: {
    default: "Fastlife · Things to do in Nigeria",
    template: "%s · Fastlife",
  },
  description:
    "Discover and book things to do across Nigeria, take a ready-made trip, or plan your own with Kemi. Preview with sample experiences; no real bookings.",
};
export const viewport: Viewport = { themeColor: "#26337a" };
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ExperienceOverlayProvider>
          <a className="skip" href="#main">
            Skip to content
          </a>
          <SiteChrome />
          <main id="main" tabIndex={-1}>
            {children}
          </main>
          <footer className="site-footer">
            <div className="site-footer-inner">
              <div>
                <BrandMark />
                <p>
                  Things to do across Nigeria: book an outing, take a ready-made
                  trip, or plan your own.
                </p>
              </div>
              <nav aria-label="Footer" className="footer-columns">
                <div>
                  <h2>Discover</h2>
                  <Link href="/explore">Things to do</Link>
                  <Link href="/packages">Ready-made trips</Link>
                  <Link href="/destinations/lagos">Lagos</Link>
                </div>
                <div>
                  <h2>Plan</h2>
                  <Link href="/plan/new?mode=chat">Plan with Kemi</Link>
                  <Link href="/trips">My plans</Link>
                  <Link href="/cart">Cart</Link>
                </div>
                <div>
                  <h2>For partners</h2>
                  <Link href="/partner">Partner with us</Link>
                  <Link href="/account?next=/partner">Partner sign in</Link>
                </div>
                <div>
                  <h2>Preview</h2>
                  <Link href="/photo-credits">Photo credits</Link>
                </div>
              </nav>
              <p className="fine-print">
                Preview build. Experiences, suppliers and prices are samples.
                Times are Lagos time (WAT); prices in Nigerian naira.
              </p>
            </div>
          </footer>
          <Toaster />
        </ExperienceOverlayProvider>
      </body>
    </html>
  );
}
