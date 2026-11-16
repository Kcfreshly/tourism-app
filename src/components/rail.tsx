"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import Icon from "./icons";

// A row of cards moved with side arrows instead of a scrollbar. Swipe and
// trackpad scrolling still work; "See all" in the section head lists
// everything.
export default function Rail({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  const track = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: true, end: true });
  useEffect(() => {
    const el = track.current;
    if (!el) return;
    function measure() {
      if (!el) return;
      setEdges({
        start: el.scrollLeft <= 4,
        end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 4,
      });
    }
    measure();
    el.addEventListener("scroll", measure, { passive: true });
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => {
      el.removeEventListener("scroll", measure);
      observer.disconnect();
    };
  }, []);
  function move(direction: 1 | -1) {
    const el = track.current;
    if (!el) return;
    // A page of whole cards at a time.
    el.scrollBy({ left: direction * el.clientWidth * 0.9, behavior: "smooth" });
  }
  return (
    <div className="rail-frame" role="region" aria-label={label}>
      <div className="rail" ref={track}>
        {children}
      </div>
      {!edges.start && (
        <button
          type="button"
          className="rail-arrow rail-arrow--prev"
          onClick={() => move(-1)}
        >
          <Icon name="chevronLeft" size={22} />
          <span className="sr-only">Previous {label}</span>
        </button>
      )}
      {!edges.end && (
        <button
          type="button"
          className="rail-arrow rail-arrow--next"
          onClick={() => move(1)}
        >
          <Icon name="chevronRight" size={22} />
          <span className="sr-only">More {label}</span>
        </button>
      )}
    </div>
  );
}
