import { createHash, randomBytes, randomUUID } from "node:crypto";
import { AppError } from "@/shared/application/app-error";
import {
  inviteDays,
  inviteStatus,
  type PartnerApplication,
  type PartnerInvite,
} from "../../domain/partner";
import type { PartnerRepository } from "../ports/partner-repository";

const hash = (token: string) =>
  createHash("sha256").update(token).digest("hex");

const notFound = () =>
  new AppError(
    "NOT_FOUND",
    "INVITE_NOT_FOUND",
    "This invitation link isn’t valid. Ask Fastlife for a new one.",
  );

function withStatus(invite: PartnerInvite, now: Date) {
  return { ...invite, status: inviteStatus(invite, now) };
}

// Staff invite a business they've already vetted, and send the link
// themselves (WhatsApp, email). The token is shown once.
export class CreatePartnerInvite {
  constructor(
    private readonly partners: PartnerRepository,
    private readonly baseUrl: () => string,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async execute(command: { actorId: string; invite: PartnerApplication }) {
    const token = randomBytes(24).toString("base64url");
    const invite = await this.partners.createInvite(
      {
        ...command.invite,
        id: randomUUID(),
        tokenHash: hash(token),
        expiresAt: new Date(this.clock().getTime() + inviteDays * 86400000),
      },
      {
        actorId: command.actorId,
        action: "PARTNER_INVITED",
        details: { businessName: command.invite.businessName },
      },
    );
    return {
      invite: withStatus(invite, this.clock()),
      url: `${this.baseUrl()}/partner/invite/${token}`,
    };
  }
}

export class ListPartnerInvites {
  constructor(
    private readonly partners: PartnerRepository,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async execute() {
    const now = this.clock();
    return (await this.partners.listInvites()).map((i) => withStatus(i, now));
  }
}

export class RevokePartnerInvite {
  constructor(
    private readonly partners: PartnerRepository,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async execute(command: { actorId: string; id: string }) {
    const invite = await this.partners.revokeInvite(
      command.id,
      command.actorId,
    );
    if (!invite)
      throw new AppError(
        "CONFLICT",
        "INVITE_CLOSED",
        "This invitation was already used or cancelled.",
      );
    return withStatus(invite, this.clock());
  }
}

// What the invite page shows before and after sign-in: the business and
// whether the link still works. Nothing else about the invite is exposed.
export class ViewPartnerInvite {
  constructor(
    private readonly partners: PartnerRepository,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async execute(token: string) {
    const invite = await this.partners.findInvite(hash(token));
    if (!invite) throw notFound();
    return {
      businessName: invite.businessName,
      status: inviteStatus(invite, this.clock()),
      expiresAt: invite.expiresAt,
    };
  }
}

// The invited person, signed in, accepts: their account becomes the owner of
// a verified partner. An account with its own pending or declined
// application has that application verified with the invite's details
// instead; one that already runs a partner is refused.
export class AcceptPartnerInvite {
  constructor(
    private readonly partners: PartnerRepository,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async execute(command: { userId: string; token: string }) {
    const tokenHash = hash(command.token);
    const invite = await this.partners.findInvite(tokenHash);
    if (!invite) throw notFound();
    const now = this.clock();
    const status = inviteStatus(invite, now);
    if (status !== "OPEN")
      throw new AppError(
        "CONFLICT",
        "INVITE_CLOSED",
        status === "EXPIRED"
          ? "This invitation has expired. Ask Fastlife for a new one."
          : "This invitation was already used or cancelled.",
      );
    const existing = await this.partners.forUser(command.userId);
    if (
      existing &&
      (existing.status === "VERIFIED" || existing.status === "SUSPENDED")
    )
      throw new AppError(
        "CONFLICT",
        "ALREADY_PARTNER",
        `This account already runs ${existing.businessName}. Sign in with another account to accept.`,
      );
    if (existing && existing.memberRole !== "OWNER")
      throw new AppError(
        "FORBIDDEN",
        "OWNER_ONLY",
        "This account is staff for another business. Sign in with another account to accept.",
      );
    const partner = await this.partners.acceptInvite({
      tokenHash,
      userId: command.userId,
      partnerId: randomUUID(),
      existing: existing && { id: existing.id, version: existing.version },
      now,
    });
    if (!partner)
      throw new AppError(
        "CONFLICT",
        "INVITE_CLOSED",
        "This invitation was already used or cancelled.",
      );
    return partner;
  }
}
