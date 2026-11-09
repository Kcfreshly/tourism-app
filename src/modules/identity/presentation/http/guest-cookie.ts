import { cookies } from "next/headers";

// Legacy guest draft cookie, read only so its drafts can be linked to an account.
const name = "tourism-session";

export async function guestToken() {
  return (await cookies()).get(name)?.value;
}

export async function forgetGuest() {
  (await cookies()).delete(name);
}
