import { isNotSureValue } from "@/lib/scopes/fact-labels";
import {
  isQuestionAnswered,
  shouldHideConditionalQuestion,
} from "@/lib/scopes/conditional-rules";
import {
  isFinishLevelInheritedFromProject,
  isInheritedFinishLevelKey,
} from "@/lib/scopes/finish-level";
import { getScopeQuestions } from "@/lib/scopes/registry";
import {
  buildFactLookup,
  factHasValue,
  getPrepopulationForQuestion,
  getFactValue,
  hasFactValue,
  toPositiveNumber,
  type ProjectFactRecord,
} from "@/lib/scopes/fact-values";
import {
  buildDerivedFactDisplays,
  deriveFactsForProject,
  mergeDerivedFactsIntoRecords,
  type DerivedFactDisplay,
} from "@/lib/scopes/derived-facts";
import type { ScopeQuestionTemplate } from "@/lib/scopes/types";
import {
  getEstimatePriorityClass,
  isNeverAskEstimateQuestion,
  isQuickEstimateAskQuestion,
  MAX_QUICK_ESTIMATE_P0_QUESTIONS,
} from "@/lib/scopes/estimate-priority";
import { blocksLevel1Estimate } from "@/lib/scopes/level1-blocking";
import { planLevel1Questions } from "@/lib/assistant/level1-question-plan";
import type { InterviewCandidate } from "@/lib/builder-interview/types";
import { isQuestionSuppressedByScopeItemExclusion } from "@/lib/scope-discovery/ui/scope-item-question-gates";
import { isProjectConditionDuplicateFactKey } from "@/lib/project-conditions/canonical";

/**
 * Stage 3.1B.7F-R6: do not silently drop applicable questions on multi-WA jobs.
 * Progressive disclosure lives in the UI; question generation includes all
 * currently-applicable unanswered templates (required + optional).
 * DECK-2B: classified templates use P0-only Quick Estimate budget.
 */
const MAX_OPTIONAL_QUESTIONS_SOFT = 40;

export const QUICK_ESTIMATE_BLOCK_TITLE = "Scope details";
export const QUICK_ESTIMATE_BLOCK_DESCRIPTION =
  "A few high-value details will sharpen the initial estimate. Optional specification can wait for Builder Review.";

export const MISSING_DETAILS_BLOCK_TITLE = "Missing scope details";
export const MISSING_DETAILS_BLOCK_DESCRIPTION =
  "A few details are needed before the estimate can be sharpened.";

