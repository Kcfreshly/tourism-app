import type { PackageRecord, TripPackage } from "../../domain/packages";
import type { AuditEntry } from "./catalogue-repository";

export type PackageChange = {
  status: string;
  record: TripPackage;
  audit: Omit<AuditEntry, "actorId">;
};

export interface PackageRepository {
  listPublished(): Promise<PackageRecord[]>;
  listAll(): Promise<PackageRecord[]>;
  slugTaken(slug: string): Promise<boolean>;
  create(
    row: Omit<PackageRecord, "version">,
    audit: AuditEntry,
  ): Promise<PackageRecord>;
  // Reads the row, runs `decide` and writes the change with its audit event in
  // one transaction. `decide` throws to refuse. Returns null when
  // `expectedVersion` no longer matches.
  update(
    input: { id: string; expectedVersion: number; actorId: string },
    decide: (current: PackageRecord | undefined) => PackageChange,
  ): Promise<PackageRecord | null>;
}
