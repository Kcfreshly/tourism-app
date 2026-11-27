// A signed-in account acting on the platform. Guests have no actor: they can
// browse and keep a bucket in the browser, but cannot plan.
export type Actor = {
  id: string;
  role: string;
  kind: "ACCOUNT";
  // For receipts and the payment provider.
  email?: string;
};

// Staff roles. A super admin can do everything an admin can, plus delete
// listings; deletions stay recoverable from the audit trail.
export const staffRoles = ["ADMIN", "SUPER_ADMIN"] as const;

export function isAdmin(actor: Actor) {
  return (staffRoles as readonly string[]).includes(actor.role);
}

export function isSuperAdmin(actor: Actor) {
  return actor.role === "SUPER_ADMIN";
}
