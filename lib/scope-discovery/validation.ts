import { z } from "zod";
import { uuidSchema } from "@/lib/security/numeric-validation";
import { SCOPE_DISCOVERY_ERROR_CODES } from "./codes";
import { isConfidenceInBand } from "./confidence";
import { hasDuplicateEvidence } from "./evidence";
import { deepFreeze } from "./immutability";
import {
  CONFIDENCE_BANDS,
  EVIDENCE_SOURCE_TYPES,
  SUGGESTION_KINDS,
  SUGGESTION_STATUSES,
  type ScopeDiscoverySuggestion,
  type ValidationIssue,
  type ValidationResult,
} from "./types";
import { SCOPE_DISCOVERY_CONTRACT_VERSION } from "./version";

const FORBIDDEN_COMMERCIAL_KEYS = [
  "totalCost",
  "total_cost",
  "totalSell",
  "total_sell",
  "grossMargin",
  "gross_margin",
  "grossProfit",
  "gross_profit",
  "gst",
  "gstAmount",
  "rate",
  "unitRate",
  "markup",
  "sellPrice",
  "costPrice",
  "commercialTotal",
] as const;

const evidenceSchema = z.object({
  sourceType: z.enum(EVIDENCE_SOURCE_TYPES),
  sourceId: z.string().min(1),
  excerptOrValue: z.string(),
  relevance: z.enum(["primary", "supporting", "contrary"]),
  timestamp: z.string().min(1),
  provenance: z.enum(["ai", "deterministic_rule", "user", "system"]),
  userAuthored: z.boolean(),
  authoritative: z.boolean(),
});

const clarificationSchema = z.object({
  key: z.string().min(1),
  promptKey: z.string().min(1),
  relatedFactKeys: z.array(z.string()),
});

