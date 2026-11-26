import {
  and,
  asc,
  desc,
  eq,
  gt,
  inArray,
  isNull,
  ne,
  or,
  sql,
} from "drizzle-orm";
import { randomUUID } from "node:crypto";
import type { Database } from "@/database/client";
import { audit } from "@/modules/audit/infrastructure/persistence/schema";
import type {
  CheckoutPayment,
  CheckoutRepository,
  NewCheckout,
  PaymentEvent,
  SettleRequest,
  SettleResult,
} from "../../application/ports/checkout-repository";
import {
  holdingBookingStatuses,
  type BookingStatus,
  type BookingView,
  type CheckoutStatus,
  type OrderView,
  type ServiceView,
  type Viewer,
} from "../../domain/checkout";
import { slotKey, type SlotRef } from "../../domain/resolve-line";
import type { ServiceLine, ServiceStatus } from "../../domain/trip-checkout";
import {
  accountCarts,
  bookingStatusHistory,
  bookings,
  checkoutLines,
  checkouts,
  inventorySlots,
  orders,
  paymentEvents,
  payments,
  serviceRequestHistory,
  serviceRequests,
} from "./schema";

type Runner = Pick<Database, "select">;
type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];

const openStatuses: CheckoutStatus[] = ["HELD", "PAYMENT_PENDING"];

// Thrown inside a transaction to roll it back with a result.
class Refused<T> {
  constructor(public result: T) {}
}

// Units taken per slot id: bookings that still hold places, plus lines of
// checkouts whose hold hasn't lapsed. A lapsed hold frees itself; no sweeper
// is needed.
async function takenBySlot(
  q: Runner,
  slotIds: string[],
  now: Date,
  excludeCheckoutId?: string,
) {
  const taken = new Map<string, number>();
  if (!slotIds.length) return taken;
  const booked = await q
    .select({
      slotId: bookings.slotId,
      units: sql<number>`sum(${bookings.units})::int`,
    })
    .from(bookings)
    .where(
      and(
        inArray(bookings.slotId, slotIds),
        inArray(bookings.status, holdingBookingStatuses),
      ),
    )
    .groupBy(bookings.slotId);
  const holding = await q
    .select({
      slotId: checkoutLines.slotId,
      units: sql<number>`sum(${checkoutLines.units})::int`,
    })
    .from(checkoutLines)
    .innerJoin(checkouts, eq(checkouts.id, checkoutLines.checkoutId))
    .where(
      and(
        inArray(checkoutLines.slotId, slotIds),
        inArray(checkouts.status, openStatuses),
        gt(checkouts.expiresAt, now),
        excludeCheckoutId ? ne(checkouts.id, excludeCheckoutId) : undefined,
      ),
    )
    .groupBy(checkoutLines.slotId);
  for (const row of [...booked, ...holding])
    if (row.slotId)
      taken.set(row.slotId, (taken.get(row.slotId) ?? 0) + Number(row.units));
  return taken;
}

// Locks slots in id order, so two checkouts sharing slots can't deadlock.
async function lockSlots(tx: Tx, ids: string[]) {
  if (!ids.length) return [];
  return tx
    .select()
    .from(inventorySlots)
    .where(inArray(inventorySlots.id, ids))
    .orderBy(asc(inventorySlots.id))
    .for("update");
}

export class DrizzleCheckoutRepository implements CheckoutRepository {
  constructor(private readonly db: () => Database) {}

  async remaining(slots: SlotRef[], now: Date) {
    const result = new Map<string, number>();
    if (!slots.length) return result;
    const rows = await this.db()
      .select({
        id: inventorySlots.id,
        productType: inventorySlots.productType,
        productId: inventorySlots.productId,
        localDate: inventorySlots.localDate,
        startTime: inventorySlots.startTime,
      })
      .from(inventorySlots)
      .where(
        or(
          ...slots.map((s) =>
            and(
              eq(inventorySlots.productType, s.productType),
              eq(inventorySlots.productId, s.productId),
              eq(inventorySlots.localDate, s.localDate),
              eq(inventorySlots.startTime, s.startTime),
            ),
          ),
        ),
      );
    const taken = await takenBySlot(
      this.db(),
      rows.map((r) => r.id),
      now,
    );
    const idByKey = new Map(
      rows.map((r) => [
        slotKey({ ...r, productType: r.productType as SlotRef["productType"] }),
        r.id,
      ]),
    );
    for (const s of slots) {
      const id = idByKey.get(slotKey(s));
      result.set(slotKey(s), s.capacity - (id ? (taken.get(id) ?? 0) : 0));
    }
    return result;
  }

