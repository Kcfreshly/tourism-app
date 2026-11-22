import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import type { Database } from "@/database/client";
import { audit } from "@/modules/audit/infrastructure/persistence/schema";
import type {
  AuditEntry,
  PartnerRepository,
  SubmissionChange,
} from "../../application/ports/partner-repository";
import {
  openSubmissionStatuses,
  type Partner,
  type PartnerApplication,
  type Submission,
  type SubmissionStatus,
} from "../../domain/partner";
import { listingSubmissions, partnerMembers, partners } from "./schema";

type PartnerRow = typeof partners.$inferSelect;
type SubmissionRow = typeof listingSubmissions.$inferSelect;

function toPartner(row: PartnerRow): Partner {
  return {
    id: row.id,
    businessName: row.businessName,
    contactEmail: row.contactEmail,
    phone: row.phone,
    offering: row.offering,
    status: row.status as Partner["status"],
    decisionReason: row.decisionReason,
    version: row.version,
    createdAt: row.createdAt,
  };
}

function toSubmission(row: SubmissionRow): Submission {
  return {
    id: row.id,
    partnerId: row.partnerId,
    productType: row.productType as Submission["productType"],
    productId: row.productId,
    baseVersion: row.baseVersion,
    name: row.name,
    proposed: row.proposed,
    status: row.status as SubmissionStatus,
    reason: row.reason,
    version: row.version,
    submittedAt: row.submittedAt,
    updatedAt: row.updatedAt,
  };
}

export class DrizzlePartnerRepository implements PartnerRepository {
  constructor(private readonly db: () => Database) {}

  async forUser(userId: string) {
    const [row] = await this.db()
      .select({ partner: partners, role: partnerMembers.role })
      .from(partnerMembers)
      .innerJoin(partners, eq(partners.id, partnerMembers.partnerId))
      .where(eq(partnerMembers.userId, userId));
    return row
      ? {
          ...toPartner(row.partner),
          memberRole: row.role as "OWNER" | "STAFF",
        }
      : null;
  }

  async find(id: string) {
    const [row] = await this.db()
      .select()
      .from(partners)
      .where(eq(partners.id, id));
    return row ? toPartner(row) : null;
  }

  async list() {
    const rows = await this.db()
      .select()
      .from(partners)
      .orderBy(desc(partners.createdAt));
    return rows.map(toPartner);
  }

  apply(input: {
    id: string;
    userId: string;
    application: PartnerApplication;
  }) {
    return this.db().transaction(async (tx) => {
      const [row] = await tx
        .insert(partners)
        .values({ id: input.id, ...input.application, status: "PENDING" })
        .returning();
      await tx.insert(partnerMembers).values({
        partnerId: input.id,
        userId: input.userId,
        role: "OWNER",
      });
      await tx.insert(audit).values({
        id: randomUUID(),
        actorId: input.userId,
        action: "PARTNER_APPLIED",
        entityId: input.id,
        details: { businessName: input.application.businessName },
      });
      return toPartner(row);
    });
  }

  updatePartner(
    input: { id: string; expectedVersion: number; actorId: string },
    change: Parameters<PartnerRepository["updatePartner"]>[1],
  ) {
    const { audit: entry, decidedBy, ...fields } = change;
    return this.db().transaction(async (tx) => {
      const [row] = await tx
        .update(partners)
        .set({
          ...fields,
          ...(decidedBy ? { decidedBy, decidedAt: new Date() } : {}),
          version: input.expectedVersion + 1,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(partners.id, input.id),
            eq(partners.version, input.expectedVersion),
          ),
        )
        .returning();
      if (!row) return null;
      await tx.insert(audit).values({
        id: randomUUID(),
        actorId: input.actorId,
        action: entry.action,
        entityId: input.id,
        details: entry.details,
      });
      return toPartner(row);
    });
  }

  createSubmission(
    row: Parameters<PartnerRepository["createSubmission"]>[0],
    entry: AuditEntry,
  ) {
    return this.db().transaction(async (tx) => {
      const [created] = await tx
        .insert(listingSubmissions)
        .values({ ...row, status: "DRAFT" })
        .returning();
      await tx.insert(audit).values({
        id: randomUUID(),
        actorId: entry.actorId,
        action: entry.action,
        entityId: row.id,
        details: { ...entry.details, partnerId: row.partnerId },
      });
      return toSubmission(created);
    });
  }

  async findSubmission(id: string) {
    const [row] = await this.db()
      .select()
      .from(listingSubmissions)
      .where(eq(listingSubmissions.id, id));
    return row ? toSubmission(row) : null;
  }

  async openSubmissionFor(productId: string) {
    const [row] = await this.db()
      .select()
      .from(listingSubmissions)
      .where(
        and(
          eq(listingSubmissions.productId, productId),
          inArray(listingSubmissions.status, openSubmissionStatuses),
        ),
      );
    return row ? toSubmission(row) : null;
  }

  async submissionsFor(partnerId: string) {
    const rows = await this.db()
      .select()
      .from(listingSubmissions)
      .where(eq(listingSubmissions.partnerId, partnerId))
      .orderBy(desc(listingSubmissions.updatedAt));
    return rows.map(toSubmission);
  }

  async submissionsWithStatus(status: SubmissionStatus) {
    const rows = await this.db()
      .select({
        submission: listingSubmissions,
        businessName: partners.businessName,
      })
      .from(listingSubmissions)
      .innerJoin(partners, eq(partners.id, listingSubmissions.partnerId))
      .where(eq(listingSubmissions.status, status))
      .orderBy(asc(listingSubmissions.submittedAt));
    return rows.map((r) => ({
      ...toSubmission(r.submission),
      businessName: r.businessName,
    }));
  }

  updateSubmission(
    input: { id: string; expectedVersion: number; actorId: string },
    change: SubmissionChange,
  ) {
    const { audit: entry, decidedBy, ...fields } = change;
    return this.db().transaction(async (tx) => {
      const [row] = await tx
        .update(listingSubmissions)
        .set({
          ...fields,
          ...(decidedBy ? { decidedBy, decidedAt: new Date() } : {}),
          version: input.expectedVersion + 1,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(listingSubmissions.id, input.id),
            eq(listingSubmissions.version, input.expectedVersion),
          ),
        )
        .returning();
      if (!row) return null;
      await tx.insert(audit).values({
        id: randomUUID(),
        actorId: input.actorId,
        action: entry.action,
        entityId: input.id,
        // The whole submission as it now stands, like catalogue snapshots.
        details: {
          ...entry.details,
          partnerId: row.partnerId,
          snapshot: toSubmission(row),
        },
      });
      return toSubmission(row);
    });
  }
}
