import { getRefineAdapter } from "@/lib/assistant/refine/adapters/registry";
import { internalWallsRefinePanel } from "@/lib/assistant/refine/adapters/internal-walls";
import type { EstimateFact } from "@/lib/estimate/types";
import {
  getCalculatorConsumedFacts,
  isCalculatorConsumedConstraint,
  isCalculatorConsumedFact,
  SHARED_CONSUMED_CONSTRAINT_KEYS,
} from "@/lib/estimate/consumed-facts";
import { hasFactValue, isNotSureValue } from "@/lib/estimate/facts";
import { deckFactQuestionClass } from "@/lib/estimate/deck-information-contract";
import { fenceFactQuestionClass } from "@/lib/estimate/fence-information-contract";
import { retainingWallFactQuestionClass } from "@/lib/estimate/retaining-wall-information-contract";
import { getEstimatePriorityClass } from "@/lib/scopes/estimate-priority";
import { getQuestionTemplateByKey } from "@/lib/scopes/registry";
import type {
  ComposeRefineInput,
  RefineCandidate,
  RefineView,
} from "@/lib/assistant/refine/types";

const PROJECT_CONDITION_DEFS: readonly {
  readonly key: (typeof SHARED_CONSUMED_CONSTRAINT_KEYS)[number];
  readonly label: string;
  readonly question: string;
  readonly questionKey: string;
  readonly inputType: RefineCandidate["inputType"];
  readonly options: readonly string[];
  readonly tier: RefineCandidate["tier"];
}[] = [
  {
    key: "site_access",
    label: "Site access",
    question: "How difficult is site access?",
    questionKey: "interview.site.site_access",
    inputType: "select",
    options: ["Easy", "Moderate", "Difficult", "Very poor"],
    tier: "high_value",
  },
  {
    key: "material_carry_distance",
    label: "Carry distance",
    question: "Distance from material drop-off or waste carting?",
    questionKey: "interview.site.material_carry_distance",
    inputType: "select",
    options: ["< 10m", "10–30m", "> 30m", "Not sure"],
    tier: "advanced",
  },
  {
    key: "occupied_site",
    label: "Occupied site",
    question: "Is the site occupied during works?",
    questionKey: "interview.site.occupied_site",
    inputType: "boolean",
    options: ["Yes", "No", "Not sure"],
    tier: "high_value",
  },
  {
    key: "working_hours",
    label: "Working hours",
    question: "Are there working-hour restrictions?",
    questionKey: "interview.site.working_hours",
    inputType: "boolean",
    options: ["No", "Yes", "Not sure"],
    tier: "high_value",
  },
];

function isEditableConsumedFact(workAreaType: string, factKey: string): boolean {
  if (!isCalculatorConsumedFact(workAreaType, factKey)) return false;
  const contract =
    deckFactQuestionClass(factKey) ??
    fenceFactQuestionClass(factKey) ??
    retainingWallFactQuestionClass(factKey);
  if (
    contract === "DERIVED" ||
    contract === "NOT_CONSUMED"
  ) {
    return false;
  }
  const template = getQuestionTemplateByKey(factKey);
  if (template && getEstimatePriorityClass(template) === "P3") return false;
  return true;
}

function projectConditionCandidates(
  input: ComposeRefineInput
): RefineCandidate[] {
  return PROJECT_CONDITION_DEFS.filter((def) =>
    isCalculatorConsumedConstraint(def.key)
  ).map((def) => ({
    id: `refine:pc:${def.key}`,
    group: "project_conditions" as const,
    tier: def.tier,
    workAreaId: null,
    workAreaName: null,
    workAreaType: null,
    factKey: null,
    constraintKey: def.key,
    questionKey: def.questionKey,
    label: def.label,
    question: def.question,
    inputType: def.inputType,
    options: def.options,
    writeTarget: "CONSTRAINT" as const,
    write: null,
    consumedByCalculator: true as const,
    currentValue: input.constraints.find((row) => row.key === def.key)?.value as
      | RefineCandidate["currentValue"]
      | undefined,
  }));
}

function answeredConsumedEditCandidates(
  input: ComposeRefineInput,
  existingIds: ReadonlySet<string>
): RefineCandidate[] {
  const out: RefineCandidate[] = [];
  for (const wa of input.workAreas.filter((row) => row.status !== "excluded")) {
    for (const factKey of getCalculatorConsumedFacts(wa.type)) {
      const id = `refine:${wa.id}:${factKey}`;
      if (existingIds.has(id)) continue;
      if (!isEditableConsumedFact(wa.type, factKey)) continue;
      const row = input.facts.find(
        (fact) => fact.key === factKey && fact.work_area_id === wa.id
      );
      if (!row || !hasFactValue(row.value) || isNotSureValue(row.value)) continue;
      const template = getQuestionTemplateByKey(factKey);
      if (!template) continue;
      const priority = getEstimatePriorityClass(template);
      out.push({
        id,
        group: template.category === "measurement" ? "structure" : "specification",
        tier: priority === "P2" ? "advanced" : "high_value",
        workAreaId: wa.id,
        workAreaName: wa.name,
        workAreaType: wa.type,
        factKey,
        constraintKey: null,
        questionKey: factKey,
        label: template.label,
        question: template.questionText,
        inputType:
          template.inputType === "boolean"
            ? "boolean"
            : template.inputType === "number"
              ? "number"
              : template.inputType === "multi_select"
                ? "multi_select"
                : template.inputType === "text"
                  ? "text"
                  : "select",
        options: template.options,
        unit: template.unit,
        writeTarget: "FACT",
        write: null,
        consumedByCalculator: true,
        currentValue: row.value as RefineCandidate["currentValue"],
      });
    }
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
  const existingIds = new Set(collected.map((row) => row.id));
  collected.push(...answeredConsumedEditCandidates(input, existingIds));

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
