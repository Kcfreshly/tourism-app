"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Intake from "./intake";
import Icon from "./icons";
import { useBackdropDismiss } from "@/hooks/use-backdrop-dismiss";
import { useBucket } from "@/hooks/use-bucket";
import { useActiveTrip } from "@/hooks/use-active-trip";
import { authClient } from "./auth-client";

export function BucketButton({
  id,
  variant = "full",
}: {
  id: string;
  variant?: "full" | "compact" | "icon";
}) {
  const { ids, toggle } = useBucket();
  const saved = ids.includes(id);
  const full = !saved && ids.length >= 30;
  if (variant === "icon")
    return (
      <button
        type="button"
        className="bucket-button bucket-button--icon icon-button"
        disabled={full}
        title={saved ? "Remove from bucket" : "Add to bucket"}
        aria-label={saved ? "Remove from bucket" : "Add to bucket"}
        aria-pressed={saved}
        onClick={() => toggle(id)}
      >
        <Icon name={saved ? "bookmarkFilled" : "bookmark"} size={18} />
      </button>
    );
  return (
    <button
      type="button"
      className={`bucket-button bucket-button--${variant}`}
      disabled={full}
      title={
        full
          ? "Your bucket holds up to 30 activities. Remove one to save another."
          : undefined
      }
      aria-pressed={saved}
      onClick={() => toggle(id)}
    >
      <span className="bucket-button-icon">
        <Icon name={saved ? "check" : "plus"} size={16} />
      </span>
      {saved ? (
        <span>
          {variant === "compact" ? "Saved" : "In your bucket"}
          <span className="sr-only"> · Remove from bucket</span>
        </span>
      ) : (
        <span>Add to bucket</span>
      )}
    </button>
  );
}

export function BucketNav() {
  const { ids } = useBucket();
  return (
    <Link
      className="bucket-pill"
      href="/explore?view=bucket"
      data-empty={!ids.length}
    >
      <Icon name="bookmark" size={18} />
      <span className="bucket-pill-label">Bucket</span>
      <span className="bucket-count" aria-label={`${ids.length} saved`}>
        {ids.length}
      </span>
    </Link>
  );
}

// Clear with confirmation and Undo. Clearing only changes the browser
// shortlist; scheduled itinerary items are never touched.
export function ClearBucket({ onCleared }: { onCleared?: () => void } = {}) {
  const { ids, clear, restore } = useBucket();
  const [cleared, setCleared] = useState<string[] | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const dismiss = useBackdropDismiss(dialog);
  return (
    <>
      <button
        type="button"
        className="text-button danger-text"
        disabled={!ids.length}
        onClick={() => dialog.current?.showModal()}
      >
        Clear bucket
      </button>
      {cleared && (
        <span className="bucket-undo" role="status">
          Bucket cleared.{" "}
          <button
            type="button"
            className="text-button"
            aria-label="Undo clear bucket"
            onClick={() => {
              restore(cleared);
              setCleared(null);
            }}
          >
            Undo
          </button>
        </span>
      )}
      <dialog
        ref={dialog}
        className="confirm-dialog clear-bucket-dialog"
        aria-label="Clear your bucket"
        {...dismiss}
      >
        <h2>Clear your bucket?</h2>
        <p>
          This removes all {ids.length} saved activities from your shortlist.
          Anything already in your itinerary stays exactly where it is.
        </p>
        <div className="actions">
          <button
            type="button"
            className="secondary"
            autoFocus
            onClick={() => dialog.current?.close()}
          >
            Keep activities
          </button>
          <button
            type="button"
            className="danger"
            onClick={() => {
              setCleared(clear());
              dialog.current?.close();
              onCleared?.();
            }}
          >
            Clear bucket
          </button>
        </div>
      </dialog>
    </>
  );
}

export function PlanTrip({
  tripId,
  className,
}: { tripId?: string; className?: string } = {}) {
  const activeTrip = useActiveTrip();
  const router = useRouter();
  const { data: session } = authClient.useSession();
  const [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const dismiss = useBackdropDismiss(dialog);
  const trip = tripId || activeTrip;
  return (
    <>
      <button
        type="button"
        className={className}
        onClick={() => {
          // Exploring is public; planning starts after sign-in, with the
          // bucket kept in this browser.
          if (!session) router.push("/account?next=%2Fplan%2Fnew");
          else if (trip) router.push(`/trips/${encodeURIComponent(trip)}/plan`);
          else {
            setOpen(true);
            dialog.current?.showModal();
          }
        }}
      >
        {session && trip ? "Open trip planner" : "Plan my trip"}
        <Icon name="arrowRight" size={18} />
      </button>
      <dialog
        ref={dialog}
        className="sheet-dialog onboarding-overlay"
        onClose={() => setOpen(false)}
        aria-labelledby="onboarding-title"
        {...dismiss}
      >
        <div className="sheet-header">
          <div>
            <p className="eyebrow">Before we plan</p>
            <h2 id="onboarding-title">
              We&#8217;d like to know you&#8212;let&#8217;s tailor your trip.
            </h2>
          </div>
          <button
            type="button"
            className="icon-button close-button"
            onClick={() => dialog.current?.close()}
          >
            <Icon name="close" size={20} />
            <span className="sr-only">Close</span>
          </button>
        </div>
        <div className="sheet-body">
          {open && (
            <Intake embedded onContinue={() => dialog.current?.close()} />
          )}
        </div>
      </dialog>
    </>
  );
}

// Sticky summary shown while browsing with a non-empty bucket.
export function BucketTray({
  tripId,
  onView,
}: {
  tripId?: string;
  onView: () => void;
}) {
  const { ids } = useBucket();
  const activeTrip = useActiveTrip();
  if (!ids.length && !tripId && !activeTrip) return null;
  return (
    <div className="bucket-tray" role="region" aria-label="Your bucket">
      <div className="bucket-tray-inner">
        <p>
          <span className="bucket-count">{ids.length}</span>
          <span>
            <strong>
              {ids.length === 1 ? "activity" : "activities"} in your bucket
            </strong>
            <small>
              {ids.length
                ? "Saved ideas only — not booked or scheduled."
                : "Add ideas as you browse."}
            </small>
          </span>
        </p>
        <div className="bucket-tray-actions">
          {ids.length > 0 && (
            <button type="button" className="secondary" onClick={onView}>
              View bucket
            </button>
          )}
          <PlanTrip tripId={tripId} />
        </div>
      </div>
    </div>
  );
}
