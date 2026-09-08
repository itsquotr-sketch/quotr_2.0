import { isKnownValue } from "@/lib/assistant/clarify/suppress";
import { getRefineAdapter } from "@/lib/assistant/refine/adapters/registry";
import { internalWallsRefinePanel } from "@/lib/assistant/refine/adapters/internal-walls";
import type { EstimateFact } from "@/lib/estimate/types";
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
  if (!constraintKnown(input.constraints, "occupied_site")) {
    out.push({
      id: "refine:pc:occupied_site",
      group: "project_conditions",
      tier: "high_value",
      workAreaId: null,
      workAreaName: null,
      workAreaType: null,
      factKey: null,
      constraintKey: "occupied_site",
      questionKey: "interview.site.occupied_site",
      label: "Occupied site",
      question: "Is the site occupied during works?",
      inputType: "boolean",
      options: ["Yes", "No", "Not sure"],
      writeTarget: "CONSTRAINT",
      write: null,
      consumedByCalculator: true,
    });
  }
  if (!constraintKnown(input.constraints, "working_hours")) {
    out.push({
      id: "refine:pc:working_hours",
      group: "project_conditions",
      tier: "high_value",
      workAreaId: null,
      workAreaName: null,
      workAreaType: null,
      factKey: null,
      constraintKey: "working_hours",
      questionKey: "interview.site.working_hours",
      label: "Working hours",
      question: "Are there working-hour restrictions?",
      inputType: "boolean",
      options: ["No", "Yes", "Not sure"],
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
  const attachCurrent = (rows: RefineCandidate[]): RefineCandidate[] =>
    rows.map((row) => {
      const key = row.constraintKey ?? row.factKey;
      if (!key) return row;
      const raw = row.constraintKey
        ? input.constraints.find((c) => c.key === key)?.value
        : input.facts.find(
            (f) =>
              f.key === key &&
              (row.workAreaId == null || f.work_area_id === row.workAreaId)
          )?.value;
      if (raw == null) return row;
      return { ...row, currentValue: raw as RefineCandidate["currentValue"] };
    });
  return {
    highValue: attachCurrent(highValue),
    advanced: attachCurrent(advanced),
    hasCandidates: unique.length > 0,
    wallTypePanels: input.workAreas
      .filter((row) => row.status !== "excluded" && row.type === "internal_walls")
      .map((wa) =>
        internalWallsRefinePanel({
          workAreaId: wa.id,
          workAreaName: wa.name,
          facts: input.facts as EstimateFact[],
        })
      ),
  };
}

/**
 * Physically consumed for planning takeoff, but not Refine-interviewed.
 * Quotr derives/assumes joist layout; do not ask the builder to take off.
 * Name retained for RECOVERY-4-R2 compatibility.
 */
export const DECK_NOT_CONSUMED_REFINE_KEYS = [
  "deck.joist_section",
  "deck.joist_centres_mm",
] as const;
