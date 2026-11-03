"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Item } from "@/domain/planner";
import type { Profile } from "@/domain/profile";
import { unplannedDays } from "@/domain/checkout";
import { useBackdropDismiss } from "@/hooks/use-backdrop-dismiss";
import Icon from "./icons";

function shortDate(date: string) {
  return new Date(date + "T12:00:00Z").toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

// Goes to checkout. Empty days get a reminder, never a block: travellers may
// keep days free and plan them later.
export default function CheckoutButton({
  tripId,
  profile,
  items,
  disabled,
  beforeLeave,
  onPlanDay,
  className = "checkout-button",
}: {
  tripId: string;
  profile: Pick<Profile, "startDate" | "endDate">;
  items: Pick<Item, "localDate">[];
  disabled?: boolean;
  // Saves pending edits; returning false keeps the traveller here.
  beforeLeave?: () => Promise<boolean>;
  // Plan an empty day; without it, "Plan" opens the planner.
  onPlanDay?: (day: string) => void;
  className?: string;
}) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const dismiss = useBackdropDismiss(dialog);
  const [busy, setBusy] = useState(false);
  const empty = unplannedDays(profile, items);
  const total = Math.round(
    (Date.parse(profile.endDate) - Date.parse(profile.startDate)) / 86400000 +
      1,
  );
  async function proceed() {
    setBusy(true);
    try {
      if (beforeLeave && !(await beforeLeave())) return;
      dialog.current?.close();
      router.push(`/trips/${encodeURIComponent(tripId)}/checkout`);
    } finally {
      setBusy(false);
    }
  }
  function plan(day: string) {
    dialog.current?.close();
    if (onPlanDay) onPlanDay(day);
    else
      router.push(
        `/trips/${encodeURIComponent(tripId)}/plan?day=${encodeURIComponent(day)}`,
      );
  }
  return (
    <>
      <button
        type="button"
        className={className}
        disabled={disabled || busy}
        onClick={() => {
          if (empty.length) dialog.current?.showModal();
          else void proceed();
        }}
      >
        {busy ? "Saving…" : "Review and checkout"}
        <Icon name="arrowRight" size={16} />
      </button>
      <dialog
        ref={dialog}
        className="confirm-dialog checkout-prompt"
        aria-labelledby="checkout-prompt-title"
        {...dismiss}
      >
        <div className="checkout-prompt-head">
          <h2 id="checkout-prompt-title">
            {empty.length === total
              ? "You haven’t planned any days yet"
              : `${empty.length} of ${total} days ${empty.length === 1 ? "has" : "have"} nothing planned`}
          </h2>
          <button
            type="button"
            className="icon-button"
            aria-label="Close"
            onClick={() => dialog.current?.close()}
          >
            <Icon name="close" size={18} />
          </button>
        </div>
        <p>
          That’s fine if you want free time. You can still check out now and add
          to these days later, before your trip.
        </p>
        <ul className="checkout-prompt-days">
          {empty.map((day) => (
            <li key={day}>
              <span>
                <Icon name="calendar" size={15} />
                {shortDate(day)}
              </span>
              <button
                type="button"
                className="text-button"
                onClick={() => plan(day)}
              >
                Plan this day
              </button>
            </li>
          ))}
        </ul>
        <div className="actions">
          <button
            type="button"
            className="secondary"
            autoFocus
            onClick={() => plan(empty[0])}
          >
            Keep planning
          </button>
          <button type="button" disabled={busy} onClick={() => void proceed()}>
            {busy ? "Saving…" : "Continue to checkout"}
          </button>
        </div>
      </dialog>
    </>
  );
}
