"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import Icon from "./icons";

type Toast = { id: number; message: string; href?: string; action?: string };

// Confirms Save, Add to cart and Add to trip with where the item went.
export function showToast(toast: Omit<Toast, "id">) {
  window.dispatchEvent(new CustomEvent("app-toast", { detail: toast }));
}

export default function Toaster() {
  const [toast, setToast] = useState<Toast | null>(null);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    function receive(event: Event) {
      const detail = (event as CustomEvent<Omit<Toast, "id">>).detail;
      setToast({ ...detail, id: Date.now() });
      clearTimeout(timer);
      timer = setTimeout(() => setToast(null), 6000);
    }
    window.addEventListener("app-toast", receive);
    return () => {
      window.removeEventListener("app-toast", receive);
      clearTimeout(timer);
    };
  }, []);
  return (
    <div className="toast-region" role="status" aria-live="polite">
      {toast && (
        <p className="toast" key={toast.id}>
          <Icon name="check" size={18} />
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