const sourceSnapshotSchema = z.object({
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

const decisionSchema = z.object({
  decisionType: z.enum(["accept", "reject", "modify"]),
  decidedByUserId: uuidSchema,
  decidedAt: z.string().min(1),
  originalSuggestionId: uuidSchema,
  modifiedTitle: z.string().nullable(),
  modifiedDescription: z.string().nullable(),
  modifiedWorkAreaType: z.string().nullable(),
  reasonCode: z.string().nullable(),
  userNote: z.string().nullable(),
  sourceRevision: z.string().min(1),
  resultingWorkAreaId: z.union([uuidSchema, z.null()]),
});

const providerMetadataSchema = z.object({
  provider: z.string().min(1),
  model: z.string().min(1),
  requestId: z.string().nullable(),
  promptContractVersion: z.string().nullable(),
});

const suggestionSchema = z.object({
  suggestionId: uuidSchema,
  projectId: uuidSchema,
  orgId: uuidSchema,
  analysisRunId: uuidSchema,
  suggestionKind: z.enum(SUGGESTION_KINDS),
  proposedWorkAreaType: z.string().nullable(),
  proposedTitle: z.string(),
  proposedDescription: z.string().nullable(),
  relatedWorkAreaId: z.union([uuidSchema, z.null()]),
  parentSuggestionId: z.union([uuidSchema, z.null()]),
  confidence: z.number().min(0).max(1),
  confidenceBand: z.enum(CONFIDENCE_BANDS),
  evidence: z.array(evidenceSchema),
  rationaleKey: z.string().min(1),
  sourceSnapshot: sourceSnapshotSchema,
  dependencyReferences: z.array(z.string()),
  conflictReferences: z.array(z.string()),
  missingInformation: z.array(clarificationSchema),
  status: z.enum(SUGGESTION_STATUSES),
  decision: decisionSchema.nullable(),
  contractVersion: z.string().min(1),
  providerMetadata: providerMetadataSchema.nullable(),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
  staleReason: z
    .enum([
      "brief_changed",
      "notes_changed",
      "facts_changed",
      "constraints_changed",
      "work_areas_changed",
      "catalogue_version_changed",
      "contract_version_changed",
      "material_source_changed",
    ])
    .nullable(),
  supersededBySuggestionId: z.union([uuidSchema, z.null()]),
  failureCode: z.string().nullable(),
  failureMessage: z.string().nullable(),
  catalogueEdgeId: z.string().nullable(),
  origin: z.enum(["deterministic", "ai", "merged"]),
});

function issue(
  code: (typeof SCOPE_DISCOVERY_ERROR_CODES)[keyof typeof SCOPE_DISCOVERY_ERROR_CODES],
  message: string,
  path: string
): ValidationIssue {
  return { code, message, path };
}

export function assertNoCommercialFields(
  value: unknown,
  path = "$"
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (value === null || value === undefined || typeof value !== "object") {
    return issues;
  }
  if (Array.isArray(value)) {
    value.forEach((item, i) => {
      issues.push(...assertNoCommercialFields(item, `${path}[${i}]`));
    });
    return issues;
  }
  const record = value as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (
      (FORBIDDEN_COMMERCIAL_KEYS as readonly string[]).includes(key) ||
      /^(total|sell|cost|margin|gst|rate|markup)_/i.test(key)
    ) {
      issues.push(
        issue(
          SCOPE_DISCOVERY_ERROR_CODES.COMMERCIAL_FIELD_FORBIDDEN,
          `Commercial field "${key}" is forbidden on scope-discovery suggestions.`,
          `${path}.${key}`
        )
      );
    }
    issues.push(...assertNoCommercialFields(record[key], `${path}.${key}`));
  }
  return issues;
}

export function validateScopeDiscoverySuggestion(
  input: unknown
): ValidationResult {
  const issues: ValidationIssue[] = [];

  issues.push(...assertNoCommercialFields(input));

  const parsed = suggestionSchema.safeParse(input);
  if (!parsed.success) {
    for (const err of parsed.error.issues) {
      const path = err.path.length > 0 ? err.path.join(".") : "$";
      const code =
        path.includes("suggestionKind")
          ? SCOPE_DISCOVERY_ERROR_CODES.INVALID_KIND
          : path.includes("status")
            ? SCOPE_DISCOVERY_ERROR_CODES.INVALID_STATUS
            : path.includes("confidence")
              ? SCOPE_DISCOVERY_ERROR_CODES.INVALID_CONFIDENCE
              : path.includes("evidence")
                ? SCOPE_DISCOVERY_ERROR_CODES.INVALID_EVIDENCE
                : path.includes("sourceSnapshot")
                  ? SCOPE_DISCOVERY_ERROR_CODES.INVALID_SOURCE_SNAPSHOT
                  : path.endsWith("Id") ||
                      path.includes("suggestionId") ||
                      path.includes("projectId")
                    ? SCOPE_DISCOVERY_ERROR_CODES.INVALID_ID
                    : SCOPE_DISCOVERY_ERROR_CODES.INVALID_EVIDENCE;
      issues.push(issue(code, err.message, path));
    }
    return deepFreeze({ ok: false, issues, suggestion: null });
  }

  const suggestion = parsed.data as ScopeDiscoverySuggestion;

  if (suggestion.contractVersion !== SCOPE_DISCOVERY_CONTRACT_VERSION) {
    issues.push(
      issue(
        SCOPE_DISCOVERY_ERROR_CODES.INVALID_CONTRACT_VERSION,
        `Expected contractVersion ${SCOPE_DISCOVERY_CONTRACT_VERSION}.`,
        "contractVersion"
      )
    );
  }

  if (suggestion.proposedTitle.trim().length === 0) {
    issues.push(
      issue(
        SCOPE_DISCOVERY_ERROR_CODES.EMPTY_TITLE,
        "proposedTitle must be non-empty.",
        "proposedTitle"
      )
    );
  }

  if (!isConfidenceInBand(suggestion.confidence, suggestion.confidenceBand)) {
    issues.push(
      issue(
        SCOPE_DISCOVERY_ERROR_CODES.CONFIDENCE_BAND_MISMATCH,
        `confidence ${suggestion.confidence} is inconsistent with band ${suggestion.confidenceBand}.`,
        "confidenceBand"
      )
    );
  }

  if (hasDuplicateEvidence(suggestion.evidence)) {
    issues.push(
      issue(
        SCOPE_DISCOVERY_ERROR_CODES.DUPLICATE_EVIDENCE,
        "Evidence list contains duplicate sourceType+sourceId+relevance entries.",
        "evidence"
      )
    );
  }

  const needsWorkAreaType =
    suggestion.suggestionKind === "WORK_AREA" ||
    suggestion.suggestionKind === "SUB_SCOPE" ||
    suggestion.suggestionKind === "MISSING_SCOPE" ||
    suggestion.suggestionKind === "DEPENDENCY";

  if (
    needsWorkAreaType &&
    (!suggestion.proposedWorkAreaType ||
      suggestion.proposedWorkAreaType.trim().length === 0)
  ) {
    issues.push(
      issue(
        SCOPE_DISCOVERY_ERROR_CODES.WORK_AREA_TYPE_REQUIRED,
        `${suggestion.suggestionKind} requires proposedWorkAreaType.`,
        "proposedWorkAreaType"
      )
    );
  }

  if (
    suggestion.status === "ACCEPTED" ||
    suggestion.status === "REJECTED" ||
    suggestion.status === "MODIFIED"
  ) {
    if (!suggestion.decision) {
      issues.push(
        issue(
          SCOPE_DISCOVERY_ERROR_CODES.DECISION_REQUIRED,
          `${suggestion.status} requires decision metadata.`,
          "decision"
        )
      );
    } else {
      const expected =
        suggestion.status === "ACCEPTED"
          ? "accept"
          : suggestion.status === "REJECTED"
            ? "reject"
            : "modify";
      if (suggestion.decision.decisionType !== expected) {
        issues.push(
          issue(
            SCOPE_DISCOVERY_ERROR_CODES.DECISION_MISMATCH,
            `decisionType ${suggestion.decision.decisionType} does not match status ${suggestion.status}.`,
            "decision.decisionType"
          )
        );
      }
      if (suggestion.status === "MODIFIED") {
        if (
          !suggestion.decision.modifiedTitle ||
          suggestion.decision.modifiedTitle.trim().length === 0
        ) {
          issues.push(
            issue(
              SCOPE_DISCOVERY_ERROR_CODES.DECISION_REQUIRED,
              "MODIFIED requires modifiedTitle on decision.",
              "decision.modifiedTitle"
            )
          );
        }
      }
    }
  }

  if (suggestion.status === "STALE" && !suggestion.staleReason) {
    issues.push(
      issue(
        SCOPE_DISCOVERY_ERROR_CODES.STALE_REASON_REQUIRED,
        "STALE requires staleReason.",
        "staleReason"
      )
    );
  }

  if (
    suggestion.status === "SUPERSEDED" &&
    !suggestion.supersededBySuggestionId
  ) {
    issues.push(
      issue(
        SCOPE_DISCOVERY_ERROR_CODES.SUPERSEDED_LINK_REQUIRED,
        "SUPERSEDED requires supersededBySuggestionId.",
        "supersededBySuggestionId"
      )
    );
  }

  if (
    suggestion.status === "FAILED" &&
    (!suggestion.failureCode || !suggestion.failureMessage)
  ) {
    issues.push(
      issue(
        SCOPE_DISCOVERY_ERROR_CODES.FAILED_ERROR_REQUIRED,
        "FAILED requires failureCode and failureMessage.",
        "failureCode"
      )
    );
  }

  if (issues.length > 0) {
    return deepFreeze({ ok: false, issues, suggestion: null });
  }

  return deepFreeze({
    ok: true,
    issues: [],
    suggestion: deepFreeze(suggestion),
  });
}
