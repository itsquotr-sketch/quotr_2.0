import { isKnownValue } from "@/lib/assistant/clarify/suppress";
import { getRefineAdapter } from "@/lib/assistant/refine/adapters/registry";
import {
  isCalculatorConsumedConstraint,
  isCalculatorConsumedFact,
} from "@/lib/estimate/consumed-facts";
import type {
  ComposeRefineInput,
  RefineCandidate,
  RefineView,
} from "@/lib/assistant/refine/types";

function constraintKnown(
  constraints: ComposeRefineInput["constraints"],
  key: string
): boolean {
  const row = constraints.find((c) => c.key === key);
  return row != null && isKnownValue(row.value);
}

function projectConditionCandidates(
  input: ComposeRefineInput
): RefineCandidate[] {
  const out: RefineCandidate[] = [];
  if (!constraintKnown(input.constraints, "site_access")) {
    out.push({
      id: "refine:pc:site_access",
      group: "project_conditions",
      tier: "high_value",
      workAreaId: null,
      workAreaName: null,
      workAreaType: null,
      factKey: null,
      constraintKey: "site_access",
      questionKey: "interview.site.site_access",
      label: "Site access",
      question: "How difficult is site access?",
      inputType: "select",
      options: ["Easy", "Moderate", "Difficult", "Very poor"],
      writeTarget: "CONSTRAINT",
      write: null,
      consumedByCalculator: true,
    });
  }
  if (!constraintKnown(input.constraints, "material_carry_distance")) {
    out.push({
      id: "refine:pc:material_carry_distance",
      group: "project_conditions",
      tier: "advanced",
      workAreaId: null,
      workAreaName: null,
      workAreaType: null,
      factKey: null,
      constraintKey: "material_carry_distance",
      questionKey: "interview.site.material_carry_distance",
      label: "Carry distance",
      question: "Distance from material drop-off or waste carting?",
      inputType: "select",
      options: ["< 10m", "10–30m", "> 30m", "Not sure"],
      writeTarget: "CONSTRAINT",
      write: null,
      consumedByCalculator: true,
    });
  }
  return out;
}

export function composeRefineView(input: ComposeRefineInput): RefineView {
  const collected: RefineCandidate[] = [];
  for (const wa of input.workAreas.filter((row) => row.status !== "excluded")) {
    const adapter = getRefineAdapter(wa.type);
    if (!adapter) continue;
    const card = input.jobPlan.cards.find((c) => c.workAreaId === wa.id);
    collected.push(
      ...adapter.candidates({
        workAreaId: wa.id,
        workAreaName: wa.name,
        facts: input.facts,
        briefText: input.briefText,
        notConfirmed: card?.notConfirmed ?? [],
      })
    );
  }
  collected.push(...projectConditionCandidates(input));

  const seen = new Set<string>();
  const unique = collected.filter((row) => {
    if (seen.has(row.id)) return false;
    seen.add(row.id);
    if (row.constraintKey) {
      return isCalculatorConsumedConstraint(row.constraintKey);
    }
    if (!row.factKey) return false;
    return isCalculatorConsumedFact(row.workAreaType, row.factKey);
  });

  const highValue = unique.filter((row) => row.tier === "high_value");
  const advanced = unique.filter((row) => row.tier === "advanced");
  return {
    highValue,
    advanced,
    hasCandidates: unique.length > 0,
  };
}

export const DECK_NOT_CONSUMED_REFINE_KEYS = [
  "deck.joist_section",
  "deck.joist_centres_mm",
] as const;
