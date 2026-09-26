import { isImplicitScopeExclusion } from "@/lib/assistant/job-plan/exclusion-provenance";
import { isCalculatorConsumedFact } from "@/lib/estimate/consumed-facts";
import { deckFactIsRelevant } from "@/lib/estimate/deck-question-descriptors";
import {
  getBooleanFact,
  hasFactValue,
  isNotSureValue,
} from "@/lib/estimate/facts";
import {
  DECK_CONCRETE_BAGS_PER_HOLE_FACT_KEY,
  DECK_CONCRETE_TO_SUPPORTS_FACT_KEY,
  newSubstructureIncluded,
  shouldAskPileReplacement,
} from "@/lib/estimate/deck-scope-2c";
import { getQuestionTemplateByKey } from "@/lib/scopes/registry";
import type {
  ComposeRefineInput,
  RefineCandidate,
  RefineWorkAreaAdapter,
} from "@/lib/assistant/refine/types";

/**
 * Legacy aliases the calculator still reads, and takeoff facts Quotr derives.
 * They stay readable. They are not canonical Refine keys.
 */
export const DECK_REFINE_EXCLUDED_KEYS = [
  "deck.material",
  "deck.demolition_required",
  "deck.has_stairs",
  "deck.has_balustrade",
  "deck.joist_section",
  "deck.joist_centres_mm",
] as const;

const DECK_REFINE_EXCLUDED = new Set<string>(DECK_REFINE_EXCLUDED_KEYS);

function known(
  facts: ComposeRefineInput["facts"],
  workAreaId: string,
  key: string,
  briefText: string | null
): boolean {
  const row = facts.find(
    (f) => f.key === key && f.work_area_id === workAreaId
  );
  if (!row || !hasFactValue(row.value) || isNotSureValue(row.value)) return false;
  if (
    isImplicitScopeExclusion({
      factKey: key,
      value: row.value,
      source: row.source,
      briefText,
    })
  ) {
    return false;
  }
  return true;
}

function fromCheck(
  item: ComposeRefineInput["jobPlan"]["cards"][number]["notConfirmed"][number],
  workAreaName: string,
  workAreaType: string,
  params: {
    question: string;
    group: RefineCandidate["group"];
    tier: RefineCandidate["tier"];
    inputType: RefineCandidate["inputType"];
    options?: readonly string[];
    unit?: string;
  }
): RefineCandidate | null {
  if (!item.sourceFactKey || !item.write) return null;
  if (item.write.factKey !== item.sourceFactKey) return null;
  return {
    id: `refine:${item.workAreaId}:${item.sourceFactKey}`,
    group: params.group,
    tier: params.tier,
    workAreaId: item.workAreaId,
    workAreaName,
    workAreaType,
    factKey: item.sourceFactKey,
    constraintKey: null,
    questionKey: item.sourceFactKey,
    label: item.label,
    question: params.question,
    inputType: params.inputType,
    options: params.options,
    unit: params.unit,
    writeTarget: "FACT",
    write: item.write,
    consumedByCalculator: true,
  };
}

const DECK_CHECK_COPY: Record<
  string,
  { question: string; options?: readonly string[] }
> = {
  "deck.skirting_included": {
    question: "Is full-height deck skirting / screening included?",
  },
  "deck.concrete_to_supports": {
    question: "Include concrete to piles or posts?",
  },
};

export const deckRefineAdapter: RefineWorkAreaAdapter = {
  workAreaType: "deck",
  candidates({ workAreaId, workAreaName, facts, briefText, notConfirmed }) {
    const out: RefineCandidate[] = [];
    const supportsRelevant =
      newSubstructureIncluded([...facts], workAreaId) ||
      shouldAskPileReplacement({ facts: [...facts], workAreaId });
    const concreteYes =
      getBooleanFact([...facts], workAreaId, DECK_CONCRETE_TO_SUPPORTS_FACT_KEY) ===
      true;

    for (const item of notConfirmed) {
      const key = item.sourceFactKey;
      if (!key || !item.write) continue;
      if (!isCalculatorConsumedFact("deck", key)) continue;
      if (DECK_REFINE_EXCLUDED.has(key)) continue;
      if (key === DECK_CONCRETE_TO_SUPPORTS_FACT_KEY && !supportsRelevant) {
        continue;
      }
      if (
        key !== DECK_CONCRETE_TO_SUPPORTS_FACT_KEY &&
        !deckFactIsRelevant(key, { facts, workAreaId, briefText })
      ) {
        continue;
      }
      const template = getQuestionTemplateByKey(key);
      const copy = DECK_CHECK_COPY[key];
      const inputType: RefineCandidate["inputType"] =
        item.write.valueType === "boolean"
          ? "boolean"
          : template?.inputType === "number"
            ? "number"
            : "select";
      const row = fromCheck(item, workAreaName, "deck", {
        question: copy?.question ?? template?.questionText ?? item.label,
        group: inputType === "number" ? "structure" : "scope",
        tier: "high_value",
        inputType,
        options:
          inputType === "select"
            ? copy?.options ?? template?.options
            : undefined,
        unit: inputType === "number" ? template?.unit : undefined,
      });
      if (row) out.push(row);
    }

    if (
      supportsRelevant &&
      concreteYes &&
      !known(facts, workAreaId, DECK_CONCRETE_BAGS_PER_HOLE_FACT_KEY, briefText)
    ) {
      out.push({
        id: `refine:${workAreaId}:${DECK_CONCRETE_BAGS_PER_HOLE_FACT_KEY}`,
        group: "structure",
        tier: "advanced",
        workAreaId,
        workAreaName,
        workAreaType: "deck",
        factKey: DECK_CONCRETE_BAGS_PER_HOLE_FACT_KEY,
        constraintKey: null,
        questionKey: DECK_CONCRETE_BAGS_PER_HOLE_FACT_KEY,
        label: "Concrete bags per hole",
        question: "How many 20kg bags per hole?",
        inputType: "number",
        writeTarget: "FACT",
        write: null,
        consumedByCalculator: true,
      });
    }

    return out;
  },
};
