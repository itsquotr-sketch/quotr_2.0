/**
 * @deprecated Import from `@/lib/assistant/mock-seed` instead.
 * Re-exports kept for backward compatibility during Phase 2C-2.
 */
export {
  buildStaticConstraintQuestions,
  buildStaticEstimate,
  PROGRESS_STAGES,
  STATIC_CONSTRAINT_SEEDS,
  STATIC_ESTIMATE_TOTALS,
  STATIC_EXCLUDED_WORK_AREAS,
  STATIC_INCLUDED_WORK_AREAS,
  STATIC_LINE_ITEM_SEEDS,
  STATIC_PANEL_SCOPE_SUMMARIES,
  STATIC_QUESTION_BLOCK,
  STATIC_QUESTION_SEEDS,
  STATIC_SCOPE_ASSUMPTIONS,
  STATIC_SCOPE_EXCLUSIONS,
  STATIC_WORK_AREA_SEEDS,
} from "@/lib/assistant/mock-seed";

import {
  buildStaticConstraintQuestions,
  buildStaticEstimate,
  STATIC_INCLUDED_WORK_AREAS,
  STATIC_EXCLUDED_WORK_AREAS,
  STATIC_SCOPE_ASSUMPTIONS,
  STATIC_SCOPE_EXCLUSIONS,
  STATIC_PANEL_SCOPE_SUMMARIES,
  STATIC_LINE_ITEM_SEEDS,
  STATIC_WORK_AREA_SEEDS,
  STATIC_QUESTION_BLOCK,
  STATIC_QUESTION_SEEDS,
} from "@/lib/assistant/mock-seed";
import type {
  Estimate,
  Question,
  QuestionBlockData,
  WorkArea,
} from "@/components/assistant/types";

export const MOCK_WORK_AREAS: WorkArea[] = STATIC_WORK_AREA_SEEDS.map(
  (seed, index) => ({
    id: `mock_wa_${index}`,
    type: seed.type,
    name: seed.name,
    aiConfidence: seed.ai_confidence,
    status: seed.status,
  })
);

export const MOCK_INCLUDED_WORK_AREAS = STATIC_INCLUDED_WORK_AREAS;
export const MOCK_EXCLUDED_WORK_AREAS = STATIC_EXCLUDED_WORK_AREAS;
export const MOCK_SCOPE_EXCLUSIONS = STATIC_SCOPE_EXCLUSIONS;
export const MOCK_SCOPE_ASSUMPTIONS = STATIC_SCOPE_ASSUMPTIONS;
export const MOCK_PANEL_SCOPE_SUMMARIES = STATIC_PANEL_SCOPE_SUMMARIES;

export const MOCK_WORK_AREA_QUESTIONS: Question[] = STATIC_QUESTION_SEEDS.map(
  (seed, index) => ({
    id: `mock_q_${index}`,
    workAreaName: "Deck",
    key: seed.key,
    label: seed.label,
    questionText: seed.question_text,
    inputType: seed.input_type,
    options: seed.options,
    required: seed.required,
    unit: seed.unit,
  })
);

export const MOCK_WORK_AREA_QUESTION_BLOCK: QuestionBlockData = {
  id: "mock_qb_deck",
  title: STATIC_QUESTION_BLOCK.title,
  description: STATIC_QUESTION_BLOCK.description,
  stage: "work_area_questions",
  questions: MOCK_WORK_AREA_QUESTIONS,
  status: "active",
};

export const MOCK_CONSTRAINT_QUESTIONS = buildStaticConstraintQuestions();

export const MOCK_CONSTRAINT_BLOCK: QuestionBlockData = {
  id: "mock_qb_constraints",
  title: "Site constraints",
  description: "These help adjust labour and access allowances.",
  stage: "constraints",
  questions: MOCK_CONSTRAINT_QUESTIONS,
  status: "active",
};

export const MOCK_ESTIMATE: Estimate = buildStaticEstimate(
  STATIC_LINE_ITEM_SEEDS.map((seed, index) => ({
    id: `mock_li_${index}`,
    workAreaName: seed.work_area_name,
    label: seed.label,
    category: seed.category,
    costLow: seed.cost_low,
    costHigh: seed.cost_high,
    sellLow: seed.sell_low,
    sellHigh: seed.sell_high,
    recommendedCost: seed.recommended_cost,
    recommendedSell: seed.recommended_sell,
    grossProfit: seed.gross_profit,
    marginPercent: seed.margin_percent,
    markupPercent: seed.markup_percent,
    rateSource: seed.rate_source,
  }))
);
