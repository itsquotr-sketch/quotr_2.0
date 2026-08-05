import { assertNoCommercialFields } from "../validation";
import { deepFreeze } from "../immutability";
import { CONFIDENCE_BANDS, SUGGESTION_KINDS } from "../types";
import { CATALOGUE_ERROR_CODES } from "./codes";
import { isCanonicalScopeId, resolveCanonicalScopeId } from "./normalisation";
import {
  CONDITION_OPERATORS,
  RELATIONSHIP_TYPES,
  REQUIREMENT_LEVELS,
  type CatalogueCondition,
  type CatalogueValidationIssue,
  type CatalogueValidationResult,
  type ScopeRelationship,
} from "./types";

function issue(
  code: (typeof CATALOGUE_ERROR_CODES)[keyof typeof CATALOGUE_ERROR_CODES],
  message: string,
  path: string
): CatalogueValidationIssue {
  return { code, message, path };
}

function validateCondition(
  condition: CatalogueCondition,
  path: string,
  issues: CatalogueValidationIssue[]
): void {
  if (typeof condition !== "object" || condition === null) {
    issues.push(
      issue(
        CATALOGUE_ERROR_CODES.INVALID_CONDITION,
        "Condition must be an object.",
        path
      )
    );
    return;
  }
  if (typeof condition.op !== "string") {
    issues.push(
      issue(
        CATALOGUE_ERROR_CODES.UNKNOWN_OPERATOR,
        "Condition missing op.",
        path
      )
    );
    return;
  }
  if (!(CONDITION_OPERATORS as readonly string[]).includes(condition.op)) {
    issues.push(
      issue(
        CATALOGUE_ERROR_CODES.UNKNOWN_OPERATOR,
        `Unknown operator ${condition.op}.`,
        `${path}.op`
      )
    );
  }
  for (const [key, value] of Object.entries(condition)) {
    if (typeof value === "function") {
      issues.push(
        issue(
          CATALOGUE_ERROR_CODES.EXECUTABLE_PREDICATE_FORBIDDEN,
          `Executable predicate forbidden at ${key}.`,
          `${path}.${key}`
        )
      );
    }
  }
  if (condition.op === "all" || condition.op === "any") {
    condition.conditions.forEach((child, i) =>
      validateCondition(child, `${path}.conditions[${i}]`, issues)
    );
  }
}

export function validateCatalogueRelationships(
  relationships: readonly ScopeRelationship[]
): CatalogueValidationResult {
  const issues: CatalogueValidationIssue[] = [];
  const ids = new Set<string>();
  const semanticEdges = new Set<string>();

  for (const [index, rel] of relationships.entries()) {
    const base = `relationships[${index}]`;
    for (const commercial of assertNoCommercialFields(rel)) {
      issues.push({
        code: CATALOGUE_ERROR_CODES.COMMERCIAL_FIELD_FORBIDDEN,
        message: commercial.message,
        path: `${base}${commercial.path === "$" ? "" : `.${commercial.path.replace(/^\./, "")}`}`,
      });
    }

    if (ids.has(rel.relationshipId)) {
      issues.push(
        issue(
          CATALOGUE_ERROR_CODES.DUPLICATE_RELATIONSHIP_ID,
          `Duplicate relationshipId ${rel.relationshipId}.`,
          `${base}.relationshipId`
        )
      );
    }
    ids.add(rel.relationshipId);

    if (!rel.rationaleCode || rel.rationaleCode.trim().length === 0) {
      issues.push(
        issue(
          CATALOGUE_ERROR_CODES.MISSING_RATIONALE,
          "rationaleCode required.",
          `${base}.rationaleCode`
        )
      );
    }

    if (!rel.evidenceRequirements) {
      issues.push(
        issue(
          CATALOGUE_ERROR_CODES.MISSING_EVIDENCE_REQUIREMENTS,
          "evidenceRequirements required.",
          `${base}.evidenceRequirements`
        )
      );
    }

    if (
      !isCanonicalScopeId(rel.parentScopeType) &&
      !resolveCanonicalScopeId(rel.parentScopeType)
    ) {
      issues.push(
        issue(
          CATALOGUE_ERROR_CODES.UNKNOWN_SCOPE_ID,
          `Unknown parentScopeType ${rel.parentScopeType}.`,
          `${base}.parentScopeType`
        )
      );
    }
    if (
      !isCanonicalScopeId(rel.candidateScopeType) &&
      !resolveCanonicalScopeId(rel.candidateScopeType)
    ) {
      issues.push(
        issue(
          CATALOGUE_ERROR_CODES.UNKNOWN_SCOPE_ID,
          `Unknown candidateScopeType ${rel.candidateScopeType}.`,
          `${base}.candidateScopeType`
        )
      );
    }

    if (!(RELATIONSHIP_TYPES as readonly string[]).includes(rel.relationshipType)) {
      issues.push(
        issue(
          CATALOGUE_ERROR_CODES.INVALID_RELATIONSHIP_TYPE,
          `Invalid relationshipType ${rel.relationshipType}.`,
          `${base}.relationshipType`
        )
      );
    }
    if (!(REQUIREMENT_LEVELS as readonly string[]).includes(rel.requirementLevel)) {
      issues.push(
        issue(
          CATALOGUE_ERROR_CODES.INVALID_REQUIREMENT_LEVEL,
          `Invalid requirementLevel ${rel.requirementLevel}.`,
          `${base}.requirementLevel`
        )
      );
    }
    if (!(CONFIDENCE_BANDS as readonly string[]).includes(rel.defaultConfidenceBand)) {
      issues.push(
        issue(
          CATALOGUE_ERROR_CODES.INVALID_BAND,
          `Invalid band ${rel.defaultConfidenceBand}.`,
          `${base}.defaultConfidenceBand`
        )
      );
    }
    if (!(SUGGESTION_KINDS as readonly string[]).includes(rel.suggestionKind)) {
      issues.push(
        issue(
          CATALOGUE_ERROR_CODES.INVALID_SUGGESTION_KIND,
          `Invalid suggestionKind ${rel.suggestionKind}.`,
          `${base}.suggestionKind`
        )
      );
    }

    validateCondition(rel.triggerConditions, `${base}.triggerConditions`, issues);
    if (rel.suppressConditions) {
      validateCondition(
        rel.suppressConditions,
        `${base}.suppressConditions`,
        issues
      );
    }
    if (rel.conflictConditions) {
      validateCondition(
        rel.conflictConditions,
        `${base}.conflictConditions`,
        issues
      );
    }

    const semanticKey = `${rel.parentScopeType}|${rel.candidateScopeType}|${rel.relationshipType}|${rel.suggestionKind}`;
    if (semanticEdges.has(semanticKey) && rel.active) {
      issues.push(
        issue(
          CATALOGUE_ERROR_CODES.DUPLICATE_SEMANTIC_EDGE,
          `Duplicate semantic edge ${semanticKey}.`,
          `${base}`
        )
      );
    }
    if (rel.active) semanticEdges.add(semanticKey);

    if (
      rel.suppressConditions &&
      JSON.stringify(rel.triggerConditions) ===
        JSON.stringify(rel.suppressConditions)
    ) {
      issues.push(
        issue(
          CATALOGUE_ERROR_CODES.IMPOSSIBLE_TRIGGER_SUPPRESS,
          "Trigger and suppress conditions are identical.",
          base
        )
      );
    }
  }

  return deepFreeze({
    ok: issues.length === 0,
    issues,
  });
}
