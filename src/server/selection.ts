import { listCatalogue } from "./catalogue";
import { ApiError } from "./identity";
export async function validateSelection(
  ids: string[],
  retained: string[] = [],
) {
  if (!ids.length) return;
  const available = new Set((await listCatalogue()).map((e) => e.offer.id));
  if (
    new Set(ids).size !== ids.length ||
    ids.some((id) => !available.has(id) && !retained.includes(id))
  )
    throw new ApiError(
      422,
      "INVALID_OFFER",
      "Choose a currently published demo experience.",
    );
}
export async function publishedSelection(ids: string[]) {
  if (!ids.length) return [];
  const available = new Set((await listCatalogue()).map((e) => e.offer.id));
  return [...new Set(ids)].filter((id) => available.has(id));
}
