import {
  factHasValue,
  roundToTwoDecimals,
  type ProjectFactRecord,
} from "@/lib/scopes/fact-values";
import type { DerivedFactCandidate } from "@/lib/scopes/derived-facts";

const NUMERIC_TOLERANCE_PERCENT = 0.05;

export type DerivedFactConflict = {
  workAreaId: string;
  key: string;
  label: string;
  derivedValue: number | string;
  originalValue: number | string;
  originalSource: string;
  unit?: string;
  warning: string;
};

function formatDisplayValue(value: number | string, unit?: string): string {
  const unitSuffix = unit ? unit : "";
  return `${value}${unitSuffix}`;
}

export function valuesMateriallyDiffer(
  original: unknown,
  derived: number | string
): boolean {
  if (typeof original === "number" && typeof derived === "number") {
    if (!Number.isFinite(original) || !Number.isFinite(derived)) {
      return String(original) !== String(derived);
    }
    if (original === 0 && derived !== 0) return true;
    const base = Math.max(Math.abs(original), Math.abs(derived), 1);
    return Math.abs(original - derived) / base > NUMERIC_TOLERANCE_PERCENT;
  }

  if (typeof original === "string" && typeof derived === "string") {
    return original.trim().toLowerCase() !== derived.trim().toLowerCase();
  }

  return String(original) !== String(derived);
}

export function detectDerivedFactConflicts(
  projectFacts: ProjectFactRecord[],
  derivedFacts: DerivedFactCandidate[]
): DerivedFactConflict[] {
  const conflicts: DerivedFactConflict[] = [];

  for (const derived of derivedFacts) {
    const existing = projectFacts.find(
      (fact) =>
        fact.work_area_id === derived.work_area_id && fact.key === derived.key
    );

    if (!existing || !factHasValue(existing.value)) {
      continue;
    }

    if (existing.source === "user") {
      continue;
    }

    if (
      existing.source !== "ai_extracted" &&
      existing.source !== "derived" &&
      existing.source !== "assumption"
    ) {
      continue;
    }

    if (!valuesMateriallyDiffer(existing.value, derived.value)) {
      continue;
    }

    const label = derived.label;
    const unit = derived.unit;
    conflicts.push({
      workAreaId: derived.work_area_id,
      key: derived.key,
      label,
      derivedValue:
        typeof derived.value === "number"
          ? roundToTwoDecimals(derived.value)
          : derived.value,
      originalValue: existing.value as number | string,
      originalSource: existing.source ?? "unknown",
      unit,
      warning: `${label} recalculated from dimensions: ${formatDisplayValue(
        typeof derived.value === "number"
          ? roundToTwoDecimals(derived.value)
          : derived.value,
        unit
      )}. Original extracted value: ${formatDisplayValue(
        existing.value as number | string,
        unit
      )}.`,
    });
  }

  return conflicts;
}