  async hold(checkout: NewCheckout, now: Date) {
    try {
      return await this.db().transaction(async (tx) => {
        // Pressing Pay again replaces this traveller's earlier hold.
        await tx
          .update(checkouts)
          .set({ expiresAt: now, updatedAt: now })
          .where(
            and(
              checkout.userId
                ? eq(checkouts.userId, checkout.userId)
                : eq(checkouts.guestKeyHash, checkout.guestKeyHash ?? ""),
              inArray(checkouts.status, openStatuses),
              gt(checkouts.expiresAt, now),
            ),
          );
        // Service lines (a trip's cars and guides) take no places.
        const placed = checkout.lines.flatMap((l) =>
          l.slot ? [{ line: l.line, slot: l.slot }] : [],
        );
        const slotIds = new Map<string, string>();
        for (const { slot } of placed) {
          const key = slotKey(slot);
          if (slotIds.has(key)) continue;
          const [row] = await tx
            .insert(inventorySlots)
            .values({
              id: randomUUID(),
              productType: slot.productType,
              productId: slot.productId,
              partnerId: slot.partnerId,
              localDate: slot.localDate,
              startTime: slot.startTime,
              capacity: slot.capacity,
              capacityUnit: slot.capacityUnit,
            })
            .onConflictDoUpdate({
              target: [
                inventorySlots.productType,
                inventorySlots.productId,
                inventorySlots.localDate,
                inventorySlots.startTime,
              ],
              // Capacity follows the listing; places already sold stay sold.
              set: { capacity: slot.capacity, partnerId: slot.partnerId },
            })
            .returning();
          slotIds.set(key, row.id);
        }
        const locked = await lockSlots(tx, [...slotIds.values()]);
        const taken = await takenBySlot(
          tx,
          locked.map((s) => s.id),
          now,
        );
        const needed = new Map<string, number>();
        for (const { line, slot } of placed) {
          const id = slotIds.get(slotKey(slot))!;
          const want = (needed.get(id) ?? 0) + slot.units;
          needed.set(id, want);
          const left = slot.capacity - (taken.get(id) ?? 0);
          if (want > left)
            throw new Refused({
              held: false as const,
              cartLineId: line.id,
              remaining: Math.max(0, left - (want - slot.units)),
            });
        }
        await tx.insert(checkouts).values({
          id: checkout.id,
          userId: checkout.userId,
          guestKeyHash: checkout.guestKeyHash,
          status: "HELD",
          subtotalMinor: checkout.subtotalMinor,
          feeMinor: checkout.feeMinor,
          totalMinor: checkout.totalMinor,
          currency: checkout.currency,
          priceVersion: checkout.priceVersion,
          expiresAt: checkout.expiresAt,
          idempotencyKey: checkout.idempotencyKey,
          contactName: checkout.contact.name,
          contactEmail: checkout.contact.email,
          contactPhone: checkout.contact.phone,
          tripId: checkout.trip?.id ?? null,
          tripVersion: checkout.trip?.version ?? null,
        });
        await tx.insert(checkoutLines).values(
          checkout.lines.map((l, i) => ({
            id: randomUUID(),
            checkoutId: checkout.id,
            lineNo: i + 1,
            cartLineId: l.line.id,
            ...(l.slot
              ? {
                  productType: l.slot.productType,
                  productId: l.slot.productId,
                  partnerId: l.slot.partnerId,
                  slotId: slotIds.get(slotKey(l.slot))!,
                  localDate: l.slot.localDate,
                  startTime: l.slot.startTime,
                  units: l.slot.units,
                }
              : {
                  productType: "SERVICE",
                  productId: (l.line as ServiceLine).service,
                  partnerId: null,
                  slotId: null,
                  localDate: (l.line as ServiceLine).date,
                  startTime: (l.line as ServiceLine).startTime,
                  units: 1,
                }),
            title: l.title,
            cartLine: l.line,
            priceRows: l.rows,
            subtotalMinor: l.subtotalMinor,
            feeMinor: l.feeMinor,
            totalMinor: l.totalMinor,
            terms: l.terms,
          })),
        );
        return { held: true as const };
      });
    } catch (e) {
      if (e instanceof Refused) return e.result;
      throw e;
    }
  }

