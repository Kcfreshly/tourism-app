import { listCatalogue } from "@/server/catalogue";
import { success, failure } from "@/server/identity";
export async function GET() {
  try {
    return success(await listCatalogue());
  } catch (e) {
    return failure(e);
  }
}
