"use client";
import type { ReactNode } from "react";
import type { Item, PriceLine } from "@/modules/trips/domain/planner";
import type { Profile } from "@/modules/trips/domain/profile";
import { costByDay, unplannedDays } from "@/modules/trips/domain/checkout";
import { formatMoney } from "@/modules/catalogue/domain/experience-content";
import Icon from "./icons";
import rules from "../../tourism-v1-handoff/data/pricing.demo.json";

type Price = {
  lines: PriceLine[];
  activitiesMinor: number;
  transportMinor: number;
  hostingMinor: number;
  subtotalMinor: number;
  feeMinor: number;
  taxMinor: number;
  totalMinor: number;
  blockers: { message: string }[];
};

const money = (n: number) => formatMoney(n, n % 100 ? 2 : 0);
const groupIcon = { activities: "sparkle", transport: "car", hosting: "users" };
function shortDate(date: string) {
  return new Date(date + "T12:00:00Z").toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}
function lineLabel(label: string) {
  return label.replace(/\s*[—-]\s*DEMO\b/, "");
}

// The full, itemised trip cost: every priced line grouped under its day, then
// the category totals, service fee and tax.
export default function TripCost({
  profile,
  price,
  items,
  dirty = false,
  currentDay,
  onSelectDay,
  expanded = false,
  footer,
}: {
  profile: Pick<Profile, "startDate" | "endDate" | "adults">;
  price: Price | null;
  items: Item[];
  dirty?: boolean;
  currentDay?: string;
  onSelectDay?: (day: string) => void;
  expanded?: boolean;
  footer?: ReactNode;
}) {
  const days = costByDay(profile, price?.lines ?? [], items);
  const empty = unplannedDays(profile, items);
  const planned = days.length - empty.length;
  const total = price?.totalMinor ?? 0;
  return (
    <section className="trip-cost" aria-labelledby="trip-cost-title">
      <header className="trip-cost-head">
        <p className="eyebrow">Trip cost</p>
        <h2 id="trip-cost-title" aria-busy={dirty}>
          {money(total)}
          {dirty && <span className="trip-cost-updating"> updating…</span>}
        </h2>
        <p className="trip-cost-sub">
          {profile.adults > 1 && total > 0 && (
            <>≈ {money(Math.round(total / profile.adults))} per adult · </>
          )}
          {planned} of {days.length} days planned
        </p>
        <div
          className="trip-cost-progress"
          role="img"
          aria-label={`${planned} of ${days.length} days planned`}
        >
          {days.map(({ day }) => (
            <span key={day} data-planned={!empty.includes(day)} />
          ))}
        </div>
      </header>
      <div
        className="trip-cost-body"
        role="region"
        aria-label="Cost by day"
        tabIndex={0}
      >
        <ol className="trip-cost-days">
          {days.map(({ day, lines, totalMinor }, index) => {
            const free = empty.includes(day);
            const label = `Day ${index + 1} · ${shortDate(day)}`;
            return (
              <li key={day} data-current={day === currentDay}>
                <details open={expanded || day === currentDay}>
                  <summary>
                    <span className="trip-cost-day">
                      {onSelectDay ? (
                        <button
                          type="button"
                          className="text-button"
                          onClick={(event) => {
                            event.preventDefault();
                            onSelectDay(day);
                          }}
                        >
                          {label}
                        </button>
                      ) : (
                        label
                      )}
                    </span>
                    <span className="trip-cost-day-total">
                      {free ? "Free day" : money(totalMinor)}
                    </span>
                    <Icon name="chevronDown" size={14} />
                  </summary>
                  {lines.length ? (
                    <ul className="trip-cost-lines">
                      {lines.map((line) => (
                        <li key={line.key}>
                          <Icon
                            name={
                              groupIcon[line.group] as
                                "sparkle" | "car" | "users"
                            }
                            size={14}
                          />
                          <span className="trip-cost-line-label">
                            {line.time && <small>{line.time}</small>}
                            {lineLabel(line.label)}
                            {line.quantity > 1 && (
                              <small>
                                {line.quantity} × {money(line.unitRateMinor)}
                              </small>
                            )}
                          </span>
                          <span className="trip-cost-line-total">
                            {money(line.totalMinor)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="trip-cost-free">
                      {free
                        ? "Nothing planned yet. You can keep it free."
                        : "Personal time only. Nothing to pay."}
                    </p>
                  )}
                </details>
              </li>
            );
          })}
        </ol>
        <dl className="trip-cost-totals">
          <div>
            <dt>Activities</dt>
            <dd>{money(price?.activitiesMinor ?? 0)}</dd>
          </div>
          <div>
            <dt>Transport</dt>
            <dd>{money(price?.transportMinor ?? 0)}</dd>
          </div>
          <div>
            <dt>Guides & hosting</dt>
            <dd>{money(price?.hostingMinor ?? 0)}</dd>
          </div>
          <div className="trip-cost-subtotal">
            <dt>Subtotal</dt>
            <dd>{money(price?.subtotalMinor ?? 0)}</dd>
          </div>
          <div>
            <dt>Service fee ({rules.feeBps / 100}%)</dt>
            <dd>{money(price?.feeMinor ?? 0)}</dd>
          </div>
          <div>
            <dt>Tax</dt>
            <dd>{money(price?.taxMinor ?? 0)}</dd>
          </div>
          <div className="trip-cost-total">
            <dt>Total</dt>
            <dd>{money(total)}</dd>
          </div>
        </dl>
        <p className="trip-cost-note">
          <Icon name="info" size={14} />
          Fixed prices, worked out automatically as you plan. Nothing is
          reserved or charged until you pay.
        </p>
      </div>
      {footer && <footer className="trip-cost-foot">{footer}</footer>}
    </section>
  );
}
