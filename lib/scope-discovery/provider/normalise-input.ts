import { z } from "zod";
import { uuidSchema } from "@/lib/security/numeric-validation";
import { assertNoCommercialFields } from "../validation";
import { SCOPE_DISCOVERY_CONTRACT_VERSION } from "../version";
import {
  PROVIDER_ERROR_CODES,
  ScopeDiscoveryProviderError,
} from "./errors";
import {
  PROVIDER_INPUT_LIMITS,
  type ScopeDiscoveryProviderInput,
} from "./types";
import { deepFreeze } from "../immutability";

const noteSchema = z.object({
  noteId: z.string().min(1),
  content: z.string(),
});

const waSchema = z.object({
  workAreaId: uuidSchema,
  type: z.string().min(1),
  title: z.string().nullable(),
});

const factSchema = z.object({
  key: z.string().min(1),
  value: z.union([z.string(), z.number(), z.boolean(), z.null()]),
});

const constraintSchema = z.object({
  key: z.string().min(1),
  value: z.union([z.string(), z.number(), z.boolean(), z.null()]),
});

const suppressionSchema = z.object({
  relationshipId: z.string().min(1),
  candidateScopeType: z.string().min(1),
  reason: z.string().min(1),
});

const conflictSchema = z.object({
  relationshipId: z.string().min(1),
  candidateScopeType: z.string().min(1),
  reason: z.string().min(1),
});

const snapshotSchema = z.object({
  briefRevision: z.string().min(1),
  noteRevisionSet: z.string().min(1),
  factRevisions: z.string().min(1),
  constraintRevisions: z.string().min(1),
  workAreaRevisions: z.string().min(1),
  catalogueVersion: z.string().min(1),
  contractVersion: z.string().min(1),
  providerModelId: z.string().nullable(),
  formattingRevision: z.string().nullable(),
});

const inputSchema = z.object({
  projectId: uuidSchema,
  orgId: uuidSchema,
  analysisRunId: uuidSchema,
  projectBrief: z.string(),
  selectedSiteNotes: z.array(noteSchema),
  acceptedWorkAreas: z.array(waSchema),
  relevantFacts: z.array(factSchema),
  relevantConstraints: z.array(constraintSchema),
  deterministicSuggestions: z.array(z.unknown()),
  deterministicSuppressions: z.array(suppressionSchema),
  deterministicConflicts: z.array(conflictSchema),
  sourceSnapshot: snapshotSchema,
  catalogueVersion: z.string().min(1),
  contractVersion: z.string().min(1),
  region: z.string().nullable(),
  analysisObjective: z.string().min(1),
});

