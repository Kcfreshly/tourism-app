import { controller, success } from "@/shared/presentation/http/responses";
import type { RequestGuards } from "@/modules/identity/presentation/http/request-guards";
import type { ListCatalogueRecords } from "../../../application/use-cases/list-catalogue-records";

export function createListCatalogueRecordsController(
  guards: RequestGuards,
  listRecords: ListCatalogueRecords,
) {
  return controller(async () => {
    await guards.requireAdmin();
    return success(await listRecords.execute());
  });
}
