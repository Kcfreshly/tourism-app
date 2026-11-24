import Link from "next/link";
import type { CartLine } from "@/modules/bookings/domain/cart";
import {
  bookingStatusLabels,
  type BookingStatus,
  type OrderView,
  type ServiceView,
} from "@/modules/bookings/domain/checkout";
import { formatMoney } from "@/modules/catalogue/domain/experience-content";
import { clockLabel, shortDay } from "@/modules/catalogue/domain/schedule";
import {
  serviceStatusLabel,
  serviceTitles,
} from "@/modules/bookings/domain/trip-checkout";
import { assigneeLines } from "@/modules/bookings/domain/service-request";
import Icon from "./icons";

const plural = (n: number, one: string, many: string) =>
  `${n} ${n === 1 ? one : many}`;

function guests(line: CartLine) {
  if (line.kind === "PACKAGE")
    return plural(line.travellers, "traveller", "travellers");
  return [
    plural(line.adults, "adult", "adults"),
    line.children ? plural(line.children, "child", "children") : "",
  ]
    .filter(Boolean)
    .join(", ");
}

const lagosTime = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Africa/Lagos",
  });

function StatusChip({ status }: { status: BookingStatus }) {
  const tone =
    status === "CONFIRMED" || status === "COMPLETED"
      ? "ok"
      : status === "AWAITING_PARTNER"
        ? "wait"
        : undefined;
  return (
    <span className="status-chip" data-tone={tone}>
      <Icon
        name={tone === "ok" ? "check" : tone === "wait" ? "clock" : "info"}
        size={14}
      />
      {bookingStatusLabels[status]}
    </span>
  );
}

function ServiceChip({ s }: { s: ServiceView }) {
  const tone =
    s.status === "MATCHED" || s.status === "COMPLETED"
      ? "ok"
      : s.status === "REQUESTED"
        ? "wait"
        : undefined;
  return (
    <span className="status-chip" data-tone={tone}>
      <Icon
        name={tone === "ok" ? "check" : tone === "wait" ? "clock" : "info"}
        size={14}
      />
      {serviceStatusLabel(s.service, s.status)}
    </span>
  );
}

