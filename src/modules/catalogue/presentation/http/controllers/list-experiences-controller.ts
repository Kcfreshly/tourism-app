import { controller, success } from "@/shared/presentation/http/responses";
import type { ListPublishedExperiences } from "../../../application/use-cases/list-published-experiences";

export function createListExperiencesController(
  listPublished: ListPublishedExperiences,
) {
  return controller(async () => success(await listPublished.execute()));
}
