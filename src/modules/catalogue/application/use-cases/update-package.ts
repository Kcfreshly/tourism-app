import { AppError } from "@/shared/application/app-error";
import { lagosToday } from "../../domain/events";
import { packageReadiness, type PackageEdit } from "../../domain/packages";
import type { PackageRepository } from "../ports/package-repository";

export class UpdatePackage {
  constructor(private readonly packages: PackageRepository) {}

  async execute(command: { actorId: string; edit: PackageEdit }) {
    const { edit } = command;
    const changed = await this.packages.update(
      {
        id: edit.id,
        expectedVersion: edit.expectedVersion,
        actorId: command.actorId,
      },
      (current) => {
        if (!current)
          throw new AppError("NOT_FOUND", "NOT_FOUND", "Trip not found.");
        if (current.record.isDemo !== true)
          throw new AppError(
            "INVALID",
            "LIVE_EDIT_DISABLED",
            "This workspace only edits fictional demo trips.",
          );
        // Cart lines refer to the slug, so it never changes after creation.
        const record = { ...edit.trip, slug: current.slug };
        if (edit.status === "DEMO_PUBLISHED") {
          const missing = packageReadiness(record, lagosToday());
          if (missing.length)
            throw new AppError("INVALID", "NOT_READY", missing.join("; "));
        }
        const before = current.record as Record<string, unknown>;
        return {
          status: edit.status,
          record,
          audit: {
            action: "PACKAGE_UPDATED",
            details: {
              previousVersion: current.version,
              status: edit.status,
              changed: Object.keys({ ...before, ...record }).filter(
                (k) =>
                  JSON.stringify(before[k]) !==
                  JSON.stringify(record[k as keyof typeof record]),
              ),
            },
          },
        };
      },
    );
    if (!changed)
      throw new AppError(
        "CONFLICT",
        "VERSION_CONFLICT",
        "This trip changed. Reload before editing again.",
      );
    return changed;
  }
}
