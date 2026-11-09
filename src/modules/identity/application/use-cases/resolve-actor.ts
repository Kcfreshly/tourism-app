import type { Actor } from "../../domain/actor";
import type { ActorRepository } from "../ports/actor-repository";
import type { SessionReader } from "../ports/session-reader";

// Reads the role from the database on every request, so a role change takes
// effect without signing in again.
export class ResolveActor {
  constructor(
    private readonly sessions: SessionReader,
    private readonly actors: ActorRepository,
  ) {}

  async execute(headers: Headers): Promise<Actor | null> {
    const id = await this.sessions.accountId(headers);
    if (!id) return null;
    const record = await this.actors.findAccount(id);
    return record ? { ...record, kind: "ACCOUNT" } : null;
  }
}
