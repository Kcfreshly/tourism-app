"use client";
import { useRef, useState, type PointerEvent } from "react";
import { minutes, time, type Item } from "@/domain/planner";
import {
  resizedBlock,
  snapMinutes,
  type PlannerDrag,
} from "@/domain/planner-interactions";
import type { Experience } from "@/server/catalogue";
import ExperienceOverlay from "./experience-overlay";

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
  return (
    <>
      <div className="schedule-heading">
        <div>
          <h2>
            {new Date(day + "T12:00:00Z").toLocaleDateString("en-GB", {
              weekday: "long",
              day: "numeric",
              month: "short",
            })}
          </h2>
          <span>Africa/Lagos · 15-minute intervals</span>
        </div>
        <button className="secondary" disabled={busy} onClick={onPersonal}>
          + Personal time
        </button>
      </div>
      {!items.length && (
        <p className="schedule-empty">
          Your day is open. Drag an activity here or add personal time.
        </p>
      )}
      <div className="schedule-feedback" role="status" aria-live="polite">
        {resize
          ? `${resize.proposed.startTime}–${resize.proposed.endTime} · ${minutes(resize.proposed.endTime) - minutes(resize.proposed.startTime)} min${problem ? ` · ${problem}` : " · Release to apply"}`
          : preview
            ? `${preview.startTime}–${preview.endTime}${problem ? ` · ${problem}` : " · Available"}`
            : dragging && hover !== null
              ? "Choose a valid start time or a published fixed session."
              : "Drag an activity into your day, or select Add to day."}
      </div>
      <div
        className="schedule-scroll"
        ref={scroll}
        tabIndex={0}
        aria-label="Day time grid"
      >
        <div
          className="time-grid"
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
            return (
              <article
                key={item.id}
                className={`schedule-block block-${item.kind.toLowerCase()} ${duration < 60 ? "short-block" : ""}`}
                data-item-id={item.id}
                data-invalid={resize?.item.id === item.id && !!problem}
                style={{
                  top: minutes(item.startTime) - start,
                  height: Math.max(15, duration),
                }}
              >
                {flexible && !item.locked && (
                  <button
                    className="block-resize edge-start"
                    aria-label={`Resize start of ${item.title}`}
                    onKeyDown={(event) => {
                      if (
                        event.key === "ArrowUp" ||
                        event.key === "ArrowDown"
                      ) {
                        event.preventDefault();
                        onCommit(
                          resizedBlock(
                            original,
                            "start",
                            event.key === "ArrowUp" ? -15 : 15,
                          ),
                        );
                      } else if (event.key === "Enter") onEdit(original);
                    }}
                    disabled={busy}
                    onPointerDown={(event) => begin(event, item, "start")}
                    onPointerMove={(event) => {
                      if (
                        resize &&
                        event.currentTarget.hasPointerCapture(event.pointerId)
                      )
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
                      if (
                        event.currentTarget.hasPointerCapture(event.pointerId)
                      )
                        event.currentTarget.releasePointerCapture(
                          event.pointerId,
                        );
                    }}
                    onPointerCancel={() => setResize(null)}
                  />
                )}
                <div className="block-main">
                  <div className="block-topline">
                    <button
                      className="block-drag"
                      draggable={!busy && !item.locked}
                      disabled={busy || item.locked}
                      aria-label={`Move ${item.title}`}
                      title="Drag to move; use Edit for keyboard or fixed-session alternatives"
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
                      ⠿
                    </button>
                    <span>
                      {item.startTime}–{item.endTime}
                      {offer?.schedulingType === "FIXED"
                        ? " · Fixed session"
                        : offer?.kind === "FULL_DAY"
                          ? " · Day full"
                          : ""}
                      {item.locked ? " · Locked" : ""}
                    </span>
                    <button
                      className="block-edit"
                      disabled={busy}
                      onClick={() => onEdit(original)}
                    >
                      Edit
                    </button>
                  </div>
                  <h3>
                    {offer ? (
                      <ExperienceOverlay
                        experience={offer}
                        trigger={item.title.replace(/\s*[—-]\s*DEMO$/, "")}
                        triggerStyle="title"
                      />
                    ) : (
                      item.title
                    )}
                  </h3>
                  {duration >= 60 && (
                    <div className="block-actions">
                      <button onClick={() => onLock(original)}>
                        {item.locked ? "Unlock" : "Lock"}
                      </button>
                      {offer && !item.locked && (
                        <button
                          disabled={busy}
                          onClick={() => onReplace(original)}
                        >
                          Replace
                        </button>
                      )}
                      <button
                        disabled={busy}
                        onClick={() => onRemove(original)}
                      >
                        Remove
                      </button>
                    </div>
                  )}
                </div>
                {flexible && !item.locked && (
                  <button
                    className="block-resize edge-end"
                    aria-label={`Resize end of ${item.title}`}
                    onKeyDown={(event) => {
                      if (
                        event.key === "ArrowUp" ||
                        event.key === "ArrowDown"
                      ) {
                        event.preventDefault();
                        onCommit(
                          resizedBlock(
                            original,
                            "end",
                            event.key === "ArrowUp" ? -15 : 15,
                          ),
                        );
                      } else if (event.key === "Enter") onEdit(original);
                    }}
                    disabled={busy}
                    onPointerDown={(event) => begin(event, item, "end")}
                    onPointerMove={(event) => {
                      if (
                        resize &&
                        event.currentTarget.hasPointerCapture(event.pointerId)
                      )
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
                      if (
                        event.currentTarget.hasPointerCapture(event.pointerId)
                      )
                        event.currentTarget.releasePointerCapture(
                          event.pointerId,
                        );
                    }}
                    onPointerCancel={() => setResize(null)}
                  />
                )}
              </article>
            );
          })}
        </div>
      </div>
    </>
  );
}
