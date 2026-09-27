/**
 * Input validation for variation actions.
 * Signed amounts belong to this domain only. Quote, estimate, pricing and
 * rates continue to use the non-negative money schemas.
 */

import { z } from "zod";
import {
  finiteNumberSchema,
  finitePositiveNumberSchema,
  trimmedStringSchema,
  uuidSchema,
} from "@/lib/security/numeric-validation";
import { VARIATION_ITEM_TYPES } from "@/lib/variations/domain";

const optionalText = (max: number) =>
  z.union([z.string().trim().max(max), z.null()]);

export const variationIdempotencyKeySchema = z.string().trim().min(8).max(200);

export const createDraftVariationSchema = z
  .object({
    projectId: uuidSchema,
    title: trimmedStringSchema(160, { min: 1, requiredMessage: "Enter a variation title." }),
    summary: optionalText(2000),
    idempotencyKey: variationIdempotencyKeySchema,
  })
  .strict();

export const updateDraftVariationSchema = z
  .object({
    variationId: uuidSchema,
    revisionId: uuidSchema,
    title: trimmedStringSchema(160, { min: 1, requiredMessage: "Enter a variation title." }),
    summary: optionalText(2000),
    clientNotes: optionalText(4000),
    internalNotes: optionalText(4000),
    proposedTimeEffectDays: z.number().int().min(-3650).max(3650).nullable(),
  })
  .strict();

export const variationItemFieldsSchema = z
  .object({
    itemType: z.enum(VARIATION_ITEM_TYPES),
    clientDescription: trimmedStringSchema(500, {
      min: 1,
      requiredMessage: "Describe this variation item.",
    }),
    workAreaId: uuidSchema.nullable(),
    snapshotLineId: uuidSchema.nullable(),
    stableComponentKey: optionalText(120),
    quantity: finitePositiveNumberSchema,
    unit: trimmedStringSchema(40, { min: 1, requiredMessage: "Enter a unit." }),
    unitCost: z.union([finiteNumberSchema, z.null()]),
    unitSell: z.union([finiteNumberSchema, z.null()]),
    sortOrder: z.number().int().min(0).max(10_000),
    clientInclusion: optionalText(500),
    clientExclusion: optionalText(500),
    substitutionGroupId: uuidSchema.nullable(),
    internalMetadata: z
      .record(z.string().max(80), z.union([z.string().max(500), finiteNumberSchema, z.boolean(), z.null()]))
      .nullable(),
  })
  .strict();

export const addDraftVariationItemSchema = variationItemFieldsSchema
  .extend({
    variationId: uuidSchema,
    revisionId: uuidSchema,
  })
  .strict();

export const updateDraftVariationItemSchema = addDraftVariationItemSchema
  .extend({ itemId: uuidSchema })
  .strict();

export const deleteDraftVariationItemSchema = z
  .object({
    variationId: uuidSchema,
    revisionId: uuidSchema,
    itemId: uuidSchema,
  })
  .strict();

export const variationRevisionCommandSchema = z
  .object({
    variationId: uuidSchema,
    revisionId: uuidSchema,
  })
  .strict();

export const deleteUnissuedDraftVariationSchema = variationRevisionCommandSchema
  .extend({ projectId: uuidSchema })
  .strict();

export const withdrawIssuedVariationSchema = variationRevisionCommandSchema
  .extend({
    projectId: uuidSchema,
    reason: trimmedStringSchema(500, {
      min: 1,
      requiredMessage: "Enter a withdrawal reason.",
    }),
  })
  .strict();

export const loadProjectVariationsSchema = z
  .object({ projectId: uuidSchema })
  .strict();

export const loadVariationSchema = z
  .object({ variationId: uuidSchema })
  .strict();

const costComponentSchema = z
  .object({
    id: uuidSchema.nullable(),
    category: z.enum(["material", "labour", "subcontract", "plant", "allowance", "other"]),
    description: trimmedStringSchema(500, { min: 1, requiredMessage: "Describe this cost." }),
    quantity: finitePositiveNumberSchema,
    unit: trimmedStringSchema(40, { min: 1, requiredMessage: "Enter a unit." }),
    unitCost: z.union([finiteNumberSchema, z.null()]),
    sortOrder: z.number().int().min(0).max(10_000),
  })
  .strict();

export const saveDraftVariationBuildUpSchema = z
  .object({
    variationId: uuidSchema,
    revisionId: uuidSchema,
    itemId: uuidSchema.nullable(),
    confirmModeChange: z.boolean(),
    itemType: z.enum(["addition", "omission"]),
    clientDescription: trimmedStringSchema(500, { min: 1, requiredMessage: "Describe this variation item." }),
    workAreaId: uuidSchema.nullable(),
    snapshotLineId: uuidSchema.nullable(),
    quantity: finitePositiveNumberSchema,
    unit: trimmedStringSchema(40, { min: 1, requiredMessage: "Enter a unit." }),
    sortOrder: z.number().int().min(0).max(10_000),
    substitutionGroupId: uuidSchema.nullable(),
    targetMarginPercent: finiteNumberSchema,
    sellProvenance: z.enum(["calculated", "manual", "pricing_required"]),
    manualSellTotal: z.union([finiteNumberSchema, z.null()]),
    components: z.array(costComponentSchema).max(40),
  })
  .strict();

export const convertDraftVariationItemToSimpleSchema = updateDraftVariationItemSchema
  .extend({ confirmModeChange: z.boolean() })
  .strict();
