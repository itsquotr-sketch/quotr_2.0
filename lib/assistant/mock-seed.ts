import type {
  Estimate,
  EstimateLineItem,
  Question,
  QuestionBlockData,
  WorkArea,
} from "@/components/assistant/types";
import {
  buildPanelScopeSummariesFromScopeReview,
  buildScopeReview,
} from "@/lib/scopes/scope-review";
import { DEFAULT_MARGIN_PERCENT } from "@/lib/estimate/constants";

export type StaticWorkAreaSeed = {
  type: string;
  name: string;
  status: "suggested" | "confirmed" | "excluded";
  ai_confidence: number;
  sort_order: number;
};

export const STATIC_WORK_AREA_SEEDS: StaticWorkAreaSeed[] = [
  {
    type: "deck",
    name: "Deck",
    status: "suggested",
    ai_confidence: 0.95,
    sort_order: 1,
  },
  {
    type: "pergola",
    name: "Pergola",
    status: "suggested",
    ai_confidence: 0.82,
    sort_order: 2,
  },
  {
    type: "external_stairs",
    name: "External Stairs",
    status: "suggested",
    ai_confidence: 0.75,
    sort_order: 3,
  },
];

export type StaticQuestionSeed = {
  key: string;
  label: string;
  question_text: string;
  input_type: "number" | "select" | "boolean" | "text";
  options?: string[];
  required: boolean;
  unit?: string;
  sort_order: number;
  work_area_type?: string;
};

export const STATIC_QUESTION_BLOCK = {
  stage: "work_area_questions" as const,
  title: "Deck details",
  description: "A few details will help sharpen the estimate.",
  sort_order: 1,
};

export const STATIC_QUESTION_SEEDS: StaticQuestionSeed[] = [
  {
    key: "deck.length_m",
    label: "Length of deck",
    question_text: "What is the deck length?",
    input_type: "number",
    unit: "m",
    required: true,
    sort_order: 1,
    work_area_type: "deck",
  },
  {
    key: "deck.width_m",
    label: "Width of deck",
    question_text: "What is the deck width?",
    input_type: "number",
    unit: "m",
    required: true,
    sort_order: 2,
    work_area_type: "deck",
  },
  {
    key: "deck.material",
    label: "Decking material",
    question_text: "What decking material should be allowed for?",
    input_type: "select",
    options: ["Hardwood", "Treated Pine", "Composite", "Not sure"],
    required: true,
    sort_order: 3,
    work_area_type: "deck",
  },
  {
    key: "deck.has_stairs",
    label: "Stairs",
    question_text: "Are stairs included?",
    input_type: "boolean",
    options: ["Yes", "No", "Not sure"],
    required: true,
    sort_order: 4,
    work_area_type: "deck",
  },
  {
    key: "deck.has_balustrade",
    label: "Balustrade",
    question_text: "Is a balustrade required?",
    input_type: "boolean",
    options: ["Yes", "No", "Not sure"],
    required: true,
    sort_order: 5,
    work_area_type: "deck",
  },
  {
    key: "deck.pergola_included",
    label: "Pergola",
    question_text: "Is the pergola included in this estimate?",
    input_type: "boolean",
    options: ["Yes", "No", "Not sure"],
    required: true,
    sort_order: 6,
    work_area_type: "deck",
  },
];

export type StaticConstraintSeed = {
  key: string;
  label: string;
  question_text: string;
  input_type: "select" | "boolean";
  options: string[];
  required: boolean;
};

export const STATIC_CONSTRAINT_SEEDS: StaticConstraintSeed[] = [
  {
    key: "site_access",
    label: "Site access",
    question_text: "How difficult is site access?",
    input_type: "select",
    options: ["Easy", "Moderate", "Difficult"],
    required: true,
  },
  {
    key: "site_slope",
    label: "Site slope",
    question_text: "Is the site sloped?",
    input_type: "boolean",
    options: ["Yes", "No", "Not sure"],
    required: true,
  },
  {
    key: "material_carry_distance",
    label: "Material carry distance",
    question_text: "Distance from material drop-off?",
    input_type: "select",
    options: ["< 10m", "10–30m", "> 30m", "Not sure"],
    required: true,
  },
  {
    key: "working_hours",
    label: "Working hours",
    question_text: "Are there working-hour restrictions?",
    input_type: "boolean",
    options: ["No", "Yes", "Not sure"],
    required: true,
  },
];

