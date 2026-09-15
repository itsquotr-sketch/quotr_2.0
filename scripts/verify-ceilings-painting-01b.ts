/**
 * CEILINGS-PAINTING-01B — Ceiling painting materials + labour authority.
 *
 * Hosted ordinary lounge + bulkhead fixture:
 * 12 m² main + 4 m² bulkhead lining = 16 m² painting.
 *
 * Run: npx --yes tsx scripts/verify-ceilings-painting-01b.ts
 */
import type { EstimateLineItem } from "../components/assistant/types";
import type { OrganisationRate, OrganisationSettings } from "../components/setup/types";
import { composeBuilderReview } from "../lib/assistant/builder-review/compose";
import { calculateEstimate } from "../lib/estimate/calculate-estimate";
import {
  extractCeilingPortionsFromBrief,
  mergeCeilingPortionsPreferringExplicitAi,
} from "../lib/estimate/ceilings-brief";
import { ceilingCommercialOwnsFinishMoney } from "../lib/estimate/ceilings-commercial";
import {
  CEILINGS_PAINTING_COMPONENT,
  CEILINGS_PAINTING_LABOUR,
  CEILINGS_PAINTING_MATERIAL_KEY,
  CEILINGS_PAINTING_MATERIAL_LEGACY_ALIAS,
  CEILINGS_STOPPING_COMPONENT,
  CEILINGS_STOPPING_MATERIAL_KEY,
  PAINTING_LABOUR_HOURS_PER_M2,
  PAINTING_LABOUR_HOURS_PER_M2_KEY,
} from "../lib/estimate/ceilings-identities";
import {
  applyCeilingsFactWrite,
  CEILINGS_PORTIONS_FACT_KEY,
  resolveCeilingsPortions,
  type CeilingPortion,
} from "../lib/estimate/ceilings-portions";
import { nestedCeilingsQuoteIsBlocked } from "../lib/estimate/ceilings-quote-readiness";
import { getQuotrProductivityBenchmark } from "../lib/estimate/productivity";
import { getCatalogueEntry } from "../lib/rates/catalogue";
import type {
  EstimateContext,
  EstimateFact,
  EstimateLineItemInput,
} from "../lib/estimate/types";
import type {
  LabourRequirement,
  MaterialRequirement,
} from "../lib/estimate/requirements";
import type { MaterialWastageSettings } from "../lib/settings/material-wastage";
import { buildWorkAreaDescriptionsMap } from "../lib/work-areas/quote-description";
import { calculatePainting } from "../lib/estimate/calculators/fitout";

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

function near(
  actual: number | null | undefined,
  expected: number,
  tol = 0.02
): boolean {
  return (
    actual != null &&
    Number.isFinite(actual) &&
    Math.abs(actual - expected) <= tol
  );
}

const HUMAN_QA_BRIEF =
  "Line the existing ceiling in a 4m x 3m lounge with 13mm Standard GIB and thermal insulation. Include a 4m long, 500mm deep and 500mm high timber bulkhead.";

const WASTAGE: MaterialWastageSettings = {
  defaultMaterialWastagePercent: 10,
  sheetMaterialWastagePercent: 10,
  timberFramingWastagePercent: 10,
};

const SETTINGS: OrganisationSettings = {
  id: "s1",
  org_id: "o1",
  default_margin_percent: 10,
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

function write(
  facts: EstimateFact[],
  key: string,
  value: unknown,
  nestedItemId?: string,
  componentId?: string
): EstimateFact[] {
  return applyCeilingsFactWrite({
    facts,
    workAreaId: "c1",
    key,
    value,
    nestedItemId,
    componentId,
  });
}

function writePortions(portions: CeilingPortion[]): EstimateFact[] {
  return applyCeilingsFactWrite({
    facts: [],
    workAreaId: "c1",
    key: CEILINGS_PORTIONS_FACT_KEY,
    value: portions,
  });
}

function material(
  requirements: readonly { kind: string; componentKey: string }[],
  key: string
): MaterialRequirement | undefined {
  return requirements.find(
    (row): row is MaterialRequirement =>
      row.kind === "material" && row.componentKey === key
  );
}

function labour(
  requirements: readonly { kind: string; componentKey: string }[],
  key: string
): LabourRequirement | undefined {
  return requirements.find(
    (row): row is LabourRequirement =>
      row.kind === "labour" && row.componentKey === key
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
    itemKey: item.itemKey,
    componentKey: item.componentKey,
    componentId: item.componentId,
    nestedItemId: item.nestedItemId,
    contributingNestedItemIds: item.contributingNestedItemIds,
    notes: item.notes,
    includedInTotal: item.includedInTotal,
  }));
}

