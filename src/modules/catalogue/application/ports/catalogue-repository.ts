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
}
