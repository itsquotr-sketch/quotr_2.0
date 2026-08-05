import { SUGGESTION_KINDS } from "../types";
import type { ScopeDiscoveryProviderInput } from "./types";
import { SCOPE_DISCOVERY_PROMPT_VERSION } from "./version";

export const SCOPE_DISCOVERY_SYSTEM_PROMPT = `You are Quotr's contextual scope-discovery assistant for building contractors.

You PROPOSE only. You never decide, accept, reject, or mutate records.

Hard rules:
1. AI proposes only. The user decides later.
2. Deterministic catalogue rules supplied in the input are authoritative for required considerations, suppressions, and conflicts. Do not override them.
3. Accepted Work Areas and user Facts must not be contradicted silently.
4. Explicit exclusions / suppressions must be respected — do not re-propose suppressed candidate scope types.
5. Unknown must remain unknown. Do not invent measurements, quantities, or customer requirements.
6. Missing evidence should produce clarification candidates (CLARIFICATION_REQUIRED), not fabricated facts.
7. No pricing, rates, margin, GST, or commercial calculations.
8. No legal, consent, or compliance conclusions.
9. No assumptions presented as facts.
10. Cite only supplied evidence references (brief:project, note:<id>, fact:<key>, constraint:<key>, work-area:<id>, rule:<relationship-id>).
11. Output valid JSON only matching the schema. No prose outside JSON.
12. Every candidate must be status-implied PROPOSED only — do not emit accepted/rejected/modified statuses.
13. Do not invent Work Area types outside the allowed catalogue identifiers supplied.
14. Do not invent evidence references.

Return JSON of the form:
{
  "candidates": [ ... ],
  "warnings": [ "..." ]
}

Each candidate fields:
suggestionKind, proposedWorkAreaType, proposedTitle, proposedDescription,
relatedWorkAreaReference, parentSuggestionReference, confidenceBand,
evidenceReferences, rationaleCode, missingInformation, dependencyReferences,
conflictReferences.

suggestionKind must be one of: ${SUGGESTION_KINDS.join(", ")}.
confidenceBand must be one of: HIGH, MEDIUM, LOW.
HIGH confidence requires at least two supporting evidenceReferences (or one DETERMINISTIC_RULE-equivalent rule: reference plus another source).
`;

export function buildScopeDiscoveryUserPrompt(
  input: ScopeDiscoveryProviderInput,
  allowedEvidenceRefs: ReadonlySet<string>
): string {
  const payload = {
    promptVersion: SCOPE_DISCOVERY_PROMPT_VERSION,
    analysisObjective: input.analysisObjective,
    region: input.region,
    catalogueVersion: input.catalogueVersion,
    contractVersion: input.contractVersion,
    projectBrief: input.projectBrief,
    selectedSiteNotes: input.selectedSiteNotes,
    acceptedWorkAreas: input.acceptedWorkAreas,
    relevantFacts: input.relevantFacts,
    relevantConstraints: input.relevantConstraints,
    deterministicSuggestions: input.deterministicSuggestions.map((s) => ({
      suggestionKind: s.suggestionKind,
      proposedWorkAreaType: s.proposedWorkAreaType,
      proposedTitle: s.proposedTitle,
      catalogueEdgeId: s.catalogueEdgeId,
      confidenceBand: s.confidenceBand,
      rationaleKey: s.rationaleKey,
    })),
    deterministicSuppressions: input.deterministicSuppressions,
    deterministicConflicts: input.deterministicConflicts,
    allowedEvidenceReferences: [...allowedEvidenceRefs].sort(),
  };

  return [
    "Perform contextual Intelligent Scope Discovery for the following project context.",
    "Respect deterministic suppressions and conflicts. Propose only additional contextual candidates.",
    "Respond with schema-conforming JSON only.",
    "",
    JSON.stringify(payload, null, 2),
  ].join("\n");
}

export function buildRepairUserPrompt(params: {
  readonly malformedText: string;
  readonly validationErrors: readonly string[];
}): string {
  return [
    "Your previous response failed validation.",
    "Return ONLY corrected schema-conforming JSON for the same discovery task.",
    "Do not expand the task. Do not invent new evidence references. Do not add commercial fields.",
    "",
    "Validation errors:",
    ...params.validationErrors.map((e) => `- ${e}`),
    "",
    "Previous response (for repair only):",
    params.malformedText.slice(0, 4000),
  ].join("\n");
}

/** Static checks for prompt governance verification. */
export function promptGovernanceMarkers(): readonly string[] {
  return [
    "You PROPOSE only",
    "Deterministic catalogue rules",
    "No pricing, rates, margin, GST",
    "No legal, consent, or compliance conclusions",
    "Cite only supplied evidence references",
    "Output valid JSON only matching the schema",
  ];
}
