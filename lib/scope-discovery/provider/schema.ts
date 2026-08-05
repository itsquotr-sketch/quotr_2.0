import { z } from "zod";
import { CONFIDENCE_BANDS, SUGGESTION_KINDS } from "../types";

export const providerCandidateSchema = z
  .object({
    suggestionKind: z.enum(SUGGESTION_KINDS),
    proposedWorkAreaType: z.string().min(1),
    proposedTitle: z.string().min(1),
    proposedDescription: z.string().nullable(),
    relatedWorkAreaReference: z.string().nullable(),
    parentSuggestionReference: z.string().nullable(),
    confidenceBand: z.enum(CONFIDENCE_BANDS),
    evidenceReferences: z.array(z.string()),
    rationaleCode: z.string().min(1),
    missingInformation: z.array(
      z.object({
        key: z.string().min(1),
        promptKey: z.string().min(1),
        relatedFactKeys: z.array(z.string()),
      })
    ),
    dependencyReferences: z.array(z.string()),
    conflictReferences: z.array(z.string()),
  })
  .strict();

export const providerOutputSchema = z
  .object({
    candidates: z.array(providerCandidateSchema),
    warnings: z.array(z.string()),
  })
  .strict();

export type ProviderOutputParsed = z.infer<typeof providerOutputSchema>;