export const STATIC_INCLUDED_WORK_AREAS: WorkArea[] = [
  {
    id: "scope_deck",
    type: "deck",
    name: "Deck",
    aiConfidence: 0.95,
    status: "confirmed",
    summary:
      "Timber deck with hardwood decking, stairs and pergola included.",
    includedScopeItems: [
      {
        id: "si_deck_framing",
        label: "Deck framing/substructure",
        status: "included",
        source: "detected",
      },
      {
        id: "si_deck_hardwood",
        label: "Hardwood decking allowance",
        status: "included",
        source: "benchmark",
      },
      {
        id: "si_deck_stairs",
        label: "Stairs allowance",
        status: "included",
        source: "benchmark",
      },
      {
        id: "si_deck_pergola",
        label: "Pergola rough allowance",
        status: "included",
        source: "assumed",
      },
      {
        id: "si_deck_fixings",
        label: "Standard fixings and consumables",
        status: "included",
        source: "assumed",
      },
    ],
    excludedScopeItems: [
      {
        id: "se_deck_consent",
        label: "Building consent / engineering",
        status: "excluded",
        source: "assumed",
      },
      {
        id: "se_deck_balustrade",
        label: "Balustrade if later excluded",
        status: "excluded",
        source: "assumed",
      },
      {
        id: "se_deck_excavation",
        label: "Major excavation unless confirmed",
        status: "excluded",
        source: "assumed",
      },
    ],
    assumptions: [
      "Standard timber framing assumed",
      "Normal ground conditions assumed",
      "Pergola treated as rough allowance",
    ],
    missingInfo: [
      "Final footing details",
      "Confirm exact pergola specification",
    ],
  },
  {
    id: "scope_pergola",
    type: "pergola",
    name: "Pergola",
    aiConfidence: 0.82,
    status: "confirmed",
    summary: "Pergola included as a rough allowance.",
    includedScopeItems: [
      {
        id: "si_pergola_basic",
        label: "Basic pergola labour/material allowance",
        status: "included",
        source: "benchmark",
      },
    ],
    assumptions: ["Standard timber pergola assumed"],
    missingInfo: ["Exact pergola size", "Roof/covering type"],
  },
  {
    id: "scope_stairs",
    type: "external_stairs",
    name: "External Stairs",
    aiConfidence: 0.75,
    status: "confirmed",
    summary: "External stairs included as allowance.",
    includedScopeItems: [
      {
        id: "si_stairs_basic",
        label: "Basic stair framing and tread allowance",
        status: "included",
        source: "benchmark",
      },
    ],
    missingInfo: [
      "Number of risers",
      "Handrail/balustrade requirement",
    ],
  },
];

export const STATIC_EXCLUDED_WORK_AREAS: WorkArea[] = [];

export const STATIC_SCOPE_EXCLUSIONS: string[] = [
  "Building consent / engineering",
  "Major excavation unless confirmed",
  "Final finish selections beyond allowance",
];

export const STATIC_SCOPE_ASSUMPTIONS: string[] = [
  "Standard timber framing assumed",
  "Normal ground conditions assumed",
  "Pergola treated as rough allowance",
  "Standard timber pergola assumed",
  "Benchmark rates used unless user rates available",
];

export const STATIC_PANEL_SCOPE_SUMMARIES: { workArea: string; summary: string }[] =
  [
    { workArea: "Deck", summary: "framing, hardwood decking" },
    { workArea: "External Stairs", summary: "allowance included" },
    { workArea: "Pergola", summary: "rough allowance" },
  ];

export const STATIC_ESTIMATE_TOTALS = {
  cost_low: 14500,
  cost_high: 19100,
  sell_low: 18400,
  sell_high: 24600,
  recommended_cost: 17200,
  recommended_sell: 22500,
  gross_profit: 5300,
  margin_percent: 23.6,
  markup_percent: 30.8,
  confidence: 72,
  rate_source_summary: "Using benchmark rates",
  assumptions: [
    "Standard access assumed unless otherwise stated.",
    "Decking material based on selected allowance.",
    "Pergola included as a rough allowance.",
    "Pricing includes overhead and margin allowance.",
  ],
  missing_info: [
    "Final footing details",
    "Confirm exact pergola specification",
  ],
  exclusions: STATIC_SCOPE_EXCLUSIONS,
};

export type StaticLineItemSeed = {
  work_area_type: string;
  work_area_name: string;
  label: string;
  category: EstimateLineItem["category"];
  cost_low: number;
  cost_high: number;
  sell_low: number;
  sell_high: number;
  recommended_cost: number;
  recommended_sell: number;
  gross_profit: number;
  margin_percent: number;
  markup_percent?: number;
  rate_source: string;
  sort_order: number;
};