  private async withPayment(
    checkoutId: string,
    reference?: string,
  ): Promise<CheckoutPayment | null> {
    const [c] = await this.db()
      .select()
      .from(checkouts)
      .where(eq(checkouts.id, checkoutId));
    if (!c) return null;
    const [p] = await this.db()
      .select()
      .from(payments)
      .where(
        reference
          ? eq(payments.reference, reference)
          : eq(payments.checkoutId, checkoutId),
      )
      .orderBy(desc(payments.createdAt))
      .limit(1);
    const [o] = await this.db()
      .select({ reference: orders.reference })
      .from(orders)
      .where(eq(orders.checkoutId, checkoutId));
    return {
      checkout: {
        id: c.id,
        userId: c.userId,
        guestKeyHash: c.guestKeyHash,
        status: c.status as CheckoutStatus,
        totalMinor: c.totalMinor,
        currency: c.currency,
        expiresAt: c.expiresAt,
        contactEmail: c.contactEmail,
        reviewReason: c.reviewReason,
      },
      payment: p
        ? {
            reference: p.reference,
            provider: p.provider,
            status: p.status,
            amountMinor: p.amountMinor,
            currency: p.currency,
            authorizationUrl: p.authorizationUrl,
          }
        : null,
      orderReference: o?.reference ?? null,
    };
  }

  async findByIdempotencyKey(key: string) {
    const [c] = await this.db()
      .select({ id: checkouts.id })
      .from(checkouts)
      .where(eq(checkouts.idempotencyKey, key));
    return c ? this.withPayment(c.id) : null;
  }

  async findByPaymentReference(reference: string) {
    const [p] = await this.db()
      .select({ checkoutId: payments.checkoutId })
      .from(payments)
      .where(eq(payments.reference, reference));
    return p ? this.withPayment(p.checkoutId, reference) : null;
  }

  async attachPayment(
    checkoutId: string,
    payment: Parameters<CheckoutRepository["attachPayment"]>[1],
  ) {
    await this.db().transaction(async (tx) => {
      await tx.insert(payments).values({
        id: randomUUID(),
        checkoutId,
        ...payment,
        status: "INITIALISED",
      });
      await tx
        .update(checkouts)
        .set({
          status: "PAYMENT_PENDING",
          version: sql`${checkouts.version} + 1`,
          updatedAt: new Date(),
        })
        .where(and(eq(checkouts.id, checkoutId), eq(checkouts.status, "HELD")));
    });
  }

  async recordFailure(
    reference: string,
    status: "FAILED" | "ABANDONED" | "REVERSED",
    payload: unknown,
  ) {
    await this.db().transaction(async (tx) => {
      const [p] = await tx
        .update(payments)
        .set({
          status,
          providerPayload: payload,
          version: sql`${payments.version} + 1`,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(payments.reference, reference),
            eq(payments.status, "INITIALISED"),
          ),
        )
        .returning();
      if (!p) return;
      await tx
        .update(checkouts)
        .set({
          status: "FAILED",
          version: sql`${checkouts.version} + 1`,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(checkouts.id, p.checkoutId),
            inArray(checkouts.status, openStatuses),
          ),
        );
    });
  }

  async markReview(checkoutId: string, reason: string) {
    await this.db()
      .update(checkouts)
      .set({
        status: "REQUIRES_REVIEW",
        reviewReason: reason,
        version: sql`${checkouts.version} + 1`,
        updatedAt: new Date(),
      })
      .where(and(eq(checkouts.id, checkoutId), ne(checkouts.status, "PAID")));
  }

