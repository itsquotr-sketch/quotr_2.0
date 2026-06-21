import type { NoteProposalExtractionOutput } from "@/lib/ai/note-proposal-schema";
import {
  parseRawConstraint,
  parseRawFact,
  parseRawNoteAnalysisResponse,
  parseRawWorkArea,
} from "@/lib/ai/note-analysis-schema";
import {
  DERIVED_FACT_KEYS,
  inferUnitFromFactKey,
  normalizeCanonicalFactKey,
} from "@/lib/scopes/fact-keys";

export const DEFAULT_NOTE_REASON = "Identified from site note.";

/** @deprecated Use DERIVED_FACT_KEYS from @/lib/scopes/fact-keys */
export { DERIVED_FACT_KEYS };

export function normalizeFactKey(
  key: string,
  workAreaType: string | null
): string {
  return normalizeCanonicalFactKey(key, workAreaType);
}

export function inferUnitFromKey(key: string): string | undefined {
  return inferUnitFromFactKey(key);
}

const LABEL_FROM_KEY: Record<string, string> = {
  "deck.length_m": "Length",
  "deck.width_m": "Width",
  "deck.area_m2": "Area",
  "fence.length_m": "Length",
  "fence.height_m": "Height",
  "retaining_wall.length_m": "Length",
  "retaining_wall.height_m": "Height",
};

export type NormaliseNoteAnalysisResult = {
  output: NoteProposalExtractionOutput;
  warnings: string[];
  skippedCount: number;
};

function nullishString(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
  return String(value);
}

function parseConfidence(value: unknown, fallback = 0.5): number {
  if (typeof value === "number" && !Number.isNaN(value)) {
    return Math.min(1, Math.max(0, value));
  }
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value.trim());
    if (!Number.isNaN(parsed)) {
      return Math.min(1, Math.max(0, parsed));
    }
  }
  return fallback;
}

function parseAction<T extends string>(
  value: unknown,
  allowed: readonly T[]
): T | undefined {
  const text = nullishString(value);
  if (!text) return undefined;
  return allowed.includes(text as T) ? (text as T) : undefined;
}

function coerceFactValue(
  value: unknown
): string | number | boolean | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (typeof value !== "string") return undefined;

  const trimmed = value.trim();
  if (!trimmed) return undefined;

  if (trimmed === "true") return true;
  if (trimmed === "false") return false;

  const withUnit = trimmed.match(/^(\d+(?:\.\d+)?)\s*m(?:etre|eter|rs)?(?:\s|$|²)?/i);
  if (withUnit) return Number(withUnit[1]);

  const bareNumber = trimmed.match(/^(\d+(?:\.\d+)?)$/);
  if (bareNumber) return Number(bareNumber[1]);

  return trimmed;
}

function defaultLabelForKey(key: string): string {
  return (
    LABEL_FROM_KEY[key] ??
    key
      .split(".")
      .pop()
      ?.replace(/_/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase()) ??
    key
  );
}

function resolveWorkAreaType(raw: ReturnType<typeof parseRawFact>): string | null {
  if (!raw) return null;
  return nullishString(raw.work_area_type) ?? nullishString(raw.workAreaType) ?? null;
}

function resolveReason(
  raw: { rationale?: unknown; reason?: unknown },
  fallback = DEFAULT_NOTE_REASON
): string {
  return (
    nullishString(raw.rationale) ?? nullishString(raw.reason) ?? fallback
  );
}

/**
 * Normalise permissive AI note analysis output into canonical extraction objects.
 * Skips invalid items instead of failing the whole analysis.
 */
