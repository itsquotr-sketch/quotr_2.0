import type {
  Estimate,
  EstimateLineItem,
  QualityLevel,
  Question,
  QuestionBlockData,
  WorkArea,
  WorkAreaActiveQuestion,
  WorkAreaStatus,
} from "@/components/assistant/types";
import { parseLineItemNotes, getMaterialBuildUps } from "@/lib/estimate/line-item-metadata";
import { normalizeRateSourceLabel } from "@/lib/estimate/rate-source-labels";
import {
  buildStaticConstraintQuestions,
  buildStaticEstimate,
  STATIC_CONSTRAINT_SEEDS,
} from "@/lib/assistant/mock-seed";
import type {
  AssistantState,
  ConstraintRow,
  ScopeReview,
} from "@/lib/assistant/types";
import { isStageAtOrBeyond } from "@/lib/assistant/stage";
import { DEFAULT_MARGIN_PERCENT } from "@/lib/estimate/constants";
import type { AssumptionMetadata } from "@/lib/estimate/assumption-metadata";
import { SCOPE_CATALOGUE } from "@/lib/scopes/catalogue";
import {
  buildDerivedFactDisplays,
  mergeDerivedFactsIntoRecords,
  deriveFactsForProject,
} from "@/lib/scopes/derived-facts";
import { normalizeAnswerForUi } from "@/lib/scopes/fact-values";
import { getMissingLabelForKey } from "@/lib/scopes/questions";
import {
  buildPanelScopeSummariesFromScopeReview,
  buildScopeReview,
} from "@/lib/scopes/scope-review";

type DbWorkArea = {
  id: string;
  type: string;
  name: string;
  status: string;
  ai_confidence: number | null;
  summary: string | null;
  quote_description: string | null;
  sort_order: number;
};

type DbQuestionBlock = {
  id: string;
  stage: string;
  title: string;
  description: string | null;
  status: string;
  sort_order: number;
};

type DbQuestion = {
  id: string;
  question_block_id: string;
  work_area_id: string | null;
  key: string;
  label: string;
  question_text: string;
  input_type: string;
  options: unknown;
  required: boolean;
  unit: string | null;
  answer_value: unknown;
  sort_order: number;
};

type DbConstraint = {
  id: string;
  key: string;
  label: string;
  value: unknown;
};

type DbEstimate = {
  id: string;
  cost_low: number | null;
  cost_high: number | null;
  sell_low: number | null;
  sell_high: number | null;
  recommended_cost: number | null;
  recommended_sell: number | null;
  gross_profit: number | null;
  margin_percent: number | null;
  markup_percent: number | null;
  is_stale?: boolean | null;
  calibration_version?: string | null;
  target_margin_percent?: number | null;
  confidence: number | null;
  rate_source_summary: string | null;
  assumptions: unknown;
  missing_info: unknown;
  exclusions: unknown;
  assumption_metadata?: unknown;
};

type DbLineItem = {
  id: string;
  work_area_name: string;
  label: string;
  category: string;
  cost_low: number | null;
  cost_high: number | null;
  sell_low: number | null;
  sell_high: number | null;
  recommended_cost: number | null;
  recommended_sell: number | null;
  gross_profit: number | null;
  margin_percent: number | null;
  markup_percent: number | null;
  rate_source: string | null;
  notes: string | null;
  sort_order: number;
};

type DbProject = {
  id: string;
  stage: string;
  brief_text: string | null;
  quality_level: string | null;
};

type DbProjectFact = {
  key: string;
  work_area_id: string | null;
  value: unknown;
  source: string | null;
};

function parseJsonStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function parseAnswerValue(value: unknown): string | number | boolean | null {
  if (value === null || value === undefined) return null;
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }
  return null;
}

function parseOptions(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const options = value.filter((item): item is string => typeof item === "string");
  return options.length > 0 ? options : undefined;
}

const catalogueByType = new Map(
  SCOPE_CATALOGUE.map((item) => [item.type, item])
);

function getWorkAreaSummary(wa: DbWorkArea): string {
  if (wa.summary) return wa.summary;
  const catalogue = catalogueByType.get(wa.type);
  if (catalogue) return catalogue.description;
  return "Included in this estimate.";
}

function buildIncludedWorkAreasFromDb(workAreas: DbWorkArea[]): WorkArea[] {
  return workAreas
    .filter((wa) => wa.status === "confirmed")
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((wa) => ({
      ...mapWorkArea(wa),
      summary: getWorkAreaSummary(wa),
    }));
}