  async settle(req: SettleRequest): Promise<SettleResult> {
    return this.db().transaction(async (tx) => {
      const [payment] = await tx
        .select()
        .from(payments)
        .where(eq(payments.reference, req.reference))
        .for("update");
      if (!payment) throw new Error(`Unknown payment ${req.reference}`);
      const [checkout] = await tx
        .select()
        .from(checkouts)
        .where(eq(checkouts.id, payment.checkoutId))
        .for("update");
      if (checkout.status === "PAID") {
        const [order] = await tx
          .select({ reference: orders.reference })
          .from(orders)
          .where(eq(orders.checkoutId, checkout.id));
        return {
          status: "PAID",
          orderReference: order.reference,
          created: false,
        };
      }
      const paymentSucceeded = {
        status: "SUCCESS",
        channel: req.channel,
        paidAt: req.paidAt,
        providerPayload: req.payload,
        version: sql`${payments.version} + 1`,
        updatedAt: req.now,
      };
      const lines = await tx
        .select()
        .from(checkoutLines)
        .where(eq(checkoutLines.checkoutId, checkout.id))
        .orderBy(asc(checkoutLines.lineNo));
      // Lines that hold places become bookings; a trip's cars and guides
      // become service requests.
      const placed = lines.flatMap((l) =>
        l.slotId ? [{ ...l, slotId: l.slotId }] : [],
      );
      const services = lines.filter((l) => !l.slotId);

      const holdValid =
        openStatuses.includes(checkout.status as CheckoutStatus) &&
        checkout.expiresAt > req.now;
      if (!holdValid) {
        // Paid after the hold lapsed: take the places again if still free.
        const slotIds = [...new Set(placed.map((l) => l.slotId))];
        const locked = await lockSlots(tx, slotIds);
        const taken = await takenBySlot(tx, slotIds, req.now, checkout.id);
        const lost = locked.some(
          (s) =>
            placed
              .filter((l) => l.slotId === s.id)
              .reduce((n, l) => n + l.units, 0) >
            s.capacity - (taken.get(s.id) ?? 0),
        );
        if (lost) {
          await tx
            .update(payments)
            .set(paymentSucceeded)
            .where(eq(payments.id, payment.id));
          await tx
            .update(checkouts)
            .set({
              status: "REQUIRES_REVIEW",
              reviewReason: "CAPACITY_LOST",
              version: sql`${checkouts.version} + 1`,
              updatedAt: req.now,
            })
            .where(eq(checkouts.id, checkout.id));
          await tx.insert(audit).values({
            id: randomUUID(),
            actorId: "SYSTEM",
            action: "CHECKOUT_REQUIRES_REVIEW",
            entityId: checkout.id,
            details: {
              reason: "CAPACITY_LOST",
              paymentReference: req.reference,
            },
          });
          return { status: "REQUIRES_REVIEW", reason: "CAPACITY_LOST" };
        }
      }

      let reference = req.orderReference();
      for (let i = 0; i < 5; i++) {
        const [clash] = await tx
          .select({ id: orders.id })
          .from(orders)
          .where(eq(orders.reference, reference));
        if (!clash) break;
        reference = req.orderReference();
      }
      const orderId = randomUUID();
      await tx.insert(orders).values({
        id: orderId,
        checkoutId: checkout.id,
        userId: checkout.userId,
        reference,
        totalMinor: checkout.totalMinor,
        tripId: checkout.tripId,
      });
      const plan = req.plan(
        placed.map((l) => ({
          id: l.id,
          cartLineId: l.cartLineId,
          partnerId: l.partnerId,
          terms: l.terms,
        })),
      );
      const created = placed.map((l) => {
        const p = plan.find((x) => x.checkoutLineId === l.id)!;
        return {
          id: randomUUID(),
          orderId,
          checkoutLineId: l.id,
          userId: checkout.userId,
          slotId: l.slotId,
          productType: l.productType,
          productId: l.productId,
          localDate: l.localDate,
          startTime: l.startTime,
          units: l.units,
          partnerId: l.partnerId,
          commissionBps: p.commissionBps,
          status: p.status,
          partnerDeadline: p.partnerDeadline,
          totalMinor: l.totalMinor,
          feeMinor: l.feeMinor,
        };
      });
      if (created.length) {
        await tx.insert(bookings).values(created);
        await tx.insert(bookingStatusHistory).values(
          created.map((b) => ({
            id: randomUUID(),
            bookingId: b.id,
            fromStatus: null,
            toStatus: b.status,
            actorType: "SYSTEM",
            actorId: "payments",
            reason: `Paid with ${req.reference}`,
          })),
        );
      }
      // Cars and guides only come with a planned trip, which needs an
      // account; a guest checkout never has them.
      const accountId = checkout.userId;
      if (services.length && !accountId)
        throw new Error(`Guest checkout ${checkout.id} has trip services`);
      const requested = !accountId
        ? []
        : services.map((l) => {
            const line = l.cartLine as ServiceLine;
            return {
              id: randomUUID(),
              orderId,
              checkoutLineId: l.id,
              userId: accountId,
              tripId: checkout.tripId,
              service: line.service,
              localDate: line.date,
              startTime: line.startTime,
              status: "REQUESTED",
              matchBy: new Date(line.matchBy),
              totalMinor: l.totalMinor,
              feeMinor: l.feeMinor,
            };
          });
      if (requested.length) {
        await tx.insert(serviceRequests).values(requested);
        await tx.insert(serviceRequestHistory).values(
          requested.map((r) => ({
            id: randomUUID(),
            serviceRequestId: r.id,
            fromStatus: null,
            toStatus: r.status,
            actorType: "SYSTEM",
            actorId: "payments",
            note: `Paid with ${req.reference}`,
          })),
        );
      }
      await tx
        .update(payments)
        .set(paymentSucceeded)
        .where(eq(payments.id, payment.id));
      await tx
        .update(checkouts)
        .set({
          status: "PAID",
          version: sql`${checkouts.version} + 1`,
          updatedAt: req.now,
        })
        .where(eq(checkouts.id, checkout.id));
      // The paid lines leave the saved cart; anything else stays. A guest's
      // cart lives only in their browser, which clears it on the order page.
      const [cart] = checkout.userId
        ? await tx
            .select()
            .from(accountCarts)
            .where(eq(accountCarts.userId, checkout.userId))
            .for("update")
        : [];
      const paidIds = new Set(lines.map((l) => l.cartLineId));
      if (cart && cart.lines.some((l) => paidIds.has(l.id)))
        await tx
          .update(accountCarts)
          .set({
            lines: cart.lines.filter((l) => !paidIds.has(l.id)),
            version: sql`${accountCarts.version} + 1`,
            updatedAt: req.now,
          })
          .where(eq(accountCarts.userId, cart.userId));
      await tx.insert(audit).values({
        id: randomUUID(),
        actorId: checkout.userId ?? "GUEST",
        action: "ORDER_PAID",
        entityId: orderId,
        details: {
          reference,
          checkoutId: checkout.id,
          paymentReference: req.reference,
          totalMinor: checkout.totalMinor,
          bookings: created.map((b) => ({ id: b.id, status: b.status })),
          services: requested.map((r) => ({ id: r.id, service: r.service })),
        },
      });
      return { status: "PAID", orderReference: reference, created: true };
    });
  }

