"use client";
import { useLayoutEffect, useRef, type ReactNode } from "react";
export default function SiteChrome({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
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
    <div ref={ref} className="site-chrome">
      {children}
    </div>
  );
}
