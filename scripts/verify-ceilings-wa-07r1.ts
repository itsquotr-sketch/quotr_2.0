/**
 * CEILINGS WA-07R1 — P1/P2 closure before human QA.
 *
 * Run: npx --yes tsx scripts/verify-ceilings-wa-07r1.ts
 *
 * Preview only. Does not change physical formulas or commercial benchmarks.
 */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { OrganisationSettings } from "../components/setup/types";
import type { EstimateLineItem } from "../components/assistant/types";
import { enrichExtractionFromBrief } from "../lib/ai/enrich-extraction";
import type { AIExtractionOutput } from "../lib/ai/schema";
import { composeBuilderReview } from "../lib/assistant/builder-review/compose";
import { composeClarifyView } from "../lib/assistant/clarify/compose";
import { composeJobPlan } from "../lib/assistant/job-plan/compose";
import { composeEstimateReadiness } from "../lib/assistant/readiness/compose";
import {
  extractCeilingPortionsFromBrief,
  mergeCeilingPortionsPreferringExplicitAi,
} from "../lib/estimate/ceilings-brief";
import {
  aggregateCeilingCommercialLines,
  commercializeCeilings,
} from "../lib/estimate/ceilings-commercial";
import {
  CEILINGS_PARTIAL_ESTIMATE_MESSAGE,
  CEILINGS_SPECIALIST_COMPONENT,
} from "../lib/estimate/ceilings-identities";
import { CEILINGS_PLASTERBOARD_COMPONENT } from "../lib/estimate/ceilings-lining";
import { calculateCeilingsPhysical } from "../lib/estimate/ceilings-physical";
import {
  applyCeilingsFactWrite,
  CEILINGS_PORTIONS_FACT_KEY,
  createEmptyCeilingBulkhead,
  createEmptyCeilingPortion,
  normalizeExtractedCeilingPortions,
  type CeilingPortion,
} from "../lib/estimate/ceilings-portions";
import { nestedCeilingsQuoteIsBlocked } from "../lib/estimate/ceilings-quote-readiness";
import {
  CEILINGS_SPECIALIST_FIRE_ACOUSTIC_NOTICE,
  ceilingPortionHasUnknownProprietaryFireAcoustic,
} from "../lib/estimate/ceilings-specialist";
import { getAnalysisCapableWorkAreaTypes } from "../lib/scopes/capability";
import { discoverWorkAreaInstances } from "../lib/work-areas/discovery-instances";
import { buildWorkAreaDescriptionsMap } from "../lib/work-areas/quote-description";
import type {
  EstimateFact,
  EstimateLineItemInput,
  EstimateWorkArea,
} from "../lib/estimate/types";
import type { MaterialWastageSettings } from "../lib/settings/material-wastage";

let passed = 0;
let failed = 0;

