/**
 * DOORS-02-R1 — hosted multi-clause Door Set extraction and persistence.
 *
 * Run: npx --yes tsx scripts/verify-doors-02-r1-hosted-multi-set.ts
 *
 * No paid AI. No Production.
 *
 * Pre-fix reproduction (diagnostic on HEAD 6dbc38a7, exact QA brief):
 *   extractDoorPortionsFromBrief → 1 portion
 *   id: random ds UUID
 *   label: Ensuite (global location regex; `\bbedroom doors?\b` missed
 *     “to the bedrooms”, then `\bensuite\b` won)
 *   installation: prehung_internal
 *   construction: hollow_core
 *   dimensions: 1980 × 810
 *   quantity: 2
 *   hardware: true
 *   authority: extracted
 *   persist: one doors.portions collection row, one hybrid entry
 *   Work: “Doors · 1 door set”
 *   hosted COST at Quotr $60: $890 (= QA $915 at company $65)
 *
 * Failing stage: splitDoorSetSnippets returned one snippet, so clause 2
 * never became a portion. “Ensuite” attached during locationFromSnippet
 * on the unsplit brief. Merge/persist could not invent the missing set.
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
import { FITOUT_BENCHMARKS } from "../lib/estimate/benchmark-rates";
import {
  extractDoorPortionsFromBrief,
  mergeDoorPortionsPreferringDeterministic,
} from "../lib/estimate/doors-brief";
import { doorPortionIsInformationComplete } from "../lib/estimate/doors-clarify";
import { DOORS_CARPENTER_LABOUR_RATE_KEY } from "../lib/estimate/doors-identities";
import {
  applyDoorsFactWrite,
  DOORS_DELETE_PORTION_KEY,
  DOORS_PORTIONS_FACT_KEY,
  mergePersistedDoorsPortionsOnReanalyse,
  parseDoorsPortions,
  storedDoorsPortions,
  type DoorPortion,
} from "../lib/estimate/doors-portions";
import { doorsIncludedQuoteScopeCount } from "../lib/estimate/doors-quote";
import { looksLikeDoorProductMoney } from "../lib/estimate/internal-walls-identities";
import { round2 } from "../lib/estimate/facts";
import type {
  EstimateContext,
  EstimateFact,
  EstimateLineItemInput,
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

const QA_BRIEF =
  "Supply and install two 1980 × 810 mm hollow-core prehung internal doors to the bedrooms with standard latch/lever hardware. Also replace one 2200 × 910 mm solid-core internal door leaf to the ensuite using the existing frame and existing hardware.";

const PRE_FIX_HYBRID = {
  count: 1,
  label: "Ensuite",
  installation_type: "prehung_internal",
  leaf_construction: "hollow_core",
  height_mm: 1980,
  width_mm: 810,
  quantity: 2,
  hardware_included: true,
  workSummary: "Doors · 1 door set",
  quotrCost: 890,
} as const;

const allowed = getAnalysisCapableWorkAreaTypes();

const emptyExtraction = (): AIExtractionOutput => ({
  workAreas: [],
  facts: [],
  assumptions: [],
  possibleConstraints: [],
  confidence: 0.5,
  warnings: [],
});

const WA = {
  id: "d1",
  type: "doors",
  name: "Doors",
  status: "confirmed" as const,
  sort_order: 1,
};

function extract(brief: string, ai: AIExtractionOutput = emptyExtraction()) {
  return enrichExtractionFromBrief({
    briefText: brief,
    extraction: ai,
    allowedTypes: allowed,
  }).extraction;
}

function persistExtracted(
  extraction: AIExtractionOutput,
  previous: EstimateFact[] = []
): EstimateFact[] {
  const fact = extraction.facts.find((row) => row.key === DOORS_PORTIONS_FACT_KEY);
  const incoming = parseDoorsPortions(fact?.value);
  return applyDoorsFactWrite({
    facts: previous,
    workAreaId: WA.id,
    key: DOORS_PORTIONS_FACT_KEY,
    value: incoming,
    factSource: "ai_extracted",
  });
}

function hostedFacts(brief: string, ai?: AIExtractionOutput): EstimateFact[] {
  return persistExtracted(extract(brief, ai));
}

function portions(facts: EstimateFact[]): DoorPortion[] {
  return storedDoorsPortions(facts, WA.id);
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

function noLeakage(rows: readonly DoorPortion[]): boolean {
  const bedroom = rows.find(isBedroom);
  const ensuite = rows.find(isEnsuite);
  if (!bedroom || !ensuite) return false;
  return (
    bedroom.label !== ensuite.label &&
    bedroom.installation_type !== ensuite.installation_type &&
    bedroom.leaf_construction !== ensuite.leaf_construction &&
    bedroom.height_mm !== ensuite.height_mm &&
    bedroom.width_mm !== ensuite.width_mm &&
    bedroom.quantity !== ensuite.quantity &&
    bedroom.hardware_included !== ensuite.hardware_included
  );
}

function planOf(facts: EstimateFact[], brief: string) {
  return composeJobPlan({
    workAreas: [WA],
    facts,
    qualityLevel: "standard",
    briefText: brief,
  });
}

function clarifyOf(facts: EstimateFact[], brief: string) {
  return composeClarifyView({
    stage: "quality",
    briefText: brief,
    qualityLevel: "standard",
    workAreas: [WA],
    facts,
    constraints: [],
    jobPlan: planOf(facts, brief),
  });
}

function readyOf(facts: EstimateFact[], brief: string) {
  const jobPlan = planOf(facts, brief);
  return composeEstimateReadiness({
    clarify: composeClarifyView({
      stage: "quality",
      briefText: brief,
      qualityLevel: "standard",
      workAreas: [WA],
      facts,
      constraints: [],
      jobPlan,
    }),
    jobPlan,
    qualityLevel: "standard",
    constraints: [],
  });
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

function estimateOf(facts: EstimateFact[], rates: OrganisationRate[] = []) {
  const ctx = {
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
    rates,
  } as unknown as EstimateContext;
  return calculateEstimate(ctx);
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
    workAreas: [{ id: WA.id, name: WA.name, type: WA.type, status: "confirmed" }],
    requirements: estimate.requirements,
    facts,
  });
}

function quoteOf(facts: EstimateFact[]) {
  const nested = portions(facts);
  return buildWorkAreaQuoteDescriptionDraft({
    type: "doors",
    name: "Doors",
    facts: [
      {
        key: DOORS_PORTIONS_FACT_KEY,
        label: "Door sets",
        value: JSON.stringify(nested),
      },
    ],
  });
}

function hybridAi(): AIExtractionOutput {
  return {
    ...emptyExtraction(),
    workAreas: [
      { type: "doors", name: "Doors", confidence: 0.7, rationale: "AI hybrid" },
    ],
    facts: [
      {
        work_area_type: "doors",
        work_area_name: "Doors",
        key: DOORS_PORTIONS_FACT_KEY,
        label: "Door sets",
        value: [
          {
            id: "ai-hybrid",
            label: "Ensuite",
            installation_type: "prehung_internal",
            leaf_construction: "hollow_core",
            height_mm: 1980,
            width_mm: 810,
            quantity: 2,
            hardware_included: true,
            specialist_kind: null,
          },
        ],
        confidence: 0.7,
      },
    ],
  };
}

function expectTwoQa(rows: readonly DoorPortion[]): boolean {
  return rows.length === 2 && noLeakage(rows);
}

console.log("=== DOORS-02-R1 hosted multi-set ===\n");

check(
  "pre-fix hybrid snapshot is documented",
  PRE_FIX_HYBRID.count === 1 &&
    PRE_FIX_HYBRID.label === "Ensuite" &&
    PRE_FIX_HYBRID.installation_type === "prehung_internal" &&
    PRE_FIX_HYBRID.quantity === 2 &&
    PRE_FIX_HYBRID.workSummary.includes("1 door set")
);

const parsed = extractDoorPortionsFromBrief(QA_BRIEF);
check(
  "1. deterministic parser returns two portions",
  parsed.length === 2 && expectTwoQa(parsed),
  `count=${parsed.length} labels=${parsed.map((row) => row.label).join(",")}`
);

const hosted = hostedFacts(QA_BRIEF);
const hostedPortions = portions(hosted);
check(
  "2. hosted enrich+persist returns two portions",
  expectTwoQa(hostedPortions),
  `count=${hostedPortions.length}`
);
check("3. bedroom fields", hostedPortions.some(isBedroom));
check("4. ensuite fields", hostedPortions.some(isEnsuite));
check("5. no field leakage", noLeakage(hostedPortions));
check(
  "6. distinct stable IDs",
  hostedPortions.length === 2 &&
    hostedPortions[0]!.id !== hostedPortions[1]!.id &&
    Boolean(hostedPortions[0]!.id) &&
    Boolean(hostedPortions[1]!.id)
);

const reFacts = persistExtracted(extract(QA_BRIEF), hosted);
const rePortions = portions(reFacts);
check(
  "7. idempotent re-analysis",
  rePortions.length === 2 &&
    rePortions[0]!.id === hostedPortions[0]!.id &&
    rePortions[1]!.id === hostedPortions[1]!.id &&
    expectTwoQa(rePortions)
);

const userP1 = applyDoorsFactWrite({
  facts: hosted,
  workAreaId: WA.id,
  key: "doors.portion.quantity",
  value: 5,
  nestedItemId: hostedPortions.find(isBedroom)!.id,
});
const afterUserP1 = persistExtracted(extract(QA_BRIEF), userP1);
const userP1Rows = portions(afterUserP1);
check(
  "8. user edit portion 1 survives re-analysis",
  userP1Rows.length === 2 &&
    userP1Rows.find(isEnsuite) != null &&
    userP1Rows.find((row) => row.label === "Bedrooms" || row.label === "Bedroom doors")
      ?.quantity === 5 &&
    userP1Rows.find((row) => row.label === "Bedrooms" || row.label === "Bedroom doors")
      ?.quantity_authority === "user"
);

const ensuiteId = hostedPortions.find(isEnsuite)!.id;
const userP2 = applyDoorsFactWrite({
  facts: hosted,
  workAreaId: WA.id,
  key: "doors.portion.width_mm",
  value: 860,
  nestedItemId: ensuiteId,
});
const afterUserP2 = persistExtracted(extract(QA_BRIEF), userP2);
const userP2Rows = portions(afterUserP2);
check(
  "8b. user edit portion 2 survives re-analysis",
  userP2Rows.length === 2 &&
    userP2Rows.find((row) => row.id === ensuiteId)?.width_mm === 860 &&
    userP2Rows.find((row) => row.id === ensuiteId)?.width_authority === "user" &&
    userP2Rows.some(isBedroom)
);

const deleted = applyDoorsFactWrite({
  facts: hosted,
  workAreaId: WA.id,
  key: DOORS_DELETE_PORTION_KEY,
  value: ensuiteId,
});
const afterDelete = persistExtracted(extract(QA_BRIEF), deleted);
check(
  "9. deleted portion is not recreated on re-analysis",
  portions(afterDelete).length === 1 &&
    portions(afterDelete).some(isBedroom) &&
    !portions(afterDelete).some(isEnsuite)
);

const userHybrid = mergePersistedDoorsPortionsOnReanalyse({
  extracted: parsed,
  persisted: [
    {
      ...hostedPortions[0]!,
      label: "Ensuite",
      label_authority: "user",
      installation_type: "prehung_internal",
      leaf_construction: "hollow_core",
      height_mm: 1980,
      width_mm: 810,
      quantity: 2,
      hardware_included: true,
    },
  ],
});
check(
  "9b. user-owned single hybrid is not auto-split",
  userHybrid.length === 1 && userHybrid[0]?.label_authority === "user"
);

const machineHybrid = mergePersistedDoorsPortionsOnReanalyse({
  extracted: parsed,
  persisted: [
    {
      id: "stale-hybrid",
      label: "Ensuite",
      installation_type: "prehung_internal",
      leaf_construction: "hollow_core",
      height_mm: 1980,
      width_mm: 810,
      quantity: 2,
      hardware_included: true,
      other_description: null,
      specialist_kind: null,
      installation_authority: "extracted",
      leaf_authority: "extracted",
      height_authority: "extracted",
      width_authority: "extracted",
      quantity_authority: "extracted",
      hardware_authority: "extracted",
      label_authority: "extracted",
    },
  ],
});
check(
  "9c. machine-owned hybrid is repaired to two portions",
  machineHybrid.length === 2 &&
    machineHybrid[0]?.id === "stale-hybrid" &&
    expectTwoQa(machineHybrid)
);

check(
  "10. one canonical collection row",
  hosted.filter((row) => row.key === DOORS_PORTIONS_FACT_KEY).length === 1 &&
    reFacts.filter((row) => row.key === DOORS_PORTIONS_FACT_KEY).length === 1
);
check(
  "11. no scalar competing facts",
  !hosted.some((row) => row.key === "doors.count") &&
    !extract(QA_BRIEF).facts.some((row) => row.key === "doors.count") &&
    !extract(QA_BRIEF).facts.some((row) => row.key === "doors.door_type")
);

const card = planOf(hosted, QA_BRIEF).cards[0];
check(
  "12. Work card says two Door Sets",
  Boolean(card?.summary?.includes("2 door specifications")) &&
    card?.included.length === 2 &&
    card.specChips.length === 2
);

const clarify = clarifyOf(hosted, QA_BRIEF);
const panelItems = clarify.nestedItemPanels?.[0]?.items ?? [];
const ready = readyOf(hosted, QA_BRIEF);
const knownText = ready.known.join(" | ");
check(
  "13. Details/Ready represent two Door Sets",
  panelItems.length === 2 &&
    panelItems.every((row) => row.complete) &&
    !/^1$/.test(knownText) &&
    !knownText.includes("KNOWN") &&
    /Bedrooms|Bedroom/.test(knownText) &&
    /Ensuite/.test(knownText) &&
    ready.enoughToEstimate === true &&
    hostedPortions.every(doorPortionIsInformationComplete)
);

const est60 = estimateOf(hosted);
const est65 = estimateOf(hosted, [companyLabour(65)]);
const review60 = reviewOf(est60, hosted);
const reviewGroups = review60.workAreas[0]?.portionGroups ?? [];
check(
  "14. hosted estimate has two Review groups",
  reviewGroups.length === 2 &&
    reviewGroups.some((row) => /Bedroom/i.test(row.label)) &&
    reviewGroups.some((row) => /Ensuite/i.test(row.label))
);
check(
  "15. direct COST $1,200 at Quotr $60",
  includedCost(est60.lineItems) === 1200,
  `actual=${includedCost(est60.lineItems)}`
);
check(
  "16. direct COST $1,232.50 at company $65",
  includedCost(est65.lineItems) === 1232.5,
  `actual=${includedCost(est65.lineItems)}`
);

const quote = quoteOf(hosted);
check(
  "17. Quote produces two independent scope entries",
  /Bedrooms:/.test(quote) &&
    /Ensuite:/.test(quote) &&
    /prehung internal door sets/.test(quote) &&
    /replacement internal door leaf/.test(quote) &&
    doorsIncludedQuoteScopeCount([
      { key: DOORS_PORTIONS_FACT_KEY, label: "Door sets", value: JSON.stringify(hostedPortions) },
    ]) === 2
);
check(
  "18. no legacy package money",
  !est60.lineItems.some((row) =>
    looksLikeDoorProductMoney(row.label) ||
    /supply\/install allowance/i.test(row.label) ||
    row.recommendedCost === FITOUT_BENCHMARKS.doorsEach.cost * 2
  )
);

const specialistPlus = hostedFacts(
  "Supply and install one fire-rated door. Also supply and install one 1980 × 810 mm hollow-core prehung internal door."
);
const specialistRows = portions(specialistPlus);
check(
  "19. supported/specialist siblings remain independent",
  specialistRows.length === 2 &&
    specialistRows.some((row) => row.installation_type === "other_unsupported") &&
    specialistRows.some(
      (row) =>
        row.installation_type === "prehung_internal" &&
        row.leaf_construction === "hollow_core" &&
        row.width_mm === 810
    )
);

const openingOnly = extract(
  "Construct an internal wall with one 810 × 1980 opening. Opening only."
);
const combined = extract(
  "Build a new internal wall with one 810 × 1980 door opening and supply and install two 1980 × 810 mm hollow-core prehung internal doors to the bedrooms with standard latch/lever hardware. Also replace one 2200 × 910 mm solid-core internal door leaf to the ensuite using the existing frame and existing hardware."
);
const combinedDoors = persistExtracted(combined);
check(
  "20. Internal Walls opening ownership is unchanged",
  !openingOnly.workAreas.some((row) => row.type === "doors") &&
    !openingOnly.facts.some((row) => row.key === DOORS_PORTIONS_FACT_KEY) &&
    combined.workAreas.some((row) => row.type === "internal_walls") &&
    combined.workAreas.some((row) => row.type === "doors") &&
    expectTwoQa(portions(combinedDoors)) &&
    !combined.facts.some(
      (row) => row.key.startsWith("internal_walls.") && row.key.includes("doors")
    )
);

const vsHybridAi = persistExtracted(extract(QA_BRIEF, hybridAi()));
check(
  "AI/deterministic merge preserves two clause-local sets against a hybrid AI payload",
  expectTwoQa(portions(vsHybridAi))
);

const mergedDirect = mergeDoorPortionsPreferringDeterministic(
  parseDoorsPortions(hybridAi().facts[0]?.value),
  parsed
);
check(
  "AI matching does not collapse deterministic portions",
  expectTwoQa(mergedDirect)
);

const matrix: Array<{ name: string; brief: string; assert: (rows: DoorPortion[]) => boolean }> =
  [
    {
      name: "I1 exact QA brief",
      brief: QA_BRIEF,
      assert: expectTwoQa,
    },
    {
      name: "I2 without Also",
      brief:
        "Supply and install two 1980 × 810 mm hollow-core prehung internal doors to the bedrooms with standard latch/lever hardware. Replace one 2200 × 910 mm solid-core internal door leaf to the ensuite using the existing frame and existing hardware.",
      assert: expectTwoQa,
    },
    {
      name: "I3 joined with plus",
      brief:
        "Supply and install two 1980 × 810 mm hollow-core prehung internal doors to the bedrooms with standard latch/lever hardware plus replace one 2200 × 910 mm solid-core internal door leaf to the ensuite using the existing frame and existing hardware.",
      assert: expectTwoQa,
    },
    {
      name: "I4 joined with semicolon",
      brief:
        "Supply and install two 1980 × 810 mm hollow-core prehung internal doors to the bedrooms with standard latch/lever hardware; replace one 2200 × 910 mm solid-core internal door leaf to the ensuite using the existing frame and existing hardware.",
      assert: expectTwoQa,
    },
    {
      name: "I5 replacement clause first",
      brief:
        "Replace one 2200 × 910 mm solid-core internal door leaf to the ensuite using the existing frame and existing hardware. Also supply and install two 1980 × 810 mm hollow-core prehung internal doors to the bedrooms with standard latch/lever hardware.",
      assert: (rows) =>
        rows.length === 2 &&
        rows[0] != null &&
        isEnsuite(rows[0]) &&
        rows[1] != null &&
        isBedroom(rows[1]),
    },
    {
      name: "I6 two prehung sets different dimensions",
      brief:
        "Supply and install two 1980 × 810 mm hollow-core prehung internal doors to the bedrooms. Also supply and install one 1980 × 760 mm hollow-core prehung internal door to the ensuite.",
      assert: (rows) =>
        rows.length === 2 &&
        rows[0]?.width_mm === 810 &&
        rows[0]?.quantity === 2 &&
        rows[1]?.width_mm === 760 &&
        rows[1]?.quantity === 1 &&
        rows[0]?.installation_type === "prehung_internal" &&
        rows[1]?.installation_type === "prehung_internal",
    },
    {
      name: "I7 two replacement-leaf sets different locations",
      brief:
        "Replace one 2200 × 910 mm solid-core internal door leaf to the ensuite using the existing frame. Also replace one 1980 × 810 mm hollow-core internal door leaf to the bedrooms using the existing frame.",
      assert: (rows) =>
        rows.length === 2 &&
        rows[0]?.label === "Ensuite" &&
        rows[0]?.installation_type === "replacement_leaf" &&
        rows[1]?.label === "Bedrooms" &&
        rows[1]?.installation_type === "replacement_leaf",
    },
    {
      name: "I8 identical products different locations",
      brief:
        "Supply and install one 1980 × 810 mm hollow-core prehung internal door to the bedrooms. Also supply and install one 1980 × 810 mm hollow-core prehung internal door to the ensuite.",
      assert: (rows) =>
        rows.length === 2 &&
        rows[0]?.label === "Bedrooms" &&
        rows[1]?.label === "Ensuite" &&
        rows[0]?.id !== rows[1]?.id &&
        rows[0]?.width_mm === 810 &&
        rows[1]?.width_mm === 810,
    },
    {
      name: "I9 two explicitly separate identical sets",
      brief:
        "Supply and install one 1980 × 810 mm hollow-core prehung internal door. Also supply and install one 1980 × 810 mm hollow-core prehung internal door.",
      assert: (rows) =>
        rows.length === 2 &&
        rows[0]?.id !== rows[1]?.id &&
        rows[0]?.width_mm === 810 &&
        rows[1]?.width_mm === 810 &&
        rows[0]?.clause_ordinal === 0 &&
        rows[1]?.clause_ordinal === 1,
    },
    {
      name: "I10 jamb and stops stays one set",
      brief:
        "Supply and install one 1980 × 810 mm hollow-core prehung internal door including jamb and stops.",
      assert: (rows) =>
        rows.length === 1 && rows[0]?.installation_type === "prehung_internal",
    },
    {
      name: "I11 supply and install stays one set",
      brief:
        "Supply and install one 1980 × 810 mm hollow-core prehung internal door.",
      assert: (rows) =>
        rows.length === 1 && rows[0]?.installation_type === "prehung_internal",
    },
    {
      name: "I12 frame and hardware stays one set",
      brief:
        "Replace one 2200 × 910 mm solid-core internal door leaf using the existing frame and hardware.",
      assert: (rows) =>
        rows.length === 1 && rows[0]?.installation_type === "replacement_leaf",
    },
    {
      name: "I13 custom ordinary leaf plus standard prehung",
      brief:
        "Fit one custom conventional hinged internal leaf into the existing frame. Also supply and install one 1980 × 810 mm hollow-core prehung internal door.",
      assert: (rows) =>
        rows.length === 2 &&
        rows[0]?.leaf_construction === "other" &&
        rows[0]?.installation_type === "replacement_leaf" &&
        rows[1]?.installation_type === "prehung_internal",
    },
    {
      name: "I14 specialist plus supported ordinary",
      brief:
        "Supply and install one fire-rated door. Also supply and install one 1980 × 810 mm hollow-core prehung internal door.",
      assert: (rows) =>
        rows.length === 2 &&
        rows[0]?.installation_type === "other_unsupported" &&
        rows[1]?.installation_type === "prehung_internal",
    },
  ];

for (const row of matrix) {
  const facts = hostedFacts(row.brief);
  check(row.name, row.assert(portions(facts)), `count=${portions(facts).length}`);
}

check(
  "I15 opening-only Internal Walls brief",
  !openingOnly.workAreas.some((row) => row.type === "doors")
);
check("I16 combined IW opening plus two Door Sets", expectTwoQa(portions(combinedDoors)));
check("I17 re-analysis of the exact brief", rePortions.length === 2 && expectTwoQa(rePortions));
check(
  "I18 user edits portion 1 then re-analysis",
  userP1Rows.find((row) => row.quantity === 5)?.quantity_authority === "user"
);
check(
  "I19 user edits portion 2 then re-analysis",
  userP2Rows.find((row) => row.id === ensuiteId)?.width_authority === "user"
);
check("I20 user deletes a portion then re-analysis", portions(afterDelete).length === 1);

check(
  "REPLACEMENT fixture with Fit-after-period stays one set",
  extractDoorPortionsFromBrief(
    "Replace the damaged leaf. Fit one 2200 × 910 solid-core replacement leaf into the existing frame using the existing hardware."
  ).length === 1
);

check(
  "clause segmentation is local (Also / plus / semicolon / replace)",
  read("lib/estimate/doors-brief.ts").includes("splitDoorSetSnippets") &&
    read("lib/estimate/doors-brief.ts").includes("supply and install") &&
    read("lib/estimate/doors-brief.ts").includes("\\bbedrooms?\\b")
);

check(
  "Work adapter no longer emits a count-only chip",
  !read("lib/assistant/job-plan/adapters/doors.ts").includes('value: String(summaries.length)')
);

if (failed > 0) {
  console.log(`\nFAILED ${failed}  passed ${passed}`);
  process.exit(1);
}
console.log(`\nOK  ${passed} checks`);
