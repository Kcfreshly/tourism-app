import type { SessionReader } from "../../application/ports/session-reader";
import { auth } from "./better-auth";

export class BetterAuthSessionReader implements SessionReader {
  async accountId(headers: Headers) {
    const session = await auth().api.getSession({ headers });
    return session?.user.id ?? null;
  }

  async signOut(headers: Headers) {
    await auth().api.signOut({ headers });
  }
}
