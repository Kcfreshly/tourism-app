import type { CatalogueRecord } from "../../domain/experience";

export type AuditEntry = {
  actorId: string;
  action: string;
  details: Record<string, unknown>;
};

export type CatalogueChange = {
  status: string;
  record: unknown;
  review: unknown;
  audit: Omit<AuditEntry, "actorId">;
};

// One audit event about a listing, with who did it when known.
export type CatalogueEvent = {
  id: string;
  action: string;
  actorId: string;
  actorName: string | null;
  createdAt: Date;
  details: Record<string, unknown>;
};

// A listing that was deleted and has not been restored since.
export type DeletedListing = {
  auditId: string;
  deletedAt: Date;
  deletedBy: string;
  reason: string | null;
  snapshot: CatalogueRecord;
};

export type RestoreResult =
  | { kind: "RESTORED"; row: CatalogueRecord }
  | { kind: "NOT_A_DELETION" }
  | { kind: "ALREADY_LISTED" }
  | { kind: "SEED_KEY_TAKEN" };

// Every write also stores a full snapshot of the row in its audit event, so
// any listing can be rebuilt from the audit trail.
export interface CatalogueRepository {
  listPublished(): Promise<CatalogueRecord[]>;
  listAll(): Promise<CatalogueRecord[]>;
  // Reads the row, runs `decide` and writes the change with its audit event in
  // one transaction. `decide` throws to refuse. Returns null when
  // `expectedVersion` no longer matches.
  update(
    input: { id: string; expectedVersion: number; actorId: string },
    decide: (current: CatalogueRecord | undefined) => CatalogueChange,
  ): Promise<CatalogueRecord | null>;
  createDraft(
    row: Omit<CatalogueRecord, "version">,
    audit: AuditEntry,
  ): Promise<CatalogueRecord>;
  // Removes the row and records a CATALOGUE_DELETED event holding its last
  // snapshot. Returns undefined when it doesn't exist and null when
  // `expectedVersion` no longer matches.
  delete(input: {
    id: string;
    expectedVersion: number;
    actorId: string;
    reason: string | null;
  }): Promise<CatalogueRecord | null | undefined>;
  history(entityId: string): Promise<CatalogueEvent[]>;
  deleted(): Promise<DeletedListing[]>;
  // Puts a deleted listing back from the snapshot in that deletion event.
  restore(input: { auditId: string; actorId: string }): Promise<RestoreResult>;
}
