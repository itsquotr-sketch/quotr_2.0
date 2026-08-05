import { z } from "zod";
import { SCOPE_CATALOGUE } from "@/lib/scopes/catalogue";

const SUPPORTED_TYPES = new Set(SCOPE_CATALOGUE.map((item) => item.type));

export const acceptSuggestionSchema = z.object({
  suggestionId: z.string().uuid(),
  projectId: z.string().uuid(),
  sourceRevision: z.string().trim().min(1).max(512),
  reasonCode: z.string().trim().max(128).nullable().optional(),
  userNote: z.string().trim().max(2000).nullable().optional(),
});

export const rejectSuggestionSchema = acceptSuggestionSchema;

export const modifyAcceptSuggestionSchema = z.object({
  suggestionId: z.string().uuid(),
  projectId: z.string().uuid(),
  modifiedTitle: z.string().trim().min(1).max(200),
  modifiedDescription: z.string().trim().max(4000).nullable(),
  modifiedWorkAreaType: z
    .string()
    .trim()
    .min(1)
    .refine((value) => SUPPORTED_TYPES.has(value), {
      message: "Unsupported work area type",
    }),
  sourceRevision: z.string().trim().min(1).max(512),
  reasonCode: z.string().trim().max(128).nullable().optional(),
  userNote: z.string().trim().max(2000).nullable().optional(),
});

export function isSupportedWorkAreaType(type: string): boolean {
  return SUPPORTED_TYPES.has(type);
}
