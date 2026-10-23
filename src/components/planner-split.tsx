"use client";
import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type CSSProperties,
} from "react";

export default function PlannerSplit({
  library,
  schedule,
  resetKey,
}: {
  library: ReactNode;
  schedule: ReactNode;
  resetKey: number;
}) {
  const root = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(1200);
  const [ratio, setRatio] = useState(35);
  const [tab, setTab] = useState("schedule");
  const min = Math.min(45, (280 / width) * 100);
  const max = Math.max(min, Math.min(65, ((width - 352) / width) * 100));
  const current = Math.max(min, Math.min(max, ratio));
  useEffect(() => {
    const observer = new ResizeObserver((entries) =>
      setWidth(entries[0].contentRect.width),
    );
    if (root.current) observer.observe(root.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    Promise.resolve().then(() => {
      const stored = Number(localStorage.getItem("tourism.planner.split"));
      setRatio(resetKey ? 35 : stored >= 20 && stored <= 65 ? stored : 35);
      if (resetKey) localStorage.removeItem("tourism.planner.split");
    });
  }, [resetKey]);
  function adjust(value: number) {
    const next = Math.max(min, Math.min(max, value));
    setRatio(next);
    localStorage.setItem("tourism.planner.split", String(next));
  }
  return (
    <>
      <div className="workspace-tabs" aria-label="Planner view">
        <button
          aria-pressed={tab === "schedule"}
          onClick={() => setTab("schedule")}
        >
          My schedule
        </button>
        <button
          aria-pressed={tab === "library"}
          onClick={() => setTab("library")}
        >
          Activities
        </button>
      </div>
      <div
        ref={root}
        className="planner-workspace"
        data-mobile-view={tab}
        style={{ "--library-width": `${current}%` } as CSSProperties}
      >
        <aside
          id="planner-library-panel"
          className="planner-panel planner-library"
        >
          {library}
        </aside>
        <div
          className="workspace-divider"
          role="separator"
          aria-label="Resize activity library"
          aria-orientation="vertical"
          aria-controls="planner-library-panel planner-schedule-panel"
          aria-valuemin={Math.round(min)}
          aria-valuemax={Math.round(max)}
          aria-valuenow={Math.round(current)}
          aria-valuetext={`${Math.round(current)} percent for activities`}
          tabIndex={0}
          onKeyDown={(event) => {
            const next =
              event.key === "ArrowLeft"
                ? current - 2
                : event.key === "ArrowRight"
                  ? current + 2
                  : event.key === "Home"
                    ? min
                    : event.key === "End"
                      ? max
                      : undefined;
            if (next !== undefined) {
              event.preventDefault();
              adjust(next);
            }
          }}
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => {
            if (
              event.currentTarget.hasPointerCapture(event.pointerId) &&
              root.current
            ) {
              const box = root.current.getBoundingClientRect();
              adjust(((event.clientX - box.left) / box.width) * 100);
            }
          }}
          onPointerUp={(event) =>
            event.currentTarget.releasePointerCapture(event.pointerId)
          }
        >
          <span aria-hidden="true">⋮</span>
        </div>
        <div
          id="planner-schedule-panel"
          className="planner-panel planner-schedule"
        >
          {schedule}
        </div>
      </div>
    </>
  );
}