const AREA_ONLY_SKIP_KEYS = new Set([
  "bathroom.area_m2",
  "kitchen.area_m2",
  "pergola.area_m2",
  "demolition.area_m2",
  "flooring.area_m2",
  "painting.internal_area_m2",
  "painting.external_area_m2",
  "plastering.area_m2",
  "ceilings.area_m2",
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
  /** Project-wide constraints used for Fact-first question dedupe (7F-R6). */
  constraints?: readonly {
    readonly key: string;
    readonly value: unknown;
  }[];
};

export type BuiltQuestion = {
  key: string;
  label: string;
  questionText: string;
  inputType: ScopeQuestionTemplate["inputType"];
  options?: string[];
  unit?: string;
  required: boolean;
  /** DECK-2B-R1 — whether unanswered question blocks Level 1 submit / estimate. */
  blocksEstimate?: boolean;
  workAreaId: string;
  workAreaName: string;
  workAreaSortOrder: number;
  sortOrder: number;
  initialAnswerValue?: string | number | boolean | string[] | null;
  initialAnswerSource?: "user" | "ai_extracted" | "system" | null;
};

export type BuiltQuestionBlock = {
  title: string;
  description: string;
  questions: BuiltQuestion[];
  derivedDisplays: DerivedFactDisplay[];
};

export type ScopeItemExclusionInput = {
  readonly excludedScopeItemTypes?: ReadonlySet<string>;
};

export type ExistingQuestionRecord = {
  workAreaId: string | null;
  key: string;
  answerValue?: unknown;
  blockStatus?: string;
};

type CandidateQuestion = BuiltQuestion & {
  priority: number;
  estimatePriorityClass: ReturnType<typeof getEstimatePriorityClass>;
};

function selectQuickEstimateQuestions(
  candidates: CandidateQuestion[],
  options?: {
    readonly pcCandidatesForPlanning?: readonly InterviewCandidate[];
    readonly questionBudget?: number;
  }
): CandidateQuestion[] {
  const sortCandidates = (a: CandidateQuestion, b: CandidateQuestion) => {
    if (a.workAreaSortOrder !== b.workAreaSortOrder) {
      return a.workAreaSortOrder - b.workAreaSortOrder;
    }
    if (a.required !== b.required) {
      return a.required ? -1 : 1;
    }
    return a.priority - b.priority;
  };

  const classifiedP0 = candidates.filter((q) => q.estimatePriorityClass === "P0");
  const unclassified = candidates.filter((q) => q.estimatePriorityClass == null);

  let selectedClassified: CandidateQuestion[] = [];
  if (
    classifiedP0.length > 0 ||
    (options?.pcCandidatesForPlanning?.length ?? 0) > 0
  ) {
    const plan = planLevel1Questions({
      scopeQuestions: classifiedP0,
      pcCandidates: options?.pcCandidatesForPlanning ?? [],
      max: options?.questionBudget ?? MAX_QUICK_ESTIMATE_P0_QUESTIONS,
    });
    selectedClassified = plan.scopeQuestions as CandidateQuestion[];
  }

  const required = unclassified.filter((q) => q.required);
  const optional = unclassified.filter((q) => !q.required);
  const selected = [
    ...selectedClassified,
    ...required,
    ...optional.slice(0, MAX_OPTIONAL_QUESTIONS_SOFT),
  ].filter((q, index, all) => {
    const id = `${q.workAreaId}:${q.key}`;
    return all.findIndex((item) => `${item.workAreaId}:${item.key}` === id) === index;
  });

  return selected.sort(sortCandidates);
}

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
  const selectOptions =
    params.template.inputType === "select" ||
    params.template.inputType === "boolean" ||
    params.template.inputType === "multi_select"
      ? params.template.options
      : undefined;

  if (params.template.required) {
    return !factHasValue(value) || isNotSureValue(value, selectOptions);
  }

  return factHasValue(value) && isNotSureValue(value, selectOptions);
}

