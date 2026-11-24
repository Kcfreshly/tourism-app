// Matching a paid car, night car or guide: staff assign a person (and a
// vehicle for cars), the traveller sees who it is, and anything still
// unmatched at its deadline is marked for a refund.
import { z } from "zod";
import type { ServiceKind, ServiceStatus } from "./trip-checkout";

const phone = z
  .string()
  .trim()
  .regex(
    /^\+?[0-9][0-9 ()-]{6,19}$/,
    "Use a phone number like +234 801 234 5678",
  );

export const assigneeSchema = z
  .object({
    name: z.string().trim().min(2).max(80),
    phone,
    vehicle: z.string().trim().max(80).default(""),
    plate: z.string().trim().max(20).default(""),
  })
  .strict();
export type Assignee = z.infer<typeof assigneeSchema>;

const target = {
  id: z.uuid(),
  expectedVersion: z.number().int().min(1),
};

export const serviceActionSchema = z.discriminatedUnion("action", [
  z
    .object({ action: z.literal("MATCH"), ...target, assignee: assigneeSchema })
    .strict(),
  z
    .object({
      action: z.literal("UNMATCH"),
      ...target,
      // Why nobody could be found; kept in the request's history.
      note: z.string().trim().min(3).max(300),
    })
    .strict(),
  z.object({ action: z.literal("COMPLETE"), ...target }).strict(),
]);
export type ServiceAction = z.infer<typeof serviceActionSchema>;

const isCar = (service: ServiceKind) =>
  service === "CAR" || service === "NIGHT_CAR";

// Where an action takes a request, or null when it isn't allowed. Matching
// again changes who was matched.
export function nextServiceStatus(
  current: ServiceStatus,
  action: ServiceAction["action"],
): ServiceStatus | null {
  if (action === "MATCH")
    return current === "REQUESTED" || current === "MATCHED" ? "MATCHED" : null;
  if (action === "UNMATCH")
    return current === "REQUESTED" || current === "MATCHED"
      ? "UNMATCHED"
      : null;
  return current === "MATCHED" ? "COMPLETED" : null;
}

// What a match must include: a car needs its vehicle and plate.
export function assigneeProblem(service: ServiceKind, a: Assignee) {
  if (isCar(service) && (!a.vehicle || !a.plate))
    return "Add the vehicle and its plate number.";
  return null;
}

// Still waiting for someone at its deadline: a refund is due.
export function isOverdue(
  r: { status: string; matchBy: Date | string },
  now: Date,
) {
  return r.status === "REQUESTED" && new Date(r.matchBy) <= now;
}

// The matched person as the traveller sees it.
export function assigneeLines(
  service: ServiceKind,
  a: Record<string, string> | null,
): [string, string][] {
  if (!a) return [];
  const role = isCar(service) ? "Driver" : "Guide";
  return (
    [
      [role, a.name],
      ["Phone", a.phone],
      ["Vehicle", a.vehicle],
      ["Plate", a.plate],
    ] as [string, string | undefined][]
  ).filter((l): l is [string, string] => !!l[1]);
}
