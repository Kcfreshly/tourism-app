"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Intake from "./intake";
import { useBucket, useActiveTrip } from "./trip-store";
export { useBucket } from "./trip-store";
export function BucketButton({ id }: { id: string }) {
  const { ids, toggle } = useBucket();
  const saved = ids.includes(id);
  return (
    <button
      type="button"
      className="bucket-button"
      disabled={!saved && ids.length >= 30}
      title={
        ids.length >= 30
          ? "Your bucket holds up to 30 activities. Remove one to save another."
          : undefined
      }
      aria-pressed={saved}
      onClick={() => toggle(id)}
    >
      <span className="bucket-button-icon" aria-hidden="true">
        {saved ? "\u2713" : "+"}
      </span>
      <span>{saved ? "Remove from bucket" : "Add to bucket"}</span>
    </button>
  );
}
export function BucketNav() {
  const { ids } = useBucket();
  return <Link href="/explore">Bucket ({ids.length})</Link>;
}
export function PlanTrip({ tripId }: { tripId?: string } = {}) {
  const activeTrip = useActiveTrip();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  return (
    <>
      <button
        onClick={() => {
          const trip = tripId || activeTrip;
          if (trip) router.push(`/trips/${encodeURIComponent(trip)}/plan`);
          else {
            setOpen(true);
            dialog.current?.showModal();
          }
        }}
      >
        {tripId || activeTrip ? "Open trip planner" : "Plan my trip"}
      </button>
      <dialog
        ref={dialog}
        className="onboarding-overlay"
        onClose={() => setOpen(false)}
        aria-label="Tailor your trip"
      >
        <button className="secondary" onClick={() => dialog.current?.close()}>
          Close
        </button>
        <h2>We&#8217;d like to know you&#8212;let&#8217;s tailor your trip.</h2>
        {open && <Intake onContinue={() => dialog.current?.close()} />}
      </dialog>
    </>
  );
}
