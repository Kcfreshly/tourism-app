import { controller, success } from "@/shared/presentation/http/responses";
import type { RequestGuards } from "@/modules/identity/presentation/http/request-guards";
import type { ListTrips } from "../../../application/use-cases/list-trips";

export function createListTripsController(
  guards: RequestGuards,
  listTrips: ListTrips,
) {
  return controller(async () =>
    success(await listTrips.execute(await guards.requireActor())),
  );
}
