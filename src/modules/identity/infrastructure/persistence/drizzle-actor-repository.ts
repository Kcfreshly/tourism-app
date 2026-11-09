import { eq } from "drizzle-orm";
import type { Database } from "@/database/client";
import type { ActorRepository } from "../../application/ports/actor-repository";
import { user } from "./schema";

export class DrizzleActorRepository implements ActorRepository {
  constructor(private readonly db: () => Database) {}

  async findAccount(id: string) {
    const [record] = await this.db()
      .select({ id: user.id, role: user.role })
      .from(user)
      .where(eq(user.id, id));
    return record ?? null;
  }
}
