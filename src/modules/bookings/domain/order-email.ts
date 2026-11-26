// The email a buyer gets once their payment is confirmed. Paying books a
// place; a partner-confirmed booking is only final once the partner says
// yes, so the email says which parts are confirmed and which are waiting.
import { formatMoney } from "@/modules/catalogue/domain/experience-content";
import { clockLabel, shortDay } from "@/modules/catalogue/domain/schedule";
import type { BookingView, OrderView } from "./checkout";
import type { PartnerBookingView } from "./partner-booking";
import { serviceStatusLabel, serviceTitles } from "./trip-checkout";

// Structurally the mailer port's EmailMessage; the domain doesn't import ports.
type Email = { to: string; subject: string; text: string; html: string };

const plural = (n: number, one: string, many: string) =>
  `${n} ${n === 1 ? one : many}`;

function guests(b: Pick<BookingView, "line">) {
  const line = b.line;
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

function bookingStatus(b: BookingView) {
  if (b.status === "CONFIRMED") return "Confirmed";
  if (b.status === "AWAITING_PARTNER")
    return b.partnerDeadline
      ? `Booked, waiting for ${b.terms.operator} to confirm by ${lagosTime(b.partnerDeadline)}. If they can’t, it’s refunded in full.`
      : `Booked, waiting for ${b.terms.operator} to confirm.`;
  return null;
}

const escape = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );

type Part = { title: string; lines: string[]; status: string | null };

export function orderPaidEmail(order: OrderView, link: string): Email {
  const waiting =
    order.bookings.some((b) => b.status === "AWAITING_PARTNER") ||
    order.services.some((s) => s.status === "REQUESTED");
  const subject = waiting
    ? `Booked: ${order.reference}, waiting for confirmation`
    : `You’re booked: ${order.reference}`;
  const intro = waiting
    ? "We’ve received your payment and booked your places. Some parts still need the partner to confirm; we’ll let you know. Your booking isn’t final until then."
    : "We’ve received your payment and your booking is confirmed.";
  const parts: Part[] = [
    ...order.bookings.map((b) => ({
      title: b.title,
      lines: [
        `${b.productType === "PACKAGE" ? "Departs " : ""}${shortDay(b.date)}${b.startTime ? ` · ${clockLabel(b.startTime)}` : ""} · ${guests(b)}`,
        `${b.terms.where} · run by ${b.terms.operator}`,
        `Paid ${formatMoney(b.totalMinor)} · Cancellation: ${b.terms.cancellation}`,
      ],
      status: bookingStatus(b),
    })),
    ...order.services.map((s) => ({
      title: serviceTitles[s.service],
      lines: [
        `${shortDay(s.date)} · ${s.label}`,
        `Paid ${formatMoney(s.totalMinor)}`,
      ],
      status:
        s.status === "REQUESTED"
          ? `We’ll send their name and phone by ${lagosTime(s.matchBy)}. If we can’t match you, it’s refunded in full.`
          : serviceStatusLabel(s.service, s.status),
    })),
  ];
  const door = order.bookings.some((b) => b.productType === "EXPERIENCE")
    ? "Show this email or the reference at the door."
    : "";

  const text = [
    `Hi ${order.contact.name},`,
    "",
    intro,
    "",
    `Reference: ${order.reference}`,
    "",
    ...parts.flatMap((p) => [
      p.title,
      ...p.lines.map((l) => `  ${l}`),
      ...(p.status ? [`  ${p.status}`] : []),
      "",
    ]),
    `Total paid: ${formatMoney(order.totalMinor)}`,
    "",
    `See your booking and its latest status: ${link}`,
    door,
    "",
    "Fastlife",
  ]
    .filter((l, i, all) => l !== "" || all[i - 1] !== "")
    .join("\n");

  const html = `<!doctype html>
<html><body style="margin:0;padding:24px;background:#f6f5f2;font-family:Arial,Helvetica,sans-serif;color:#1d1b2e">
<div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;padding:24px">
<p style="margin:0 0 4px;font-size:13px;color:#6b6880">Order ${escape(order.reference)}</p>
<h1 style="margin:0 0 12px;font-size:22px">${escape(waiting ? "Booked, waiting for confirmation" : "You’re booked")}</h1>
<p style="margin:0 0 16px">Hi ${escape(order.contact.name)}, ${escape(intro.charAt(0).toLowerCase() + intro.slice(1))}</p>
${parts
  .map(
    (
      p,
    ) => `<div style="border:1px solid #e4e2ec;border-radius:10px;padding:12px 14px;margin:0 0 10px">
<p style="margin:0 0 6px;font-weight:bold">${escape(p.title)}</p>
${p.lines.map((l) => `<p style="margin:0 0 4px;font-size:14px">${escape(l)}</p>`).join("\n")}
${p.status ? `<p style="margin:6px 0 0;font-size:14px;font-weight:bold">${escape(p.status)}</p>` : ""}
</div>`,
  )
  .join("\n")}
<p style="margin:16px 0;font-size:16px"><strong>Total paid: ${escape(formatMoney(order.totalMinor))}</strong></p>
<p style="margin:0 0 16px"><a href="${escape(link)}" style="display:inline-block;background:#3b2f8f;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:8px;font-weight:bold">See your booking</a></p>
${door ? `<p style="margin:0 0 8px;font-size:14px">${escape(door)}</p>` : ""}
<p style="margin:16px 0 0;font-size:13px;color:#6b6880">Fastlife</p>
</div></body></html>`;

  return { to: order.contact.email, subject, text, html };
}

