import { isImplicitScopeExclusion } from "@/lib/assistant/job-plan/exclusion-provenance";
import { hasFactValue, isNotSureValue } from "@/lib/estimate/facts";
import type {
  ComposeRefineInput,
  RefineCandidate,
  RefineWorkAreaAdapter,
} from "@/lib/assistant/refine/types";

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
  }
): RefineCandidate | null {
  if (!item.sourceFactKey || !item.write) return null;
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
    writeTarget: "FACT",
    write: item.write,
    consumedByCalculator: true,
  };
}

const DECK_CHECK_COPY: Record<
  string,
  { question: string; options?: readonly string[] }
> = {
  "deck.existing_deck_removal": {
    question: "Include existing deck removal?",
  },
  "deck.vertical_face_boards_required": {
    question: "Include fascia / edge finish?",
  },
  "deck.access_type": {
    question: "Are steps or a stair set included?",
    options: ["None", "Single step or step-down", "Stair set"],
  },
  "deck.balustrade_required": {
    question: "Include a balustrade?",
  },
};

export const deckRefineAdapter: RefineWorkAreaAdapter = {
  workAreaType: "deck",
  candidates({ workAreaId, workAreaName, facts, briefText, notConfirmed }) {
    const out: RefineCandidate[] = [];
    for (const item of notConfirmed) {
      const key = item.sourceFactKey;
      if (!key || !(key in DECK_CHECK_COPY)) continue;
      const copy = DECK_CHECK_COPY[key]!;
      const row = fromCheck(item, workAreaName, "deck", {
        question: copy.question,
        group: "scope",
        tier: "high_value",
        inputType: copy.options ? "select" : "boolean",
        options: copy.options,
      });
      if (row) out.push(row);
    }

    if (!known(facts, workAreaId, "deck.board_material", briefText)) {
      out.push({
        id: `refine:${workAreaId}:deck.board_material`,
        group: "specification",
        tier: "high_value",
        workAreaId,
        workAreaName,
        workAreaType: "deck",
        factKey: "deck.board_material",
        constraintKey: null,
        questionKey: "deck.board_material",
        label: "Decking material",
        question: "What decking is being used?",
        inputType: "select",
        options: ["Treated Pine", "Hardwood", "Kwila", "Composite"],
        writeTarget: "FACT",
        write: null,
        consumedByCalculator: true,
      });
    }

    if (!known(facts, workAreaId, "deck.height_m", briefText)) {
      out.push({
        id: `refine:${workAreaId}:deck.height_m`,
        group: "specification",
        tier: "high_value",
        workAreaId,
        workAreaName,
        workAreaType: "deck",
        factKey: "deck.height_m",
        constraintKey: null,
        questionKey: "deck.height_m",
        label: "Deck height",
        question: "Approximate deck height above ground?",
        inputType: "number",
        writeTarget: "FACT",
        write: null,
        consumedByCalculator: true,
      });
    }

    if (!known(facts, workAreaId, "deck.pile_or_post_replacement_required", briefText)) {
      out.push({
        id: `refine:${workAreaId}:deck.pile_or_post_replacement_required`,
        group: "structure",
        tier: "advanced",
        workAreaId,
        workAreaName,
        workAreaType: "deck",
        factKey: "deck.pile_or_post_replacement_required",
        constraintKey: null,
        questionKey: "deck.pile_or_post_replacement_required",
        label: "Pile / post replacement",
        question: "Replace piles or posts?",
        inputType: "boolean",
        writeTarget: "FACT",
        write: {
          factKey: "deck.pile_or_post_replacement_required",
          valueType: "boolean",
          includeValue: true,
          excludeValue: false,
          label: "Pile / post replacement",
        },
        consumedByCalculator: true,
      });
    }

    if (!known(facts, workAreaId, "deck.substructure_condition", briefText)) {
      out.push({
        id: `refine:${workAreaId}:deck.substructure_condition`,
        group: "structure",
        tier: "advanced",
        workAreaId,
        workAreaName,
        workAreaType: "deck",
        factKey: "deck.substructure_condition",
        constraintKey: null,
        questionKey: "deck.substructure_condition",
        label: "Existing substructure condition",
        question: "What is the existing substructure condition?",
        inputType: "select",
        options: ["Sound", "Partial replacement", "Full replacement", "None", "Unknown"],
        writeTarget: "FACT",
        write: null,
        consumedByCalculator: true,
      });
    }

    return out;
  },
};
