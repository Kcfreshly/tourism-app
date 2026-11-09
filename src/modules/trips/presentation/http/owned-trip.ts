import { AppError } from "@/shared/application/app-error";
import type { RequestGuards } from "@/modules/identity/presentation/http/request-guards";
import type { LoadOwnedTrip } from "../../application/use-cases/load-owned-trip";
import { tripIdSchema } from "./schemas/trip-requests";

// A malformed id is reported as missing before the caller is identified.
export function createOwnedTripLoader(
  guards: RequestGuards,
  loadOwnedTrip: LoadOwnedTrip,
) {
  return async (id: string) => {
    if (!tripIdSchema.safeParse(id).success)
      throw new AppError("NOT_FOUND", "NOT_FOUND", "Trip not found.");
    return loadOwnedTrip.execute(id, await guards.requireActor());
  };
}

export type OwnedTripLoader = ReturnType<typeof createOwnedTripLoader>;
