import {
  controller,
  success,
  type IdParams,
} from "@/shared/presentation/http/responses";
import type { GetPublishedExperience } from "../../../application/use-cases/get-published-experience";

export function createGetExperienceController(
  getPublished: GetPublishedExperience,
) {
  return controller(async (_: Request, { params }: IdParams) =>
    success(await getPublished.execute((await params).id)),
  );
}
