import { z } from "zod";
import { itemSchema, servicesSchema } from "../../../domain/planner";
import { profileSchema } from "../../../domain/profile";

export const tripIdSchema = z.uuid();

export const updateTripProfileRequest = z
  .object({
    expectedVersion: z.number().int().positive(),
    profile: profileSchema,
  })
  .strict();

export const saveWorkspaceRequest = z
  .object({
    expectedVersion: z.number().int().positive(),
    items: z.array(itemSchema).max(240),
    services: servicesSchema,
  })
  .strict();

export const generateProposalRequest = z
  .object({
    selectedOfferIds: z.array(z.string().max(100)).max(30).optional(),
  })
  .strict();

export const applyProposalRequest = z
  .object({
    proposalId: z.uuid(),
    expectedVersion: z.number().int().positive(),
  })
  .strict();

export const intakeRequest = z
  .object({ profile: profileSchema, message: z.string().min(1).max(3000) })
  .strict();