// Sent when the partner confirms or declines (or doesn't answer in time).
export function bookingDecidedEmail(
  b: PartnerBookingView,
  link: string,
): Email {
  const confirmed = b.status === "CONFIRMED";
  const when = `${b.productType === "PACKAGE" ? "Departs " : ""}${shortDay(b.date)}${b.startTime ? ` · ${clockLabel(b.startTime)}` : ""} · ${guests(b)}`;
  const subject = confirmed
    ? `Confirmed: ${b.title} (${b.orderReference})`
    : `Not available: ${b.title} (${b.orderReference}), full refund`;
  const lines = confirmed
    ? [
        `Good news: ${b.businessName ?? "the partner"} has confirmed your booking. It’s final.`,
        b.productType === "EXPERIENCE"
          ? "Show this email or the reference at the door."
          : "",
      ]
    : [
        `Sorry, ${b.businessName ?? "the partner"} couldn’t take this booking.`,
        b.reason ? `Reason: ${b.reason}` : "",
        `You’ll get a full refund of ${formatMoney(b.totalMinor)} to the way you paid. We’ll let you know when it’s sent.`,
      ];
  const body = lines.filter(Boolean);
  const text = [
    `Hi ${b.guest.name},`,
    "",
    ...body,
    "",
    b.title,
    `  ${when}`,
    `  Reference: ${b.orderReference}`,
    "",
    `See your booking: ${link}`,
    "",
    "Fastlife",
  ].join("\n");
  const html = `<!doctype html>
<html><body style="margin:0;padding:24px;background:#f6f5f2;font-family:Arial,Helvetica,sans-serif;color:#1d1b2e">
<div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;padding:24px">
<p style="margin:0 0 4px;font-size:13px;color:#6b6880">Order ${escape(b.orderReference)}</p>
<h1 style="margin:0 0 12px;font-size:22px">${escape(confirmed ? "Your booking is confirmed" : "Your booking couldn’t be confirmed")}</h1>
<p style="margin:0 0 12px">Hi ${escape(b.guest.name)},</p>
${body.map((l) => `<p style="margin:0 0 10px">${escape(l)}</p>`).join("\n")}
<div style="border:1px solid #e4e2ec;border-radius:10px;padding:12px 14px;margin:12px 0">
<p style="margin:0 0 6px;font-weight:bold">${escape(b.title)}</p>
<p style="margin:0;font-size:14px">${escape(when)}</p>
</div>
<p style="margin:0 0 16px"><a href="${escape(link)}" style="display:inline-block;background:#3b2f8f;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:8px;font-weight:bold">See your booking</a></p>
<p style="margin:16px 0 0;font-size:13px;color:#6b6880">Fastlife</p>
</div></body></html>`;
  return { to: b.guest.email, subject, text, html };
}
