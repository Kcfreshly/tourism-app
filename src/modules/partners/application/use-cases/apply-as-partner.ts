import { randomUUID } from "node:crypto";
import { AppError } from "@/shared/application/app-error";
import type { PartnerApplication } from "../../domain/partner";
import type { PartnerRepository } from "../ports/partner-repository";

// A signed-in account applies to run listings. Staff verify the business
// before it can submit anything. A pending application can be corrected and
// a declined one sent again.
export class ApplyAsPartner {
  constructor(private readonly partners: PartnerRepository) {}

  async execute(command: { userId: string; application: PartnerApplication }) {
    const existing = await this.partners.forUser(command.userId);
    if (!existing)
      return this.partners.apply({
        id: randomUUID(),
        userId: command.userId,
        application: command.application,
      });
    if (existing.status === "VERIFIED" || existing.status === "SUSPENDED")
      throw new AppError(
        "CONFLICT",
        "ALREADY_PARTNER",
        "This account already has a partner business.",
      );
    if (existing.memberRole !== "OWNER")
      throw new AppError(
        "FORBIDDEN",
        "OWNER_ONLY",
        "Only the business owner can change the application.",
      );
    const changed = await this.partners.updatePartner(
      {
        id: existing.id,
        expectedVersion: existing.version,
        actorId: command.userId,
      },
      {
        ...command.application,
        status: "PENDING",
        decisionReason:
          existing.status === "DECLINED" ? null : existing.decisionReason,
        audit: {
          action:
            existing.status === "DECLINED"
              ? "PARTNER_REAPPLIED"
              : "PARTNER_APPLICATION_UPDATED",
          details: { businessName: command.application.businessName },
        },
      },
    );
    if (!changed)
      throw new AppError(
        "CONFLICT",
        "VERSION_CONFLICT",
        "Your application changed. Reload and try again.",
      );
    return changed;
  }
}