/** True when a question should still be asked (required gap or unanswered optional). */
export function isTemplateQuestionUnanswered(params: {
  template: ScopeQuestionTemplate;
  workArea: WorkAreaInput;
  lookup: ReturnType<typeof buildFactLookup>;
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

  if (
    isQuestionAnswered(
      params.lookup,
      params.workArea.id,
      params.template.factKey,
      params.template.options
    )
  ) {
    return false;
  }

  if (params.template.required) {
    return true;
  }

  return true;
}

/**
 * Stage 3.1D: Question answers alone never satisfy missing-fact readiness.
 * Facts are the sole authority; heal paths materialize answers into facts.
 * Kept exported for regression tests / call-site clarity.
 */
export function questionAnswerSatisfiesMissingFact(): boolean {
  return false;
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
  includeOptional?: boolean;
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
      if (!isQuickEstimateAskQuestion(template)) {
        continue;
      }

      const unanswered = params.includeOptional
        ? isTemplateQuestionUnanswered({
            template,
            workArea,
            lookup: factLookup,
            confirmedTypes,
            project: params.project,
          })
        : isTemplateFactMissing({
            template,
            workArea,
            lookup: factLookup,
            qualityLevel: params.project.quality_level,
            confirmedTypes,
            project: params.project,
          });

      if (!unanswered) {
        continue;
      }

      // Stage 3.1D: do not treat question-only answers as satisfying fact readiness.
      // If a fact is missing, keep generating / retaining editors until the fact exists
      // (healQuestionAnswersIntoFacts runs before this in ensureMissingDetails).

      if (hasActiveExistingQuestion(existingQuestions, workArea.id, template.key)) {
        continue;
      }

      const prepopulation = getPrepopulationForQuestion({
        facts: mergedFacts,
        workAreaId: workArea.id,
        factKey: template.factKey,
        inputType: template.inputType,
        options: spoilQuestionOptions(template, workArea.id, factLookup),
      });

      candidates.push({
        key: template.key,
        label: template.label,
        questionText: template.questionText,
        inputType: template.inputType,
        options: spoilQuestionOptions(template, workArea.id, factLookup),
        unit: template.unit,
        required: template.required,
        workAreaId: workArea.id,
        workAreaName: workArea.name,
        workAreaSortOrder: workArea.sort_order,
        priority: template.priority,
        estimatePriorityClass: getEstimatePriorityClass(template),
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

  return selectQuickEstimateQuestions(candidates).map((question, index) => ({
    ...question,
    sortOrder: index + 1,
  }));
}

function constraintValue(
  project: ProjectInput,
  key: string
): string | null {
  const row = project.constraints?.find((c) => c.key === key);
  if (!row || row.value === null || row.value === undefined || row.value === "") {
    return null;
  }
  return String(row.value).trim();
}

/**
 * FOUNDATION-R1: Project Conditions own project-wide topics.
 * Duplicate Scope Details questions are never generated — even when the
 * project constraint is still UNKNOWN. The Project Conditions interviewer
 * owns asking them. ceilings.access / deck.access_type remain local.
 */
function spoilQuestionOptions(
  template: ScopeQuestionTemplate,
  workAreaId: string,
  factLookup: ReturnType<typeof buildFactLookup>
): string[] | undefined {
  if (template.factKey !== "retaining_wall.spoil_removal_portion") {
    return template.options;
  }
  const volume = toPositiveNumber(
    getFactValue(factLookup, workAreaId, "retaining_wall.excavation_volume_m3")
  );
  if (volume == null) return template.options;
  return [
    `All — ${volume.toFixed(1)}m³`,
    "Some — enter quantity",
    "None",
  ];
}

function isSuppressedByProjectWideKnowledge(
  factKey: string,
  project: ProjectInput,
  factLookup: ReturnType<typeof buildFactLookup>,
  _workAreaId: string,
  confirmedTypes: Set<string>
): boolean {
  if (isProjectConditionDuplicateFactKey(factKey)) {
    return true;
  }

  const carry = constraintValue(project, "material_carry_distance");
  const occupied = constraintValue(project, "occupied_site");

  if (
    factKey === "demolition.skip_bin_included" &&
    carry &&
    !carry.startsWith("<")
  ) {
    return true;
  }

  if (factKey === "demolition.disposal_included") {
    if (confirmedTypes.has("waste_removal")) return true;
    const knownYes = [...factLookup.values()].some(
      (f) =>
        (f.key === "fitout.waste_required" ||
          f.key === "demolition.waste_removal_required") &&
        (f.value === true ||
          f.value === "Yes" ||
          f.value === "yes" ||
          f.value === "true")
    );
    if (knownYes) return true;
  }

  if (factKey.includes("occupied") && occupied) {
    return true;
  }

  return false;
}

export function shouldSkipTemplateQuestion(
  template: ScopeQuestionTemplate,
  workArea: WorkAreaInput,
  factLookup: ReturnType<typeof buildFactLookup>,
  confirmedTypes: Set<string>,
  project: ProjectInput,
  excludedScopeItemTypes?: ReadonlySet<string>
): boolean {
  if (
    excludedScopeItemTypes &&
    excludedScopeItemTypes.size > 0 &&
    isQuestionSuppressedByScopeItemExclusion({
      factKey: template.factKey,
      excludedTypes: excludedScopeItemTypes,
    })
  ) {
    return true;
  }

  if (template.factKey === "deck.pergola_included") {
    return true;
  }

  if (isNeverAskEstimateQuestion(template)) {
    return true;
  }

  // 7F-R6: project-wide constraints / known scope suppress WA duplicates.
  if (isSuppressedByProjectWideKnowledge(template.factKey, project, factLookup, workArea.id, confirmedTypes)) {
    return true;
  }

  if (
    template.factKey === "internal_walls.painting_included" &&
    confirmedTypes.has("painting")
  ) {
    return true;
  }

  if (
    template.factKey === "doors.painting_included" &&
    confirmedTypes.has("painting")
  ) {
    return true;
  }

  if (
    template.factKey === "ceilings.painting_included" &&
    confirmedTypes.has("painting")
  ) {
    return true;
  }

  if (
    (template.factKey === "deck.has_stairs" ||
      template.factKey === "deck.access_type") &&
    confirmedTypes.has("external_stairs")
  ) {
    return true;
  }

  if (shouldHideConditionalQuestion(template, workArea.id, factLookup, confirmedTypes)) {
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

  if (template.factKey === "pergola.area_m2") {
    const hasLength = hasFactValue(factLookup, workArea.id, "pergola.length_m");
    const hasWidth = hasFactValue(factLookup, workArea.id, "pergola.width_m");
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
  excludedScopeItemTypes?: ReadonlySet<string>;
  /** DECK-2B-R1 — global Level 1 budget ranks Scope + PC together. */
  pcCandidatesForPlanning?: readonly InterviewCandidate[];
  scopeQuestionBudget?: number;
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
  const excluded = params.excludedScopeItemTypes;
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
          params.project,
          excluded
        )
      ) {
        continue;
      }

      if (!isQuickEstimateAskQuestion(template)) {
        continue;
      }

      if (isQuestionAnswered(factLookup, workArea.id, template.factKey)) {
        continue;
      }

      const prepopulation = getPrepopulationForQuestion({
        facts: mergedFacts,
        workAreaId: workArea.id,
        factKey: template.factKey,
        inputType: template.inputType,
        options: spoilQuestionOptions(template, workArea.id, factLookup),
      });

      candidates.push({
        key: template.key,
        label: template.label,
        questionText: template.questionText,
        inputType: template.inputType,
        options: spoilQuestionOptions(template, workArea.id, factLookup),
        unit: template.unit,
        required: template.required,
        blocksEstimate:
          template.estimatePriorityClass != null
            ? blocksLevel1Estimate(template)
            : template.required,
        workAreaId: workArea.id,
        workAreaName: workArea.name,
        workAreaSortOrder: workArea.sort_order,
        priority: template.priority,
        estimatePriorityClass: getEstimatePriorityClass(template),
        sortOrder: 0,
        initialAnswerValue: prepopulation?.value ?? null,
        initialAnswerSource: prepopulation?.source ?? null,
      });
    }
  }

  const selected = selectQuickEstimateQuestions(candidates, {
    pcCandidatesForPlanning: params.pcCandidatesForPlanning,
    questionBudget: params.scopeQuestionBudget,
  }).map((question, index) => ({
    ...question,
    sortOrder: index + 1,
  }));

  return {
    title: QUICK_ESTIMATE_BLOCK_TITLE,
    description: QUICK_ESTIMATE_BLOCK_DESCRIPTION,
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

    if (!isQuickEstimateAskQuestion(template)) {
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
      blocksEstimate:
        template.estimatePriorityClass != null
          ? blocksLevel1Estimate(template)
          : template.required,
      workAreaId: params.workArea.id,
      workAreaName: params.workArea.name,
      workAreaSortOrder: params.workArea.sort_order,
      priority: template.priority,
      estimatePriorityClass: getEstimatePriorityClass(template),
      sortOrder: 0,
      initialAnswerValue: prepopulation?.value ?? null,
      initialAnswerSource: prepopulation?.source ?? null,
    });
  }

  const selected = selectQuickEstimateQuestions(candidates).map((question, index) => ({
    ...question,
    sortOrder: index + 1,
  }));

  return {
    title: `${params.workArea.name} details`,
    description: QUICK_ESTIMATE_BLOCK_DESCRIPTION,
    questions: selected,
    derivedDisplays: buildDerivedFactDisplays(mergedFacts).filter(
      (display) => display.workAreaId === params.workArea.id
    ),
  };
}
