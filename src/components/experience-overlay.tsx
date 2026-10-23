"use client";
import {
  createContext,
  useContext,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import PhotoCredit from "./photo-credit";
import type { Experience } from "@/server/catalogue";
import { BucketButton } from "./bucket";
import Icon from "./icons";
import {
  categoryShortLabels,
  displayName,
  formatDuration,
  formatMoney,
  priceBasisLabel,
  storyFor,
  zoneLabel,
} from "@/domain/experience-content";
const dayNames = ["", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
function openDays(days: number[]) {
  if (days.length === 7) return "Open daily";
  return `Open ${days.map((day) => dayNames[day]).join(", ")}`;
}
type Selection = {
  experience: Experience & { seedKey?: string };
  onAdd?: () => void;
  origin: HTMLButtonElement;
};
const OverlayContext = createContext<((selection: Selection) => void) | null>(
  null,
);
export function ExperienceOverlayProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [selection, setSelection] = useState<Selection | null>(null);
  return (
    <OverlayContext.Provider value={setSelection}>
      {children}
      {selection && (
        <ActivityDialog {...selection} onClose={() => setSelection(null)} />
      )}
    </OverlayContext.Provider>
  );
}
export default function ExperienceOverlay({
  experience,
  onAdd,
  trigger = "View details",
  triggerStyle = "button",
}: {
  experience: Selection["experience"];
  onAdd?: () => void;
  trigger?: ReactNode;
  triggerStyle?: "button" | "image" | "title";
}) {
  const openOverlay = useContext(OverlayContext);
  const [local, setLocal] = useState<Selection | null>(null);
  return (
    <>
      <button
        type="button"
        className={`experience-trigger experience-trigger--${triggerStyle} ${triggerStyle === "button" ? "secondary" : ""}`}
        onClick={(event) => {
          const selection = { experience, onAdd, origin: event.currentTarget };
          if (openOverlay) openOverlay(selection);
          else setLocal(selection);
        }}
      >
        {trigger}
      </button>
      {local && <ActivityDialog {...local} onClose={() => setLocal(null)} />}
    </>
  );
}
function ActivityDialog({
  experience: e,
  onAdd,
  origin,
  onClose,
}: Selection & { onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const backdropPress = useRef<{ id: number; x: number; y: number } | null>(
    null,
  );
  const [photoIndex, setPhotoIndex] = useState(0),
    [failed, setFailed] = useState<string[]>([]);
  const photos = e.photos?.length ? e.photos : [e.imagePath],
    selectedPhoto = photos[photoIndex] ?? photos[0];
  const story = storyFor(e.seedKey, e.categoryId);
  useLayoutEffect(() => {
    const x = window.scrollX,
      y = window.scrollY,
      oldOverflow = document.body.style.overflow;
    const ancestors: { element: HTMLElement; top: number; left: number }[] = [];
    for (
      let element = origin.parentElement;
      element;
      element = element.parentElement
    )
      ancestors.push({
        element,
        top: element.scrollTop,
        left: element.scrollLeft,
      });
    document.body.style.overflow = "hidden";
    if (!ref.current?.open) ref.current?.showModal();
    return () => {
      document.body.style.overflow = oldOverflow;
      for (const entry of ancestors) {
        entry.element.scrollTop = entry.top;
        entry.element.scrollLeft = entry.left;
      }
      window.scrollTo({ left: x, top: y, behavior: "instant" });
      const target = origin.isConnected
        ? origin
        : (ancestors.find(
            (entry) => entry.element.isConnected && entry.element.tabIndex >= 0,
          )?.element ?? document.querySelector<HTMLElement>("main"));
      target?.focus({ preventScroll: true });
      backdropPress.current = null;
    };
  }, [origin]);
  function outside(x: number, y: number) {
    const box = ref.current?.getBoundingClientRect();
    return (
      !!box && (x < box.left || x > box.right || y < box.top || y > box.bottom)
    );
  }
  return createPortal(
    <dialog
      ref={ref}
      onClose={onClose}
      className="experience-overlay reading-overlay"
      aria-label={displayName(e.name)}
      aria-modal="true"
      onKeyDown={(event) => {
        if (event.key !== "Tab") return;
        const controls = [
          ...event.currentTarget.querySelectorAll<HTMLElement>(
            "button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex='-1']),video[controls]",
          ),
        ].filter(
          (element) =>
            element.tabIndex >= 0 && element.getClientRects().length > 0,
        );
        const first = controls[0],
          last = controls.at(-1);
        if (event.shiftKey && document.activeElement === first && last) {
          event.preventDefault();
          last.focus({ preventScroll: true });
        } else if (
          !event.shiftKey &&
          document.activeElement === last &&
          first
        ) {
          event.preventDefault();
          first.focus({ preventScroll: true });
        }
      }}
      onPointerDown={(event) => {
        backdropPress.current =
          event.button === 0 &&
          event.target === event.currentTarget &&
          outside(event.clientX, event.clientY)
            ? { id: event.pointerId, x: event.clientX, y: event.clientY }
            : null;
      }}
      onPointerUp={(event) => {
        const press = backdropPress.current;
        backdropPress.current = null;
        if (
          press &&
          press.id === event.pointerId &&
          event.target === event.currentTarget &&
          outside(event.clientX, event.clientY) &&
          Math.hypot(event.clientX - press.x, event.clientY - press.y) < 8
        )
          ref.current?.close();
      }}
      onPointerCancel={() => {
        backdropPress.current = null;
      }}
    >
      <div className="overlay-header">
        <div>
          <p className="eyebrow">
            {categoryShortLabels[e.categoryId] ?? e.categoryId} ·{" "}
            {zoneLabel(e.zoneId)}
          </p>
          <h2>{displayName(e.name)}</h2>
        </div>
        <button
          className="secondary close-button"
          autoFocus
          onClick={() => ref.current?.close()}
        >
          <Icon name="close" size={18} />
          Close
        </button>
      </div>
      <div className="overlay-body">
        <div className="experience-gallery" aria-label="Activity photos">
          <div className="gallery-image-frame">
            <img
              className="gallery-image"
              src={
                failed.includes(selectedPhoto)
                  ? `/assets/illustrations/category-${e.categoryId}.svg`
                  : selectedPhoto
              }
              alt={
                failed.includes(selectedPhoto)
                  ? "Illustrated activity fallback"
                  : e.photos?.length
                    ? displayName(e.name)
                    : (e.inspirationPhoto?.title ??
                      "Category illustration; venue photos not supplied")
              }
              draggable={false}
              onError={() =>
                setFailed((previous) =>
                  previous.includes(selectedPhoto)
                    ? previous
                    : [...previous, selectedPhoto],
                )
              }
            />
            {e.inspirationPhoto && !e.photos?.length && (
              <span className="image-label">Destination inspiration</span>
            )}
          </div>
          {photos.length > 1 && (
            <div className="gallery-controls">
              <button
                className="icon-button"
                aria-label="Previous photo"
                onClick={() =>
                  setPhotoIndex(
                    (index) => (index + photos.length - 1) % photos.length,
                  )
                }
              >
                <Icon name="chevronLeft" />
              </button>
              <span aria-live="polite">
                {photoIndex + 1} / {photos.length}
              </span>
              <button
                className="icon-button"
                aria-label="Next photo"
                onClick={() =>
                  setPhotoIndex((index) => (index + 1) % photos.length)
                }
              >
                <Icon name="chevronRight" />
              </button>
            </div>
          )}
        </div>
        <div
          className="experience-information"
          role="region"
          aria-label="Activity information"
          tabIndex={0}
        >
          <p className="experience-introduction">{story.summary}</p>
          <dl className="fact-grid">
            <div>
              <dt>
                <Icon name="clock" size={16} /> Duration
              </dt>
              <dd>
                {formatDuration(e.durationMinMinutes, e.durationMaxMinutes)}
              </dd>
            </div>
            <div>
              <dt>
                <Icon name="pin" size={16} /> Area
              </dt>
              <dd>{zoneLabel(e.zoneId)}, Lagos</dd>
            </div>
            <div>
              <dt>
                <Icon name="calendar" size={16} /> Timing
              </dt>
              <dd>
                {e.schedulingType === "FIXED"
                  ? "Fixed sessions"
                  : e.kind === "FULL_DAY"
                    ? "Full day"
                    : "Flexible start"}
              </dd>
            </div>
            <div>
              <dt>
                <Icon name="users" size={16} /> Group size
              </dt>
              <dd>
                {e.offer.minParty}–{e.offer.maxParty} adults
              </dd>
            </div>
          </dl>
          {story.why && (
            <section className="info-section">
              <h3>Why it’s worth it</h3>
              <p>{story.why}</p>
            </section>
          )}
          <section className="info-section">
            <h3>When you can go</h3>
            <p>
              {openDays(e.availabilityLocal.days)},{" "}
              {e.availabilityLocal.opensAt}–{e.availabilityLocal.closesAt} Lagos
              time. Up to {e.offer.capacityPerSlot}{" "}
              {e.offer.capacityUnit === "PERSON" ? "people" : "groups"} per
              slot.
            </p>
            {e.schedulingType === "FIXED" ? (
              <>
                <p>
                  Runs at set times. Choose a session; its start time and length
                  can’t be changed.
                </p>
                <ul className="session-list" aria-label="Sessions">
                  {e.sessions?.map((session) => (
                    <li key={session.startTime}>
                      <strong>{session.startTime}</strong>
                      <span>{formatDuration(session.durationMinutes)}</span>
                      {session.dates && (
                        <small>{session.dates.join(", ")}</small>
                      )}
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p>
                {e.kind === "FULL_DAY"
                  ? "Takes up the main part of your day, so nothing else can overlap it."
                  : `Pick your own start time and length. Your whole visit must finish by ${e.availabilityLocal.closesAt}.`}
              </p>
            )}
          </section>
          <div className="inclusion-columns">
            <section className="info-section">
              <h3>Included</h3>
              <ul className="tick-list">
                {e.inclusions.map((value) => (
                  <li key={value}>
                    <Icon name="check" size={16} />
                    {value.replace(/^Demo a/, "A")}
                  </li>
                ))}
              </ul>
            </section>
            <section className="info-section">
              <h3>Not included</h3>
              <ul className="cross-list">
                {e.exclusions.map((value) => (
                  <li key={value}>
                    <Icon name="close" size={16} />
                    {value}
                  </li>
                ))}
              </ul>
            </section>
          </div>
          <section className="info-section">
            <h3>Good to know</h3>
            <ul className="plain-list">
              <li>For adults {e.offer.minAge}+.</li>
              <li>Walking: {e.mobility.intensity.toLowerCase()}.</li>
              <li>Wheelchair access: not confirmed.</li>
              {e.offer.hostIncluded && <li>A local host joins you.</li>}
              <li>Meeting point shared once booked.</li>
            </ul>
          </section>
          {e.videoUrl && (
            <video controls src={e.videoUrl} aria-label="Experience video" />
          )}
          {e.inspirationPhoto && <PhotoCredit photo={e.inspirationPhoto} />}
          <p className="sample-note">
            <Icon name="info" size={16} />
            Sample listing. Adding it to your bucket saves the idea only — no
            time is assigned and nothing is booked.
          </p>
        </div>
      </div>
      <div className="overlay-footer">
        <p className="overlay-price">
          <strong>{formatMoney(e.offer.rateMinor)}</strong>{" "}
          <span>{priceBasisLabel(e.offer.priceBasis)}</span>
        </p>
        <div className="overlay-actions">
          <a
            className="text-link"
            href={`/experiences/${e.seedKey ?? e.id}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            Open in new tab
            <Icon name="external" size={16} />
          </a>
          <BucketButton id={e.offer.id} />
          {onAdd && (
            <button
              onClick={() => {
                ref.current?.close();
                onAdd();
              }}
            >
              <Icon name="plus" size={18} />
              Add to itinerary
            </button>
          )}
        </div>
      </div>
    </dialog>,
    document.body,
  );
}
