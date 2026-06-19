import type { QualityLevel } from "@/components/assistant/types";

/** Work-area fact keys satisfied by project.quality_level when not unknown. */
export const FINISH_LEVEL_FACT_KEYS = new Set([
  "bathroom.finish_level",
  "kitchen.finish_level",
]);

const FINISH_LEVEL_BY_WORK_AREA_TYPE: Record<string, string> = {
  bathroom: "bathroom.finish_level",
  kitchen: "kitchen.finish_level",
};

export function isInheritedFinishLevelKey(factKey: string): boolean {
  return FINISH_LEVEL_FACT_KEYS.has(factKey);
}

export function qualityLevelToFinishLevel(
  qualityLevel: string | null | undefined
): string | null {
  switch (qualityLevel) {
    case "budget":
      return "Budget";
    case "standard":
      return "Standard";
    case "premium":
      return "Premium";
    default:
      return null;
  }
}

export function isFinishLevelInheritedFromProject(
  qualityLevel: string | null | undefined
): boolean {
  return qualityLevelToFinishLevel(qualityLevel) !== null;
}

export function getFinishLevelFactKeyForWorkAreaType(
  workAreaType: string
): string | null {
  return FINISH_LEVEL_BY_WORK_AREA_TYPE[workAreaType] ?? null;
}

export function getInheritedFinishLevelForWorkArea(
  workAreaType: string,
  qualityLevel: string | null | undefined
): { factKey: string; value: string } | null {
  const factKey = getFinishLevelFactKeyForWorkAreaType(workAreaType);
  const value = qualityLevelToFinishLevel(qualityLevel);
  if (!factKey || !value) return null;
  return { factKey, value };
}

export function resolveFinishLevel(params: {
  workAreaType: string;
  workAreaId: string;
  projectQualityLevel: QualityLevel | null;
  getWorkAreaFinishLevel?: (workAreaId: string, factKey: string) => string | null;
}): string {
  const factKey = getFinishLevelFactKeyForWorkAreaType(params.workAreaType);
  if (factKey && params.getWorkAreaFinishLevel) {
    const fromWorkArea = params.getWorkAreaFinishLevel(
      params.workAreaId,
      factKey
    );
    if (fromWorkArea) return fromWorkArea;
  }

  return (
    qualityLevelToFinishLevel(params.projectQualityLevel) ?? "Standard"
  );
}
