import { getQuestionTemplateByKey } from "@/lib/scopes/registry";

/** Identity that must remount ClarifyValueField when the asked fact changes. */
export function clarifyFieldIdentity(candidate: {
  id?: string | null;
  workAreaId?: string | null;
  factKey?: string | null;
  questionKey?: string | null;
}): string {
  if (candidate.id) return candidate.id;
  return [
    candidate.workAreaId,
    candidate.factKey,
    candidate.questionKey,
  ]
    .filter((part): part is string => Boolean(part))
    .join(":");
}

export function resolveClarifyUnit(input: {
  unit?: string;
  questionKey?: string | null;
  factKey?: string | null;
}): string | undefined {
  if (input.unit) return input.unit;
  const key = input.questionKey ?? input.factKey;
  if (!key) return undefined;
  return getQuestionTemplateByKey(key)?.unit;
}

export function parsePositiveClarifyNumber(
  raw: string
): { ok: true; value: number } | { ok: false; error: string } {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { ok: false, error: "Enter a number." };
  }
  const value = Number(trimmed);
  if (!Number.isFinite(value) || value <= 0) {
    return { ok: false, error: "Enter a number greater than zero." };
  }
  return { ok: true, value };
}
