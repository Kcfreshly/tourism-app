import { and, eq, gt } from "drizzle-orm";
import { createHash, randomUUID } from "node:crypto";
import type { Database } from "@/database/client";
import { audit } from "@/modules/audit/infrastructure/persistence/schema";
import { trips } from "@/modules/trips/infrastructure/persistence/schema";
import type { GuestSessionRepository } from "../../application/ports/guest-session-repository";
import { sessions } from "./schema";

export class DrizzleGuestSessionRepository implements GuestSessionRepository {
  constructor(private readonly db: () => Database) {}

  async findActive(token: string) {
    const [session] = await this.db()
      .select({ id: sessions.id })
      .from(sessions)
      .where(
        and(
          eq(
            sessions.tokenHash,
            createHash("sha256").update(token).digest("hex"),
          ),
          gt(sessions.expiresAt, new Date()),
        ),
      );
    return session ?? null;
  }

  async expire(id: string) {
    await this.db()
      .update(sessions)
      .set({ expiresAt: new Date(0) })
      .where(eq(sessions.id, id));
  }

  transferDrafts(guestId: string, accountId: string) {
    return this.db().transaction(async (tx) => {
      const [claimed] = await tx
        .update(sessions)
        .set({ expiresAt: new Date(0) })
        .where(
          and(eq(sessions.id, guestId), gt(sessions.expiresAt, new Date())),
        )
        .returning();
      if (!claimed) return 0;
      const moved = await tx
        .update(trips)
        .set({ ownerId: accountId, ownerType: "ACCOUNT" })
        .where(and(eq(trips.ownerId, guestId), eq(trips.ownerType, "GUEST")))
        .returning();
      await tx.insert(audit).values({
        id: randomUUID(),
        actorId: accountId,
        action: "GUEST_DRAFTS_MERGED",
        entityId: guestId,
        details: { tripIds: moved.map((t) => t.id) },
      });
      return moved.length;
    });
  }
}
