import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { SessionReader } from "../../application/ports/session-reader";

// Server-side guard for planning pages; the API routes enforce the same rule.
export function createPageGuards(sessions: SessionReader) {
  return {
    async requireSignedIn(next: string) {
      if (!(await sessions.accountId(await headers())))
        redirect(`/account?next=${encodeURIComponent(next)}`);
    },
  };
}
