"use client";
import { useState } from "react";
import type { Experience } from "@/server/catalogue";
import type { PlannerDrag } from "@/domain/planner-interactions";
import { BucketButton } from "./bucket";
import ExperienceOverlay from "./experience-overlay";

export default function PlannerActivityCard({
  experience: e,
  saved,
  busy,
  available,
  onAdd,
  onDrag,
}: {
  experience: Experience;
  saved: boolean;
  busy: boolean;
  available: boolean;
  onAdd: () => void;
  onDrag: (value: PlannerDrag | null) => void;
}) {
  const [failed, setFailed] = useState(false);
  const price = new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(e.offer.rateMinor / 100);
  return (
    <article
      className="planner-activity-card"
      data-saved={saved}
      data-offer-id={e.offer.id}
    >
      <div className="activity-picture">
        <ExperienceOverlay
          experience={e}
          triggerStyle="image"
          trigger={
            <img
              src={
                failed
                  ? `/assets/illustrations/category-${e.categoryId}.svg`
                  : e.imagePath
              }
              onError={() => setFailed(true)}
              alt={
                failed
                  ? "Illustrated experience fallback"
                  : (e.inspirationPhoto?.title ?? e.name)
              }
              loading="lazy"
              draggable={false}
            />
          }
        />
        <span className="scheduling-badge">
          {e.schedulingType === "FIXED" ? "Fixed session" : "Flexible time"}
        </span>
      </div>
      <div className="activity-card-content">
        <p className="activity-area">
          {e.zoneId} ·{" "}
          {e.durationMinMinutes === e.durationMaxMinutes
            ? e.durationMinMinutes
            : `${e.durationMinMinutes}–${e.durationMaxMinutes}`}{" "}
          min
        </p>
        <h3>
          <ExperienceOverlay
            experience={e}
            trigger={e.name.replace(/\s*[—-]\s*DEMO$/, "")}
            triggerStyle="title"
            onAdd={onAdd}
          />
        </h3>
        <p className="activity-price">
          <strong>{price}</strong>
          <span>
            {" "}
            / {e.offer.priceBasis === "PER_ADULT" ? "adult" : "group"}
          </span>
        </p>
        <div className="activity-card-actions">
          <button
            className="activity-drag-handle secondary"
            title="Drag this activity to a time in your day. You can also use Add to day."
            aria-label={`Drag ${e.name}`}
            disabled={busy || !available}
            draggable={!busy && available}
            onDragStart={(event) => {
              const value: PlannerDrag = {
                kind: "offer",
                offerId: e.offer.id,
                id: crypto.randomUUID(),
              };
              event.dataTransfer.setData(
                "application/x-tourism",
                JSON.stringify(value),
              );
              event.dataTransfer.effectAllowed = "copy";
              onDrag(value);
            }}
            onDragEnd={() => onDrag(null)}
          >
            ⠿<span>Drag</span>
          </button>
          <button disabled={busy || !available} onClick={onAdd}>
            Add to day
          </button>
        </div>
        <BucketButton id={e.offer.id} />
        {!available && (
          <p className="activity-unavailable">
            Doesn’t fit this day. Try another day or session.
          </p>
        )}
      </div>
    </article>
  );
}
