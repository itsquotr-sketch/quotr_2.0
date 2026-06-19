import type { ScopeQuestionInputType } from "@/lib/scopes/types";
import { getScopeQuestions } from "@/lib/scopes/registry";

export type FactEditMeta = {
  inputType: ScopeQuestionInputType;
  options?: string[];
  unit?: string;
  label?: string;
};

export function resolveFactEditMeta(
  workAreaType: string,
  factKey: string,
  rawValue: unknown
): FactEditMeta {
  const templates = getScopeQuestions(workAreaType);
  const template = templates.find(
    (item) => item.factKey === factKey || item.key === factKey
  );

  if (template) {
    return {
      inputType: template.inputType,
      options: template.options,
      unit: template.unit,
      label: template.label,
    };
  }

  if (typeof rawValue === "boolean") {
    return {
      inputType: "boolean",
      options: ["Yes", "No", "Not sure"],
    };
  }

  if (typeof rawValue === "number") {
    return { inputType: "number" };
  }

  return { inputType: "text" };
}

export function getDerivedFactNote(
  workAreaType: string,
  factKey: string
): string | undefined {
  if (workAreaType === "deck" && factKey === "deck.area_m2") {
    return "Calculated from length × width";
  }
  if (
    workAreaType === "retaining_wall" &&
    factKey === "retaining_wall.height_m"
  ) {
    return "Calculated from high and low heights";
  }
  if (
    workAreaType === "retaining_wall" &&
    factKey === "retaining_wall.average_height_m"
  ) {
    return "Calculated from high and low heights";
  }
  return undefined;
}
