import type { ScopeQuestionTemplate } from "@/lib/scopes/types";

export type FactSource =
  | "user"
  | "ai_extracted"
  | "derived"
  | "default"
  | "assumption"
  | "system";

export type ProjectFactRecord = {
  key: string;
  work_area_id: string | null;
  value: unknown;
  source?: string | null;
};

const NOT_SURE_VALUES = new Set([
  "not sure",
  "not_sure",
  "unknown",
  "unsure",
]);

export function factHasValue(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.length > 0;
  }
  return value !== null && value !== undefined && value !== "";
}

export function toPositiveNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return value;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return null;
}

export function roundToTwoDecimals(value: number): number {
  return Math.round(value * 100) / 100;
}

export function normalizeBooleanForUi(value: unknown): string | null {
  if (value === true || value === "true" || value === "Yes" || value === "yes") {
    return "Yes";
  }
  if (value === false || value === "false" || value === "No" || value === "no") {
    return "No";
  }
  if (typeof value === "string") {
    const lower = value.trim().toLowerCase();
    if (NOT_SURE_VALUES.has(lower) || value === "Not sure") {
      return "Not sure";
    }
  }
  return null;
}

export function normalizeAnswerForUi(
  value: unknown,
  inputType: ScopeQuestionTemplate["inputType"],
  options?: string[]
): string | number | boolean | string[] | null {
  if (!factHasValue(value)) {
    return null;
  }

  if (inputType === "number") {
    const numeric = toPositiveNumber(value);
    return numeric ?? (typeof value === "number" ? value : Number(value));
  }

  if (inputType === "boolean") {
    return normalizeBooleanForUi(value);
  }

  if (inputType === "multi_select") {
    if (Array.isArray(value)) {
      return value.filter((item): item is string => typeof item === "string");
    }
    if (typeof value === "string" && value.trim()) {
      return value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
    }
    return [];
  }

  if (inputType === "select" && typeof value === "string" && options?.length) {
    const match = options.find(
      (option) => option.toLowerCase() === value.toLowerCase()
    );
    return match ?? value;
  }

  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  return null;
}

export function normalizeAnswerForStorage(
  value: string | number | boolean | string[],
  inputType: ScopeQuestionTemplate["inputType"]
): string | number | boolean | string[] {
  if (inputType === "multi_select") {
    if (Array.isArray(value)) return value;
    if (typeof value === "string" && value.trim()) {
      return value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
    }
    return [];
  }

  if (inputType === "number") {
    if (typeof value === "number") return value;
    if (typeof value === "string" && value.trim() !== "") {
      return Number(value);
    }
  }

  if (inputType === "boolean") {
    if (value === "Yes" || value === true) return true;
    if (value === "No" || value === false) return false;
    if (value === "Not sure") return "Not sure";
  }

  return value;
}

export function mapFactSourceToQuestionAnswerSource(
  source: string | null | undefined
): "user" | "ai_extracted" | "system" | null {
  if (source === "user") return "user";
  if (source === "ai_extracted") return "ai_extracted";
  if (source === "derived" || source === "system" || source === "default") {
    return "system";
  }
  return null;
}

function getFactForQuestion(
  facts: ProjectFactRecord[],
  workAreaId: string,
  factKey: string
): ProjectFactRecord | undefined {
  return facts.find(
    (fact) => fact.work_area_id === workAreaId && fact.key === factKey
  );
}

export function getPrepopulationForQuestion(params: {
  facts: ProjectFactRecord[];
  workAreaId: string;
  factKey: string;
  inputType: ScopeQuestionTemplate["inputType"];
  options?: string[];
}): {
  value: string | number | boolean | string[] | null;
  source: "user" | "ai_extracted" | "system" | null;
} | null {
  const fact = getFactForQuestion(
    params.facts,
    params.workAreaId,
    params.factKey
  );

  if (!fact || !factHasValue(fact.value)) {
    return null;
  }

  if (fact.source === "user") {
    return {
      value: normalizeAnswerForUi(
        fact.value,
        params.inputType,
        params.options
      ),
      source: "user",
    };
  }

  if (fact.source === "ai_extracted") {
    return {
      value: normalizeAnswerForUi(
        fact.value,
        params.inputType,
        params.options
      ),
      source: "ai_extracted",
    };
  }

  if (fact.source === "derived") {
    return {
      value: normalizeAnswerForUi(
        fact.value,
        params.inputType,
        params.options
      ),
      source: "system",
    };
  }

  return {
    value: normalizeAnswerForUi(
      fact.value,
      params.inputType,
      params.options
    ),
    source: mapFactSourceToQuestionAnswerSource(fact.source),
  };
}

export function buildFactLookup(
  facts: ProjectFactRecord[]
): Map<string, ProjectFactRecord> {
  const lookup = new Map<string, ProjectFactRecord>();

  for (const fact of facts) {
    if (!fact.work_area_id) continue;
    lookup.set(`${fact.work_area_id}:${fact.key}`, fact);
  }

  return lookup;
}

export function getFactValue(
  lookup: Map<string, ProjectFactRecord>,
  workAreaId: string,
  key: string
): unknown {
  return lookup.get(`${workAreaId}:${key}`)?.value;
}

export function hasFactValue(
  lookup: Map<string, ProjectFactRecord>,
  workAreaId: string,
  key: string
): boolean {
  const value = getFactValue(lookup, workAreaId, key);
  return factHasValue(value);
}
