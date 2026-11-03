import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "./auth";
// Server-side guard for planning pages; the API routes enforce the same rule.
export async function requireSignedIn(next: string) {
  const session = await auth().api.getSession({ headers: await headers() });
  if (!session) redirect(`/account?next=${encodeURIComponent(next)}`);
  return session;
}