  async recordEvent(event: PaymentEvent) {
    const [row] = await this.db()
      .insert(paymentEvents)
      .values({ id: randomUUID(), ...event })
      .onConflictDoNothing({ target: paymentEvents.payloadSha256 })
      .returning();
    if (row) return row.id;
    // Seen before: handle it again only if it never finished.
    const [unfinished] = await this.db()
      .select({ id: paymentEvents.id })
      .from(paymentEvents)
      .where(
        and(
          eq(paymentEvents.payloadSha256, event.payloadSha256),
          isNull(paymentEvents.processedAt),
        ),
      );
    return unfinished?.id ?? null;
  }

  async finishEvent(id: string, error: string | null) {
    await this.db()
      .update(paymentEvents)
      .set(error ? { error } : { processedAt: new Date(), error: null })
      .where(eq(paymentEvents.id, id));
  }

  private async orderViews(
    where: ReturnType<typeof and>,
    limit: number,
  ): Promise<OrderView[]> {
    const rows = await this.db()
      .select({
        id: orders.id,
        reference: orders.reference,
        createdAt: orders.createdAt,
        totalMinor: orders.totalMinor,
        tripId: orders.tripId,
        name: checkouts.contactName,
        email: checkouts.contactEmail,
        phone: checkouts.contactPhone,
      })
      .from(orders)
      .innerJoin(checkouts, eq(checkouts.id, orders.checkoutId))
      .where(where)
      .orderBy(desc(orders.createdAt))
      .limit(limit);
    if (!rows.length) return [];
    const items = await this.db()
      .select({ booking: bookings, line: checkoutLines })
      .from(bookings)
      .innerJoin(checkoutLines, eq(checkoutLines.id, bookings.checkoutLineId))
      .where(
        inArray(
          bookings.orderId,
          rows.map((r) => r.id),
        ),
      )
      .orderBy(asc(checkoutLines.lineNo));
    const requests = await this.db()
      .select({ request: serviceRequests, line: checkoutLines })
      .from(serviceRequests)
      .innerJoin(
        checkoutLines,
        eq(checkoutLines.id, serviceRequests.checkoutLineId),
      )
      .where(
        inArray(
          serviceRequests.orderId,
          rows.map((r) => r.id),
        ),
      )
      .orderBy(asc(checkoutLines.lineNo));
    return rows.map((o) => ({
      reference: o.reference,
      tripId: o.tripId,
      createdAt: o.createdAt.toISOString(),
      totalMinor: o.totalMinor,
      contact: { name: o.name, email: o.email, phone: o.phone },
      bookings: items
        .filter((i) => i.booking.orderId === o.id)
        .map(({ booking: b, line: l }): BookingView => ({
          id: b.id,
          cartLineId: l.cartLineId,
          title: l.title,
          productType: b.productType as BookingView["productType"],
          date: b.localDate,
          startTime: l.cartLine.kind === "EXPERIENCE" ? l.cartLine.time : "",
          status: b.status as BookingStatus,
          partnerDeadline: b.partnerDeadline?.toISOString() ?? null,
          totalMinor: b.totalMinor,
          feeMinor: b.feeMinor,
          rows: l.priceRows,
          terms: l.terms,
          line: l.cartLine as BookingView["line"],
        })),
      services: requests
        .filter((i) => i.request.orderId === o.id)
        .map(({ request: q, line: l }): ServiceView => ({
          id: q.id,
          service: q.service as ServiceView["service"],
          date: q.localDate,
          startTime: q.startTime,
          label: (l.cartLine as ServiceLine).label,
          status: q.status as ServiceStatus,
          matchBy: q.matchBy.toISOString(),
          assignee: q.assignee,
          totalMinor: q.totalMinor,
          feeMinor: q.feeMinor,
          rows: l.priceRows,
        })),
    }));
  }

  // Same rule as canView(): account orders by account, guest orders by the
  // browser's key hash.
  private ownedBy(viewer: Viewer) {
    const conditions = [
      viewer.userId ? eq(orders.userId, viewer.userId) : undefined,
      viewer.guestKeyHash
        ? and(
            isNull(orders.userId),
            eq(checkouts.guestKeyHash, viewer.guestKeyHash),
          )
        : undefined,
    ].filter((c) => c !== undefined);
    return conditions.length ? or(...conditions) : sql`false`;
  }

  listOrders(viewer: Viewer) {
    return this.orderViews(and(this.ownedBy(viewer)), 50);
  }

  async findOrder(viewer: Viewer, reference: string) {
    const [order] = await this.orderViews(
      and(this.ownedBy(viewer), eq(orders.reference, reference)),
      1,
    );
    return order ?? null;
  }

  async findOrderByReference(reference: string) {
    const [order] = await this.orderViews(eq(orders.reference, reference), 1);
    return order ?? null;
  }
}
