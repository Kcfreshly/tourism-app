import { listCatalogue } from "@/server/catalogue";
import { success, failure, ApiError } from "@/server/identity";
export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const record = (await listCatalogue()).find(
      (e) => e.id === id || e.seedKey === id,
    );
    if (!record)
      throw new ApiError(404, "NOT_FOUND", "Published experience not found.");
    return success(record);
  } catch (e) {
    return failure(e);
  }
}