export function mapWorkArea(row: DbWorkArea): WorkArea {
  return {
    id: row.id,
    type: row.type,
    name: row.name,
    status: row.status as WorkAreaStatus,
    aiConfidence: row.ai_confidence ?? 0,
    summary: row.summary ?? undefined,
    quoteDescription: row.quote_description ?? null,
  };
}

export function mapQuestion(
  row: DbQuestion,
  workAreaName?: string
): Question {
  const options = parseOptions(row.options);
  const rawValue = parseAnswerValue(row.answer_value);

  return {
    id: row.id,
    workAreaId: row.work_area_id ?? undefined,
    workAreaName,
    key: row.key,
    label: row.label,
    questionText: row.question_text,
    inputType: row.input_type as Question["inputType"],
    options,
    required: row.required,
    unit: row.unit ?? undefined,
    value:
      rawValue === null
        ? null
        : normalizeAnswerForUi(
            rawValue,
            row.input_type as Question["inputType"],
            options
          ),
  };
}

export function mapQuestionBlock(
  block: DbQuestionBlock,
  questions: Question[]
): QuestionBlockData {
  return {
    id: block.id,
    title: block.title,
    description: block.description ?? undefined,
    stage: "work_area_questions",
    questions,
    status: block.status === "submitted" ? "submitted" : "active",
  };
}

function isQuestionUnanswered(question: Question): boolean {
  const value = question.value;
  return value === null || value === undefined || value === "";
}

function buildActiveQuestionsByWorkArea(params: {
  additionalQuestionBlocks: QuestionBlockData[];
  workAreaTypeById: Map<string, string>;
  confirmedWorkAreaIds: Set<string>;
  includeInlineQuestions: boolean;
}): Map<string, WorkAreaActiveQuestion[]> {
  const byWorkArea = new Map<string, WorkAreaActiveQuestion[]>();

  if (!params.includeInlineQuestions) {
    return byWorkArea;
  }

  for (const block of params.additionalQuestionBlocks) {
    if (block.status !== "active") {
      continue;
    }

    for (const question of block.questions) {
      if (
        !question.workAreaId ||
        !params.confirmedWorkAreaIds.has(question.workAreaId) ||
        !isQuestionUnanswered(question)
      ) {
        continue;
      }

      const workAreaType =
        params.workAreaTypeById.get(question.workAreaId) ?? "";
      const activeQuestion: WorkAreaActiveQuestion = {
        ...question,
        questionBlockId: block.id,
        missingItemLabel: getMissingLabelForKey(workAreaType, question.key),
      };

      const existing = byWorkArea.get(question.workAreaId) ?? [];
      if (existing.some((item) => item.key === question.key)) {
        continue;
      }

      existing.push(activeQuestion);
      byWorkArea.set(question.workAreaId, existing);
    }
  }

  return byWorkArea;
}

function enrichScopeReviewWithActiveQuestions(
  scopeReview: ReturnType<typeof buildScopeReview>,
  activeQuestionsByWorkArea: Map<string, WorkAreaActiveQuestion[]>
): ScopeReview {
  return {
    ...scopeReview,
    workAreas: scopeReview.workAreas.map((workArea) => {
      const activeQuestions =
        activeQuestionsByWorkArea.get(workArea.workAreaId) ?? [];
      const coveredLabels = new Set(
        activeQuestions.map((question) => question.missingItemLabel)
      );

      return {
        ...workArea,
        activeQuestions,
        missingItems: workArea.missingItems.filter(
          (item) => !coveredLabels.has(item)
        ),
      };
    }),
  };
}

export function mapConstraintRow(row: DbConstraint): ConstraintRow {
  const value = parseAnswerValue(row.value);
  return {
    id: row.id,
    key: row.key,
    label: row.label,
    value: value ?? "",
  };
}

export function constraintsToQuestions(rows: ConstraintRow[]): Question[] {
  const seedByKey = new Map(
    STATIC_CONSTRAINT_SEEDS.map((seed) => [seed.key, seed])
  );

  return rows.map((row) => {
    const seed = seedByKey.get(row.key);
    return {
      id: row.id,
      key: row.key,
      label: row.label,
      questionText: seed?.question_text ?? row.label,
      inputType: seed?.input_type ?? "select",
      options: seed?.options,
      required: true,
      value: row.value,
    };
  });
}

