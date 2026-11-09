import {
  controller,
  success,
  type IdParams,
} from "@/shared/presentation/http/responses";
import type { GetWorkspace } from "../../../application/use-cases/get-workspace";
import type { OwnedTripLoader } from "../owned-trip";

export function createGetWorkspaceController(
  ownedTrip: OwnedTripLoader,
  getWorkspace: GetWorkspace,
) {
  return controller(async (_: Request, { params }: IdParams) =>
    success(await getWorkspace.execute(await ownedTrip((await params).id))),
  );
}
