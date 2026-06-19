import { isNotSureValue } from "@/lib/scopes/fact-labels";
import {
  isFinishLevelInheritedFromProject,
  isInheritedFinishLevelKey,
} from "@/lib/scopes/finish-level";
import { getScopeQuestions } from "@/lib/scopes/registry";
import {
  buildFactLookup,
  factHasValue,
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

export const MISSING_DETAILS_BLOCK_TITLE = "Missing scope details";
export const MISSING_DETAILS_BLOCK_DESCRIPTION =
  "A few details are needed before the estimate can be sharpened.";

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

export type ExistingQuestionRecord = {
  workAreaId: string | null;
  key: string;
  answerValue?: unknown;
  blockStatus?: string;
};

type CandidateQuestion = BuiltQuestion & {
  priority: number;
};

export function getMissingLabel(template: ScopeQuestionTemplate): string {
  if (template.factKey === "deck.area_m2") {
    return "Deck area";
  }
  return template.label.replace(/\?$/, "").trim();
}

export function getMissingLabelForKey(workAreaType: string, key: string): string {
  const templates = getScopeQuestions(workAreaType);
  const template = templates.find(
    (item) => item.key === key || item.factKey === key
  );
  return template ? getMissingLabel(template) : key;
}

export function isTemplateFactMissing(params: {
  template: ScopeQuestionTemplate;
  workArea: WorkAreaInput;
  lookup: ReturnType<typeof buildFactLookup>;
  qualityLevel?: string | null;
  confirmedTypes: Set<string>;
  project: ProjectInput;
}): boolean {
  if (
    shouldSkipTemplateQuestion(
      params.template,
      params.workArea,
      params.lookup,
      params.confirmedTypes,
      params.project
    )
  ) {
    return false;
  }

  const fact = params.lookup.get(
    `${params.workArea.id}:${params.template.factKey}`
  );
  const value = fact?.value;

  if (params.template.required) {
    return !factHasValue(value) || isNotSureValue(value);
  }

  return factHasValue(value) && isNotSureValue(value);
}

function hasAnsweredExistingQuestion(
  existingQuestions: ExistingQuestionRecord[],
  workAreaId: string,
  key: string
): boolean {
  const match = existingQuestions.find(
    (question) => question.workAreaId === workAreaId && question.key === key
  );
  if (!match) {
    return false;
  }
  return factHasValue(match.answerValue) && !isNotSureValue(match.answerValue);
}

function hasActiveExistingQuestion(
  existingQuestions: ExistingQuestionRecord[],
  workAreaId: string,
  key: string
): boolean {
  return existingQuestions.some(
    (question) =>
      question.workAreaId === workAreaId &&
      question.key === key &&
      question.blockStatus === "active"
  );
}

export function buildMissingRequiredQuestionsForWorkAreas(params: {
  project: ProjectInput;
  confirmedWorkAreas: WorkAreaInput[];
  projectFacts: ProjectFactInput[];
  existingQuestions?: ExistingQuestionRecord[];
}): BuiltQuestion[] {
  const confirmed = params.confirmedWorkAreas
    .filter((workArea) => workArea.status === "confirmed")
    .sort((a, b) => a.sort_order - b.sort_order);

  const mergedFacts = prepareProjectFactsForQuestions({
    workAreas: confirmed,
    projectFacts: params.projectFacts,
  });
  const factLookup = buildFactLookup(mergedFacts);
  const confirmedTypes = new Set(confirmed.map((workArea) => workArea.type));
  const existingQuestions = params.existingQuestions ?? [];
  const candidates: CandidateQuestion[] = [];

  for (const workArea of confirmed) {
    const templates = getScopeQuestions(workArea.type);
    for (const template of templates) {
      if (
        !isTemplateFactMissing({
          template,
          workArea,
          lookup: factLookup,
          qualityLevel: params.project.quality_level,
          confirmedTypes,
          project: params.project,
        })
      ) {
        continue;
      }

      if (
        hasAnsweredExistingQuestion(existingQuestions, workArea.id, template.key)
      ) {
        continue;
      }

      if (hasActiveExistingQuestion(existingQuestions, workArea.id, template.key)) {
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

  return candidates.map((question, index) => ({
    ...question,
    sortOrder: index + 1,
  }));
}

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
    isInheritedFinishLevelKey(template.factKey) &&
    isFinishLevelInheritedFromProject(project.quality_level)
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

export function buildQuestionBlockForWorkArea(params: {
  project: ProjectInput;
  workArea: WorkAreaInput;
  allConfirmedWorkAreas: WorkAreaInput[];
  projectFacts: ProjectFactInput[];
}): BuiltQuestionBlock {
  const mergedFacts = prepareProjectFactsForQuestions({
    workAreas: params.allConfirmedWorkAreas.filter(
      (workArea) => workArea.status === "confirmed"
    ),
    projectFacts: params.projectFacts,
  });
  const factLookup = buildFactLookup(mergedFacts);
  const confirmedTypes = new Set(
    params.allConfirmedWorkAreas
      .filter((workArea) => workArea.status === "confirmed")
      .map((workArea) => workArea.type)
  );
  const templates = getScopeQuestions(params.workArea.type);
  const candidates: CandidateQuestion[] = [];

  for (const template of templates) {
    if (
      shouldSkipTemplateQuestion(
        template,
        params.workArea,
        factLookup,
        confirmedTypes,
        params.project
      )
    ) {
      continue;
    }

    if (hasFactValue(factLookup, params.workArea.id, template.factKey)) {
      continue;
    }

    const prepopulation = getPrepopulationForQuestion({
      facts: mergedFacts,
      workAreaId: params.workArea.id,
      factKey: template.factKey,
      inputType: template.inputType,
      options: template.options,
    });

    if (prepopulation && factHasValue(prepopulation.value)) {
      continue;
    }

    candidates.push({
      key: template.key,
      label: template.label,
      questionText: template.questionText,
      inputType: template.inputType,
      options: template.options,
      unit: template.unit,
      required: template.required,
      workAreaId: params.workArea.id,
      workAreaName: params.workArea.name,
      workAreaSortOrder: params.workArea.sort_order,
      priority: template.priority,
      sortOrder: 0,
      initialAnswerValue: prepopulation?.value ?? null,
      initialAnswerSource: prepopulation?.source ?? null,
    });
  }

  candidates.sort((a, b) => {
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
    title: `${params.workArea.name} details`,
    description: "A few details are needed for this added scope.",
    questions: selected,
    derivedDisplays: buildDerivedFactDisplays(mergedFacts).filter(
      (display) => display.workAreaId === params.workArea.id
    ),
  };
}
