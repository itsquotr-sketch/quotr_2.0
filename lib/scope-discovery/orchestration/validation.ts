import { z } from "zod";
import { uuidSchema } from "@/lib/security/numeric-validation";
import { assertNoCommercialFields } from "../validation";
import { SCOPE_DISCOVERY_CONTRACT_VERSION } from "../version";
import { SCOPE_RELATIONSHIP_CATALOGUE_VERSION } from "../catalogue/version";
import { SCOPE_DISCOVERY_PROMPT_VERSION } from "../provider/version";
import { deepFreeze } from "../immutability";
import {
  ORCHESTRATION_ERROR_CODES,
  ScopeDiscoveryOrchestrationError,
} from "./errors";
import {
  DISCOVERY_TRIGGERS,
  type ScopeDiscoveryRequest,
} from "./types";

const noteSchema = z.object({
  noteId: z.string().min(1),
  revision: z.string().min(1),
  content: z.string(),
});

const waSchema = z.object({
  workAreaId: uuidSchema,
  type: z.string().min(1),
  title: z.string().nullable(),
  revision: z.string().min(1),
});

const factSchema = z.object({
  key: z.string().min(1),
  value: z.union([z.string(), z.number(), z.boolean(), z.null()]),
  revision: z.string().min(1),
});

const constraintSchema = z.object({
  key: z.string().min(1),
  value: z.union([z.string(), z.number(), z.boolean(), z.null()]),
  revision: z.string().min(1),
});

const requestSchema = z.object({
  projectId: uuidSchema,
  orgId: uuidSchema,
  requestedRunId: uuidSchema,
  trigger: z.enum(DISCOVERY_TRIGGERS),
  projectBrief: z.string(),
  projectBriefRevision: z.string().min(1),
  selectedSiteNotes: z.array(noteSchema),
  acceptedWorkAreas: z.array(waSchema),
  authoritativeFacts: z.array(factSchema),
  authoritativeConstraints: z.array(constraintSchema),
  priorSuggestions: z.array(z.unknown()),
  priorDecisions: z.array(z.unknown()),
  priorProposals: z.array(z.unknown()),
  priorRejections: z.array(z.unknown()),
  currentContractVersion: z.string().min(1),
  currentCatalogueVersion: z.string().min(1),
  currentPromptVersion: z.string().min(1),
  region: z.string().nullable(),
  analysisObjective: z.string().min(1),
  providerEnabled: z.boolean(),
  explicitUserInitiation: z.boolean(),
  forceNewRun: z.boolean(),
  requestedByUserId: uuidSchema,
  requestedAt: z.string().min(1),
  priorRunSummaries: z.array(z.unknown()),
});

const FORBIDDEN_TOP_LEVEL = [
  "quotes",
  "pricing",
  "rates",
  "margin",
  "gst",
  "secrets",
  "attachments",
  "apiKey",
  "ANTHROPIC_API_KEY",
] as const;

/**
 * Validate and freeze a discovery request. Does not mutate the caller object.
 */
export function validateDiscoveryRequest(
  raw: unknown
): ScopeDiscoveryRequest {
  const commercial = assertNoCommercialFields(raw);
  if (commercial.length > 0) {
    throw new ScopeDiscoveryOrchestrationError(
      ORCHESTRATION_ERROR_CODES.INVALID_REQUEST,
      "Commercial fields are forbidden in discovery requests.",
      commercial.map((c) => c.path)
    );
  }

  if (raw && typeof raw === "object") {
    for (const key of Object.keys(raw as object)) {
      if ((FORBIDDEN_TOP_LEVEL as readonly string[]).includes(key)) {
        throw new ScopeDiscoveryOrchestrationError(
          ORCHESTRATION_ERROR_CODES.INVALID_REQUEST,
          "Irrelevant or forbidden field in discovery request.",
          [`Forbidden field "${key}".`]
        );
      }
    }
  }

  const parsed = requestSchema.safeParse(raw);
  if (!parsed.success) {
    throw new ScopeDiscoveryOrchestrationError(
      ORCHESTRATION_ERROR_CODES.INVALID_REQUEST,
      "Discovery request failed schema validation.",
      parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`)
    );
  }

  const data = parsed.data;
  const errors: string[] = [];

  if (data.currentContractVersion !== SCOPE_DISCOVERY_CONTRACT_VERSION) {
    errors.push(
      `currentContractVersion must be ${SCOPE_DISCOVERY_CONTRACT_VERSION}.`
    );
  }
  if (data.currentCatalogueVersion !== SCOPE_RELATIONSHIP_CATALOGUE_VERSION) {
    errors.push(
      `currentCatalogueVersion must be ${SCOPE_RELATIONSHIP_CATALOGUE_VERSION}.`
    );
  }
  if (data.currentPromptVersion !== SCOPE_DISCOVERY_PROMPT_VERSION) {
    errors.push(
      `currentPromptVersion must be ${SCOPE_DISCOVERY_PROMPT_VERSION}.`
    );
  }

  // Source-change triggers must not invent explicit user initiation silently —
  // caller may set the flag, but we warn via validation when inconsistent.
  // Hard rule: we do not reject; authorisation logic ignores flag for non-explicit triggers.

  if (errors.length > 0) {
    throw new ScopeDiscoveryOrchestrationError(
      ORCHESTRATION_ERROR_CODES.INVALID_REQUEST,
      "Discovery request failed policy checks.",
      errors
    );
  }

  return deepFreeze({
    projectId: data.projectId,
    orgId: data.orgId,
    requestedRunId: data.requestedRunId,
    trigger: data.trigger,
    projectBrief: data.projectBrief,
    projectBriefRevision: data.projectBriefRevision,
    selectedSiteNotes: data.selectedSiteNotes,
    acceptedWorkAreas: data.acceptedWorkAreas,
    authoritativeFacts: data.authoritativeFacts,
    authoritativeConstraints: data.authoritativeConstraints,
    priorSuggestions:
      data.priorSuggestions as ScopeDiscoveryRequest["priorSuggestions"],
    priorDecisions:
      data.priorDecisions as ScopeDiscoveryRequest["priorDecisions"],
    priorProposals:
      data.priorProposals as ScopeDiscoveryRequest["priorProposals"],
    priorRejections:
      data.priorRejections as ScopeDiscoveryRequest["priorRejections"],
    currentContractVersion: data.currentContractVersion,
    currentCatalogueVersion: data.currentCatalogueVersion,
    currentPromptVersion: data.currentPromptVersion,
    region: data.region,
    analysisObjective: data.analysisObjective,
    providerEnabled: data.providerEnabled,
    explicitUserInitiation: data.explicitUserInitiation,
    forceNewRun: data.forceNewRun,
    requestedByUserId: data.requestedByUserId,
    requestedAt: data.requestedAt,
    priorRunSummaries:
      data.priorRunSummaries as ScopeDiscoveryRequest["priorRunSummaries"],
  });
}
