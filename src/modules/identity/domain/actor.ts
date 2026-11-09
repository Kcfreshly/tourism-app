// A signed-in account acting on the platform. Guests have no actor: they can
// browse and keep a bucket in the browser, but cannot plan.
export type Actor = { id: string; role: string; kind: "ACCOUNT" };

export function isAdmin(actor: Actor) {
  return actor.role === "ADMIN";
}
