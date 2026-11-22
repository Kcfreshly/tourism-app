"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useBackdropDismiss } from "@/hooks/use-backdrop-dismiss";
import { shortDay } from "@/modules/catalogue/domain/schedule";
import { authClient } from "./auth-client";
import Icon from "./icons";

type Plan = {
  id: string;
  profile: { draftName?: string; startDate: string; endDate: string };
};

// Add to trip puts an activity into one of the traveller's plans. It opens
// that plan's planner on a day, where the time is chosen; nothing is bought.
export default function AddToTrip({
  offerId,
  title,
  date,
  className = "secondary",
  onLeave,
}: {
  offerId: string;
  title: string;
  // A date already chosen in the booking panel, used when it fits the plan.
  date?: string;
  className?: string;
  // Closes whatever this was opened from (the experience overlay) before
  // going to the planner, since that overlay outlives navigation.
  onLeave?: () => void;
}) {
  const router = useRouter();
  const { data: session } = authClient.useSession();
  const dialog = useRef<HTMLDialogElement>(null);
  const dismiss = useBackdropDismiss(dialog);
  const [plans, setPlans] = useState<Plan[] | null>(null);
  const [status, setStatus] = useState("");
  async function open() {
    if (!session) {
      router.push(
        `/account?next=${encodeURIComponent(window.location.pathname)}`,
      );
      return;
    }
    dialog.current?.showModal();
    setStatus("Loading your plans…");
    try {
      const response = await fetch("/api/v1/trips");
      const body = await response.json();
      if (!response.ok) throw Error(body.error?.message);
      setPlans(body.data);
      setStatus("");
    } catch (e) {
      setPlans([]);
      setStatus(
        e instanceof Error && e.message
          ? e.message
          : "We couldn’t load your plans. Please retry.",
      );
    }
  }
  function choose(plan: Plan) {
    const query = new URLSearchParams({ add: offerId });
    if (date && date >= plan.profile.startDate && date <= plan.profile.endDate)
      query.set("day", date);
    dialog.current?.close();
    onLeave?.();
    router.push(`/trips/${encodeURIComponent(plan.id)}/plan?${query}`);
  }
  return (
    <>
      <button type="button" className={className} onClick={open}>
        <Icon name="calendar" size={16} />
        Add to trip
      </button>
      <dialog
        ref={dialog}
        className="sheet-dialog add-to-trip-dialog"
        aria-labelledby="add-to-trip-title"
        {...dismiss}
      >
        <div className="sheet-header">
          <div>
            <p className="eyebrow">Add to trip</p>
            <h2 id="add-to-trip-title">Which plan is {title} for?</h2>
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
          <p className="muted">
            You’ll choose the day and time in the planner. Adding to a plan
            doesn’t book or pay for anything.
          </p>
          {status && <p role="status">{status}</p>}
          {plans && (
            <ul className="plan-choices">
              {plans.map((plan) => (
                <li key={plan.id}>
                  <button
                    type="button"
                    className="plan-choice"
                    onClick={() => choose(plan)}
                  >
                    <strong>{plan.profile.draftName || "Untitled plan"}</strong>
                    <span>
                      {shortDay(plan.profile.startDate)} –{" "}
                      {shortDay(plan.profile.endDate)}
                    </span>
                    <Icon name="arrowRight" size={16} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="sheet-footer">
          <Link
            className="button secondary"
            href={`/plan/new?mode=form&offer=${encodeURIComponent(offerId)}&fresh=1`}
            onClick={() => {
              dialog.current?.close();
              onLeave?.();
            }}
          >
            <Icon name="plus" size={16} />
            Start a new plan
          </Link>
        </div>
      </dialog>
    </>
  );
}
