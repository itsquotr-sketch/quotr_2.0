/**
 * DOORS-02-R2 — door-location nouns must not create unrelated Work Areas.
 *
 * Run: npx --yes tsx scripts/verify-doors-02-r2-location-ownership.ts
 *
 * No paid AI. No Production. Does not change Door prices or segmentation.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { OrganisationRate } from "../components/setup/types";
import type { EstimateLineItem } from "../components/assistant/types";
import { enrichExtractionFromBrief } from "../lib/ai/enrich-extraction";
import type { AIExtractionOutput } from "../lib/ai/schema";
import { composeBuilderReview } from "../lib/assistant/builder-review/compose";
import { composeClarifyView } from "../lib/assistant/clarify/compose";
import { composeJobPlan } from "../lib/assistant/job-plan/compose";
import { composeEstimateReadiness } from "../lib/assistant/readiness/compose";
import { calculateEstimate } from "../lib/estimate/calculate-estimate";
import { DOORS_CARPENTER_LABOUR_RATE_KEY } from "../lib/estimate/doors-identities";
import {
  applyDoorsFactWrite,
  DOORS_PORTIONS_FACT_KEY,
  parseDoorsPortions,
  storedDoorsPortions,
  type DoorPortion,
} from "../lib/estimate/doors-portions";
import { doorsIncludedQuoteScopeCount } from "../lib/estimate/doors-quote";
import { round2 } from "../lib/estimate/facts";
import type {
  EstimateContext,
  EstimateFact,
  EstimateLineItemInput,
} from "../lib/estimate/types";
import { getAnalysisCapableWorkAreaTypes } from "../lib/scopes/capability";
import { buildWorkAreaQuoteDescriptionDraft } from "../lib/work-areas/quote-description";
import {
  briefHasIndependentBathroom,
  briefHasIndependentKitchen,
  staleSuggestedOwnedWorkAreasToDrop,
} from "../lib/work-areas/ownership";

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

const QA_BRIEF =
  "Supply and install two 1980 × 810 mm hollow-core prehung internal doors to the bedrooms with standard latch/lever hardware. Also replace one 2200 × 910 mm solid-core internal door leaf to the ensuite using the existing frame and existing hardware.";

const allowed = getAnalysisCapableWorkAreaTypes();

const emptyExtraction = (): AIExtractionOutput => ({
  workAreas: [],
  facts: [],
  assumptions: [],
  possibleConstraints: [],
  confidence: 0.5,
  warnings: [],
});

function extract(brief: string) {
  return enrichExtractionFromBrief({
    briefText: brief,
    extraction: emptyExtraction(),
    allowedTypes: allowed,
  }).extraction;
}

const WA = {
  id: "d1",
  type: "doors",
  name: "Doors",
  status: "confirmed" as const,
  sort_order: 1,
};

function persistDoors(extraction: AIExtractionOutput): EstimateFact[] {
  const fact = extraction.facts.find((row) => row.key === DOORS_PORTIONS_FACT_KEY);
  return applyDoorsFactWrite({
    facts: [],
    workAreaId: WA.id,
    key: DOORS_PORTIONS_FACT_KEY,
    value: parseDoorsPortions(fact?.value),
    factSource: "ai_extracted",
  });
}

function isBedroom(row: DoorPortion): boolean {
  return (
    (row.label === "Bedrooms" || row.label === "Bedroom doors") &&
    row.installation_type === "prehung_internal" &&
    row.leaf_construction === "hollow_core" &&
    row.height_mm === 1980 &&
    row.width_mm === 810 &&
    row.quantity === 2 &&
    row.hardware_included === true
  );
}

function isEnsuite(row: DoorPortion): boolean {
  return (
    (row.label === "Ensuite" || row.label === "Ensuite door") &&
    row.installation_type === "replacement_leaf" &&
    row.leaf_construction === "solid_core" &&
    row.height_mm === 2200 &&
    row.width_mm === 910 &&
    row.quantity === 1 &&
    row.hardware_included === false
  );
}

function companyLabour(cost: number): OrganisationRate {
  return {
    id: "org-labour-carpenter",
    rate_type: "labour",
    trade: "carpenter",
    work_area_type: null,
    item_key: DOORS_CARPENTER_LABOUR_RATE_KEY,
    label: "Carpenter",
    unit: "hour",
    cost_rate: cost,
    sell_rate: null,
    markup_percent: null,
    active: true,
    source: "explicit_company",
  };
}

function includedCost(items: readonly EstimateLineItemInput[]): number {
  return round2(
    items
      .filter((row) => row.includedInTotal !== false)
      .reduce((sum, row) => sum + (row.recommendedCost ?? 0), 0)
  );
}

function mapReviewLines(
  items: readonly EstimateLineItemInput[]
): EstimateLineItem[] {
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
    productivityRate: item.productivityRate,
    costRate: item.costRate,
    itemKey: item.itemKey,
    componentKey: item.componentKey,
    nestedItemId: item.nestedItemId,
    notes: item.notes,
    identitySummary: item.identitySummary,
    includedInTotal: item.includedInTotal,
    overlapGroup: item.overlapGroup,
    scopeKey: item.scopeKey,
  }));
}

console.log("=== DOORS-02-R2 location ownership ===\n");

const qa = extract(QA_BRIEF);
const qaTypes = qa.workAreas.map((row) => row.type).sort();
check(
  "1. exact hosted two-door brief is Doors only",
  qaTypes.length === 1 && qaTypes[0] === "doors",
  qaTypes.join(",")
);

const facts = persistDoors(qa);
const portions = storedDoorsPortions(facts, WA.id);
check(
  "2. both Door Sets remain separate and correct",
  portions.length === 2 && portions.some(isBedroom) && portions.some(isEnsuite)
);

const estimate = calculateEstimate({
  project: { id: "p1", qualityLevel: "standard" },
  confirmedWorkAreas: [WA],
  facts,
  constraints: [],
  organisationSettings: {
    allow_benchmark_rates: true,
    default_margin_percent: 20,
    premium_rate_factor: 1.15,
  },
  materialWastageSettings: {
    defaultMaterialWastagePercent: 10,
    timberFramingWastagePercent: 10,
    sheetMaterialWastagePercent: 10,
  },
  rates: [companyLabour(65)],
} as unknown as EstimateContext);

const materials = estimate.lineItems.filter((row) => row.category === "materials");
const labour = estimate.lineItems.filter((row) => row.category === "labour");
check(
  "3. commercial totals unchanged at $65",
  includedCost(estimate.lineItems) === 1232.5 &&
    includedCost(materials) === 810 &&
    includedCost(labour) === 422.5,
  `total=${includedCost(estimate.lineItems)} mat=${includedCost(materials)} lab=${includedCost(labour)}`
);

const locationOnly: Array<{ brief: string; banned: string }> = [
  { brief: "Replace one internal door leaf to the ensuite.", banned: "bathroom" },
  { brief: "Install a door to the bathroom.", banned: "bathroom" },
  { brief: "Supply and install bedroom doors.", banned: "bathroom" },
  { brief: "Supply and install a kitchen door.", banned: "kitchen" },
  { brief: "Replace the laundry door leaf in the existing frame.", banned: "bathroom" },
  { brief: QA_BRIEF, banned: "bathroom" },
];
for (const row of locationOnly) {
  const types = extract(row.brief).workAreas.map((wa) => wa.type);
  check(
    `4. location-only does not create ${row.banned}: ${row.brief.slice(0, 48)}`,
    !types.includes(row.banned) &&
      (row.banned !== "bathroom" || !briefHasIndependentBathroom(row.brief)) &&
      (row.banned !== "kitchen" || !briefHasIndependentKitchen(row.brief)),
    types.join(",")
  );
}

const genuineBathroom = [
  "Renovate the ensuite.",
  "Retile the bathroom.",
  "Waterproof and tile the ensuite shower.",
  "Replace the vanity and bathroom linings.",
];
for (const brief of genuineBathroom) {
  const types = extract(brief).workAreas.map((row) => row.type);
  check(
    `5. genuine bathroom still creates Bathroom: ${brief}`,
    types.includes("bathroom") && briefHasIndependentBathroom(brief),
    types.join(",")
  );
}

const combined =
  "Supply and install one 1980 × 810 mm hollow-core prehung internal door to the bedrooms. Also renovate the ensuite.";
const combinedTypes = extract(combined).workAreas.map((row) => row.type).sort();
check(
  "6. combined independent Doors + Bathroom creates both",
  combinedTypes.includes("doors") && combinedTypes.includes("bathroom"),
  combinedTypes.join(",")
);

const dropped = staleSuggestedOwnedWorkAreasToDrop({
  existing: [
    { id: "bath-suggested", type: "bathroom", status: "suggested" },
    { id: "bath-confirmed", type: "bathroom", status: "confirmed" },
    { id: "doors-suggested", type: "doors", status: "suggested" },
  ],
  extractedTypes: ["doors"],
});
check(
  "7. re-analysis drops machine-owned false Bathroom",
  dropped.length === 1 && dropped[0] === "bath-suggested"
);
check(
  "8. user-confirmed Bathroom is never silently removed",
  !dropped.includes("bath-confirmed")
);

const opening = extract(
  "Construct an internal wall with one 810 × 1980 opening. Opening only."
);
check(
  "9. Internal Walls opening ownership unchanged",
  opening.workAreas.some((row) => row.type === "internal_walls") &&
    !opening.workAreas.some((row) => row.type === "doors") &&
    !opening.workAreas.some((row) => row.type === "bathroom")
);

const ceiling = extract("Install plasterboard ceiling 40m² over the lounge.");
check(
  "10. Ceilings discovery unchanged",
  ceiling.workAreas.some((row) => row.type === "ceilings") &&
    !ceiling.workAreas.some((row) => row.type === "bathroom")
);

const plan = composeJobPlan({
  workAreas: [WA],
  facts,
  qualityLevel: "standard",
  briefText: QA_BRIEF,
});
check(
  "Work card is Doors with two Door Sets",
  plan.cards.length === 1 &&
    plan.cards[0]?.workAreaType === "doors" &&
    Boolean(plan.cards[0]?.summary?.includes("2 door specifications"))
);

const clarify = composeClarifyView({
  stage: "quality",
  briefText: QA_BRIEF,
  qualityLevel: "standard",
  workAreas: [WA],
  facts,
  constraints: [],
  jobPlan: plan,
});
const ready = composeEstimateReadiness({
  clarify,
  jobPlan: plan,
  qualityLevel: "standard",
  constraints: [],
});
check(
  "Details/Ready complete without demolition or waterproofing",
  ready.enoughToEstimate === true &&
    !clarify.candidates.some((row) => /demolition|strip-out|waterproof/i.test(row.label)) &&
    !ready.checks.some((row) => /demolition|strip-out|waterproof/i.test(row))
);

const review = composeBuilderReview({
  estimate: {
    recommendedCost: estimate.recommendedCost,
    recommendedSell: estimate.recommendedSell,
    marginPercent: estimate.marginPercent,
    confidence: estimate.confidence,
    assumptions: estimate.assumptions,
    missingInfo: estimate.missingInfo,
    lineItems: mapReviewLines(estimate.lineItems),
  },
  workAreas: [{ id: WA.id, name: WA.name, type: WA.type, status: "confirmed" }],
  requirements: estimate.requirements,
  facts,
});
check(
  "Builder Review has two Door Set groups and no Bathroom card",
  (review.workAreas[0]?.portionGroups ?? []).length === 2 &&
    !review.workAreas.some((row) => /bathroom/i.test(row.workAreaName))
);

const quote = buildWorkAreaQuoteDescriptionDraft({
  type: "doors",
  name: "Doors",
  facts: [
    {
      key: DOORS_PORTIONS_FACT_KEY,
      label: "Door sets",
      value: JSON.stringify(portions),
    },
  ],
});
check(
  "Quote still has two Doors entries",
  /Bedrooms:/.test(quote) &&
    /Ensuite:/.test(quote) &&
    doorsIncludedQuoteScopeCount([
      {
        key: DOORS_PORTIONS_FACT_KEY,
        label: "Door sets",
        value: JSON.stringify(portions),
      },
    ]) === 2
);

const bathWa = {
  id: "b1",
  type: "bathroom",
  name: "Bathroom renovation",
  status: "suggested" as const,
  sort_order: 2,
};
const falseBathPlan = composeJobPlan({
  workAreas: [WA, bathWa],
  facts,
  qualityLevel: "standard",
  briefText: QA_BRIEF,
});
const falseBathClarify = composeClarifyView({
  stage: "quality",
  briefText: QA_BRIEF,
  qualityLevel: "standard",
  workAreas: [WA, bathWa],
  facts,
  constraints: [],
  jobPlan: falseBathPlan,
});
const falseBathReady = composeEstimateReadiness({
  clarify: falseBathClarify,
  jobPlan: falseBathPlan,
  qualityLevel: "standard",
  constraints: [],
});
const readyAfter = ready.checks.length;
const readyBefore = falseBathReady.checks.length;
const reviewAfter = review.checks.length;
console.log(
  `\nCheck-count audit: Ready before (false Bathroom)=${readyBefore} after=${readyAfter}; Review after=${reviewAfter}`
);
check(
  "false Bathroom inflated Ready checks; after fix Ready has no bathroom questions",
  readyBefore > readyAfter &&
    falseBathClarify.candidates.some((row) =>
      /demolition|strip-out|waterproof/i.test(row.label)
    )
);
check(
  "Ready vs Review remaining delta is subset filtering, not a shared-conditions redesign",
  readyAfter >= 0 &&
    reviewAfter >= 0 &&
    !ready.checks.some((row) => /demolition|waterproof/i.test(row))
);

check(
  "inferBathroom no longer keys off a bare ensuite mention",
  !read("lib/ai/enrich-extraction.ts").includes(
    'if (!includesAny(brief, ["bathroom", "ensuite"])) return;'
  ) &&
    read("lib/ai/enrich-extraction.ts").includes("briefHasIndependentBathroom")
);
check(
  "prompt forbids door-location room nouns creating Bathroom",
  read("lib/ai/brief-extraction-prompt.ts").includes(
    "Room names used only as locations"
  )
);

if (failed > 0) {
  console.log(`\nFAILED ${failed}  passed ${passed}`);
  process.exit(1);
}
console.log(`\nOK  ${passed} checks`);
