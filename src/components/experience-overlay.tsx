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
      aria-label={e.name}
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
          <p className="eyebrow">EXPERIENCE DETAILS</p>
          <h2>{e.name}</h2>
        </div>
        <button
          className="secondary"
          autoFocus
          onClick={() => ref.current?.close()}
        >
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
                    ? e.name
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
          </div>
          {photos.length > 1 && (
            <div className="gallery-controls">
              <button
                className="secondary"
                aria-label="Previous photo"
                onClick={() =>
                  setPhotoIndex(
                    (index) => (index + photos.length - 1) % photos.length,
                  )
                }
              >
                Previous
              </button>
              <span aria-live="polite">
                {photoIndex + 1} / {photos.length}
              </span>
              <button
                className="secondary"
                aria-label="Next photo"
                onClick={() =>
                  setPhotoIndex((index) => (index + 1) % photos.length)
                }
              >
                Next
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
          <p className="experience-introduction">{e.description}</p>
          <h3>Where you will go</h3>
          <p>{e.zoneId}, Lagos. Meeting point unconfirmed.</p>
          <h3>Why visit</h3>
          <p>Explore {e.categoryId} at your own pace.</p>
          <dl className="experience-facts">
            <div>
              <dt>Price</dt>
              <dd>
                NGN {(e.offer.rateMinor / 100).toLocaleString("en-NG")} /{" "}
                {e.offer.priceBasis === "PER_ADULT" ? "adult" : "group"}
              </dd>
            </div>
            <div>
              <dt>Duration</dt>
              <dd>
                {e.durationMinMinutes}-{e.durationMaxMinutes} minutes
              </dd>
            </div>
          </dl>
          <h3>Planning your visit</h3>
          <p>
            {e.schedulingType === "FIXED"
              ? "Fixed sessions: choose a published session. Start and duration cannot be changed."
              : "Flexible time: your full visit must fit opening hours and permitted duration."}
          </p>
          <p>
            Opening hours: {e.availabilityLocal.opensAt}-
            {e.availabilityLocal.closesAt} Africa/Lagos. Open on{" "}
            {e.availabilityLocal.days
              .map(
                (day) =>
                  [
                    "",
                    "Monday",
                    "Tuesday",
                    "Wednesday",
                    "Thursday",
                    "Friday",
                    "Saturday",
                    "Sunday",
                  ][day],
              )
              .join(", ")}
            . Capacity: {e.offer.capacityPerSlot}{" "}
            {e.offer.capacityUnit.toLowerCase()}.
          </p>
          {e.sessions?.map((session) => (
            <p key={session.startTime}>
              {session.startTime} / {session.durationMinutes} minutes{" "}
              {session.dates?.join(", ")}
            </p>
          ))}
          <h3>Included</h3>
          <ul>
            {e.inclusions.map((value) => (
              <li key={value}>{value}</li>
            ))}
          </ul>
          <h3>Excluded</h3>
          <ul>
            {e.exclusions.map((value) => (
              <li key={value}>{value}</li>
            ))}
          </ul>
          {e.videoUrl && (
            <video controls src={e.videoUrl} aria-label="Experience video" />
          )}
          {e.inspirationPhoto && <PhotoCredit photo={e.inspirationPhoto} />}
          <p className="muted">
            Saving does not book or assign a time. No inventory is held.
          </p>
        </div>
      </div>
      <div className="overlay-footer">
        <div className="overlay-actions">
          <BucketButton id={e.offer.id} />
          {onAdd && (
            <button
              onClick={() => {
                ref.current?.close();
                onAdd();
              }}
            >
              Add to itinerary
            </button>
          )}
          <a
            href={`/experiences/${e.seedKey ?? e.id}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            Open in new tab
          </a>
        </div>
      </div>
    </dialog>,
    document.body,
  );
}
