"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Icon from "./icons";

type Toast = {
  id: number;
  message: string;
  href?: string;
  action?: string;
  // Something is still happening (a page or Paystack is loading).
  pending?: boolean;
  // The page that started a navigation; the toast hides once it changes.
  from?: string;
};

// Navigations faster than this show nothing; a toast would only flash.
const NAVIGATION_DELAY = 250;

// Confirms Save, Add to cart and Add to trip with where the item went, and
// shows "Opening …" while a slow navigation loads.
export function showToast(toast: Omit<Toast, "id">) {
  window.dispatchEvent(new CustomEvent("app-toast", { detail: toast }));
}

export function destinationLabel(pathname: string) {
  const [first = "", second, third] = pathname.split("/").filter(Boolean);
  if (first === "trips" && third)
    return (
      {
        plan: "your plan",
        checkout: "trip checkout",
        profile: "trip details",
        services: "trip services",
        today: "today’s plan",
      }[third] ?? "your trip"
    );
  if (first === "destinations" && second)
    return decodeURIComponent(second).replace(/^./, (c) => c.toUpperCase());
  if (first === "checkout" && second === "return") return "your payment";
  if (second)
    return (
      {
        experiences: "the experience",
        packages: "the trip",
        bookings: "your booking",
        plan: "the planner",
      }[first] ?? "the next page"
    );
  return (
    {
      "": "the home page",
      explore: "things to do",
      packages: "ready-made trips",
      trips: "your plans",
      cart: "your cart",
      checkout: "checkout",
      bookings: "your bookings",
      account: "your account",
      partner: "the partner portal",
      admin: "admin",
      "photo-credits": "photo credits",
    }[first] ?? "the next page"
  );
}

export default function Toaster() {
  const pathname = usePathname();
  const [toast, setToast] = useState<Toast | null>(null);
  const navigationTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    function show(detail: Omit<Toast, "id">) {
      clearTimeout(navigationTimer.current);
      setToast({ ...detail, id: Date.now() });
      clearTimeout(timer);
      timer = setTimeout(() => setToast(null), detail.pending ? 15000 : 6000);
    }
    function receive(event: Event) {
      show((event as CustomEvent<Omit<Toast, "id">>).detail);
    }
    function navigate(event: Event) {
      const from = window.location.pathname;
      const to = new URL((event as CustomEvent<string>).detail, location.href);
      clearTimeout(navigationTimer.current);
      setToast((t) => (t?.from ? null : t));
      // Filter and query changes keep the page; they have their own feedback.
      if (to.pathname === from) return;
      navigationTimer.current = setTimeout(
        () =>
          show({
            message: `Opening ${destinationLabel(to.pathname)}…`,
            pending: true,
            from,
          }),
        NAVIGATION_DELAY,
      );
    }
    // Back from Paystack can restore this page from the browser's cache.
    function restored(event: PageTransitionEvent) {
      if (event.persisted) setToast((t) => (t?.pending ? null : t));
    }
    window.addEventListener("app-toast", receive);
    window.addEventListener("app-navigation", navigate);
    window.addEventListener("pageshow", restored);
    return () => {
      window.removeEventListener("app-toast", receive);
      window.removeEventListener("app-navigation", navigate);
      window.removeEventListener("pageshow", restored);
      clearTimeout(timer);
      clearTimeout(navigationTimer.current);
    };
  }, []);
  const visible = toast && (!toast.from || toast.from === pathname);
  return (
    <div className="toast-region" role="status" aria-live="polite">
      {visible && (
        <p className="toast" key={toast.id} aria-busy={toast.pending}>
          {toast.pending ? (
            <span className="toast-spinner" aria-hidden="true" />
          ) : (
            <Icon name="check" size={18} />
          )}
          <span>{toast.message}</span>
          {toast.href && (
            <Link href={toast.href} onClick={() => setToast(null)}>
              {toast.action ?? "View"}
            </Link>
          )}
          <button
            type="button"
            className="icon-button"
            onClick={() => setToast(null)}
          >
            <Icon name="close" size={16} />
            <span className="sr-only">Dismiss</span>
          </button>
        </p>
      )}
    </div>
  );
}
