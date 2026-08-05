import { parseJsonObject } from "@/lib/ai/parse-json";
import { assertNoCommercialFields } from "../validation";
import {
  resolveCanonicalScopeId,
  isCanonicalScopeId,
} from "../catalogue/normalisation";
import {
  PROVIDER_ERROR_CODES,
  ScopeDiscoveryProviderError,
} from "./errors";
import { providerOutputSchema, type ProviderOutputParsed } from "./schema";
import {
  PROVIDER_INPUT_LIMITS,
  type ProviderRawOutput,
  type ScopeDiscoveryProviderInput,
} from "./types";

const FORBIDDEN_STATUS_KEYS = [
  "status",
  "accepted",
  "rejected",
  "modified",
  "decision",
  "userDecision",
];

const LEGAL_PATTERNS =
  /\b(building consent required|illegal|non[- ]compliant|code compliance|must obtain consent)\b/i;

export interface OutputValidationSuccess {
  readonly ok: true;
  readonly output: ProviderRawOutput;
  readonly warnings: readonly string[];
}

export interface OutputValidationFailure {
  readonly ok: false;
  readonly errors: readonly string[];
}

export type OutputValidationResult =
  | OutputValidationSuccess
  | OutputValidationFailure;

export function validateProviderOutputText(params: {
  readonly text: string;
  readonly input: ScopeDiscoveryProviderInput;
  readonly allowedEvidenceRefs: ReadonlySet<string>;
}): OutputValidationResult {
  const json = parseJsonObject(params.text);
  if (!json.success) {
    return {
      ok: false,
      errors: [`Malformed JSON: ${json.error}`],
    };
  }

  return validateProviderOutputObject({
    raw: json.data,
    input: params.input,
    allowedEvidenceRefs: params.allowedEvidenceRefs,
  });
}

export function validateProviderOutputObject(params: {
  readonly raw: unknown;
  readonly input: ScopeDiscoveryProviderInput;
  readonly allowedEvidenceRefs: ReadonlySet<string>;
}): OutputValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const commercial = assertNoCommercialFields(params.raw);
  if (commercial.length > 0) {
    errors.push(
      ...commercial.map((c) => `Commercial field forbidden: ${c.path}`)
    );
  }

  if (params.raw && typeof params.raw === "object") {
    const walk = (value: unknown, path: string): void => {
      if (!value || typeof value !== "object") return;
      if (Array.isArray(value)) {
        value.forEach((item, i) => walk(item, `${path}[${i}]`));
        return;
      }
      for (const [key, child] of Object.entries(value)) {
        if (FORBIDDEN_STATUS_KEYS.includes(key)) {
          errors.push(`Forbidden status/decision field at ${path}.${key}`);
        }
        if (typeof child === "string" && LEGAL_PATTERNS.test(child)) {
          errors.push(`Legal/compliance conclusion prohibited at ${path}.${key}`);
        }
        walk(child, `${path}.${key}`);
      }
    };
    walk(params.raw, "$");
  }

  const parsed = providerOutputSchema.safeParse(params.raw);
  if (!parsed.success) {
    errors.push(
      ...parsed.error.issues.map(
        (i) => `${i.path.join(".") || "$"}: ${i.message}`
      )
    );
    return { ok: false, errors };
  }

  const data: ProviderOutputParsed = parsed.data;
  if (data.candidates.length > PROVIDER_INPUT_LIMITS.maxOutputCandidates) {
    errors.push(
      `candidates exceeds ${PROVIDER_INPUT_LIMITS.maxOutputCandidates}.`
    );
  }

  const suppressedTypes = new Set(
    params.input.deterministicSuppressions.map((s) =>
      (resolveCanonicalScopeId(s.candidateScopeType) ?? s.candidateScopeType).toLowerCase()
    )
  );

  const seenIdentity = new Set<string>();

  for (const [index, candidate] of data.candidates.entries()) {
    const base = `candidates[${index}]`;
    const scope =
      resolveCanonicalScopeId(candidate.proposedWorkAreaType) ??
      candidate.proposedWorkAreaType.toLowerCase();

    if (
      !isCanonicalScopeId(scope) &&
      !resolveCanonicalScopeId(candidate.proposedWorkAreaType)
    ) {
      errors.push(`${base}: unsupported Work Area type "${candidate.proposedWorkAreaType}".`);
    }

    if (suppressedTypes.has(scope)) {
      errors.push(
        `${base}: candidate overrides deterministic suppression for "${scope}".`
      );
    }

    if (candidate.evidenceReferences.length === 0) {
      errors.push(`${base}: confidence requires evidence references.`);
    }

    for (const ref of candidate.evidenceReferences) {
      if (!params.allowedEvidenceRefs.has(ref)) {
        errors.push(`${base}: fabricated/unknown evidence reference "${ref}".`);
      }
    }

    if (candidate.confidenceBand === "HIGH") {
      const unique = new Set(candidate.evidenceReferences);
      if (unique.size < 2) {
        errors.push(
          `${base}: HIGH confidence requires at least two evidence references.`
        );
      }
    }

    if (
      candidate.relatedWorkAreaReference &&
      !params.allowedEvidenceRefs.has(candidate.relatedWorkAreaReference) &&
      !params.allowedEvidenceRefs.has(
        candidate.relatedWorkAreaReference.startsWith("work-area:")
          ? candidate.relatedWorkAreaReference
          : `work-area:${candidate.relatedWorkAreaReference}`
      )
    ) {
      // Allow bare UUID if it matches an accepted WA id
      const waIds = new Set(
        params.input.acceptedWorkAreas.map((w) => w.workAreaId)
      );
      if (
        !waIds.has(candidate.relatedWorkAreaReference) &&
        !params.allowedEvidenceRefs.has(
          `work-area:${candidate.relatedWorkAreaReference}`
        )
      ) {
        errors.push(
          `${base}: relatedWorkAreaReference is not an accepted work area.`
        );
      }
    }

    if (
      candidate.parentSuggestionReference &&
      candidate.parentSuggestionReference === candidate.proposedTitle
    ) {
      errors.push(`${base}: self-referential parent relationship.`);
    }

    const identity = `${candidate.suggestionKind}|${scope}|${candidate.rationaleCode}`;
    if (seenIdentity.has(identity)) {
      errors.push(`${base}: duplicate candidate identity.`);
    }
    seenIdentity.add(identity);
  }

  warnings.push(...data.warnings);

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    output: {
      candidates: data.candidates,
      warnings: data.warnings,
    },
    warnings: [...new Set(warnings)],
  };
}

export function assertValidOrThrow(
  result: OutputValidationResult
): asserts result is OutputValidationSuccess {
  if (!result.ok) {
    throw new ScopeDiscoveryProviderError(
      PROVIDER_ERROR_CODES.OUTPUT_VALIDATION_FAILED,
      "Provider output failed validation.",
      result.errors
    );
  }
}
