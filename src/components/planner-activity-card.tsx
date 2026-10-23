"use client";
import { useState } from "react";
import type { Experience } from "@/server/catalogue";
import type { PlannerDrag } from "@/domain/planner-interactions";
import {
  displayName,
  formatDuration,
  formatMoney,
  priceBasisLabel,
  zoneLabel,
} from "@/domain/experience-content";
import { BucketButton } from "./bucket";
import ExperienceOverlay from "./experience-overlay";
import Icon from "./icons";

export default function PlannerActivityCard({
  experience: e,
  saved,
  busy,
  available,
  note,
  onAdd,
  onDrag,
}: {
  experience: Experience;
  saved: boolean;
  busy: boolean;
  available: boolean;
  note?: string;
  onAdd: () => void;
  onDrag: (value: PlannerDrag | null) => void;
}) {
  const [failed, setFailed] = useState(false);
  const draggable = !busy && available;
  return (
    <article
      className="planner-activity-card"
      data-saved={saved}
      data-available={available}
      data-offer-id={e.offer.id}
      draggable={draggable}
      onDragStart={(event) => {
        if (!draggable) return;
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
      <div className="activity-picture">
        <ExperienceOverlay
          experience={e}
          triggerStyle="image"
          onAdd={available ? onAdd : undefined}
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
      </div>
      <div className="activity-card-content">
        <h3>
          <ExperienceOverlay
            experience={e}
            trigger={displayName(e.name)}
            triggerStyle="title"
            onAdd={available ? onAdd : undefined}
          />
        </h3>
        <p className="activity-area">
          {zoneLabel(e.zoneId)} ·{" "}
          {formatDuration(e.durationMinMinutes, e.durationMaxMinutes)}
          <span
            className="scheduling-badge"
            data-fixed={e.schedulingType === "FIXED"}
          >
            {e.schedulingType === "FIXED"
              ? "Set sessions"
              : e.kind === "FULL_DAY"
                ? "Full day"
                : "Flexible"}
          </span>
        </p>
        <p className="activity-price">
          <strong>{formatMoney(e.offer.rateMinor)}</strong>{" "}
          <span>{priceBasisLabel(e.offer.priceBasis)}</span>
        </p>
        {available ? (
          note && (
            <p className="activity-fit">
              <Icon name="sparkle" size={14} />
              {note}
            </p>
          )
        ) : (
          <p className="activity-unavailable">
            Doesn’t fit this day. Try another day or session.
          </p>
        )}
      </div>
      <div className="activity-card-actions">
        <span
          className="activity-drag-handle"
          aria-hidden="true"
          title="Drag into your day"
        >
          <Icon name="grip" size={18} />
        </span>
        <BucketButton id={e.offer.id} variant="icon" />
        <button
          type="button"
          className="add-to-day"
          disabled={busy || !available}
          onClick={onAdd}
        >
          Add to day
        </button>
      </div>
    </article>
  );
}