function check(name: string, ok: boolean, detail = ""): void {
  if (ok) {
    passed += 1;
    console.log(`PASS  ${name}`);
  } else {
    failed += 1;
    console.log(`FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

function read(rel: string): string {
  return readFileSync(join(process.cwd(), rel), "utf8");
}

const P1 = "aaaaaaaa-bbbb-4ccc-8ddd-111111111111";
const P2 = "bbbbbbbb-cccc-4ddd-8eee-222222222222";
const BH1 = "cccccccc-dddd-4eee-8fff-333333333333";
const allowed = getAnalysisCapableWorkAreaTypes();

const WASTAGE: MaterialWastageSettings = {
  defaultMaterialWastagePercent: 10,
  sheetMaterialWastagePercent: 10,
  timberFramingWastagePercent: 10,
};

const SETTINGS: OrganisationSettings = {
  id: "s1",
  org_id: "o1",
  default_margin_percent: 20,
  default_contingency_percent: 0,
  budget_rate_factor: 0.9,
  premium_rate_factor: 1.15,
  currency: "NZD",
  country: "NZ",
  region: null,
  onboarding_status: "completed",
  onboarding_step: "completed",
  onboarding_completed_at: null,
  prefer_user_rates: true,
  allow_benchmark_rates: true,
  show_profit_in_estimates: true,
};

const emptyExtraction = (): AIExtractionOutput => ({
  workAreas: [
    {
      type: "ceilings",
      name: "Ceilings",
      confidence: 0.9,
      rationale: "AI",
    },
  ],
  facts: [],
  assumptions: [],
  possibleConstraints: [],
  confidence: 0.9,
  warnings: [],
});

function wa(id = "c1", name = "Ceilings"): EstimateWorkArea {
  return { id, type: "ceilings", name, sort_order: 1 };
}

function writePortions(
  portions: CeilingPortion[],
  workAreaId = "c1"
): EstimateFact[] {
  return applyCeilingsFactWrite({
    facts: [],
    workAreaId,
    key: CEILINGS_PORTIONS_FACT_KEY,
    value: portions,
  });
}

function plasterPortion(params?: {
  id?: string;
  label?: string;
  length?: number;
  width?: number;
  product?: "standard" | "aqualine" | "fyreline";
}): CeilingPortion {
  const length = params?.length ?? 4;
  const width = params?.width ?? 3;
  const row = createEmptyCeilingPortion({
    id: params?.id ?? P1,
    label: params?.label ?? "Lounge",
  });
  row.structure.family = "existing_framing";
  row.structure.job_scope = "reline_existing_suitable_framing";
  row.lining.family = "plasterboard";
  row.lining.plasterboard_product = params?.product ?? "standard";
  row.lining.thickness_mm = 13;
  row.lining.sheet_length_mm = 3000;
  row.lining.sheet_width_mm = 1200;
  row.lining.layers = 1;
  row.geometry.mode = "length_width";
  row.geometry.length_m = length;
  row.geometry.width_m = width;
  row.geometry.area_m2 = Number((length * width).toFixed(2));
  row.finish.insulation_included = false;
  row.finish.painting_included = false;
  row.finish.stopping_included = false;
  row.finish.demolition_included = false;
  row.has_bulkheads = false;
  return row;
}

function completeExistingArea(portionId: string): CeilingPortion {
  const portion = plasterPortion({ id: portionId, label: "Lounge" });
  portion.geometry.mode = "area_only";
  portion.geometry.area_m2 = 30;
  return portion;
}

function clarifyOf(facts: EstimateFact[], briefText = "") {
  const workAreas = [
    { id: "c1", type: "ceilings", name: "Ceilings", status: "confirmed" as const },
    { id: "p1", type: "painting", name: "Painting", status: "confirmed" as const },
    { id: "pl1", type: "plastering", name: "Plastering", status: "confirmed" as const },
  ];
  const plan = composeJobPlan({
    workAreas,
    facts,
    qualityLevel: "standard",
    briefText,
  });
  return composeClarifyView({
    stage: "quality",
    briefText,
    qualityLevel: "standard",
    workAreas,
    facts,
    constraints: [],
    jobPlan: plan,
  });
}

function mapReviewLines(items: readonly EstimateLineItemInput[]): EstimateLineItem[] {
  return items.map((item, index) => ({
    id: `line-${index}`,
    workAreaName: item.workAreaName,
    label: item.label,
    category: item.category,
    costLow: item.costLow,
    costHigh: item.costHigh,
    sellLow: item.sellLow,
    sellHigh: item.sellHigh,
    recommendedCost: item.recommendedCost,
    recommendedSell: item.recommendedSell,
    grossProfit: item.grossProfit,
    marginPercent: item.marginPercent,
    markupPercent: item.markupPercent,
    rateSource: item.rateSource,
    quantity: item.quantity,
    unit: item.unit,
    labourHours: item.labourHours,
    itemKey: item.itemKey,
    componentKey: item.componentKey,
    componentId: item.componentId,
    nestedItemId: item.nestedItemId,
    contributingNestedItemIds: item.contributingNestedItemIds,
    notes: item.notes,
    includedInTotal: item.includedInTotal,
  }));
}

function reviewOf(commercial: {
  lineItems: readonly EstimateLineItemInput[];
  assumptions: readonly string[];
  missingInfo: readonly string[];
  requirements: readonly import("../lib/estimate/requirements").EstimateRequirement[];
}, facts: EstimateFact[]) {
  const cost = commercial.lineItems.reduce(
    (sum, row) => sum + (row.recommendedCost ?? 0),
    0
  );
  const sell = commercial.lineItems.reduce(
    (sum, row) => sum + (row.recommendedSell ?? 0),
    0
  );
  return composeBuilderReview({
    estimate: {
      recommendedCost: cost,
      recommendedSell: sell,
      marginPercent: 20,
      confidence: 0.8,
      assumptions: commercial.assumptions,
      missingInfo: commercial.missingInfo,
      lineItems: mapReviewLines(commercial.lineItems),
    },
    workAreas: [{ id: "c1", type: "ceilings", name: "Ceilings", status: "confirmed" }],
    requirements: commercial.requirements,
    facts,
  });
}

function quoteDraft(portions: CeilingPortion[]): string {
  const facts = writePortions(portions);
  const raw = facts.find((row) => row.key === CEILINGS_PORTIONS_FACT_KEY)?.value;
  const value = typeof raw === "string" ? raw : JSON.stringify(raw);
  return (
    buildWorkAreaDescriptionsMap(
      [{ id: "c1", type: "ceilings", name: "Ceilings" }],
      new Map([
        ["c1", [{ key: CEILINGS_PORTIONS_FACT_KEY, label: "Portions", value }]],
      ])
    ).get("c1") ?? ""
  );
}

function runCommercial(portions: CeilingPortion[]) {
  const facts = writePortions(portions);
  const physical = calculateCeilingsPhysical({
    facts,
    workArea: wa(),
    materialWastageSettings: WASTAGE,
  });
  const commercial = commercializeCeilings({
    physical,
    workArea: wa(),
    rates: [],
    organisationSettings: SETTINGS,
  });
  return { facts, physical, commercial };
}

function spawnVerifier(script: string): boolean {
  const result = spawnSync("npx", ["--yes", "tsx", script], {
    cwd: process.cwd(),
    encoding: "utf8",
    shell: true,
  });
  if (result.status !== 0) {
    console.log(result.stdout);
    console.log(result.stderr);
  }
  return result.status === 0;
}

console.log("=== CEILINGS WA-07R1 P1/P2 closure ===\n");

const REQUIRED =
  "Lounge ceiling is 4m x 3m with 13mm Standard GIB and hallway ceiling is 6m x 1.2m with 13mm Fyreline.";
const required = extractCeilingPortionsFromBrief(REQUIRED);
check(
  "D one-sentence two-Portion brief produces 2 Portions",
  required.length === 2 &&
    required[0]!.label === "Lounge" &&
    required[0]!.geometry.length_m === 4 &&
    required[0]!.geometry.width_m === 3 &&
    required[0]!.lining.plasterboard_product === "standard" &&
    required[0]!.lining.thickness_mm === 13 &&
    required[1]!.label === "Hallway" &&
    required[1]!.geometry.length_m === 6 &&
    required[1]!.geometry.width_m === 1.2 &&
    required[1]!.lining.plasterboard_product === "fyreline" &&
    required[1]!.lining.thickness_mm === 13 &&
    !(required.length === 1 && required[0]!.geometry.area_m2 === 19.2)
);

const comma = extractCeilingPortionsFromBrief(
  "Lounge ceiling 4m x 3m standard GIB, hallway ceiling 6m x 1.2m Fyreline"
);
check(
  "D comma two-Portion attribution kept",
  comma.length === 2 &&
    comma[0]!.label === "Lounge" &&
    comma[1]!.label === "Hallway" &&
    comma[1]!.lining.plasterboard_product === "fyreline"
);

const semi = extractCeilingPortionsFromBrief(
  "Lounge ceiling 4m x 3m standard GIB; hallway ceiling 6m x 1.2m Fyreline"
);
check(
  "E semicolon two-Portion brief produces 2 Portions",
  semi.length === 2 &&
    semi[0]!.geometry.length_m === 4 &&
    semi[1]!.geometry.length_m === 6
);

const ambiguous = extractCeilingPortionsFromBrief(
  "Replace the lounge and hallway ceilings in plasterboard."
);
check(
  "F clearly ambiguous prose is not over-split",
  ambiguous.length <= 1
);

const AI_A = "aaaaaaaa-bbbb-4ccc-8ddd-aaaa11111111";
const AI_B = "bbbbbbbb-cccc-4ddd-8eee-bbbb22222222";
const aiNested = {
  workAreas: emptyExtraction().workAreas,
  facts: [
    {
      work_area_type: "ceilings" as const,
      key: CEILINGS_PORTIONS_FACT_KEY,
      label: "Ceiling portions",
      value: [
        {
          id: AI_A,
          label: "Lounge",
          geometry: { mode: "length_width", length_m: 4, width_m: 3, area_m2: 12 },
          structure_family: "timber_direct_fix",
          lining_family: "plasterboard",
          plasterboard_product: "standard",
          thickness_mm: 13,
          finish: {
            insulation_included: true,
            insulation_type: "R3.2 ceiling batts",
          },
        },
        {
          id: AI_B,
          label: "Hallway",
          geometry: { mode: "length_width", length_m: 6, width_m: 1.2, area_m2: 7.2 },
          structure_family: "existing_framing",
          lining_family: "plasterboard",
          plasterboard_product: "fyreline",
          thickness_mm: 13,
          fire_acoustic_requirement: "specified",
          fire_acoustic_system: "GIB Fyreline 60/60/60",
        },
      ],
      confidence: 0.95,
    },
  ],
  assumptions: [],
  possibleConstraints: [],
  confidence: 0.95,
  warnings: [],
};
const preserved = enrichExtractionFromBrief({
  briefText: REQUIRED,
  extraction: aiNested,
  allowedTypes: allowed,
});
const preservedPortions = normalizeExtractedCeilingPortions(
  preserved.extraction.facts.find((row) => row.key === CEILINGS_PORTIONS_FACT_KEY)
    ?.value
);
check(
  "A valid AI nested Portions survive enrichment",
  preservedPortions.length === 2 &&
    preservedPortions.some(
      (row) =>
        row.label === "Lounge" &&
        row.finish.insulation_type === "R3.2 ceiling batts" &&
        row.structure.family === "timber_direct_fix"
    ) &&
    preservedPortions.some(
      (row) =>
        row.label === "Hallway" &&
        row.fire_acoustic_system === "GIB Fyreline 60/60/60" &&
        row.lining.plasterboard_product === "fyreline"
    )
);

const partialAi = [
  createEmptyCeilingPortion({ id: P1, label: "Lounge" }),
  createEmptyCeilingPortion({ id: P2, label: "Hallway" }),
];
partialAi[0]!.lining.family = "plasterboard";
partialAi[0]!.lining.plasterboard_product = "standard";
partialAi[1]!.lining.family = "plasterboard";
partialAi[1]!.lining.plasterboard_product = "fyreline";
const filled = mergeCeilingPortionsPreferringExplicitAi(partialAi, required);
check(
  "B deterministic parser fills only missing safe fields",
  filled.length === 2 &&
    filled[0]!.lining.plasterboard_product === "standard" &&
    filled[0]!.lining.thickness_mm === 13 &&
    filled[0]!.geometry.length_m === 4 &&
    filled[1]!.lining.plasterboard_product === "fyreline" &&
    filled[1]!.geometry.length_m === 6
);

const strongerAi = [
  plasterPortion({ id: P1, label: "Lounge", product: "aqualine" }),
  plasterPortion({
    id: P2,
    label: "Hallway",
    length: 6,
    width: 1.2,
    product: "standard",
  }),
];
strongerAi[0]!.lining.thickness_mm = 10;
const notOverwritten = mergeCeilingPortionsPreferringExplicitAi(
  strongerAi,
  required
);
check(
  "C deterministic parser does not overwrite stronger AI values",
  notOverwritten[0]!.lining.plasterboard_product === "aqualine" &&
    notOverwritten[0]!.lining.thickness_mm === 10 &&
    notOverwritten[1]!.lining.plasterboard_product === "standard"
);

const packages = discoverWorkAreaInstances(
  "Main House Ceilings: lounge and hallway ceilings in plasterboard. Sleepout Ceilings: bedroom ceiling in plasterboard."
).filter((row) => row.type === "ceilings");
check(
  "G Main House Ceilings + Sleepout Ceilings → 2 WAs",
  packages.length === 2 &&
    packages.some((row) => row.name === "Main House Ceilings") &&
    packages.some((row) => row.name === "Sleepout Ceilings")
);

const arbitrary = discoverWorkAreaInstances(
  "Office Ceilings: open plan plasterboard. Warehouse Ceilings: storage plasterboard. Unit 1 Ceilings: beds. Unit 2 Ceilings: living."
).filter((row) => row.type === "ceilings");
check(
  "H arbitrary clear repeated labels do not require hardcoded names",
  arbitrary.length >= 2 &&
    arbitrary.some((row) => /office/i.test(row.name)) &&
    arbitrary.some((row) => /warehouse/i.test(row.name)) &&
    !read("lib/work-areas/discovery-instances.ts").includes("Sleepout Ceilings") &&
    !read("lib/work-areas/discovery-instances.ts").includes("Main House Ceilings")
);

const portionsOnly = enrichExtractionFromBrief({
  briefText: REQUIRED,
  extraction: emptyExtraction(),
  allowedTypes: allowed,
});
check(
  "I multiple Portions alone do not become multiple WAs",
  portionsOnly.extraction.workAreas.filter((row) => row.type === "ceilings")
    .length === 1 &&
    normalizeExtractedCeilingPortions(
      portionsOnly.extraction.facts.find(
        (row) => row.key === CEILINGS_PORTIONS_FACT_KEY
      )?.value
    ).length === 2
);

const fire = completeExistingArea(P1);
fire.fire_acoustic_requirement = "unknown_proprietary";
const fireFacts = writePortions([fire]);
const fireClarify = clarifyOf(fireFacts);
const firePanel = fireClarify.nestedItemPanels?.[0]?.items[0];
const fireReady = composeEstimateReadiness({
  clarify: fireClarify,
  jobPlan: composeJobPlan({
    workAreas: [
      { id: "c1", type: "ceilings", name: "Ceilings", status: "confirmed" },
    ],
    facts: fireFacts,
    qualityLevel: "standard",
  }),
  qualityLevel: "standard",
  constraints: [],
});
const fireRun = runCommercial([fire]);
check(
  "J unknown_proprietary specialist does not appear as normal complete Ceiling",
  firePanel?.complete === false &&
    firePanel?.specialistRequired === true &&
    (firePanel?.summary ?? "").includes(CEILINGS_SPECIALIST_FIRE_ACOUSTIC_NOTICE) &&
    fireReady.specialistPricingRequired === true &&
    fireReady.heading === CEILINGS_SPECIALIST_FIRE_ACOUSTIC_NOTICE &&
    !/that's enough to build your estimate/i.test(fireReady.heading) &&
    fireRun.commercial.completeness !== "COMPLETE_COMMERCIAL" &&
    ceilingPortionHasUnknownProprietaryFireAcoustic(fire)
);

check(
  "K specialist state remains Pricing Required / unsupported downstream",
  fireRun.physical.completeness === "UNSUPPORTED_SPECIALIST" &&
    fireRun.commercial.completeness === "UNSUPPORTED_SPECIALIST" &&
    fireRun.commercial.missingInfo.includes(CEILINGS_PARTIAL_ESTIMATE_MESSAGE) &&
    fireRun.commercial.requirements.some(
      (row) => row.componentKey === CEILINGS_SPECIALIST_COMPONENT
    ) &&
    nestedCeilingsQuoteIsBlocked({
      missingInfo: fireRun.commercial.missingInfo,
      items: fireRun.commercial.lineItems.map((item) => ({
        component_key: item.componentKey,
        itemKey: item.itemKey,
        notes: item.notes,
        label: item.label,
        total_cost: item.recommendedCost,
        total_sell: item.recommendedSell,
        unit_cost: item.unitCost,
        cost_known: item.costKnown,
        rateSourceType: item.rateSourceType,
      })),
    }) === true
);

check(
  "L Details does not endlessly re-ask an already-known specialist answer",
  !fireClarify.candidates.some(
    (row) => row.factKey === "ceilings.portion.fire_acoustic_requirement"
  ) &&
    !fireClarify.candidates.some(
      (row) => row.factKey === "ceilings.portion.fire_acoustic_system"
    )
);

const loungeHall = runCommercial([
  plasterPortion({ id: P1, label: "Lounge" }),
  plasterPortion({ id: P2, label: "Hall", length: 5, width: 3 }),
]);
const review = reviewOf(loungeHall.commercial, loungeHall.facts);
const plasterLine = loungeHall.commercial.lineItems.find(
  (row) => row.componentKey === CEILINGS_PLASTERBOARD_COMPONENT
);
const aggregated = aggregateCeilingCommercialLines(
  loungeHall.commercial.lineItems.filter(
    (row) => row.componentKey === CEILINGS_PLASTERBOARD_COMPONENT
  )
);
const loungeGroup = review.workAreas[0]?.portionGroups?.find((row) => row.id === P1);
const hallGroup = review.workAreas[0]?.portionGroups?.find((row) => row.id === P2);
const shared = review.workAreas[0]?.sharedLineGroups ?? [];
const loungeLining = loungeGroup?.lineGroups.find((row) => row.secondary === "Lining");
const hallLining = hallGroup?.lineGroups.find((row) => row.secondary === "Lining");
const sharedPlaster = shared.find((row) =>
  /plasterboard lining/i.test(row.label)
);
check(
  "M aggregated material total shown once / unambiguously",
  aggregated.length === 1 &&
    shared.length >= 1 &&
    shared.some((row) => /Includes Lounge \+ Hall/i.test(row.supporting ?? "")) &&
    (plasterLine?.recommendedCost ?? 0) > 0 &&
    Math.abs((sharedPlaster?.recommendedCost ?? 0) - (plasterLine?.recommendedCost ?? 0)) <
      0.05 &&
    (loungeLining?.costHidden === true || (loungeLining?.recommendedCost ?? 0) === 0) &&
    (hallLining?.costHidden === true || (hallLining?.recommendedCost ?? 0) === 0)
);

check(
  "N contributing Portion identities visible in Review",
  (loungeGroup?.label ?? "").includes("Lounge") &&
    (hallGroup?.label ?? "").includes("Hall") &&
    (aggregated[0]!.contributingNestedItemIds?.includes(P1) ?? false) &&
    (aggregated[0]!.contributingNestedItemIds?.includes(P2) ?? false)
);

const reviewTotal = review.overview.recommendedCost;
const commercialTotal = loungeHall.commercial.lineItems.reduce(
  (sum, row) => sum + (row.recommendedCost ?? 0),
  0
);
check(
  "O Builder Review mathematical total unchanged",
  Math.abs(reviewTotal - commercialTotal) < 0.05
);

const fyreBh = plasterPortion();
const bh = createEmptyCeilingBulkhead({ id: BH1, label: "Bulkhead 1" });
bh.form = "conventional_two_face_downstand";
bh.length_m = 4;
bh.depth_m = 0.4;
bh.height_m = 0.5;
bh.framing_type = "timber";
bh.lining_type = "fyreline";
bh.thickness_mm = 13;
fyreBh.has_bulkheads = true;
fyreBh.bulkheads = [bh];
const fyreQuote = quoteDraft([fyreBh]);
check(
  "P bulkhead Quote includes its own lining type",
  /fyreline/i.test(fyreQuote) && /wall-adjacent downstand bulkhead/i.test(fyreQuote)
);

check(
  "Q bulkhead Quote includes thickness when known",
  /13mm Fyreline/i.test(fyreQuote)
);

const unknownBh = plasterPortion();
const bare = createEmptyCeilingBulkhead({ id: BH1, label: "Bulkhead 1" });
bare.length_m = 4;
bare.depth_m = 0.4;
bare.height_m = 0.5;
bare.framing_type = "timber";
unknownBh.has_bulkheads = true;
unknownBh.bulkheads = [bare];
const unknownQuote = quoteDraft([unknownBh]);
check(
  "R bulkhead Quote does not invent unknown lining",
  /wall-adjacent downstand bulkhead/i.test(unknownQuote) &&
    !/lined in/i.test(unknownQuote) &&
    !/Fyreline|Aqualine|Standard plasterboard/i.test(
      unknownQuote.slice(unknownQuote.indexOf("bulkhead"))
    )
);

const standardBh = plasterPortion();
const std = createEmptyCeilingBulkhead({ id: BH1, label: "Bulkhead 1" });
std.length_m = 4;
std.depth_m = 0.4;
std.height_m = 0.5;
std.framing_type = "timber";
std.lining_type = "standard";
std.thickness_mm = 13;
standardBh.has_bulkheads = true;
standardBh.bulkheads = [std];
check(
  "P Standard bulkhead lining wording",
  /13mm Standard plasterboard/i.test(quoteDraft([standardBh]))
);

check(
  "S existing quote PR gate unchanged",
  read("lib/quotes/build-from-pricing.ts").includes("nestedCeilingsQuoteIsBlocked") &&
    read("lib/quotes/actions.ts").includes("CEILINGS_QUOTE_PR_BLOCK_MESSAGE") &&
    read("lib/estimate/ceilings-quote-readiness.ts").includes(
      "Some Ceiling items still require pricing. Resolve Pricing Required lines before sending a final quote."
    ) &&
    !read("lib/quotes/actions.ts")
      .slice(read("lib/quotes/actions.ts").indexOf("export async function markQuoteAccepted"))
      .includes("CEILINGS_QUOTE_PR_BLOCK_MESSAGE")
);

check(
  "no physical formula / commercial benchmark edits in this slice",
  !read("lib/estimate/ceilings-physical.ts").includes("WA-07R1") &&
    !read("lib/estimate/ceilings-framing.ts").includes("cost_rate:") &&
    !read("lib/work-areas/discovery-instances.ts").includes("Sleepout")
);

console.log("\n=== Prior Ceiling + quote regressions ===\n");
check("verify-ceilings-wa-06.ts", spawnVerifier("scripts/verify-ceilings-wa-06.ts"));

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
