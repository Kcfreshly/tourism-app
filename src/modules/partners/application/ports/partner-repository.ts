import type {
  Partner,
  PartnerApplication,
  PartnerInvite,
  ProductType,
  Submission,
  SubmissionStatus,
} from "../../domain/partner";

export type AuditEntry = {
  actorId: string;
  action: string;
  details: Record<string, unknown>;
};

export type PartnerMembership = Partner & { memberRole: "OWNER" | "STAFF" };

export type SubmissionChange = Partial<
  Pick<
    Submission,
    "name" | "proposed" | "status" | "reason" | "productId" | "submittedAt"
  >
> & { decidedBy?: string; audit: Omit<AuditEntry, "actorId"> };

export type QueuedSubmission = Submission & { businessName: string };

// Partners, their members and their submissions. Every write records an
// audit event in the same transaction.
export interface PartnerRepository {
  forUser(userId: string): Promise<PartnerMembership | null>;
  find(id: string): Promise<Partner | null>;
  list(): Promise<Partner[]>;
  // A first application creates the partner with the account as owner.
  apply(input: {
    id: string;
    userId: string;
    application: PartnerApplication;
  }): Promise<Partner>;
  // Writes when `expectedVersion` still matches; null otherwise.
  updatePartner(
    input: { id: string; expectedVersion: number; actorId: string },
    change: Partial<
      Pick<
        Partner,
        | "status"
        | "decisionReason"
        | "businessName"
        | "contactEmail"
        | "phone"
        | "offering"
      >
    > & { decidedBy?: string; audit: Omit<AuditEntry, "actorId"> },
  ): Promise<Partner | null>;

  // Invites: the link token is stored only as its hash.
  createInvite(
    invite: PartnerApplication & {
      id: string;
      tokenHash: string;
      expiresAt: Date;
    },
    entry: AuditEntry,
  ): Promise<PartnerInvite>;
  listInvites(): Promise<PartnerInvite[]>;
  findInvite(tokenHash: string): Promise<PartnerInvite | null>;
  // Cancels an open invite; null when it was already used or cancelled.
  revokeInvite(id: string, actorId: string): Promise<PartnerInvite | null>;
  // In one transaction: claims the invite if it is still open, then creates a
  // verified partner owned by the account, or verifies the account's own
  // pending or declined application with the invite's details. Null when the
  // invite was used, cancelled or expired meanwhile.
  acceptInvite(input: {
    tokenHash: string;
    userId: string;
    partnerId: string;
    existing: { id: string; version: number } | null;
    now: Date;
  }): Promise<Partner | null>;

  createSubmission(
    row: Omit<
      Submission,
      "version" | "submittedAt" | "updatedAt" | "reason" | "status"
    > & { createdBy: string },
    entry: AuditEntry,
  ): Promise<Submission>;
  findSubmission(id: string): Promise<Submission | null>;
  // The open (draft, in review or declined) submission for a live listing.
  openSubmissionFor(productId: string): Promise<Submission | null>;
  submissionsFor(partnerId: string): Promise<Submission[]>;
  submissionsWithStatus(status: SubmissionStatus): Promise<QueuedSubmission[]>;
  // Writes when `expectedVersion` still matches; null otherwise.
  updateSubmission(
    input: { id: string; expectedVersion: number; actorId: string },
    change: SubmissionChange,
  ): Promise<Submission | null>;
}

export type VisitTotals = {
  productType: ProductType;
  productId: string;
  views: number;
  visitors: number;
};

// Listing views for partner dashboards, and the interest signals other
// modules hold (saved activities, trip plans).
export interface ListingStatsRepository {
  recordVisit(input: {
    productType: ProductType;
    productId: string;
    day: string;
    visitor: string;
  }): Promise<void>;
  visits(
    products: { productType: ProductType; productId: string }[],
    from: string,
    to: string,
  ): Promise<{
    perProduct: VisitTotals[];
    visitors: number;
    daily: { day: string; views: number }[];
  }>;
  // How many accounts saved each offer, and how many trip plans include it.
  saves(offerIds: string[]): Promise<Record<string, number>>;
  tripPlans(offerIds: string[]): Promise<Record<string, number>>;
}
