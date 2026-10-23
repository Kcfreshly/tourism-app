import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";
import "./planner.css";
import "./overlays.css";
import { ExperienceOverlayProvider } from "@/components/experience-overlay";
import SiteChrome, { BrandMark } from "@/components/site-chrome";
export const metadata: Metadata = {
  title: { default: "Ọ̀nà · Lagos, your way", template: "%s · Ọ̀nà" },
  description:
    "Plan a Lagos stay around what you love, with Kemi or on your own. Preview with sample experiences; no real bookings.",
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
                  Experiences, transport and local hosts arranged into one clear
                  plan.
                </p>
              </div>
              <nav aria-label="Footer">
                <Link href="/explore">Explore</Link>
                <Link href="/plan/new?mode=chat">Plan with Kemi</Link>
                <Link href="/trips">My trips</Link>
                <Link href="/photo-credits">Photo credits</Link>
              </nav>
              <p className="fine-print">
                Preview build. Experiences, suppliers and prices are samples.
                Times are Lagos time (WAT); prices in Nigerian naira.
              </p>
            </div>
          </footer>
        </ExperienceOverlayProvider>
      </body>
    </html>
  );
}
