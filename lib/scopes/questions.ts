import { getScopeQuestions } from "@/lib/scopes/registry";
import {
  buildFactLookup,
  getPrepopulationForQuestion,
  hasFactValue,
  type ProjectFactRecord,
} from "@/lib/scopes/fact-values";
import {
  buildDerivedFactDisplays,
  deriveFactsForProject,
  mergeDerivedFactsIntoRecords,
  type DerivedFactDisplay,
} from "@/lib/scopes/derived-facts";
import type { ScopeQuestionTemplate } from "@/lib/scopes/types";

const MAX_QUESTIONS = 12;

const FINISH_LEVEL_KEYS = new Set([
  "bathroom.finish_level",
  "kitchen.finish_level",
]);

const AREA_ONLY_SKIP_KEYS = new Set([
  "bathroom.area_m2",
  "kitchen.area_m2",
  "pergola.area_m2",
  "demolition.area_m2",
]);

export type ProjectFactInput = ProjectFactRecord;

export type WorkAreaInput = {
  id: string;
  type: string;
  name: string;
  sort_order: number;
  status: string;
};

export type ProjectInput = {
  quality_level: string | null;
};

export type BuiltQuestion = {
  key: string;
  label: string;
  questionText: string;
  inputType: ScopeQuestionTemplate["inputType"];
  options?: string[];
  unit?: string;
  required: boolean;
  workAreaId: string;
  workAreaName: string;
  workAreaSortOrder: number;
  sortOrder: number;
  initialAnswerValue?: string | number | boolean | null;
  initialAnswerSource?: "user" | "ai_extracted" | "system" | null;
};

export type BuiltQuestionBlock = {
  title: string;
  description: string;
  questions: BuiltQuestion[];
  derivedDisplays: DerivedFactDisplay[];
};

type CandidateQuestion = BuiltQuestion & {
  priority: number;
};

export function shouldSkipTemplateQuestion(
  template: ScopeQuestionTemplate,
  workArea: WorkAreaInput,
  factLookup: ReturnType<typeof buildFactLookup>,
  confirmedTypes: Set<string>,
  project: ProjectInput
): boolean {
  if (
    template.factKey === "deck.pergola_included" &&
    confirmedTypes.has("pergola")
  ) {
    return true;
  }

  if (
    template.factKey === "deck.has_stairs" &&
    confirmedTypes.has("external_stairs")
  ) {
    return true;
  }

  if (
    FINISH_LEVEL_KEYS.has(template.factKey) &&
    project.quality_level &&
    project.quality_level !== "unknown"
  ) {
    return true;
  }

  if (AREA_ONLY_SKIP_KEYS.has(template.factKey)) {
    return hasFactValue(factLookup, workArea.id, template.factKey);
  }

  if (template.factKey === "deck.area_m2") {
    const hasLength = hasFactValue(factLookup, workArea.id, "deck.length_m");
    const hasWidth = hasFactValue(factLookup, workArea.id, "deck.width_m");
    return hasLength && hasWidth;
  }

  if (template.factKey === "retaining_wall.height_m") {
    const heightFact = factLookup.get(
      `${workArea.id}:retaining_wall.height_m`
    );
    return heightFact?.source === "derived";
  }

  return false;
}

export function prepareProjectFactsForQuestions(params: {
  workAreas: WorkAreaInput[];
  projectFacts: ProjectFactInput[];
}): ProjectFactRecord[] {
  const confirmed = params.workAreas.filter(
    (workArea) => workArea.status === "confirmed"
  );
  const derived = deriveFactsForProject({
    workAreas: confirmed.map((workArea) => ({
      id: workArea.id,
      type: workArea.type,
    })),
    projectFacts: params.projectFacts,
  });

  return mergeDerivedFactsIntoRecords(params.projectFacts, derived);
}

export function buildQuestionBlockFromProjectState(params: {
  project: ProjectInput;
  confirmedWorkAreas: WorkAreaInput[];
  projectFacts: ProjectFactInput[];
}): BuiltQuestionBlock {
  const confirmed = params.confirmedWorkAreas
    .filter((workArea) => workArea.status === "confirmed")
    .sort((a, b) => a.sort_order - b.sort_order);

  const mergedFacts = prepareProjectFactsForQuestions({
    workAreas: confirmed,
    projectFacts: params.projectFacts,
  });
  const factLookup = buildFactLookup(mergedFacts);
  const confirmedTypes = new Set(confirmed.map((workArea) => workArea.type));
  const candidates: CandidateQuestion[] = [];

  for (const workArea of confirmed) {
    const templates = getScopeQuestions(workArea.type);
    if (templates.length === 0) {
      continue;
    }

    for (const template of templates) {
      if (
        shouldSkipTemplateQuestion(
          template,
          workArea,
          factLookup,
          confirmedTypes,
          params.project
        )
      ) {
        continue;
      }

      const prepopulation = getPrepopulationForQuestion({
        facts: mergedFacts,
        workAreaId: workArea.id,
        factKey: template.factKey,
        inputType: template.inputType,
        options: template.options,
      });

      candidates.push({
        key: template.key,
        label: template.label,
        questionText: template.questionText,
        inputType: template.inputType,
        options: template.options,
        unit: template.unit,
        required: template.required,
        workAreaId: workArea.id,
        workAreaName: workArea.name,
        workAreaSortOrder: workArea.sort_order,
        priority: template.priority,
        sortOrder: 0,
        initialAnswerValue: prepopulation?.value ?? null,
        initialAnswerSource: prepopulation?.source ?? null,
      });
    }
  }

  candidates.sort((a, b) => {
    if (a.workAreaSortOrder !== b.workAreaSortOrder) {
      return a.workAreaSortOrder - b.workAreaSortOrder;
    }
    if (a.required !== b.required) {
      return a.required ? -1 : 1;
    }
    return a.priority - b.priority;
  });

  const selected = candidates.slice(0, MAX_QUESTIONS).map((question, index) => ({
    ...question,
    sortOrder: index + 1,
  }));

  return {
    title: "Scope details",
    description: "A few details will help sharpen the estimate.",
    questions: selected,
    derivedDisplays: buildDerivedFactDisplays(mergedFacts),
  };
}
