/**
 * FLOORING-06-R2 — explicit negative removal ownership.
 *
 * Root cause (hosted QA):
 *   Segmentation attached trailing negatives to the dining snippet only.
 *   Deterministic extraction did not recognise
 *   "No flooring or substrate removal is required" as finish_removal=No.
 *   AI/deterministic merge then filled finish_removal=true and
 *   existing_finish_type=carpet (first enum / invented type) onto the
 *   bathroom tile area. Physical takeoff emitted 12 m² carpet removal
 *   (0.12 h/m² = 1.44 h) and commercialisation priced carpenter hours.
 *
 * Failing stage: AI/deterministic merge, caused by deterministic extraction
 * leaving removal unanswered so AI could invent carpet.
 *
 * Run: npx --yes tsx scripts/verify-flooring-06-r2-negative-removal.ts
 * No paid AI. No Production.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { enrichExtractionFromBrief } from "../lib/ai/enrich-extraction";
import type { AIExtractionOutput } from "../lib/ai/schema";
import { composeBuilderReview } from "../lib/assistant/builder-review/compose";
import type { OrganisationRate } from "../components/setup/types";
import type { EstimateLineItem } from "../components/assistant/types";
import { calculateEstimate } from "../lib/estimate/calculate-estimate";
import {
  extractFlooringPortionsFromBrief,
  mergeFlooringPortionsPreferringDeterministic,
} from "../lib/estimate/flooring-brief";
import {
  FLOORING_CARPENTER_LABOUR_RATE_KEY,
  FLOORING_CARPET_REMOVE_LABOUR,
  FLOORING_FLOOR_PREPARATION_ALLOWANCE_M2,
  FLOORING_HARDWOOD_SUPPLY_INSTALL_M2,
  FLOORING_SUBSTRATE_REMOVE_LABOUR,
  FLOORING_TILE_SUPPLY_INSTALL_M2,
} from "../lib/estimate/flooring-identities";
import {
  FLOORING_NESTED_NOT_CALCULATED_MESSAGE,
  FLOORING_PORTIONS_FACT_KEY,
  applyFlooringFactWrite,
  createEmptyFlooringPortion,
  mergePersistedFlooringPortionsOnReanalyse,
  parseFlooringPortions,
  type FlooringPortion,
} from "../lib/estimate/flooring-portions";
import { calculateFlooringPhysical } from "../lib/estimate/flooring-physical";
import { round2 } from "../lib/estimate/facts";
import type {
  EstimateConstraint,
  EstimateContext,
  EstimateFact,
  EstimateLineItemInput,
  EstimateWorkArea,
} from "../lib/estimate/types";
import { getAnalysisCapableWorkAreaTypes } from "../lib/scopes/capability";
import { buildWorkAreaQuoteDescriptionDraft } from "../lib/work-areas/quote-description";

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

const HOSTED_BRIEF =
  "Supply and install 12 m² of 600 × 600 mm tiled flooring to the bathroom floor, including ordinary floor preparation. Also supply and install 15 m² of hardwood flooring using 186 mm wide boards to the dining room. Existing substrates and framing are to remain. No flooring or substrate removal is required.";

const WA: EstimateWorkArea = {
  id: "f1",
  type: "flooring",
  name: "Flooring",
  sort_order: 1,
  status: "confirmed",
} as EstimateWorkArea;

const emptyExtraction = (): AIExtractionOutput => ({
  workAreas: [],
  facts: [],
  assumptions: [],
  possibleConstraints: [],
  confidence: 0.5,
  warnings: [],
});

const allowed = getAnalysisCapableWorkAreaTypes();

function extract(brief: string) {
  return enrichExtractionFromBrief({
    briefText: brief,
    extraction: emptyExtraction(),
    allowedTypes: allowed,
  }).extraction;
}

function portionsOf(brief: string): FlooringPortion[] {
  const extraction = extract(brief);
  const fact = extraction.facts.find((row) => row.key === FLOORING_PORTIONS_FACT_KEY);
  return parseFlooringPortions(fact?.value);
}

function persist(portions: readonly FlooringPortion[]): EstimateFact[] {
  return [
    {
      key: FLOORING_PORTIONS_FACT_KEY,
      work_area_id: WA.id,
      value: portions,
      source: "ai_extracted",
    },
  ];
}

function ctx(
  facts: EstimateFact[],
  extra: { rates?: OrganisationRate[]; constraints?: EstimateConstraint[] } = {}
): EstimateContext {
  return {
    project: { id: "p1", qualityLevel: "standard" },
    confirmedWorkAreas: [WA],
    facts,
    constraints: extra.constraints ?? [],
    organisationSettings: {
      allow_benchmark_rates: true,
      default_margin_percent: 20,
    },
    rates: extra.rates ?? [],
  } as unknown as EstimateContext;
}

function carpenter(cost: number): OrganisationRate {
  return {
    id: "org-carpenter",
    item_key: FLOORING_CARPENTER_LABOUR_RATE_KEY,
    rate_type: "labour",
    label: "Carpenter",
    unit: "hour",
    cost_rate: cost,
    sell_rate: null,
    markup_percent: null,
    active: true,
    trade: "carpenter",
    work_area_type: "flooring",
    source: "explicit_company",
  };
}

function includedCost(
  items: readonly { includedInTotal?: boolean; rateSourceType?: string; recommendedCost?: number | null }[]
): number {
  return round2(
    items
      .filter(
        (row) =>
          row.includedInTotal !== false && row.rateSourceType !== "missing"
      )
      .reduce((sum, row) => sum + (row.recommendedCost ?? 0), 0)
  );
}

function near(actual: number | null | undefined, expected: number, tol = 0.02): boolean {
  return actual != null && Number.isFinite(actual) && Math.abs(actual - expected) <= tol;
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

function reviewOf(
  estimate: ReturnType<typeof calculateEstimate>,
  facts: EstimateFact[]
) {
  return composeBuilderReview({
    estimate: {
      recommendedCost: estimate.recommendedCost,
      recommendedSell: estimate.recommendedSell,
      marginPercent: estimate.marginPercent,
      confidence: estimate.confidence,
      assumptions: estimate.assumptions,
      missingInfo: estimate.missingInfo,
      lineItems: mapReviewLines(estimate.lineItems),
    },
    workAreas: [{ ...WA, status: "confirmed" }],
    requirements: estimate.requirements,
    facts,
  });
}

function noRemovalIdentity(
  items: readonly { componentKey?: string | null; label?: string }[]
): boolean {
  return items.every(
    (row) =>
      row.componentKey !== FLOORING_CARPET_REMOVE_LABOUR &&
      row.componentKey !== FLOORING_SUBSTRATE_REMOVE_LABOUR &&
      !/\.remove$/.test(row.componentKey ?? "") &&
      !/carpet finish removal|existing carpet/i.test(row.label ?? "")
  );
}

console.log("\n=== A. Hosted tile + hardwood negative removal ===\n");

const hostedTypes = extract(HOSTED_BRIEF).workAreas.map((row) => row.type);
check(
  "1. Flooring only — no Bathroom Renovation",
  hostedTypes.length === 1 && hostedTypes[0] === "flooring"
);

const hostedPortions = portionsOf(HOSTED_BRIEF);
check("2. Two Flooring Areas", hostedPortions.length === 2);

const bathroom = hostedPortions.find((row) => /bathroom/i.test(row.label ?? ""));
const dining = hostedPortions.find((row) => /dining/i.test(row.label ?? ""));
check(
  "3. Bathroom tile 12 m² 600×600 with preparation",
  bathroom?.finish_type === "tile" &&
    bathroom.area_m2 === 12 &&
    bathroom.tile_width_mm === 600 &&
    bathroom.tile_length_mm === 600 &&
    bathroom.floor_preparation_required === true
);
check(
  "4. Dining hardwood 15 m² 186 mm boards",
  dining?.finish_type === "hardwood" &&
    dining.area_m2 === 15 &&
    dining.hardwood_board_width_mm === 186
);
check(
  "5. Both areas finish_removal=No",
  bathroom?.finish_removal_required === false &&
    dining?.finish_removal_required === false
);
check(
  "6. Both areas substrate_removal=No",
  bathroom?.substrate_removal_required === false &&
    dining?.substrate_removal_required === false
);
check(
  "7. No invented carpet existing-finish identity",
  bathroom?.existing_finish_type == null &&
    dining?.existing_finish_type == null &&
    bathroom?.finish_type !== "carpet"
);

const aiInvented: FlooringPortion[] = [
  {
    ...createEmptyFlooringPortion({
      id: bathroom?.id ?? "fa_bath",
      label: "Bathroom",
    }),
    finish_type: "tile",
    area_m2: 12,
    finish_removal_required: true,
    existing_finish_type: "carpet",
    substrate_removal_required: true,
  },
  {
    ...createEmptyFlooringPortion({
      id: dining?.id ?? "fa_din",
      label: "Dining room",
    }),
    finish_type: "hardwood",
    area_m2: 15,
    finish_removal_required: true,
    existing_finish_type: "carpet",
  },
];
const merged = mergeFlooringPortionsPreferringDeterministic(
  aiInvented,
  hostedPortions
);
check(
  "8. Merge does not adopt invented AI carpet removal",
  merged.every(
    (row) =>
      row.finish_removal_required === false &&
      row.existing_finish_type == null &&
      row.substrate_removal_required !== true
  )
);

const hostedEst = calculateEstimate(
  ctx(persist(hostedPortions), { rates: [carpenter(65)] })
);
check(
  "9. Direct COST is exactly $5,070 with company carpenter $65 unused",
  near(includedCost(hostedEst.lineItems), 5070)
);
check(
  "10. Tile $1,800 + preparation $420 + hardwood $2,850",
  near(
    hostedEst.lineItems.find((row) => row.componentKey === FLOORING_TILE_SUPPLY_INSTALL_M2)
      ?.recommendedCost,
    1800
  ) &&
    near(
      hostedEst.lineItems.find(
        (row) => row.componentKey === FLOORING_FLOOR_PREPARATION_ALLOWANCE_M2
      )?.recommendedCost,
      420
    ) &&
    near(
      hostedEst.lineItems.find(
        (row) => row.componentKey === FLOORING_HARDWOOD_SUPPLY_INSTALL_M2
      )?.recommendedCost,
      2850
    )
);
check("11. No removal commercial line", noRemovalIdentity(hostedEst.lineItems));

const physical = calculateFlooringPhysical({
  workArea: WA,
  facts: persist(hostedPortions),
});
check(
  "12. Physical takeoff has no finish- or substrate-removal requirement",
  physical.requirements.every(
    (row) =>
      row.componentKey !== FLOORING_CARPET_REMOVE_LABOUR &&
      row.componentKey !== FLOORING_SUBSTRATE_REMOVE_LABOUR &&
      !/\.remove$/.test(row.componentKey)
  )
);

const review = reviewOf(hostedEst, persist(hostedPortions));
const reviewText = JSON.stringify(review);
check(
  "13. Builder Review has no carpet-removal identity",
  !/carpet finish removal|existing carpet|flooring\.carpet\.remove/i.test(reviewText)
);
check(
  "13b. Builder Review does not list a populated Removal group",
  !(review.workAreas[0]?.portionGroups ?? []).some((group) =>
    (group.lineGroups ?? []).some(
      (lg) => /removal/i.test(lg.label) && lg.children.length > 0
    )
  )
);

const quote = buildWorkAreaQuoteDescriptionDraft({
  type: "flooring",
  name: "Flooring",
  facts: [
    {
      key: FLOORING_PORTIONS_FACT_KEY,
      value: JSON.stringify(hostedPortions),
    },
  ],
  pricingItems: hostedEst.lineItems.map((item) => ({
    label: item.label,
    component_key: item.componentKey,
    nested_item_id: item.nestedItemId,
    cost_known: item.rateSourceType !== "missing",
    total_cost: item.recommendedCost ?? 0,
    total_sell: item.recommendedSell ?? 0,
    notes_internal: item.notes,
  })),
});
check(
  "14. Quote does not include removal as priced scope",
  !/Includes removal/i.test(quote) && !/carpet flooring/i.test(quote)
);
check(
  "15. No canonical/legacy diagnostic in Estimate missingInfo",
  !hostedEst.missingInfo.includes(FLOORING_NESTED_NOT_CALCULATED_MESSAGE) &&
    !hostedEst.missingInfo.some((row) =>
      /canonical nested|legacy Flooring allowance path/i.test(row)
    )
);

console.log("\n=== B. Clause-local negative matrix ===\n");

function pair(brief: string): FlooringPortion[] {
  return extractFlooringPortionsFromBrief(brief);
}

const shared = pair(
  "Supply and install 10 m² of carpet to the bedrooms. Also supply and install 8 m² of vinyl plank to the living room. No flooring or substrate removal is required."
);
check(
  "16. Shared final negative applies to both areas",
  shared.length === 2 &&
    shared.every((row) => row.finish_removal_required === false)
);

const contrast = pair(
  "Supply and install 10 m² of carpet to the bedrooms. Remove carpet in the bedrooms, but no removal in the living room. Also supply and install 8 m² of vinyl plank to the living room."
);
const contrastBed = contrast.find((row) => /bedroom/i.test(row.label ?? ""));
const contrastLiv = contrast.find((row) => /living/i.test(row.label ?? ""));
check(
  "17. Bedroom removal Yes; living removal No",
  contrastBed?.finish_removal_required === true &&
    contrastBed.existing_finish_type === "carpet" &&
    contrastLiv?.finish_removal_required === false
);

const retainSub = pair(
  "Supply and install 12 m² of tiled flooring to the bathroom floor. Remove tile but retain the substrate."
);
check(
  "18. Remove tile / retain substrate",
  retainSub[0]?.finish_removal_required === true &&
    retainSub[0]?.existing_finish_type === "tile" &&
    retainSub[0]?.substrate_removal_required === false
);

const replaceSub = pair(
  "Supply and install 12 m² of hardwood to the dining room. No flooring removal, but replace the substrate."
);
check(
  "19. No flooring removal does not invent substrate removal",
  replaceSub[0]?.finish_removal_required === false &&
    replaceSub[0]?.substrate_removal_required !== true &&
    replaceSub[0]?.substrate_required === true
);

const bothYes = pair(
  "Supply and install 10 m² of vinyl plank to the office. Remove carpet and substrate."
);
check(
  "20. Remove carpet and substrate → both Yes",
  bothYes[0]?.finish_removal_required === true &&
    bothYes[0]?.existing_finish_type === "carpet" &&
    bothYes[0]?.substrate_removal_required === true
);

const phrases: readonly string[] = [
  "no flooring removal required",
  "no floor-covering removal required",
  "no existing flooring removal",
  "existing flooring is to remain",
  "retain the existing flooring where applicable",
  "no substrate removal required",
  "existing substrate is to remain",
  "retain the existing substrate",
  "no flooring or substrate removal is required",
  "existing substrates and framing are to remain",
];
let phraseOk = true;
for (const phrase of phrases) {
  const rows = pair(
    `Supply and install 10 m² of tiled flooring to the bathroom floor. ${phrase}.`
  );
  const row = rows[0];
  if (!row) {
    phraseOk = false;
    break;
  }
  if (/substrate/.test(phrase) && !/flooring or substrate/.test(phrase)) {
    if (row.substrate_removal_required !== false) phraseOk = false;
  } else if (/flooring or substrate/.test(phrase)) {
    if (row.finish_removal_required !== false || row.substrate_removal_required !== false) {
      phraseOk = false;
    }
  } else if (/flooring|floor-covering|floor covering/.test(phrase)) {
    if (row.finish_removal_required !== false) phraseOk = false;
  } else if (/substrate/.test(phrase)) {
    if (row.substrate_removal_required !== false) phraseOk = false;
  }
}
check("21. Required negative phrase matrix", phraseOk);

check(
  "22. Tile area is never assigned carpet unless carpet was stated",
  bathroom?.existing_finish_type !== "carpet" &&
    pair(
      "Supply and install 12 m² of tiled flooring to the bathroom. No flooring removal is required."
    )[0]?.existing_finish_type == null
);

console.log("\n=== C. User authority survives re-analysis ===\n");

const userYes = {
  ...(bathroom as FlooringPortion),
  finish_removal_required: true,
  finish_removal_authority: "user" as const,
  existing_finish_type: "tile" as const,
  existing_finish_authority: "user" as const,
};
const reextracted = extractFlooringPortionsFromBrief(HOSTED_BRIEF);
const afterReanalyse = mergePersistedFlooringPortionsOnReanalyse({
  extracted: reextracted,
  persisted: [userYes, dining as FlooringPortion],
});
const kept = afterReanalyse.find((row) => row.id === userYes.id);
check(
  "23. User-owned removal Yes survives negative re-analysis",
  kept?.finish_removal_required === true &&
    kept.finish_removal_authority === "user" &&
    kept.existing_finish_type === "tile"
);

const userNoWrite = applyFlooringFactWrite({
  facts: persist(hostedPortions),
  workAreaId: WA.id,
  key: "flooring.portion.finish_removal_required",
  value: false,
  nestedItemId: bathroom?.id,
  factSource: "user",
});
const userStored = parseFlooringPortions(
  userNoWrite.find((row) => row.key === FLOORING_PORTIONS_FACT_KEY)?.value
).find((row) => row.id === bathroom?.id);
check(
  "24. User No is persisted with user authority",
  userStored?.finish_removal_required === false &&
    userStored.finish_removal_authority === "user"
);

console.log("\n=== D. Source ownership ===\n");

const briefSrc = read("lib/estimate/flooring-brief.ts");
check(
  "25. Hosted negative phrase is owned by deterministic extraction",
  briefSrc.includes("no flooring or substrate removal is required") &&
    briefSrc.includes("applyClauseLocalRemoval") &&
    briefSrc.includes("existing_finish_type === \"carpet\"") === false
);
check(
  "26. Merge refuses AI-invented removal Yes",
  /Never invent removal/.test(briefSrc) ||
    briefSrc.includes("secondary.finish_removal_required === false")
);

if (failed > 0) {
  console.log(`\nFAILED ${failed} / ${passed + failed}`);
  process.exit(1);
}
console.log(`\nAll ${passed} checks passed.`);