export function mapLineItem(row: DbLineItem): EstimateLineItem {
  const { displayNotes, metadata } = parseLineItemNotes(row.notes);

  return {
    id: row.id,
    workAreaName: row.work_area_name,
    label: row.label,
    category: row.category as EstimateLineItem["category"],
    costLow: Number(row.cost_low ?? 0),
    costHigh: Number(row.cost_high ?? 0),
    sellLow: Number(row.sell_low ?? 0),
    sellHigh: Number(row.sell_high ?? 0),
    recommendedCost: Number(row.recommended_cost ?? 0),
    recommendedSell: Number(row.recommended_sell ?? 0),
    grossProfit: Number(row.gross_profit ?? 0),
    marginPercent: Number(row.margin_percent ?? 0),
    markupPercent: row.markup_percent
      ? Number(row.markup_percent)
      : undefined,
    rateSource: normalizeRateSourceLabel(row.rate_source ?? ""),
    quantity: metadata.quantity,
    unit: metadata.unit,
    labourHours: metadata.labourHours,
    productivityRate: metadata.productivityRate,
    productivityUnit: metadata.productivityUnit,
    costRate: metadata.costRate,
    sellRate: metadata.sellRate,
    itemKey: metadata.itemKey,
    sellDerivedFromMargin: metadata.sellDerivedFromMargin,
    notes: displayNotes,
    materialBuildUps: getMaterialBuildUps(row.notes),
    pricingOwner: metadata.pricingOwner,
    scopeKey: metadata.scopeKey,
    overlapGroup: metadata.overlapGroup,
    includedInTotal: metadata.includedInTotal,
    clientVisible: metadata.clientVisible,
    quantityBasis: metadata.quantityBasis,
    labourMinimum: metadata.labourMinimum,
    allowanceMinimum: metadata.allowanceMinimum,
  };
}

export function mapEstimate(
  estimate: DbEstimate,
  lineItems: DbLineItem[]
): Estimate {
  const mappedLineItems = lineItems.map(mapLineItem);
  const base = buildStaticEstimate(mappedLineItems);

  return {
    ...base,
    costLow: Number(estimate.cost_low ?? base.costLow),
    costHigh: Number(estimate.cost_high ?? base.costHigh),
    sellLow: Number(estimate.sell_low ?? base.sellLow),
    sellHigh: Number(estimate.sell_high ?? base.sellHigh),
    recommendedCost: Number(estimate.recommended_cost ?? base.recommendedCost),
    recommendedSell: Number(estimate.recommended_sell ?? base.recommendedSell),
    grossProfit: Number(estimate.gross_profit ?? base.grossProfit),
    marginPercent: Number(estimate.margin_percent ?? base.marginPercent),
    markupPercent: estimate.markup_percent
      ? Number(estimate.markup_percent)
      : base.markupPercent,
    isStale: estimate.is_stale ?? false,
    calibrationVersion: estimate.calibration_version ?? null,
    targetMarginPercent: estimate.target_margin_percent
      ? Number(estimate.target_margin_percent)
      : null,
    confidence: Number(estimate.confidence ?? base.confidence),
    rateSourceSummary:
      estimate.rate_source_summary ?? base.rateSourceSummary,
    assumptions: parseJsonStringArray(estimate.assumptions),
    missingInfo: parseJsonStringArray(estimate.missing_info),
    scopeExclusions: parseJsonStringArray(estimate.exclusions),
    assumptionMetadata: parseAssumptionMetadata(estimate.assumption_metadata),
    lineItems: mappedLineItems,
  };
}

function parseAssumptionMetadata(value: unknown): AssumptionMetadata | undefined {
  if (!value || typeof value !== "object") return undefined;
  const record = value as AssumptionMetadata;
  if (!Array.isArray(record.defaultedFacts)) return undefined;
  return record;
}

