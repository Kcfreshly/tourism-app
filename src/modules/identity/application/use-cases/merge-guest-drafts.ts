import type { GuestSessionRepository } from "../ports/guest-session-repository";

export class MergeGuestDrafts {
  constructor(private readonly guests: GuestSessionRepository) {}

  // Returns the number of drafts moved, or null when this browser has no
  // active guest session.
  async execute(command: { accountId: string; guestToken?: string }) {
    const guest = command.guestToken
      ? await this.guests.findActive(command.guestToken)
      : null;
    if (!guest) return null;
    return this.guests.transferDrafts(guest.id, command.accountId);
  }
}