// The traveller's paid orders, newest first.
export function OrderList({ orders }: { orders: OrderView[] }) {
  if (!orders.length)
    return (
      <div className="empty-state">
        <Icon name="calendar" size={28} />
        <h2>No bookings yet</h2>
        <p>Activities and trips you pay for appear here, with their status.</p>
        <div className="actions">
          <Link className="button" href="/explore">
            Find things to do
          </Link>
          <Link className="button secondary" href="/cart">
            Go to cart
          </Link>
        </div>
      </div>
    );
  return (
    <ol className="order-list">
      {orders.map((o) => (
        <li key={o.reference} className="order-card card">
          <div className="order-card-head">
            <h2>
              <Link href={`/bookings/${o.reference}`}>{o.reference}</Link>
            </h2>
            <span className="muted">
              Paid {lagosTime(o.createdAt)} · {formatMoney(o.totalMinor)}
            </span>
          </div>
          <ul className="order-card-bookings">
            {o.bookings.map((b) => (
              <li key={b.id}>
                <span>
                  <strong>{b.title}</strong>
                  <small>
                    {shortDay(b.date)}
                    {b.startTime && ` · ${clockLabel(b.startTime)}`}
                  </small>
                </span>
                <StatusChip status={b.status} />
              </li>
            ))}
            {o.services.map((sv) => (
              <li key={sv.id}>
                <span>
                  <strong>{serviceTitles[sv.service]}</strong>
                  <small>
                    {shortDay(sv.date)} · {clockLabel(sv.startTime)}
                  </small>
                </span>
                <ServiceChip s={sv} />
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ol>
  );
}

// One order: each booking with its status, what happens next and its terms.
export function OrderDetail({ order }: { order: OrderView }) {
  return (
    <div className="checkout-layout">
      <ol className="checkout-lines checkout-main">
        {order.bookings.map((b, i) => (
          <li key={b.id} className="checkout-line card">
            <div className="checkout-line-head">
              <span className="checkout-line-number">Booking {i + 1}</span>
              <StatusChip status={b.status} />
            </div>
            <h3>{b.title}</h3>
            <p className="cart-line-when">
              <Icon name="calendar" size={14} />
              {b.productType === "PACKAGE" ? "Departs " : ""}
              {shortDay(b.date)}
              {b.startTime && ` · ${clockLabel(b.startTime)}`} ·{" "}
              {guests(b.line)}
            </p>
            <p className="cart-line-where">
              <Icon name="pin" size={14} />
              {b.terms.where} · run by {b.terms.operator}
            </p>
            {b.status === "AWAITING_PARTNER" && b.partnerDeadline && (
              <p className="checkout-line-after">
                <strong>Next:</strong> {b.terms.operator} confirms by{" "}
                {lagosTime(b.partnerDeadline)}. If they can’t, this booking is
                refunded in full.
              </p>
            )}
            <dl className="booking-rows">
              {b.rows.map((row) => (
                <div key={row.label}>
                  <dt>{row.label}</dt>
                  <dd>{formatMoney(row.totalMinor)}</dd>
                </div>
              ))}
              <div>
                <dt>Service fee</dt>
                <dd>{formatMoney(b.feeMinor)}</dd>
              </div>
              <div className="booking-rows-total">
                <dt>Paid for this booking</dt>
                <dd>{formatMoney(b.totalMinor)}</dd>
              </div>
            </dl>
            <p className="checkout-line-terms">
              <strong>Cancellation:</strong> {b.terms.cancellation}
            </p>
          </li>
        ))}
        {order.services.map((sv) => (
          <li key={sv.id} className="checkout-line card">
            <div className="checkout-line-head">
              <span className="checkout-line-number">
                {sv.service.endsWith("GUIDE") ? "Guide" : "Transport"}
              </span>
              <ServiceChip s={sv} />
            </div>
            <h3>{serviceTitles[sv.service]}</h3>
            <p className="cart-line-when">
              <Icon name="calendar" size={14} />
              {shortDay(sv.date)} · {sv.label}
            </p>
            {sv.status === "REQUESTED" && (
              <p className="checkout-line-after">
                <strong>Next:</strong> we match you and send their name and
                phone by {lagosTime(sv.matchBy)}. If we can’t, this part is
                refunded in full.
              </p>
            )}
            {sv.status === "UNMATCHED" && (
              <p className="checkout-line-after">
                <strong>Sorry:</strong> we couldn’t find someone in time. This
                part is refunded in full; our team will contact you.
              </p>
            )}
            {sv.assignee && sv.status !== "UNMATCHED" && (
              <dl className="booking-rows service-assignee">
                {assigneeLines(sv.service, sv.assignee).map(([k, v]) => (
                  <div key={k}>
                    <dt>{k}</dt>
                    <dd>{v}</dd>
                  </div>
                ))}
              </dl>
            )}
            <dl className="booking-rows">
              {sv.rows.map((row) => (
                <div key={row.label}>
                  <dt>{row.label}</dt>
                  <dd>{formatMoney(row.totalMinor)}</dd>
                </div>
              ))}
              <div>
                <dt>Service fee</dt>
                <dd>{formatMoney(sv.feeMinor)}</dd>
              </div>
              <div className="booking-rows-total">
                <dt>Paid for this</dt>
                <dd>{formatMoney(sv.totalMinor)}</dd>
              </div>
            </dl>
          </li>
        ))}
      </ol>
      <aside className="checkout-pay order-summary">
        <h2>Order {order.reference}</h2>
        <dl className="cart-totals">
          <div>
            <dt>Paid</dt>
            <dd>{lagosTime(order.createdAt)}</dd>
          </div>
          <div className="cart-totals-total">
            <dt>Total</dt>
            <dd>{formatMoney(order.totalMinor)}</dd>
          </div>
        </dl>
        <p className="muted">
          Lead guest: {order.contact.name}, {order.contact.phone}. Receipt:{" "}
          {order.contact.email}.
        </p>
        <Link className="text-link" href="/bookings">
          <Icon name="arrowLeft" size={16} />
          All bookings
        </Link>
      </aside>
    </div>
  );
}