function orgRate(
  itemKey: string,
  unit: string,
  cost: number,
  extras?: Partial<OrganisationRate>
): OrganisationRate {
  return {
    id: `rate-${itemKey}-${unit}-${cost}`,
    rate_type: "material",
    trade: null,
    work_area_type: "painting",
    item_key: itemKey,
    label: itemKey,
    unit,
    cost_rate: cost,
    sell_rate: null,
    markup_percent: null,
    active: true,
    ...extras,
  };
}

function estimateCtx(
  facts: EstimateFact[],
  rates: OrganisationRate[] = [],
  settings: OrganisationSettings = SETTINGS
): EstimateContext {
  return {
    project: { id: "ceilings-painting-01b", qualityLevel: "standard" },
    confirmedWorkAreas: [{ id: "c1", type: "ceilings", name: "Ceilings", sort_order: 1 }],
    facts,
    constraints: [],
    organisationSettings: settings,
    materialWastageSettings: WASTAGE,
    rates,
  } as unknown as EstimateContext;
}

function quoteDraft(facts: EstimateFact[]): string {
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

function paintingCost(result: ReturnType<typeof calculateEstimate>): number {
  const paintMat = material(result.requirements ?? [], CEILINGS_PAINTING_COMPONENT);
  const paintLab = labour(result.requirements ?? [], CEILINGS_PAINTING_LABOUR);
  return (paintMat?.totalCost ?? 0) + (paintLab?.totalCost ?? 0);
}

function siblingCostExcludingPainting(
  result: ReturnType<typeof calculateEstimate>
): number {
  return (result.requirements ?? [])
    .filter(
      (row) =>
        row.priced &&
        row.totalCost != null &&
        row.componentKey !== CEILINGS_PAINTING_COMPONENT &&
        row.componentKey !== CEILINGS_PAINTING_LABOUR
    )
    .reduce((sum, row) => sum + (row.totalCost ?? 0), 0);
}

console.log("=== CEILINGS-PAINTING-01B ===\n");

check(
  "canonical painting.material.m2 catalogue is $18 materials-only",
  getCatalogueEntry(CEILINGS_PAINTING_MATERIAL_KEY)?.defaultCostRate === 18 &&
    /materials only|not complete supply-and-apply/i.test(
      getCatalogueEntry(CEILINGS_PAINTING_MATERIAL_KEY)?.description ?? ""
    )
);
check(
  "legacy ceilings.painting.m2 aliases to painting.material.m2",
  getCatalogueEntry(CEILINGS_PAINTING_MATERIAL_LEGACY_ALIAS)?.item_key ===
    CEILINGS_PAINTING_MATERIAL_KEY
);
check(
  "painting.labour_hours_per_m2 registered at 0.12",
  getQuotrProductivityBenchmark(PAINTING_LABOUR_HOURS_PER_M2_KEY)
    ?.hoursPerUnit === PAINTING_LABOUR_HOURS_PER_M2 &&
    getCatalogueEntry(PAINTING_LABOUR_HOURS_PER_M2_KEY)?.defaultCostRate ===
      PAINTING_LABOUR_HOURS_PER_M2
);

const parsed = extractCeilingPortionsFromBrief(HUMAN_QA_BRIEF);
const merged = mergeCeilingPortionsPreferringExplicitAi(parsed, parsed);
let factsIncluded = writePortions(merged);
const portionId = merged[0]!.id;
factsIncluded = write(
  factsIncluded,
  "ceilings.portion.stopping_included",
  "Included",
  portionId
);
factsIncluded = write(
  factsIncluded,
  "ceilings.portion.painting_included",
  "Included",
  portionId
);
factsIncluded = write(
  factsIncluded,
  "ceilings.portion.insulation_type",
  "thermal",
  portionId
);

let factsExcluded = writePortions(merged);
factsExcluded = write(
  factsExcluded,
  "ceilings.portion.stopping_included",
  "Included",
  portionId
);
factsExcluded = write(
  factsExcluded,
  "ceilings.portion.painting_included",
  "Excluded",
  portionId
);
factsExcluded = write(
  factsExcluded,
  "ceilings.portion.insulation_type",
  "thermal",
  portionId
);

const excluded = calculateEstimate(estimateCtx(factsExcluded));
check(
  "A. painting excluded → no material, labour, or quote paint scope",
  material(excluded.requirements ?? [], CEILINGS_PAINTING_COMPONENT) == null &&
    labour(excluded.requirements ?? [], CEILINGS_PAINTING_LABOUR) == null &&
    !excluded.lineItems.some(
      (item) =>
        item.componentKey === CEILINGS_PAINTING_COMPONENT ||
        item.componentKey === CEILINGS_PAINTING_LABOUR
    ) &&
    !/ceiling painting is included/i.test(quoteDraft(factsExcluded))
);

const included = calculateEstimate(estimateCtx(factsIncluded));
const paintMat = material(included.requirements ?? [], CEILINGS_PAINTING_COMPONENT);
const paintLab = labour(included.requirements ?? [], CEILINGS_PAINTING_LABOUR);
const stopping = material(included.requirements ?? [], CEILINGS_STOPPING_COMPONENT);
const prePaint = siblingCostExcludingPainting(included);
const paintTotal = paintingCost(included);

check(
  "B. painting included → 16m² material $288",
  paintMat != null &&
    paintMat.materialKey === CEILINGS_PAINTING_MATERIAL_KEY &&
    near(paintMat.baseQuantity, 16) &&
    near(paintMat.unitCost, 18) &&
    near(paintMat.totalCost, 288) &&
    paintMat.priced === true &&
    paintMat.rateSource === "benchmark"
);
check(
  "B. painting labour → 1.92 h × $60 = $115.20",
  paintLab != null &&
    paintLab.productivityBasis.key === PAINTING_LABOUR_HOURS_PER_M2_KEY &&
    near(paintLab.productivityBasis.quantity, 16) &&
    near(paintLab.productivityBasis.hoursPerUnit, 0.12) &&
    near(paintLab.adjustedHours, 1.92) &&
    near(paintLab.hourlyCost, 60) &&
    near(paintLab.totalCost, 115.2) &&
    paintLab.priced === true
);
check(
  "B. painting total $403.20 and no Pricing Required for painting",
  near(paintTotal, 403.2) &&
    paintMat?.priced === true &&
    paintLab?.priced === true &&
    !included.missingInfo.some((row) =>
      /pricing required:.*painting/i.test(row)
    )
);
const excludedBaseline = calculateEstimate(estimateCtx(factsExcluded));
const prePaintFromExcluded = excludedBaseline.recommendedCost;
check(
  "H. sibling stability — excluded baseline unchanged by painting money",
  near(prePaint, prePaintFromExcluded) &&
    near(included.recommendedCost, prePaintFromExcluded + 403.2) &&
    near(prePaint + paintTotal, included.recommendedCost)
);
check(
  "H. accepted painting add-on is exactly $403.20 (16×$18 + 1.92×$60)",
  near(paintTotal, 403.2) &&
    near(included.recommendedCost - prePaintFromExcluded, 403.2)
);
check(
  "H. stopping remains 16m² × $28",
  stopping != null &&
    stopping.materialKey === CEILINGS_STOPPING_MATERIAL_KEY &&
    near(stopping.baseQuantity, 16) &&
    near(stopping.unitCost, 28) &&
    near(stopping.totalCost, 448)
);
check(
  "H. sell is cost-first GM (~10%), not a leaked benchmark sell",
  included.recommendedSell > included.recommendedCost &&
    near(included.recommendedSell / included.recommendedCost, 1 / 0.9, 0.01)
);

const materialOverride = calculateEstimate(
  estimateCtx(factsIncluded, [
    orgRate(CEILINGS_PAINTING_MATERIAL_KEY, "m2", 22),
  ])
);
const matOverrideRow = material(
  materialOverride.requirements ?? [],
  CEILINGS_PAINTING_COMPONENT
);
check(
  "C. company material override beats $18",
  near(matOverrideRow?.unitCost, 22) &&
    near(matOverrideRow?.totalCost, 352) &&
    matOverrideRow?.rateSource === "company"
);

const legacyAliasOverride = calculateEstimate(
  estimateCtx(factsIncluded, [
    orgRate(CEILINGS_PAINTING_MATERIAL_LEGACY_ALIAS, "m2", 25),
  ])
);
check(
  "C. legacy ceilings.painting.m2 company rate aliases to canonical",
  near(
    material(legacyAliasOverride.requirements ?? [], CEILINGS_PAINTING_COMPONENT)
      ?.unitCost,
    25
  ) &&
    near(
      material(legacyAliasOverride.requirements ?? [], CEILINGS_PAINTING_COMPONENT)
        ?.totalCost,
      400
    )
);

const productivityOverride = calculateEstimate(
  estimateCtx(factsIncluded, [
    orgRate(PAINTING_LABOUR_HOURS_PER_M2_KEY, "m2", 0.2, {
      rate_type: "productivity",
      work_area_type: "painting",
    }),
  ])
);
const prodLab = labour(
  productivityOverride.requirements ?? [],
  CEILINGS_PAINTING_LABOUR
);
const prodMat = material(
  productivityOverride.requirements ?? [],
  CEILINGS_PAINTING_COMPONENT
);
check(
  "D. company productivity override changes hours, not material qty",
  near(prodMat?.baseQuantity, 16) &&
    near(prodMat?.totalCost, 288) &&
    near(prodLab?.productivityBasis.hoursPerUnit, 0.2) &&
    near(prodLab?.adjustedHours, 3.2) &&
    near(prodLab?.totalCost, 192) &&
    prodLab?.rateProvenance === "company"
);

const labourOverride = calculateEstimate(
  estimateCtx(factsIncluded, [
    orgRate("labour.carpenter.hour", "hour", 75, {
      rate_type: "labour",
      work_area_type: null,
      trade: "carpenter",
    }),
  ])
);
const labourLab = labour(
  labourOverride.requirements ?? [],
  CEILINGS_PAINTING_LABOUR
);
check(
  "E. company labour COST override changes labour cost, not hours",
  near(labourLab?.adjustedHours, 1.92) &&
    near(labourLab?.hourlyCost, 75) &&
    near(labourLab?.totalCost, 144)
);

const restored = calculateEstimate(estimateCtx(factsIncluded, []));
check(
  "overrides removed restore Quotr benchmarks",
  near(
    material(restored.requirements ?? [], CEILINGS_PAINTING_COMPONENT)?.unitCost,
    18
  ) &&
    near(
      labour(restored.requirements ?? [], CEILINGS_PAINTING_LABOUR)?.adjustedHours,
      1.92
    ) &&
    near(
      labour(restored.requirements ?? [], CEILINGS_PAINTING_LABOUR)?.hourlyCost,
      60
    )
);

const noBenchmarkSettings: OrganisationSettings = {
  ...SETTINGS,
  allow_benchmark_rates: false,
};
const missingAuth = calculateEstimate(
  estimateCtx(factsIncluded, [], noBenchmarkSettings)
);
const missingMat = material(
  missingAuth.requirements ?? [],
  CEILINGS_PAINTING_COMPONENT
);
check(
  "F. missing material authority → Pricing Required, never false $0",
  missingMat?.priced === false &&
    missingMat.unitCost == null &&
    missingMat.totalCost == null &&
    missingMat.rateSource === "missing" &&
    missingAuth.lineItems.some(
      (item) =>
        item.componentKey === CEILINGS_PAINTING_COMPONENT &&
        /pricing required/i.test(item.notes ?? "")
    ) &&
    (missingAuth.requirements ?? [])
      .filter((row) => row.priced === false)
      .every((row) => row.unitCost == null && row.totalCost == null)
);

check(
  "G. no duplication — one material, one labour, one quote paint scope",
  (included.requirements ?? []).filter(
    (row) => row.componentKey === CEILINGS_PAINTING_COMPONENT
  ).length === 1 &&
    (included.requirements ?? []).filter(
      (row) => row.componentKey === CEILINGS_PAINTING_LABOUR
    ).length === 1 &&
    included.lineItems.filter(
      (item) => item.componentKey === CEILINGS_PAINTING_COMPONENT
    ).length === 1 &&
    included.lineItems.filter(
      (item) => item.componentKey === CEILINGS_PAINTING_LABOUR
    ).length === 1 &&
    !included.lineItems.some((item) => ceilingCommercialOwnsFinishMoney(item)) &&
    (quoteDraft(factsIncluded).match(/ceiling painting is included/gi) ?? [])
      .length === 1
);

const draft = quoteDraft(factsIncluded);
check(
  "Quote includes painting scope without internal rates/productivity",
  /ceiling painting is included/i.test(draft) &&
    !/\$18|\$288|0\.12|painting\.material|labour_hours|benchmark/i.test(draft)
);

const review = composeBuilderReview({
  estimate: {
    recommendedCost: included.recommendedCost,
    recommendedSell: included.recommendedSell,
    marginPercent: included.marginPercent,
    confidence: included.confidence,
    assumptions: included.assumptions,
    missingInfo: included.missingInfo,
    lineItems: mapReviewLines(included.lineItems),
  },
  workAreas: [
    { id: "c1", type: "ceilings", name: "Ceilings", status: "confirmed" },
  ],
  requirements: included.requirements ?? [],
  facts: factsIncluded,
});
const finishing =
  review.workAreas[0]?.portionGroups?.[0]?.lineGroups?.find(
    (row) => row.secondary === "Finishing"
  ) ?? null;
const paintChildren =
  finishing?.children.filter((row) => /paint/i.test(row.label)) ?? [];
const unresolvedPaint = paintChildren.filter(
  (row) =>
    row.pricingRequired ||
    row.rateLabel === "Pricing Required" ||
    /pricing required/i.test(row.supporting ?? "")
);
check(
  "Builder Review Finishing shows painting materials and labour",
  finishing != null &&
    paintChildren.some((row) => /materials/i.test(row.label)) &&
    paintChildren.some(
      (row) => /labour/i.test(row.label) || (row.labourHours ?? 0) > 0
    ) &&
    paintChildren.some((row) => near(row.quantity, 16) || /16/.test(row.supporting ?? "")) &&
    paintChildren.some(
      (row) =>
        near(row.labourHours, 1.92) || /1\.92/.test(row.supporting ?? "")
    )
);
check(
  "unresolved painting warning gone when authorities resolve",
  unresolvedPaint.length === 0 &&
    finishing?.pricingRequired !== true &&
    nestedCeilingsQuoteIsBlocked({
      missingInfo: included.missingInfo,
      items: included.lineItems.map((item) => ({
        componentKey: item.componentKey,
        itemKey: item.itemKey,
        notes: item.notes,
        label: item.label,
        total_cost: item.recommendedCost,
        total_sell: item.recommendedSell,
        unit_cost: item.costRate ?? null,
        rateSourceType: item.rateSourceType,
      })),
    }) === false
);

const paintingWa = calculatePainting(
  {
    project: { id: "paint-wa", qualityLevel: "standard" },
    confirmedWorkAreas: [
      { id: "p1", type: "painting", name: "Painting", sort_order: 1 },
    ],
    facts: [
      {
        id: "f1",
        work_area_id: "p1",
        key: "painting.location",
        value: "Internal",
        source: "user",
      },
      {
        id: "f2",
        work_area_id: "p1",
        key: "painting.surfaces",
        value: ["Walls", "Ceilings"],
        source: "user",
      },
      {
        id: "f3",
        work_area_id: "p1",
        key: "painting.internal_area_m2",
        value: 16,
        source: "user",
      },
    ],
    constraints: [],
    organisationSettings: SETTINGS,
    materialWastageSettings: WASTAGE,
    rates: [],
  } as unknown as EstimateContext,
  { id: "p1", type: "painting", name: "Painting", sort_order: 1 }
);
const paintWaLabour = paintingWa.lineItems.find((row) =>
  /painting labour/i.test(row.label)
);
check(
  "Painting WA resolves productivity from catalogue (not hardcoded fallback)",
  paintWaLabour != null &&
    near(paintWaLabour.productivityRate, 0.12) &&
    near(paintWaLabour.labourHours ?? 0, 16 * 0.12) &&
    paintWaLabour.itemKey === PAINTING_LABOUR_HOURS_PER_M2_KEY
);

const portion = resolveCeilingsPortions({
  facts: factsIncluded,
  workAreaId: "c1",
}).portions[0]!;
check(
  "quantity continuity 12 + 4 = 16",
  near(portion.geometry.area_m2, 12) &&
    near(paintMat?.baseQuantity, 16) &&
    near(stopping?.baseQuantity, 16)
);

console.log(
  failed === 0
    ? `\nCEILINGS-PAINTING-01B PASSED ${passed}/${passed}`
    : `\nCEILINGS-PAINTING-01B FAILED ${failed}/${passed + failed}`
);
process.exit(failed === 0 ? 0 : 1);
