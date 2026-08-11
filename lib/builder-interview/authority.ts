/**
 * Stage 3.2.1 — Authority / conflict evaluation.
 *
 * Reuses canonical FACT_SOURCE_PRECEDENCE — does not restate a second table.
 */

import {
  canWriteKeyToConstraints,
  canWriteKeyToFacts,
  factSourcePrecedence,
} from "@/lib/scopes/domain-ownership";
import { factHasValue } from "@/lib/scopes/fact-values";
import { isNotSureValue } from "@/lib/scopes/fact-labels";
import type {
  EvidenceState,
  InterviewConstraintInput,
  InterviewFactInput,
  InterviewWriteTarget,
} from "@/lib/builder-interview/types";

export {
  factSourcePrecedence,
  FACT_SOURCE_PRECEDENCE,
} from "@/lib/scopes/domain-ownership";

const USER_PRECEDENCE = factSourcePrecedence("user");

export function isMeaningfulKnownValue(value: unknown): boolean {
  if (!factHasValue(value)) return false;
  if (isNotSureValue(value)) return false;
  return true;
}

export function assertWriteTargetNamespace(params: {
  writeTarget: InterviewWriteTarget;
  targetKey: string;
}): { ok: true } | { ok: false; error: string } {
  if (params.writeTarget === "CONSTRAINT") {
    if (!canWriteKeyToConstraints(params.targetKey)) {
      return {
        ok: false,
        error: `Constraint write target cannot be scoped fact key: ${params.targetKey}`,
      };
    }
    return { ok: true };
  }
  if (params.writeTarget === "FACT") {
    if (!canWriteKeyToFacts(params.targetKey)) {
      return {
        ok: false,
        error: `Fact write target cannot be reserved constraint key: ${params.targetKey}`,
      };
    }
    return { ok: true };
  }
  return { ok: true };
}

export type ResolvedEvidence = {
  state: EvidenceState;
  value: unknown;
  source: string | null;
  precedence: number;
};

function classifySourceState(
  value: unknown,
  source: string | null | undefined
): EvidenceState {
  if (!isMeaningfulKnownValue(value)) {
    if (factHasValue(value) && isNotSureValue(value)) return "NOT_SURE";
    return "UNKNOWN";
  }
  const src = source ?? null;
  if (src === "user") return "KNOWN";
  if (src === "assumption") return "ASSUMED";
  if (src === "derived") return "DERIVED";
  if (src === "ai_extracted" || src === "default" || src === "system") {
    return "LOWER_AUTHORITY_EVIDENCE";
  }
  // Unknown source with a value — treat as lower authority for interview asks.
  return "LOWER_AUTHORITY_EVIDENCE";
}

export function resolveConstraintEvidence(
  constraints: readonly InterviewConstraintInput[],
  key: string
): ResolvedEvidence {
  const row = constraints.find((c) => c.key === key);
  if (!row) {
    return { state: "UNKNOWN", value: null, source: null, precedence: 0 };
  }
  return {
    state: classifySourceState(row.value, row.source),
    value: row.value,
    source: row.source ?? null,
    precedence: factSourcePrecedence(row.source),
  };
}

export function resolveFactEvidence(
  facts: readonly InterviewFactInput[],
  key: string,
  workAreaId: string | null
): ResolvedEvidence {
  const matches = facts.filter((f) => f.key === key);
  let row: InterviewFactInput | undefined;
  if (workAreaId) {
    row =
      matches.find((f) => f.workAreaId === workAreaId) ??
      matches.find((f) => f.workAreaId === null);
  } else {
    row = matches.find((f) => f.workAreaId === null) ?? matches[0];
  }
  if (!row) {
    return { state: "UNKNOWN", value: null, source: null, precedence: 0 };
  }
  return {
    state: classifySourceState(row.value, row.source),
    value: row.value,
    source: row.source ?? null,
    precedence: factSourcePrecedence(row.source),
  };
}

export function resolveTargetEvidence(params: {
  writeTarget: InterviewWriteTarget;
  targetKey: string;
  workAreaId?: string | null;
  facts: readonly InterviewFactInput[];
  constraints: readonly InterviewConstraintInput[];
}): ResolvedEvidence {
  if (params.writeTarget === "CONSTRAINT") {
    return resolveConstraintEvidence(params.constraints, params.targetKey);
  }
  if (params.writeTarget === "FACT") {
    return resolveFactEvidence(
      params.facts,
      params.targetKey,
      params.workAreaId ?? null
    );
  }
  return { state: "UNKNOWN", value: null, source: null, precedence: 0 };
}

/**
 * Model conflict outcome for a proposed user answer (no writes).
 * D13: user vs different user → conflict confirm; lower authority → may supersede.
 */
export function evaluateProposedUserAnswer(params: {
  existing: ResolvedEvidence;
  proposedValue: unknown;
}): {
  evidenceState: EvidenceState;
  requiresConflictConfirm: boolean;
} {
  const { existing, proposedValue } = params;
  if (!isMeaningfulKnownValue(proposedValue)) {
    return {
      evidenceState: existing.state,
      requiresConflictConfirm: false,
    };
  }

  if (existing.state === "UNKNOWN" || existing.state === "NOT_SURE") {
    return { evidenceState: "KNOWN", requiresConflictConfirm: false };
  }

  if (existing.precedence < USER_PRECEDENCE) {
    return { evidenceState: "KNOWN", requiresConflictConfirm: false };
  }

  // Existing user evidence
  if (valuesMateriallyEqual(existing.value, proposedValue)) {
    return { evidenceState: "KNOWN", requiresConflictConfirm: false };
  }

  return { evidenceState: "USER_CONFLICT", requiresConflictConfirm: true };
}

function valuesMateriallyEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a === "string" && typeof b === "string") {
    return a.trim().toLowerCase() === b.trim().toLowerCase();
  }
  if (typeof a === "boolean" || typeof b === "boolean") {
    const norm = (v: unknown) => {
      if (v === true || v === "true" || v === "Yes" || v === "yes") return "yes";
      if (v === false || v === "false" || v === "No" || v === "no") return "no";
      return String(v).toLowerCase();
    };
    return norm(a) === norm(b);
  }
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}

/** Whether existing evidence should suppress an ASK for this target. */
export function evidenceSuppressesAsk(state: EvidenceState): boolean {
  return (
    state === "KNOWN" ||
    state === "ASSUMED" ||
    state === "DERIVED" ||
    state === "LOWER_AUTHORITY_EVIDENCE"
  );
}
