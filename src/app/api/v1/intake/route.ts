import { z } from "zod";
import { profileSchema } from "@/domain/profile";
import { extractProfile } from "@/domain/intake";
import {
  checkOrigin,
  identity,
  success,
  failure,
  ApiError,
} from "@/server/identity";
import { limit } from "@/server/limits";
export async function POST(request: Request) {
  try {
    await checkOrigin();
    const input = z
      .object({ profile: profileSchema, message: z.string().min(1).max(3000) })
      .strict()
      .safeParse(await request.json());
    if (!input.success)
      throw new ApiError(
        422,
        "INVALID_INTAKE",
        "Check your profile and keep the message under 3,000 characters.",
      );
    const actor = await identity(true);
    await limit(`intake:${actor.id}`, 20);
    return success(extractProfile(input.data.profile, input.data.message));
  } catch (e) {
    return failure(e);
  }
}
