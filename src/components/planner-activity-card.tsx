"use client";
import { useState } from "react";
import type { Experience } from "@/modules/catalogue/domain/experience";
import type { PlannerDrag } from "@/modules/trips/domain/planner-interactions";
import {
  displayName,
  formatDuration,
  formatMoney,
  priceBasisLabel,
  zoneLabel,
} from "@/modules/catalogue/domain/experience-content";
import { BucketButton } from "./bucket";
import ExperienceOverlay from "./experience-overlay";
import Icon from "./icons";

export default function PlannerActivityCard({
  experience: e,
  saved,
  busy,
  available,
  note,
  when,
  otherDay,
  onAdd,
  onDrag,
}: {
  experience: Experience;
  saved: boolean;
  busy: boolean;
  available: boolean;
  note?: string;
  // Dated events: when they run, and a shortcut to a day they run on.
  when?: string;
  otherDay?: { label: string; go: () => void };
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
            {e.event
              ? "Event"
              : e.schedulingType === "FIXED"
                ? "Set sessions"
                : e.kind === "FULL_DAY"
                  ? "Full day"
                  : "Flexible"}
          </span>
        </p>
        {when && (
          <p className="activity-when">
            <Icon name="calendar" size={14} />
            {when}
          </p>
        )}
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
            {otherDay ? (
              <>
                Runs on {otherDay.label}.{" "}
                <button
                  type="button"
                  className="text-button"
                  onClick={otherDay.go}
                >
                  Go to that day
                </button>
              </>
            ) : (
              "Doesn’t fit this day. Try another day or session."
            )}
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
