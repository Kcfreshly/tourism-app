import { AppError } from "@/shared/application/app-error";
import type { PartnerRepository } from "../ports/partner-repository";

// The partner an account acts for. Listings, submissions and figures are
// always looked up through this, so a partner only ever sees its own.
export class PartnerAccess {
  constructor(private readonly partners: PartnerRepository) {}

  membership(userId: string) {
    return this.partners.forUser(userId);
  }

  // Only verified partners can create, submit and see their dashboard.
  async verified(userId: string) {
    const partner = await this.partners.forUser(userId);
    if (!partner)
      throw new AppError(
        "FORBIDDEN",
        "NOT_A_PARTNER",
        "Apply as a partner first.",
      );
    if (partner.status !== "VERIFIED")
      throw new AppError(
        "FORBIDDEN",
        "PARTNER_NOT_VERIFIED",
        partner.status === "SUSPENDED"
          ? "Your partner account is suspended. Contact Fastlife operations."
          : "Your partner account is waiting for verification.",
      );
    return partner;
  }
}
