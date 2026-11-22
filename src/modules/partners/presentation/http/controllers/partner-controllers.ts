import { z } from "zod";
import { AppError } from "@/shared/application/app-error";
import { controller, success } from "@/shared/presentation/http/responses";
import type { RequestGuards } from "@/modules/identity/presentation/http/request-guards";
import type { Actor } from "@/modules/identity/domain/actor";
import { catalogueEditSchema } from "@/modules/catalogue/domain/catalogue";
import { packageSchema } from "@/modules/catalogue/domain/packages";
import {
  partnerApplicationSchema,
  partnerDecisionSchema,
  productTypes,
  submissionDecisionSchema,
} from "../../../domain/partner";
import type { PartnerAccess } from "../../../application/services/partner-access";
import type { ApplyAsPartner } from "../../../application/use-cases/apply-as-partner";
import type {
  DecidePartner,
  ListPartners,
} from "../../../application/use-cases/decide-partner";
import type {
  DecideSubmission,
  ListSubmissionQueue,
} from "../../../application/use-cases/decide-submission";
import type { ListPartnerListings } from "../../../application/use-cases/list-partner-listings";
import type {
  GetPartnerDashboard,
  RecordListingVisit,
} from "../../../application/use-cases/partner-dashboard";
import type {
  SaveSubmission,
  WithdrawSubmission,
} from "../../../application/use-cases/save-submission";
import type { StartSubmission } from "../../../application/use-cases/start-submission";

function issues(error: z.ZodError) {
  return error.issues
    .map((i) =>
      i.path.length ? `${i.path.join(" › ")}: ${i.message}` : i.message,
    )
    .join("; ");
}

function parse<T>(schema: z.ZodType<T>, body: unknown, code: string) {
  const parsed = schema.safeParse(body);
  if (!parsed.success)
    throw new AppError("INVALID", code, issues(parsed.error));
  return parsed.data;
}

const startSchema = z
  .object({
    productType: z.enum(productTypes),
    name: z.string().optional(),
    productId: z.uuid().optional(),
  })
  .strict();
const saveSchema = z
  .object({
    id: z.uuid(),
    expectedVersion: z.number().int().positive(),
    submit: z.boolean(),
    experience: catalogueEditSchema.optional(),
    trip: packageSchema.optional(),
  })
  .strict();
const withdrawSchema = z
  .object({ id: z.uuid(), expectedVersion: z.number().int().positive() })
  .strict();
const visitSchema = z
  .object({
    productType: z.enum(productTypes),
    productId: z.string().min(3).max(80),
    visitor: z.string().min(16).max(64),
  })
  .strict();

// Partner portal endpoints. Every one resolves the caller's partner from the
// session, never from the request, so a partner only reaches its own data.
export function createPartnerControllers(deps: {
  guards: RequestGuards;
  access: PartnerAccess;
  apply: ApplyAsPartner;
  listings: ListPartnerListings;
  start: StartSubmission;
  save: SaveSubmission;
  withdraw: WithdrawSubmission;
  dashboard: GetPartnerDashboard;
}) {
  const { guards, access } = deps;
  async function verified() {
    const actor = await guards.requireActor();
    return { actor, partner: await access.verified(actor.id) };
  }
  return {
    // Resolves to the account's partner, or null when it hasn't applied.
    me: controller(async () => {
      const actor = await guards.requireActor();
      return success(await access.membership(actor.id));
    }),
    apply: controller(async (request: Request) => {
      await guards.checkOrigin();
      const actor = await guards.requireActor();
      await guards.throttle(`partner-apply:${actor.id}`, 10);
      const application = parse(
        partnerApplicationSchema,
        await request.json(),
        "INVALID_APPLICATION",
      );
      return success(
        await deps.apply.execute({ userId: actor.id, application }),
        201,
      );
    }),
    listings: controller(async () => {
      const { partner } = await verified();
      return success(await deps.listings.execute(partner));
    }),
    start: controller(async (request: Request) => {
      await guards.checkOrigin();
      const { actor, partner } = await verified();
      await guards.throttle(`partner-start:${actor.id}`, 30);
      const body = parse(startSchema, await request.json(), "INVALID_START");
      return success(
        await deps.start.execute({ actorId: actor.id, partner, ...body }),
        201,
      );
    }),
    save: controller(async (request: Request) => {
      await guards.checkOrigin();
      const { actor, partner } = await verified();
      await guards.throttle(`partner-save:${actor.id}`, 60);
      const body = parse(saveSchema, await request.json(), "INVALID_DRAFT");
      return success(
        await deps.save.execute({ actorId: actor.id, partner, ...body }),
      );
    }),
    withdraw: controller(async (request: Request) => {
      await guards.checkOrigin();
      const { actor, partner } = await verified();
      await guards.throttle(`partner-save:${actor.id}`, 60);
      const body = parse(
        withdrawSchema,
        await request.json(),
        "INVALID_WITHDRAW",
      );
      return success(
        await deps.withdraw.execute({ actorId: actor.id, partner, ...body }),
      );
    }),
    dashboard: controller(async () => {
      const { partner } = await verified();
      return success(await deps.dashboard.execute(partner));
    }),
    // For the shared photo upload controller.
    authorizeUpload: async () => (await verified()).actor,
  };
}

export function createAdminPartnerControllers(deps: {
  guards: RequestGuards;
  list: ListPartners;
  decide: DecidePartner;
  queue: ListSubmissionQueue;
  decideSubmission: DecideSubmission;
}) {
  const { guards } = deps;
  return {
    list: controller(async () => {
      await guards.requireAdmin();
      return success(await deps.list.execute());
    }),
    decide: controller(async (request: Request) => {
      await guards.checkOrigin();
      const actor = await guards.requireAdmin();
      await guards.throttle(`partner-decide:${actor.id}`, 60);
      const body = parse(
        partnerDecisionSchema,
        await request.json(),
        "INVALID_DECISION",
      );
      return success(await deps.decide.execute({ actorId: actor.id, ...body }));
    }),
    queue: controller(async () => {
      await guards.requireAdmin();
      return success(await deps.queue.execute());
    }),
    decideSubmission: controller(async (request: Request) => {
      await guards.checkOrigin();
      const actor = await guards.requireAdmin();
      await guards.throttle(`submission-decide:${actor.id}`, 60);
      const body = parse(
        submissionDecisionSchema,
        await request.json(),
        "INVALID_DECISION",
      );
      return success(
        await deps.decideSubmission.execute({ actorId: actor.id, ...body }),
      );
    }),
  };
}

// Public: counts a listing view. Staff and partners viewing listings aren't
// counted, so partners see what travellers do.
export function createRecordVisitController(deps: {
  guards: RequestGuards;
  access: PartnerAccess;
  record: RecordListingVisit;
  isStaff: (actor: Actor) => boolean;
}) {
  return controller(async (request: Request) => {
    await deps.guards.checkOrigin();
    const body = parse(visitSchema, await request.json(), "INVALID_VISIT");
    await deps.guards.throttle(`visit:${body.visitor}`, 120);
    const actor = await deps.guards.currentActor();
    if (
      actor &&
      (deps.isStaff(actor) || (await deps.access.membership(actor.id)))
    )
      return success({ counted: false });
    await deps.record.execute({
      productType: body.productType,
      productId: body.productId,
      visitorKey: body.visitor,
    });
    return success({ counted: true });
  });
}
