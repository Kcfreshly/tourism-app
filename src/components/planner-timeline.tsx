"use client";
import { useRef, useState, type PointerEvent } from "react";
import { minutes, time, type Item } from "@/domain/planner";
import {
  resizedBlock,
  snapMinutes,
  type PlannerDrag,
} from "@/domain/planner-interactions";
import type { Experience } from "@/server/catalogue";
import { displayName, zoneLabel } from "@/domain/experience-content";
import ExperienceOverlay from "./experience-overlay";
import Icon from "./icons";

function length(start: string, end: string) {
  const total = minutes(end) - minutes(start);
  const h = Math.floor(total / 60),
    m = total % 60;
  return h ? `${h}h${m ? ` ${m}m` : ""}` : `${m}m`;
}

export default function PlannerTimeline({
  day,
  items,
  offers,
  busy,
  dragging,
  onDrag,
  candidateAt,
  validate,
  onCommit,
  onEdit,
  onRemove,
  onLock,
  onReplace,
  onPersonal,
  onMessage,
}: {
  day: string;
  items: Item[];
  offers: Experience[];
  busy: boolean;
  dragging: PlannerDrag | null;
  onDrag: (value: PlannerDrag | null) => void;
  candidateAt: (drag: PlannerDrag, at: number, date?: string) => Item | null;
  validate: (item: Item) => string | undefined;
  onCommit: (item: Item) => boolean;
  onEdit: (item: Item) => void;
  onRemove: (item: Item) => void;
  onLock: (item: Item) => void;
  onReplace: (item: Item) => void;
  onPersonal: () => void;
  onMessage: (message: string) => void;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const [resize, setResize] = useState<{
    item: Item;
    proposed: Item;
    edge: "start" | "end";
    y: number;
  } | null>(null);
  const scroll = useRef<HTMLDivElement>(null);
  const start = Math.min(
    420,
    ...items.map((item) => Math.floor(minutes(item.startTime) / 60) * 60),
  );
  const end = 1440;
  const slots = Array.from(
    { length: (end - start) / 15 },
    (_, index) => start + index * 15,
  );
  const preview =
    dragging && hover !== null ? candidateAt(dragging, hover) : null;
  const problem = resize
    ? validate(resize.proposed)
    : preview
      ? validate(preview)
      : undefined;
  const fullDay = items
    .map((item) => offers.find((e) => e.offer.id === item.offerId))
    .find((offer) => offer?.kind === "FULL_DAY");
  function begin(
    event: PointerEvent<HTMLButtonElement>,
    item: Item,
    edge: "start" | "end",
  ) {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    setResize({ item, proposed: item, edge, y: event.clientY });
  }
  function resizeHandle(item: Item, original: Item, edge: "start" | "end") {
    return (
      <button
        className={`block-resize edge-${edge}`}
        aria-label={`Resize ${edge} of ${item.title}`}
        title={`Drag to change the ${edge} time, or use the arrow keys`}
        onKeyDown={(event) => {
          if (event.key === "ArrowUp" || event.key === "ArrowDown") {
            event.preventDefault();
            onCommit(
              resizedBlock(original, edge, event.key === "ArrowUp" ? -15 : 15),
            );
          } else if (event.key === "Enter") onEdit(original);
        }}
        disabled={busy}
        onPointerDown={(event) => begin(event, item, edge)}
        onPointerMove={(event) => {
          if (resize && event.currentTarget.hasPointerCapture(event.pointerId))
            setResize({
              ...resize,
              proposed: resizedBlock(
                resize.item,
                resize.edge,
                event.clientY - resize.y,
              ),
            });
        }}
        onPointerUp={(event) => {
          if (resize) {
            onCommit(resize.proposed);
            setResize(null);
          }
          if (event.currentTarget.hasPointerCapture(event.pointerId))
            event.currentTarget.releasePointerCapture(event.pointerId);
        }}
        onPointerCancel={() => setResize(null)}
      />
    );
  }
  return (
    <>
      <div className="schedule-heading">
        <div>
          <h2>
            {new Date(day + "T12:00:00Z").toLocaleDateString("en-GB", {
              weekday: "long",
              day: "numeric",
              month: "long",
              timeZone: "UTC",
            })}
          </h2>
          <span>
            {items.length
              ? `${items.length} ${items.length === 1 ? "item" : "items"} · Lagos time`
              : "Nothing planned yet · Lagos time"}
          </span>
        </div>
        <button className="secondary" disabled={busy} onClick={onPersonal}>
          <Icon name="plus" size={16} />
          Add personal time
        </button>
      </div>
      {fullDay && (
        <p className="day-full-banner">
          <Icon name="info" size={16} />
          This day is full: {displayName(fullDay.name)} takes up the main part
          of the day, so other activities can’t overlap it.
        </p>
      )}
      <div
        className="schedule-feedback"
        role="status"
        aria-live="polite"
        data-state={
          resize || preview ? (problem ? "invalid" : "valid") : undefined
        }
      >
        {resize
          ? `${resize.proposed.startTime}–${resize.proposed.endTime} · ${minutes(resize.proposed.endTime) - minutes(resize.proposed.startTime)} min${problem ? ` · ${problem}` : " · Release to apply"}`
          : preview
            ? `${preview.startTime}–${preview.endTime}${problem ? ` · ${problem}` : " · Available — drop to add"}`
            : dragging && hover !== null
              ? "Choose a valid start time or a published session."
              : items.length
                ? "Drag blocks to move them. Drag the top or bottom edge of a flexible activity to change its length."
                : "Your day is open. Drag an activity here, or use Add to day."}
      </div>
      <div
        className="schedule-scroll"
        ref={scroll}
        tabIndex={0}
        aria-label="Day time grid"
      >
        <div
          className="time-grid"
          data-dragging={!!dragging}
          style={{ height: end - start }}
          onDragOver={(event) => {
            if (!dragging) return;
            event.preventDefault();
            const at = Math.max(
              start,
              Math.min(
                end - 15,
                snapMinutes(
                  event.clientY -
                    event.currentTarget.getBoundingClientRect().top +
                    start,
                ),
              ),
            );
            setHover(at);
            const candidate = candidateAt(dragging, at);
            event.dataTransfer.dropEffect =
              !candidate || validate(candidate)
                ? "none"
                : dragging.kind === "offer"
                  ? "copy"
                  : "move";
          }}
          onDragLeave={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node))
              setHover(null);
          }}
          onDrop={(event) => {
            event.preventDefault();
            const raw = event.dataTransfer.getData("application/x-tourism");
            let payload = dragging;
            try {
              if (raw) payload = JSON.parse(raw) as PlannerDrag;
            } catch {
              return;
            }
            const at = Math.max(
              start,
              Math.min(
                end - 15,
                snapMinutes(
                  event.clientY -
                    event.currentTarget.getBoundingClientRect().top +
                    start,
                ),
              ),
            );
            const candidate = payload ? candidateAt(payload, at) : null;
            if (candidate) onCommit(candidate);
            else
              onMessage("Choose a valid time or an available fixed session.");
            setHover(null);
            onDrag(null);
          }}
        >
          {slots.map((at) => {
            const candidate = dragging ? candidateAt(dragging, at) : null;
            const invalid = candidate ? validate(candidate) : undefined;
            return (
              <div
                key={at}
                className={`time-slot ${at % 60 === 0 ? "hour-slot" : ""}`}
                style={{ top: at - start }}
                data-at={time(at)}
                data-drop={
                  dragging
                    ? invalid || !candidate
                      ? "invalid"
                      : "valid"
                    : undefined
                }
              >
                {at % 60 === 0 && (
                  <span className="time-label">{time(at)}</span>
                )}
              </div>
            );
          })}
          {preview && (
            <div
              className="drop-preview"
              data-invalid={!!problem}
              style={{
                top: minutes(preview.startTime) - start,
                height: Math.max(
                  15,
                  minutes(preview.endTime) - minutes(preview.startTime),
                ),
              }}
            >
              {preview.startTime}–{preview.endTime}
            </div>
          )}
          {items.map((original) => {
            const item =
              resize?.item.id === original.id ? resize.proposed : original;
            const offer = offers.find((e) => e.offer.id === item.offerId);
            const duration = minutes(item.endTime) - minutes(item.startTime);
            const flexible =
              item.kind === "EXPERIENCE" &&
              offer?.schedulingType !== "FIXED" &&
              offer?.kind !== "FULL_DAY";
            const type =
              item.kind !== "EXPERIENCE"
                ? "personal"
                : offer?.kind === "FULL_DAY"
                  ? "full-day"
                  : offer?.schedulingType === "FIXED"
                    ? "fixed"
                    : "flexible";
            return (
              <article
                key={item.id}
                className={`schedule-block block-${item.kind.toLowerCase()} ${duration < 60 ? "short-block" : ""} ${duration < 40 ? "tiny-block" : ""}`}
                data-item-id={item.id}
                data-type={type}
                data-locked={item.locked}
                data-moving={
                  dragging?.kind === "item" && dragging.id === item.id
                }
                data-invalid={resize?.item.id === item.id && !!problem}
                style={{
                  top: minutes(item.startTime) - start,
                  height: Math.max(15, duration),
                }}
              >
                {flexible &&
                  !item.locked &&
                  resizeHandle(item, original, "start")}
                <div className="block-main">
                  <div className="block-topline">
                    <button
                      className="block-drag"
                      draggable={!busy && !item.locked}
                      disabled={busy || item.locked}
                      aria-label={`Move ${item.title}`}
                      title={
                        item.locked
                          ? "Unlock to move"
                          : "Drag to move. Use Edit to move with the keyboard."
                      }
                      onDragStart={(event) => {
                        const payload: PlannerDrag = {
                          kind: "item",
                          id: item.id,
                        };
                        event.dataTransfer.setData(
                          "application/x-tourism",
                          JSON.stringify(payload),
                        );
                        event.dataTransfer.effectAllowed = "move";
                        onDrag(payload);
                      }}
                      onDragEnd={() => {
                        onDrag(null);
                        setHover(null);
                      }}
                    >
                      <Icon name={item.locked ? "lock" : "grip"} size={16} />
                    </button>
                    <span className="block-time">
                      {item.startTime}–{item.endTime}
                      <span className="block-length">
                        {length(item.startTime, item.endTime)}
                      </span>
                    </span>
                    <span className="block-tags">
                      {type === "fixed" && <span>Set session</span>}
                      {type === "full-day" && <span>Full day</span>}
                      {type === "personal" && <span>Personal</span>}
                    </span>
                    <span className="block-actions">
                      <button
                        className="icon-button"
                        disabled={busy}
                        aria-label={item.locked ? "Unlock" : "Lock"}
                        title={
                          item.locked
                            ? "Unlock: allow moves and suggestions to change this"
                            : "Lock: keep this exactly where it is"
                        }
                        onClick={() => onLock(original)}
                      >
                        <Icon
                          name={item.locked ? "unlock" : "lock"}
                          size={16}
                        />
                      </button>
                      {offer && !item.locked && (
                        <button
                          className="icon-button"
                          disabled={busy}
                          aria-label="Replace"
                          title="Replace with another activity"
                          onClick={() => onReplace(original)}
                        >
                          <Icon name="swap" size={16} />
                        </button>
                      )}
                      <button
                        className="icon-button"
                        disabled={busy}
                        aria-label="Remove"
                        title="Remove from this day"
                        onClick={() => onRemove(original)}
                      >
                        <Icon name="trash" size={16} />
                      </button>
                      <button
                        className="block-edit"
                        disabled={busy}
                        onClick={() => onEdit(original)}
                      >
                        Edit
                      </button>
                    </span>
                  </div>
                  <h3>
                    {offer ? (
                      <ExperienceOverlay
                        experience={offer}
                        trigger={displayName(item.title)}
                        triggerStyle="title"
                      />
                    ) : (
                      item.title
                    )}
                  </h3>
                  {offer && duration >= 75 && (
                    <p className="block-meta">
                      <Icon name="pin" size={14} />
                      {zoneLabel(offer.zoneId)}
                      {offer.offer.hostIncluded ? " · Local host included" : ""}
                    </p>
                  )}
                </div>
                {flexible &&
                  !item.locked &&
                  resizeHandle(item, original, "end")}
              </article>
            );
          })}
        </div>
      </div>
    </>
  );
}
