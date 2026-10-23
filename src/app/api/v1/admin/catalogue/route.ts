import {
  requireAdmin,
  failure,
  checkOrigin,
  ApiError,
  success,
} from "@/server/identity";
import { db } from "@/server/db";
import { catalogue, audit } from "@/server/schema";
import {
  catalogueEditSchema,
  demoPublishIssues,
  emptyReview,
} from "@/domain/catalogue";
import { and, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { limit } from "@/server/limits";
import fixture from "../../../../../../tourism-v1-handoff/data/experiences.demo.json";
import type { Experience } from "@/server/catalogue";
export async function GET() {
  try {
    await requireAdmin();
    return success(await db().select().from(catalogue));
  } catch (e) {
    return failure(e);
  }
}
export async function PATCH(request: Request) {
  try {
    await checkOrigin();
    const actor = await requireAdmin();
    await limit(`catalogue:${actor.id}`, 60);
    const parsed = catalogueEditSchema.safeParse(await request.json());
    if (!parsed.success)
      throw new ApiError(
        422,
        "INVALID_CATALOGUE",
        parsed.error.issues.map((i) => i.message).join("; "),
      );
    const input = parsed.data;
    const data = await db().transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(catalogue)
        .where(eq(catalogue.id, input.id));
      if (!existing)
        throw new ApiError(404, "NOT_FOUND", "Catalogue record not found.");
      const old = existing.record as Experience;
      if (old.isDemo !== true)
        throw new ApiError(
          422,
          "LIVE_EDIT_DISABLED",
          "This workspace only edits fictional demo supply.",
        );
      if (["DEMO_VERIFIED", "DEMO_PUBLISHED"].includes(input.status)) {
        const issues = demoPublishIssues(input.review);
        if (issues.length)
          throw new ApiError(422, "REVIEW_REQUIRED", issues.join("; "));
        if (
          !["DEMO_VERIFIED", "DEMO_PUBLISHED"].includes(existing.status) &&
          input.status === "DEMO_PUBLISHED"
        )
          throw new ApiError(
            422,
            "VERIFY_FIRST",
            "Save as demo verified before publishing.",
          );
      }
      const record = {
        ...old,
        name: input.name.endsWith("— DEMO")
          ? input.name
          : `${input.name} — DEMO`,
        categoryId: input.categoryId,
        zoneId: input.zoneId,
        kind: input.kind,
        durationMinMinutes: input.durationMinMinutes,
        durationMaxMinutes: input.durationMaxMinutes,
        status: input.status,
        imagePath: `/assets/illustrations/category-${input.categoryId}.svg`,
        offer: {
          ...old.offer,
          rateMinor: input.rateMinor,
          capacityPerSlot: input.capacityPerSlot,
        },
      };
      const [changed] = await tx
        .update(catalogue)
        .set({
          status: input.status,
          record,
          review: input.review,
          version: existing.version + 1,
        })
        .where(
          and(
            eq(catalogue.id, input.id),
            eq(catalogue.version, input.expectedVersion),
          ),
        )
        .returning();
      if (!changed)
        throw new ApiError(
          409,
          "VERSION_CONFLICT",
          "Catalogue changed. Reload before editing again.",
        );
      await tx.insert(audit).values({
        id: randomUUID(),
        actorId: actor.id,
        action: "DEMO_CATALOGUE_UPDATED",
        entityId: input.id,
        details: {
          previousVersion: existing.version,
          status: input.status,
          rateMinor: input.rateMinor,
          capacityPerSlot: input.capacityPerSlot,
          review: input.review,
        },
      });
      return changed;
    });
    return success(data);
  } catch (e) {
    return failure(e);
  }
}
export async function POST(request: Request) {
  try {
    await checkOrigin();
    const actor = await requireAdmin();
    await limit(`catalogue-create:${actor.id}`, 15);
    const body = await request.json();
    if (
      typeof body.name !== "string" ||
      body.name.length < 5 ||
      body.name.length > 100
    )
      throw new ApiError(
        422,
        "INVALID_NAME",
        "Enter a draft name of 5–100 characters.",
      );
    const id = randomUUID();
    const data = await db().transaction(async (tx) => {
      const template = fixture.experiences[0];
      const [record] = await tx
        .insert(catalogue)
        .values({
          id,
          seedKey: `demo-${id}`,
          status: "DRAFT",
          review: emptyReview,
          record: {
            ...template,
            id: `demo-${id}`,
            name: `${body.name} — DEMO`,
            status: "DRAFT",
            supplierId: `fictional-${id}`,
            offer: {
              ...template.offer,
              id: `demo-offer-${id}`,
              rateMinor: 0,
              capacityPerSlot: 1,
            },
          },
        })
        .returning();
      await tx.insert(audit).values({
        id: randomUUID(),
        actorId: actor.id,
        action: "DEMO_CATALOGUE_DRAFT_CREATED",
        entityId: id,
        details: { isDemo: true },
      });
      return record;
    });
    return success(data, 201);
  } catch (e) {
    return failure(e);
  }
}