export const STATIC_LINE_ITEM_SEEDS: StaticLineItemSeed[] = [
  {
    work_area_type: "deck",
    work_area_name: "Deck",
    label: "Deck labour allowance",
    category: "labour",
    cost_low: 5200,
    cost_high: 6400,
    sell_low: 7200,
    sell_high: 8800,
    recommended_cost: 5800,
    recommended_sell: 8000,
    gross_profit: 2200,
    margin_percent: 27.5,
    rate_source: "Benchmark labour allowance",
    sort_order: 1,
  },
  {
    work_area_type: "deck",
    work_area_name: "Deck",
    label: "Decking materials",
    category: "materials",
    cost_low: 4800,
    cost_high: 6100,
    sell_low: 5800,
    sell_high: 7400,
    recommended_cost: 5500,
    recommended_sell: 6600,
    gross_profit: 1100,
    margin_percent: 16.7,
    rate_source: "Benchmark material allowance",
    sort_order: 2,
  },
  {
    work_area_type: "deck",
    work_area_name: "Deck",
    label: "Substructure/framing",
    category: "materials",
    cost_low: 2300,
    cost_high: 3100,
    sell_low: 2800,
    sell_high: 3800,
    recommended_cost: 2700,
    recommended_sell: 3300,
    gross_profit: 600,
    margin_percent: 18.2,
    rate_source: "Benchmark framing allowance",
    sort_order: 3,
  },
  {
    work_area_type: "external_stairs",
    work_area_name: "External Stairs",
    label: "Stairs allowance",
    category: "allowance",
    cost_low: 800,
    cost_high: 1200,
    sell_low: 1000,
    sell_high: 1600,
    recommended_cost: 1000,
    recommended_sell: 1300,
    gross_profit: 300,
    margin_percent: 23.1,
    rate_source: "Benchmark allowance",
    sort_order: 4,
  },
  {
    work_area_type: "pergola",
    work_area_name: "Pergola",
    label: "Pergola rough allowance",
    category: "allowance",
    cost_low: 2400,
    cost_high: 3600,
    sell_low: 3000,
    sell_high: 4500,
    recommended_cost: 3000,
    recommended_sell: 3800,
    gross_profit: 800,
    margin_percent: 21.1,
    rate_source: "Rough benchmark allowance",
    sort_order: 5,
  },
];

export function buildStaticConstraintQuestions(): Question[] {
  return STATIC_CONSTRAINT_SEEDS.map((seed) => ({
    id: seed.key,
    key: seed.key,
    label: seed.label,
    questionText: seed.question_text,
    inputType: seed.input_type,
    options: seed.options,
    required: seed.required,
  }));
}

export function buildStaticEstimate(
  lineItems: EstimateLineItem[]
): Estimate {
  return {
    costLow: STATIC_ESTIMATE_TOTALS.cost_low,
    costHigh: STATIC_ESTIMATE_TOTALS.cost_high,
    sellLow: STATIC_ESTIMATE_TOTALS.sell_low,
    sellHigh: STATIC_ESTIMATE_TOTALS.sell_high,
    recommendedCost: STATIC_ESTIMATE_TOTALS.recommended_cost,
    recommendedSell: STATIC_ESTIMATE_TOTALS.recommended_sell,
    grossProfit: STATIC_ESTIMATE_TOTALS.gross_profit,
    marginPercent: STATIC_ESTIMATE_TOTALS.margin_percent,
    markupPercent: STATIC_ESTIMATE_TOTALS.markup_percent,
    confidence: STATIC_ESTIMATE_TOTALS.confidence,
    rateSourceSummary: STATIC_ESTIMATE_TOTALS.rate_source_summary,
    assumptions: STATIC_ESTIMATE_TOTALS.assumptions,
    missingInfo: STATIC_ESTIMATE_TOTALS.missing_info,
    includedWorkAreas: STATIC_INCLUDED_WORK_AREAS,
    excludedWorkAreas: STATIC_EXCLUDED_WORK_AREAS,
    scopeAssumptions: STATIC_SCOPE_ASSUMPTIONS,
    scopeExclusions: STATIC_SCOPE_EXCLUSIONS,
    missingInfoByWorkArea: {
      Deck: [
        "Final footing details",
        "Confirm exact pergola specification",
      ],
      Pergola: ["Exact pergola size", "Roof/covering type"],
      "External Stairs": [
        "Number of risers",
        "Handrail/balustrade requirement",
      ],
    },
    lineItems,
  };
}

export const PROGRESS_STAGES = [
  { key: "brief", label: "Brief" },
  { key: "confirm_work_areas", label: "Work areas" },
  { key: "quality", label: "Quality" },
  { key: "work_area_questions", label: "Questions" },
  { key: "constraints", label: "Constraints" },
  { key: "estimate_ready", label: "Estimate" },
] as const;

