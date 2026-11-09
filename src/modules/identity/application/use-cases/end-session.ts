import type { GuestSessionRepository } from "../ports/guest-session-repository";
import type { SessionReader } from "../ports/session-reader";
import type { ResolveActor } from "./resolve-actor";

// Ends both the legacy guest session and the account session, if present.
export class EndSession {
  constructor(
    private readonly guests: GuestSessionRepository,
    private readonly sessions: SessionReader,
    private readonly resolveActor: ResolveActor,
  ) {}

  async execute(command: { headers: Headers; guestToken?: string }) {
    const guest = command.guestToken
      ? await this.guests.findActive(command.guestToken)
      : null;
    if (guest) await this.guests.expire(guest.id);
    if (await this.resolveActor.execute(command.headers))
      await this.sessions.signOut(command.headers);
  }
}