export function normaliseProviderInput(
  raw: unknown
): ScopeDiscoveryProviderInput {
  const commercial = assertNoCommercialFields(raw);
  if (commercial.length > 0) {
    throw new ScopeDiscoveryProviderError(
      PROVIDER_ERROR_CODES.COMMERCIAL_CONTENT_FORBIDDEN,
      "Commercial fields are forbidden in provider input.",
      commercial.map((c) => c.path)
    );
  }

  const parsed = inputSchema.safeParse(raw);
  if (!parsed.success) {
    throw new ScopeDiscoveryProviderError(
      PROVIDER_ERROR_CODES.INPUT_VALIDATION_FAILED,
      "Provider input failed schema validation.",
      parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`)
    );
  }

  const data = parsed.data;
  const errors: string[] = [];

  if (data.projectBrief.length > PROVIDER_INPUT_LIMITS.maxBriefChars) {
    errors.push(
      `projectBrief exceeds ${PROVIDER_INPUT_LIMITS.maxBriefChars} characters.`
    );
  }
  if (data.selectedSiteNotes.length > PROVIDER_INPUT_LIMITS.maxNotes) {
    errors.push(`selectedSiteNotes exceeds ${PROVIDER_INPUT_LIMITS.maxNotes}.`);
  }
  for (const [i, note] of data.selectedSiteNotes.entries()) {
    if (note.content.length > PROVIDER_INPUT_LIMITS.maxNoteChars) {
      errors.push(
        `selectedSiteNotes[${i}] exceeds ${PROVIDER_INPUT_LIMITS.maxNoteChars} characters.`
      );
    }
  }
  if (data.acceptedWorkAreas.length > PROVIDER_INPUT_LIMITS.maxWorkAreas) {
    errors.push(
      `acceptedWorkAreas exceeds ${PROVIDER_INPUT_LIMITS.maxWorkAreas}.`
    );
  }
  if (data.relevantFacts.length > PROVIDER_INPUT_LIMITS.maxFacts) {
    errors.push(`relevantFacts exceeds ${PROVIDER_INPUT_LIMITS.maxFacts}.`);
  }
  if (data.relevantConstraints.length > PROVIDER_INPUT_LIMITS.maxConstraints) {
    errors.push(
      `relevantConstraints exceeds ${PROVIDER_INPUT_LIMITS.maxConstraints}.`
    );
  }
  if (
    data.deterministicSuggestions.length >
    PROVIDER_INPUT_LIMITS.maxDeterministicSuggestions
  ) {
    errors.push(
      `deterministicSuggestions exceeds ${PROVIDER_INPUT_LIMITS.maxDeterministicSuggestions}.`
    );
  }
  if (
    data.deterministicSuppressions.length >
    PROVIDER_INPUT_LIMITS.maxDeterministicSuppressions
  ) {
    errors.push(
      `deterministicSuppressions exceeds ${PROVIDER_INPUT_LIMITS.maxDeterministicSuppressions}.`
    );
  }
  if (
    data.deterministicConflicts.length >
    PROVIDER_INPUT_LIMITS.maxDeterministicConflicts
  ) {
    errors.push(
      `deterministicConflicts exceeds ${PROVIDER_INPUT_LIMITS.maxDeterministicConflicts}.`
    );
  }
  if (data.contractVersion !== SCOPE_DISCOVERY_CONTRACT_VERSION) {
    errors.push(
      `contractVersion must be ${SCOPE_DISCOVERY_CONTRACT_VERSION}.`
    );
  }

  // Reject irrelevant top-level fields that look like commercial/history dumps
  if (raw && typeof raw === "object") {
    const forbiddenKeys = [
      "quotes",
      "pricing",
      "rates",
      "margin",
      "gst",
      "secrets",
      "attachments",
      "apiKey",
      "organisationSecrets",
    ];
    for (const key of Object.keys(raw as object)) {
      if (forbiddenKeys.includes(key)) {
        errors.push(`Irrelevant/forbidden field "${key}" is not allowed.`);
      }
    }
  }

  if (errors.length > 0) {
    throw new ScopeDiscoveryProviderError(
      PROVIDER_ERROR_CODES.INPUT_VALIDATION_FAILED,
      "Provider input exceeded limits or failed policy checks.",
      errors
    );
  }

  // Facts are not silently truncated — over-limit already rejected above.
  return deepFreeze({
    projectId: data.projectId,
    orgId: data.orgId,
    analysisRunId: data.analysisRunId,
    projectBrief: data.projectBrief,
    selectedSiteNotes: data.selectedSiteNotes,
    acceptedWorkAreas: data.acceptedWorkAreas,
    relevantFacts: data.relevantFacts,
    relevantConstraints: data.relevantConstraints,
    deterministicSuggestions:
      data.deterministicSuggestions as ScopeDiscoveryProviderInput["deterministicSuggestions"],
    deterministicSuppressions: data.deterministicSuppressions,
    deterministicConflicts: data.deterministicConflicts,
    sourceSnapshot: data.sourceSnapshot,
    catalogueVersion: data.catalogueVersion,
    contractVersion: data.contractVersion,
    region: data.region,
    analysisObjective: data.analysisObjective,
  });
}

export function buildAllowedEvidenceRefs(
  input: ScopeDiscoveryProviderInput
): ReadonlySet<string> {
  const refs = new Set<string>();
  refs.add("brief:project");
  for (const note of input.selectedSiteNotes) {
    refs.add(`note:${note.noteId}`);
  }
  for (const fact of input.relevantFacts) {
    refs.add(`fact:${fact.key}`);
  }
  for (const constraint of input.relevantConstraints) {
    refs.add(`constraint:${constraint.key}`);
  }
  for (const wa of input.acceptedWorkAreas) {
    refs.add(`work-area:${wa.workAreaId}`);
  }
  for (const suppression of input.deterministicSuppressions) {
    refs.add(`rule:${suppression.relationshipId}`);
  }
  for (const conflict of input.deterministicConflicts) {
    refs.add(`rule:${conflict.relationshipId}`);
  }
  for (const suggestion of input.deterministicSuggestions) {
    if (suggestion.catalogueEdgeId) {
      refs.add(`rule:${suggestion.catalogueEdgeId}`);
    }
  }
  return refs;
}
