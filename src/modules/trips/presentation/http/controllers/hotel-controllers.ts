import { z } from "zod";
import { AppError } from "@/shared/application/app-error";
import { controller, success } from "@/shared/presentation/http/responses";
import type { RequestGuards } from "@/modules/identity/presentation/http/request-guards";
import { hotelInputSchema } from "../../../domain/hotels";
import { stayTypes, type StayType } from "../../../domain/profile";
import type {
  ListHotels,
  SaveHotel,
  SearchHotels,
} from "../../../application/use-cases/hotels";

const searchSchema = z.object({
  q: z.string().max(120),
  zoneId: z.enum(["UNDECIDED", "LEKKI", "VI", "MAINLAND"]).optional(),
  type: z.enum(Object.keys(stayTypes) as [StayType]).optional(),
});

const saveSchema = z.union([
  z
    .object({
      id: z.uuid(),
      expectedVersion: z.number().int().min(1),
      hotel: hotelInputSchema,
    })
    .strict(),
  z.object({ hotel: hotelInputSchema }).strict(),
]);

export function createHotelControllers(deps: {
  guards: RequestGuards;
  search: SearchHotels;
  list: ListHotels;
  save: SaveHotel;
}) {
  return {
    // The plan form's search as travellers type: ?q=&zoneId=&type=
    search: controller(async (request: Request) => {
      const actor = await deps.guards.requireActor();
      await deps.guards.throttle(`hotels:${actor.id}`, 120);
      const url = new URL(request.url);
      const parsed = searchSchema.safeParse({
        q: url.searchParams.get("q") ?? "",
        zoneId: url.searchParams.get("zoneId") ?? undefined,
        type: url.searchParams.get("type") ?? undefined,
      });
      if (!parsed.success)
        throw new AppError(
          "INVALID",
          "INVALID_SEARCH",
          "Search with up to 120 characters.",
        );
      return success(await deps.search.execute(parsed.data));
    }),
    list: controller(async () => {
      await deps.guards.requireAdmin();
      return success(await deps.list.execute());
    }),
    save: controller(async (request: Request) => {
      await deps.guards.checkOrigin();
      const actor = await deps.guards.requireAdmin();
      await deps.guards.throttle(`admin-hotels:${actor.id}`, 60);
      const parsed = saveSchema.safeParse(await request.json());
      if (!parsed.success)
        throw new AppError(
          "INVALID",
          "INVALID_HOTEL",
          parsed.error.issues.map((i) => i.message).join("; "),
        );
      return success(await deps.save.execute(actor.id, parsed.data));
    }),
  };
}
