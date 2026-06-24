import type { QualityLevel } from "@/components/assistant/types";
import type { EstimateFact } from "@/lib/estimate/types";
import { resolveFinishLevel } from "@/lib/scopes/finish-level";

const NOT_SURE_VALUES = new Set([
  "not sure",
  "not_sure",
  "unknown",
  "unsure",
]);

export function hasFactValue(value: unknown): boolean {
  return value !== null && value !== undefined && value !== "";
}

export function isNotSureValue(value: unknown): boolean {
  if (typeof value !== "string") return false;
  const lower = value.trim().toLowerCase();
  return NOT_SURE_VALUES.has(lower) || value === "Not sure";
}

export function getFact(
  facts: EstimateFact[],
  workAreaId: string | null,
  key: string
): EstimateFact | undefined {
  return facts.find(
    (fact) => fact.work_area_id === workAreaId && fact.key === key
  );
}

export function getWorkAreaFacts(
  facts: EstimateFact[],
  workAreaId: string
): EstimateFact[] {
  return facts.filter((fact) => fact.work_area_id === workAreaId);
}

export function hasFact(
  facts: EstimateFact[],
  workAreaId: string,
  key: string
): boolean {
  const fact = getFact(facts, workAreaId, key);
  return hasFactValue(fact?.value) && !isNotSureValue(fact?.value);
}

export function getNumberFact(
  facts: EstimateFact[],
  workAreaId: string,
  key: string
): number | null {
  const value = getFact(facts, workAreaId, key)?.value;
  if (!hasFactValue(value) || isNotSureValue(value)) return null;

  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }

  return null;
}

export function getStringFact(
  facts: EstimateFact[],
  workAreaId: string,
  key: string
): string | null {
  const value = getFact(facts, workAreaId, key)?.value;
  if (!hasFactValue(value) || isNotSureValue(value)) return null;

  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return null;
}

export function getBooleanFact(
  facts: EstimateFact[],
  workAreaId: string,
  key: string
): boolean | null {
  const value = getFact(facts, workAreaId, key)?.value;
  if (!hasFactValue(value) || isNotSureValue(value)) return null;

  if (value === true || value === "true" || value === "Yes" || value === "yes") {
    return true;
  }
  if (value === false || value === "false" || value === "No" || value === "no") {
    return false;
  }

  return null;
}

export function getBooleanFactAny(
  facts: EstimateFact[],
  workAreaId: string,
  keys: string[]
): boolean | null {
  for (const key of keys) {
    const value = getBooleanFact(facts, workAreaId, key);
    if (value !== null) return value;
  }
  return null;
}

export function getStringFactAny(
  facts: EstimateFact[],
  workAreaId: string,
  keys: string[]
): string | null {
  for (const key of keys) {
    const value = getStringFact(facts, workAreaId, key);
    if (value) return value;
  }
  return null;
}

export function getNumberFactAny(
  facts: EstimateFact[],
  workAreaId: string,
  keys: string[]
): number | null {
  for (const key of keys) {
    const value = getNumberFact(facts, workAreaId, key);
    if (value !== null) return value;
  }
  return null;
}

export function getArrayFact(
  facts: EstimateFact[],
  workAreaId: string,
  key: string
): string[] {
  const value = getFact(facts, workAreaId, key)?.value;
  if (!hasFactValue(value) || isNotSureValue(value)) return [];
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }
  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

/** True when a select-style changes field indicates work is included. */
export function getTradeChangesIncluded(
  facts: EstimateFact[],
  workAreaId: string,
  key: string
): boolean | null {
  const value = getStringFact(facts, workAreaId, key);
  if (!value) return null;
  const lower = value.toLowerCase();
  if (lower === "none" || lower === "no") return false;
  if (lower.includes("minor") || lower.includes("major")) return true;
  return null;
}

export function formatMissing(label: string): string {
  return `${label} not confirmed`;
}

export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function getFinishLevel(
  facts: EstimateFact[],
  workAreaId: string,
  workAreaType: string,
  projectQualityLevel: QualityLevel | null
): string {
  return resolveFinishLevel({
    workAreaType,
    workAreaId,
    projectQualityLevel,
    getWorkAreaFinishLevel: (id, factKey) =>
      getStringFact(facts, id, factKey),
  });
}