/** Demo-only read-only state for the static demo route */
export function buildDemoAssistantState(): import("@/lib/assistant/types").AssistantState {
  const workAreas: WorkArea[] = STATIC_WORK_AREA_SEEDS.map((seed, index) => ({
    id: `demo_wa_${index}`,
    type: seed.type,
    name: seed.name,
    aiConfidence: seed.ai_confidence,
    status: "confirmed",
  }));

  const questions: Question[] = STATIC_QUESTION_SEEDS.map((seed, index) => ({
    id: `demo_q_${index}`,
    workAreaName: "Deck",
    key: seed.key,
    label: seed.label,
    questionText: seed.question_text,
    inputType: seed.input_type,
    options: seed.options,
    required: seed.required,
    unit: seed.unit,
    value:
      seed.key === "deck.length_m"
        ? 6
        : seed.key === "deck.width_m"
          ? 3
          : seed.key === "deck.material"
            ? "Hardwood"
            : "Yes",
  }));

  const questionBlock: QuestionBlockData = {
    id: "demo_qb",
    title: STATIC_QUESTION_BLOCK.title,
    description: STATIC_QUESTION_BLOCK.description,
    stage: "work_area_questions",
    questions,
    status: "submitted",
  };

  const lineItems: EstimateLineItem[] = STATIC_LINE_ITEM_SEEDS.map(
    (seed, index) => ({
      id: `demo_li_${index}`,
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
    })
  );

  const demoWorkAreas = workAreas.map((workArea, index) => ({
    id: workArea.id,
    type: workArea.type,
    name: workArea.name,
    status: "confirmed" as const,
    sort_order: index + 1,
    summary:
      STATIC_INCLUDED_WORK_AREAS.find((item) => item.name === workArea.name)
        ?.summary ?? null,
  }));

  const demoFacts = [
    {
      key: "deck.length_m",
      work_area_id: "demo_wa_0",
      value: 6,
      source: "user",
    },
    {
      key: "deck.width_m",
      work_area_id: "demo_wa_0",
      value: 3,
      source: "user",
    },
    {
      key: "deck.material",
      work_area_id: "demo_wa_0",
      value: "Hardwood",
      source: "user",
    },
    {
      key: "deck.has_stairs",
      work_area_id: "demo_wa_0",
      value: true,
      source: "user",
    },
    {
      key: "deck.has_balustrade",
      work_area_id: "demo_wa_0",
      value: true,
      source: "user",
    },
    {
      key: "pergola.roofing_included",
      work_area_id: "demo_wa_1",
      value: true,
      source: "ai_extracted",
    },
  ];

  const scopeReviewBase = buildScopeReview({
    workAreas: demoWorkAreas,
    projectFacts: demoFacts,
    questions,
    qualityLevel: "standard",
    scopeAssumptions: STATIC_SCOPE_ASSUMPTIONS,
    scopeExclusions: STATIC_SCOPE_EXCLUSIONS,
  });

  const scopeReview = {
    ...scopeReviewBase,
    workAreas: scopeReviewBase.workAreas.map((workArea) => ({
      ...workArea,
      activeQuestions: [],
    })),
  };

  return {
    project: {
      id: "demo",
      stage: "estimate_ready",
      briefText:
        "3m wide by 6m long deck with stairs and a pergola",
      qualityLevel: "standard",
    },
    workAreas,
    questionBlock,
    additionalQuestionBlocks: [],
    constraintQuestions: buildStaticConstraintQuestions().map((q) => ({
      ...q,
      value:
        q.key === "site_access"
          ? "Easy"
          : q.key === "site_slope"
            ? "No"
            : q.key === "material_carry_distance"
              ? "< 10m"
              : "No",
    })),
    submittedConstraints: STATIC_CONSTRAINT_SEEDS.map((seed, index) => ({
      id: `demo_c_${index}`,
      key: seed.key,
      label: seed.label,
      value:
        seed.key === "site_access"
          ? "Easy"
          : seed.key === "site_slope"
            ? "No"
            : seed.key === "material_carry_distance"
              ? "< 10m"
              : "No",
    })),
    estimate: buildStaticEstimate(lineItems),
    scopeSummary: {
      includedWorkAreas: STATIC_INCLUDED_WORK_AREAS,
      scopeAssumptions: STATIC_SCOPE_ASSUMPTIONS,
      scopeExclusions: STATIC_SCOPE_EXCLUSIONS,
    },
    scopeReview,
    panelScopeSummaries: buildPanelScopeSummariesFromScopeReview(scopeReview),
    derivedFactDisplays: [],
    defaultMarginPercent: DEFAULT_MARGIN_PERCENT,
  };
}
