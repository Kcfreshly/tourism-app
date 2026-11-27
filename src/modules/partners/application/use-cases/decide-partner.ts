import { AppError } from "@/shared/application/app-error";
import type { PartnerStatus } from "../../domain/partner";
import type { PartnerRepository } from "../ports/partner-repository";

const allowed: Record<PartnerStatus, PartnerStatus[]> = {
  PENDING: ["VERIFIED", "DECLINED"],
  VERIFIED: ["SUSPENDED"],
  SUSPENDED: ["VERIFIED"],
  DECLINED: [],
};

// Staff verify a partner business, decline it with a reason, or suspend and
// reinstate it. Suspended partners can't submit or see their portal; their
// live listings stay until staff unpublish them.
export class DecidePartner {
  constructor(private readonly partners: PartnerRepository) {}

  async execute(command: {
    actorId: string;
    id: string;
    expectedVersion: number;
    status: "VERIFIED" | "DECLINED" | "SUSPENDED";
    reason?: string;
  }) {
    const current = await this.partners.find(command.id);
    if (!current)
      throw new AppError("NOT_FOUND", "NOT_FOUND", "Partner not found.");
    if (!allowed[current.status].includes(command.status))
      throw new AppError(
        "CONFLICT",
        "INVALID_TRANSITION",
        `A ${current.status.toLowerCase()} partner can't be set to ${command.status.toLowerCase()}.`,
      );
    const changed = await this.partners.updatePartner(
      {
        id: command.id,
        expectedVersion: command.expectedVersion,
        actorId: command.actorId,
      },
      {
        status: command.status,
        decisionReason: command.reason?.trim() || null,
        decidedBy: command.actorId,
        audit: {
          action: `PARTNER_${command.status}`,
          details: { from: current.status, reason: command.reason ?? null },
        },
      },
    );
    if (!changed)
      throw new AppError(
        "CONFLICT",
        "VERSION_CONFLICT",
        "This partner changed. Reload before deciding.",
      );
    return changed;
  }
}

export class ListPartners {
  constructor(private readonly partners: PartnerRepository) {}

  execute() {
    return this.partners.list();
  }
}