export function buildAssistantState(input: {
  project: DbProject;
  workAreas: DbWorkArea[];
  questionBlocks: DbQuestionBlock[];
  questions: DbQuestion[];
  constraints: DbConstraint[];
  estimate: DbEstimate | null;
  lineItems: DbLineItem[];
  projectFacts?: DbProjectFact[];
  defaultMarginPercent?: number;
}): AssistantState {
  const workAreas = input.workAreas.map(mapWorkArea);
  const workAreaNameById = new Map(
    workAreas.map((wa) => [wa.id, wa.name])
  );

  const workAreaQuestionBlocks = input.questionBlocks
    .filter((block) => block.stage === "work_area_questions")
    .sort((a, b) => a.sort_order - b.sort_order);

  const projectStage = input.project.stage as AssistantState["project"]["stage"];

  let questionBlock: QuestionBlockData | null = null;
  const additionalQuestionBlocks: QuestionBlockData[] = [];

  for (const block of workAreaQuestionBlocks) {
    const blockQuestions = input.questions
      .filter((q) => q.question_block_id === block.id)
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((q) =>
        mapQuestion(
          q,
          q.work_area_id
            ? workAreaNameById.get(q.work_area_id)
            : undefined
        )
      );

    const mapped = mapQuestionBlock(block, blockQuestions);

    if (
      projectStage === "work_area_questions" &&
      block.status === "active" &&
      !questionBlock
    ) {
      questionBlock = mapped;
      continue;
    }

    if (block.status === "active") {
      additionalQuestionBlocks.push(mapped);
      continue;
    }

    if (!questionBlock) {
      questionBlock = mapped;
    }
  }

  const scopeReviewQuestions = input.questions
    .filter((question) =>
      workAreaQuestionBlocks.some(
        (block) => block.id === question.question_block_id
      )
    )
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((q) =>
      mapQuestion(
        q,
        q.work_area_id ? workAreaNameById.get(q.work_area_id) : undefined
      )
    );

  const submittedConstraints = input.constraints
    .sort((a, b) => a.key.localeCompare(b.key))
    .map(mapConstraintRow);

  const constraintQuestions =
    submittedConstraints.length > 0
      ? constraintsToQuestions(submittedConstraints)
      : buildStaticConstraintQuestions();

  const estimate =
    input.estimate && input.lineItems.length > 0
      ? mapEstimate(input.estimate, input.lineItems)
      : input.estimate
        ? mapEstimate(input.estimate, input.lineItems)
        : null;

  const confirmedWorkAreas = input.workAreas.filter(
    (workArea) => workArea.status === "confirmed"
  );
  const derivedFacts = deriveFactsForProject({
    workAreas: confirmedWorkAreas.map((workArea) => ({
      id: workArea.id,
      type: workArea.type,
    })),
    projectFacts: input.projectFacts ?? [],
  });
  const mergedFacts = mergeDerivedFactsIntoRecords(
    input.projectFacts ?? [],
    derivedFacts
  );

  const scopeAssumptions = input.estimate
    ? parseJsonStringArray(input.estimate.assumptions)
    : [];
  const scopeExclusions = input.estimate
    ? parseJsonStringArray(input.estimate.exclusions)
    : [];

  const scopeReviewBase = buildScopeReview({
    workAreas: input.workAreas,
    projectFacts: input.projectFacts ?? [],
    questions: scopeReviewQuestions,
    qualityLevel: input.project.quality_level,
    scopeAssumptions,
    scopeExclusions,
  });

  const workAreaTypeById = new Map(
    input.workAreas.map((workArea) => [workArea.id, workArea.type])
  );

  const confirmedWorkAreaIds = new Set(
    input.workAreas
      .filter((workArea) => workArea.status === "confirmed")
      .map((workArea) => workArea.id)
  );

  const activeQuestionsByWorkArea = buildActiveQuestionsByWorkArea({
    additionalQuestionBlocks,
    workAreaTypeById,
    confirmedWorkAreaIds,
    includeInlineQuestions: isStageAtOrBeyond(projectStage, "constraints"),
  });

  const scopeReview = enrichScopeReviewWithActiveQuestions(
    scopeReviewBase,
    activeQuestionsByWorkArea
  );

  return {
    project: {
      id: input.project.id,
      stage: input.project.stage as AssistantState["project"]["stage"],
      briefText: input.project.brief_text,
      qualityLevel: (input.project.quality_level as QualityLevel) ?? null,
    },
    workAreas,
    questionBlock,
    additionalQuestionBlocks,
    constraintQuestions,
    submittedConstraints,
    estimate,
    scopeSummary: {
      includedWorkAreas: buildIncludedWorkAreasFromDb(input.workAreas),
      scopeAssumptions,
      scopeExclusions,
    },
    scopeReview,
    panelScopeSummaries: buildPanelScopeSummariesFromScopeReview(scopeReview),
    derivedFactDisplays: buildDerivedFactDisplays(mergedFacts),
    defaultMarginPercent: input.defaultMarginPercent ?? DEFAULT_MARGIN_PERCENT,
  };
}
