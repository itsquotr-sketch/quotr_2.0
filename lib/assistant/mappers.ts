import type {
  Estimate,
  EstimateLineItem,
  QualityLevel,
  Question,
  QuestionBlockData,
  WorkArea,
  WorkAreaStatus,
} from "@/components/assistant/types";
import {
  buildStaticConstraintQuestions,
  buildStaticEstimate,
  STATIC_CONSTRAINT_SEEDS,
  STATIC_INCLUDED_WORK_AREAS,
  STATIC_PANEL_SCOPE_SUMMARIES,
  STATIC_SCOPE_ASSUMPTIONS,
  STATIC_SCOPE_EXCLUSIONS,
} from "@/lib/assistant/mock-seed";
import type {
  AssistantState,
  ConstraintRow,
} from "@/lib/assistant/types";

type DbWorkArea = {
  id: string;
  type: string;
  name: string;
  status: string;
  ai_confidence: number | null;
  summary: string | null;
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
  confidence: number | null;
  rate_source_summary: string | null;
  assumptions: unknown;
  missing_info: unknown;
  exclusions: unknown;
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

export function mapWorkArea(row: DbWorkArea): WorkArea {
  return {
    id: row.id,
    type: row.type,
    name: row.name,
    status: row.status as WorkAreaStatus,
    aiConfidence: row.ai_confidence ?? 0,
    summary: row.summary ?? undefined,
  };
}

export function mapQuestion(
  row: DbQuestion,
  workAreaName?: string
): Question {
  return {
    id: row.id,
    workAreaId: row.work_area_id ?? undefined,
    workAreaName,
    key: row.key,
    label: row.label,
    questionText: row.question_text,
    inputType: row.input_type as Question["inputType"],
    options: parseOptions(row.options),
    required: row.required,
    unit: row.unit ?? undefined,
    value: parseAnswerValue(row.answer_value),
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
    rateSource: row.rate_source ?? "",
    notes: row.notes ?? undefined,
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
    confidence: Number(estimate.confidence ?? base.confidence),
    rateSourceSummary:
      estimate.rate_source_summary ?? base.rateSourceSummary,
    assumptions: parseJsonStringArray(estimate.assumptions),
    missingInfo: parseJsonStringArray(estimate.missing_info),
    scopeExclusions: parseJsonStringArray(estimate.exclusions),
    lineItems: mappedLineItems,
  };
}

export function buildAssistantState(input: {
  project: DbProject;
  workAreas: DbWorkArea[];
  questionBlocks: DbQuestionBlock[];
  questions: DbQuestion[];
  constraints: DbConstraint[];
  estimate: DbEstimate | null;
  lineItems: DbLineItem[];
}): AssistantState {
  const workAreas = input.workAreas.map(mapWorkArea);
  const workAreaNameById = new Map(
    workAreas.map((wa) => [wa.id, wa.name])
  );

  const workAreaQuestionBlock = input.questionBlocks.find(
    (block) => block.stage === "work_area_questions"
  );

  let questionBlock: QuestionBlockData | null = null;
  if (workAreaQuestionBlock) {
    const blockQuestions = input.questions
      .filter((q) => q.question_block_id === workAreaQuestionBlock.id)
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((q) =>
        mapQuestion(
          q,
          q.work_area_id
            ? workAreaNameById.get(q.work_area_id)
            : undefined
        )
      );

    questionBlock = mapQuestionBlock(workAreaQuestionBlock, blockQuestions);
  }

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

  return {
    project: {
      id: input.project.id,
      stage: input.project.stage as AssistantState["project"]["stage"],
      briefText: input.project.brief_text,
      qualityLevel: (input.project.quality_level as QualityLevel) ?? null,
    },
    workAreas,
    questionBlock,
    constraintQuestions,
    submittedConstraints,
    estimate,
    scopeSummary: {
      includedWorkAreas: STATIC_INCLUDED_WORK_AREAS,
      scopeAssumptions: STATIC_SCOPE_ASSUMPTIONS,
      scopeExclusions: STATIC_SCOPE_EXCLUSIONS,
    },
    panelScopeSummaries: STATIC_PANEL_SCOPE_SUMMARIES,
  };
}