export function normaliseNoteAnalysis(raw: unknown): NormaliseNoteAnalysisResult {
  const parsed = parseRawNoteAnalysisResponse(raw);
  const warnings: string[] = [];
  let skippedCount = 0;

  if (!parsed) {
    return {
      output: {
        summary: "",
        confidence: 0.5,
        workAreas: [],
        facts: [],
        constraints: [],
        warnings: ["Could not parse note analysis response structure."],
      },
      warnings: ["Could not parse note analysis response structure."],
      skippedCount: 1,
    };
  }

  const workAreas: NoteProposalExtractionOutput["workAreas"] = [];

  for (const item of parsed.workAreas) {
    const rawWorkArea = parseRawWorkArea(item);
    if (!rawWorkArea) {
      skippedCount += 1;
      warnings.push("Skipped invalid work area item.");
      continue;
    }

    const type = nullishString(rawWorkArea.type);
    if (!type) {
      skippedCount += 1;
      warnings.push("Skipped work area without type.");
      continue;
    }

    workAreas.push({
      type,
      confidence: parseConfidence(rawWorkArea.confidence),
      rationale: resolveReason(rawWorkArea),
      action: parseAction(rawWorkArea.action, ["add", "restore", "no_change"]),
    });
  }

  const facts: NoteProposalExtractionOutput["facts"] = [];

  for (const item of parsed.facts) {
    const rawFact = parseRawFact(item);
    if (!rawFact) {
      skippedCount += 1;
      warnings.push("Skipped invalid fact item.");
      continue;
    }

    const workAreaType = resolveWorkAreaType(rawFact);
    const rawKey = nullishString(rawFact.key);
    if (!rawKey) {
      skippedCount += 1;
      warnings.push("Skipped fact without key.");
      continue;
    }

    const key = normalizeFactKey(rawKey, workAreaType);
    if (DERIVED_FACT_KEYS.has(key)) {
      skippedCount += 1;
      warnings.push(`Skipped derived fact key: ${key}`);
      continue;
    }

    const value =
      coerceFactValue(rawFact.value) ?? coerceFactValue(rawFact.proposedValue);
    if (value === undefined) {
      skippedCount += 1;
      warnings.push(`Skipped fact ${key} without value.`);
      continue;
    }

    const unit =
      nullishString(rawFact.unit) ?? inferUnitFromKey(key);

    facts.push({
      work_area_type: workAreaType,
      key,
      label: nullishString(rawFact.label) ?? defaultLabelForKey(key),
      value,
      unit,
      confidence: parseConfidence(rawFact.confidence),
      rationale: resolveReason(rawFact),
      action: parseAction(rawFact.action, ["add", "update", "no_change"]),
    });
  }

  const constraints: NoteProposalExtractionOutput["constraints"] = [];

  for (const item of parsed.constraints) {
    const rawConstraint = parseRawConstraint(item);
    if (!rawConstraint) {
      skippedCount += 1;
      warnings.push("Skipped invalid constraint item.");
      continue;
    }

    const key = nullishString(rawConstraint.key);
    if (!key) {
      skippedCount += 1;
      warnings.push("Skipped constraint without key.");
      continue;
    }

    const value =
      coerceFactValue(rawConstraint.value) ??
      coerceFactValue(rawConstraint.proposedValue);
    if (value === undefined) {
      skippedCount += 1;
      warnings.push(`Skipped constraint ${key} without value.`);
      continue;
    }

    constraints.push({
      key,
      label: nullishString(rawConstraint.label) ?? defaultLabelForKey(key),
      value,
      confidence: parseConfidence(rawConstraint.confidence),
      rationale: resolveReason(rawConstraint),
      action: parseAction(rawConstraint.action, [
        "add",
        "update",
        "no_change",
      ]),
    });
  }

  const modelWarnings = parsed.warnings
    .map((warning) => nullishString(warning))
    .filter((warning): warning is string => Boolean(warning));

  return {
    output: {
      summary: nullishString(parsed.summary) ?? "",
      confidence: parseConfidence(parsed.confidence),
      workAreas,
      facts,
      constraints,
      warnings: [...modelWarnings, ...warnings],
    },
    warnings,
    skippedCount,
  };
}
