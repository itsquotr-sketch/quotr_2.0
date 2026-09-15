/**
 * CEILINGS WA-08-R6 — exact ordinary Ceiling human-QA repair.
 *
 * Brief + Details (Plastering Included, Painting Included) must keep an
 * ordinary timber bulkhead, mixed-unit 4 × 0.5 × 0.5 m, 4 m² lining, and
 * visible plastering/painting. Preview only.
 *
 * Run: npx --yes tsx scripts/verify-ceilings-wa-08-r6-human-qa.ts
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { EstimateLineItem } from "../components/assistant/types";
import type { OrganisationSettings } from "../components/setup/types";
import { composeBuilderReview } from "../lib/assistant/builder-review/compose";
import { composeJobPlan } from "../lib/assistant/job-plan/compose";
import { composeRefineView } from "../lib/assistant/refine/compose";
import { calculateEstimate } from "../lib/estimate/calculate-estimate";
import {
  extractCeilingPortionsFromBrief,
  mergeCeilingPortionsPreferringExplicitAi,
} from "../lib/estimate/ceilings-brief";
import {
  calculateCeilingBulkhead,
  CEILINGS_BULKHEAD_FRAMING_TIMBER_COMPONENT,
  CEILINGS_BULKHEAD_LINING_COMPONENT,
} from "../lib/estimate/ceilings-bulkheads";
import { ceilingCommercialOwnsFinishMoney } from "../lib/estimate/ceilings-commercial";
import {
  CEILINGS_FIXINGS_BULKHEAD_FRAMING_COMPONENT,
  CEILINGS_FIXINGS_BULKHEAD_LINING_COMPONENT,
} from "../lib/estimate/ceilings-fixings";
import {
  CEILINGS_BULKHEAD_FRAMING_TIMBER_LABOUR,
  CEILINGS_BULKHEAD_LINING_LABOUR,
  CEILINGS_PAINTING_COMPONENT,
  CEILINGS_PAINTING_MATERIAL_KEY,
  CEILINGS_STOPPING_COMPONENT,
  CEILINGS_STOPPING_MATERIAL_KEY,
} from "../lib/estimate/ceilings-identities";
import { CEILINGS_PLASTERBOARD_COMPONENT } from "../lib/estimate/ceilings-lining";
import {
  applyCeilingBulkheadTopologyState,
  applyCeilingsFactWrite,
  CEILINGS_BULKHEAD_TOPOLOGY_V1,
  CEILINGS_PORTIONS_FACT_KEY,
  isUnsupportedCeilingBulkhead,
  parseCeilingsPortions,
  resolveCeilingsPortions,
  type CeilingBulkhead,
  type CeilingPortion,
} from "../lib/estimate/ceilings-portions";
import { nestedCeilingsQuoteIsBlocked } from "../lib/estimate/ceilings-quote-readiness";
import type {
  EstimateContext,
  EstimateFact,
  EstimateLineItemInput,
} from "../lib/estimate/types";
import type { MaterialRequirement } from "../lib/estimate/requirements";
import type { MaterialWastageSettings } from "../lib/settings/material-wastage";
import { buildWorkAreaDescriptionsMap } from "../lib/work-areas/quote-description";

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

function near(actual: number | null | undefined, expected: number, tol = 0.02): boolean {
  return actual != null && Number.isFinite(actual) && Math.abs(actual - expected) <= tol;
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

function estimateCtx(facts: EstimateFact[]): EstimateContext {
  return {
    project: { id: "ceilings-wa-08-r6", qualityLevel: "standard" },
    confirmedWorkAreas: [{ id: "c1", type: "ceilings", name: "Ceilings", sort_order: 1 }],
    facts,
    constraints: [],
    organisationSettings: SETTINGS,
    materialWastageSettings: WASTAGE,
    rates: [],
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

function bulkheadFromPhrase(phrase: string): CeilingBulkhead | undefined {
  return extractCeilingPortionsFromBrief(phrase).flatMap((row) => row.bulkheads)[0];
}

function dimsOf(phrase: string): {
  length_m: number | null;
  depth_m: number | null;
  height_m: number | null;
} {
  const bh = bulkheadFromPhrase(phrase);
  return {
    length_m: bh?.length_m ?? null,
    depth_m: bh?.depth_m ?? null,
    height_m: bh?.height_m ?? null,
  };
}

console.log("=== CEILINGS WA-08-R6 exact human-QA ===\n");

const parsed = extractCeilingPortionsFromBrief(HUMAN_QA_BRIEF);
const parsedPortion = parsed[0]!;
const parsedBh = parsedPortion.bulkheads[0]!;

check(
  "parser extracts one lounge portion with one bulkhead",
  parsed.length === 1 && parsedPortion.bulkheads.length === 1
);
check(
  "ordinary timber bulkhead topology",
  parsedBh.form === CEILINGS_BULKHEAD_TOPOLOGY_V1 &&
    parsedBh.topology === CEILINGS_BULKHEAD_TOPOLOGY_V1 &&
    parsedBh.topology_source === "assumed_disclosed" &&
    !isUnsupportedCeilingBulkhead(parsedBh) &&
    parsedBh.framing_type === "timber"
);
check(
  "labelled mixed-unit bulkhead dims 4 / 0.5 / 0.5",
  near(parsedBh.length_m, 4) &&
    near(parsedBh.depth_m, 0.5) &&
    near(parsedBh.height_m, 0.5) &&
    parsedBh.height_m !== 4
);

const ai = JSON.parse(JSON.stringify(parsedPortion)) as CeilingPortion;
ai.bulkheads[0]!.form = "complex";
applyCeilingBulkheadTopologyState(ai.bulkheads[0]!, { explicit: true });
ai.bulkheads[0]!.length_m = 4;
ai.bulkheads[0]!.depth_m = 0.5;
ai.bulkheads[0]!.height_m = 4;
const merged = mergeCeilingPortionsPreferringExplicitAi([ai], parsed);
const mergedBh = merged[0]!.bulkheads[0]!;
check(
  "parser ordinary repairs leftover-token AI specialist and 4m height",
  !isUnsupportedCeilingBulkhead(mergedBh) &&
    mergedBh.form === CEILINGS_BULKHEAD_TOPOLOGY_V1 &&
    mergedBh.topology_source === "assumed_disclosed" &&
    near(mergedBh.length_m, 4) &&
    near(mergedBh.depth_m, 0.5) &&
    near(mergedBh.height_m, 0.5)
);

const specialistKeep = mergeCeilingPortionsPreferringExplicitAi(
  extractCeilingPortionsFromBrief("Lounge 5m x 4m with a timber floating bulkhead"),
  extractCeilingPortionsFromBrief("Lounge 5m x 4m with a timber floating bulkhead")
);
check(
  "specialist topology still wins with material words",
  isUnsupportedCeilingBulkhead(specialistKeep[0]!.bulkheads[0]!) &&
    specialistKeep[0]!.bulkheads[0]!.form === "complex"
);

const dimVariants: readonly { phrase: string; label: string }[] = [
  { phrase: "Include a 4m long, 500mm deep and 500mm high timber bulkhead", label: "4m long, 500mm deep and 500mm high" },
  { phrase: "Include a 4000mm long, 500mm deep and 500mm high timber bulkhead", label: "4000mm long, 500mm deep and 500mm high" },
  { phrase: "Include a 4m long, 0.5m deep and 0.5m high timber bulkhead", label: "4m long, 0.5m deep and 0.5m high" },
  { phrase: "Include a 4m × 500mm × 500mm bulkhead", label: "4m × 500mm × 500mm bulkhead" },
  { phrase: "Include a 4m long, 500mm projection and 500mm drop timber bulkhead", label: "4m long, 500mm projection and 500mm drop" },
  { phrase: "Include a 4m long, 500mm wide and 500mm high timber bulkhead", label: "4m long, 500mm wide and 500mm high" },
];
for (const row of dimVariants) {
  const dims = dimsOf(row.phrase);
  check(
    `mixed-unit ${row.label}`,
    near(dims.length_m, 4) && near(dims.depth_m, 0.5) && near(dims.height_m, 0.5),
    JSON.stringify(dims)
  );
}

let facts = writePortions(merged);
const portionId = merged[0]!.id;
facts = write(facts, "ceilings.portion.stopping_included", "Included", portionId);
facts = write(facts, "ceilings.portion.painting_included", "Included", portionId);
const afterDetails = resolveCeilingsPortions({ facts, workAreaId: "c1" }).portions[0]!;
check(
  "Details Included persists stopping and painting",
  afterDetails.finish.stopping_included === true &&
    afterDetails.finish.painting_included === true
);

facts = write(facts, "ceilings.portion.insulation_type", "thermal", portionId);
const afterBackNav = resolveCeilingsPortions({ facts, workAreaId: "c1" }).portions[0]!;
check(
  "back-navigation does not clobber included finishes",
  afterBackNav.finish.stopping_included === true &&
    afterBackNav.finish.painting_included === true &&
    afterBackNav.finish.insulation_type === "thermal" &&
    near(afterBackNav.bulkheads[0]?.height_m, 0.5)
);

const rawEnvelope = facts.find((row) => row.key === CEILINGS_PORTIONS_FACT_KEY)?.value;
const parsedEnvelope =
  typeof rawEnvelope === "string" ? JSON.parse(rawEnvelope) : rawEnvelope;
const reparsed = parseCeilingsPortions(parsedEnvelope);
check(
  "refresh persistence keeps finishes, dims and ordinary topology",
  reparsed[0]?.finish.stopping_included === true &&
    reparsed[0]?.finish.painting_included === true &&
    reparsed[0]?.bulkheads[0]?.form === CEILINGS_BULKHEAD_TOPOLOGY_V1 &&
    near(reparsed[0]?.bulkheads[0]?.length_m, 4) &&
    near(reparsed[0]?.bulkheads[0]?.depth_m, 0.5) &&
    near(reparsed[0]?.bulkheads[0]?.height_m, 0.5)
);

const takeoff = calculateCeilingBulkhead({
  portion: afterBackNav,
  bulkhead: afterBackNav.bulkheads[0]!,
  materialWastageSettings: WASTAGE,
});
check(
  "ordinary two-face lining 4m² before waste",
  takeoff.status !== "unsupported_specialist" &&
    near(takeoff.lengthM, 4) &&
    near(takeoff.depthM, 0.5) &&
    near(takeoff.heightM, 0.5) &&
    near(takeoff.undersideAreaM2, 2) &&
    near(takeoff.verticalFaceAreaM2, 2) &&
    near(takeoff.liningAreaM2, 4)
);

const hosted = calculateEstimate(estimateCtx(facts));
const stopping = material(hosted.requirements ?? [], CEILINGS_STOPPING_COMPONENT);
const painting = material(hosted.requirements ?? [], CEILINGS_PAINTING_COMPONENT);
const mainLining = material(hosted.requirements ?? [], CEILINGS_PLASTERBOARD_COMPONENT);
const bhFrame = material(hosted.requirements ?? [], CEILINGS_BULKHEAD_FRAMING_TIMBER_COMPONENT);
const bhLining = material(hosted.requirements ?? [], CEILINGS_BULKHEAD_LINING_COMPONENT);
const bhFrameFix = material(hosted.requirements ?? [], CEILINGS_FIXINGS_BULKHEAD_FRAMING_COMPONENT);
const bhLiningFix = material(hosted.requirements ?? [], CEILINGS_FIXINGS_BULKHEAD_LINING_COMPONENT);

check(
  "ordinary bulkhead framing/lining/fixings/labour emitted",
  bhFrame != null &&
    bhLining != null &&
    bhFrameFix != null &&
    bhLiningFix != null &&
    (hosted.requirements ?? []).some(
      (row) => row.componentKey === CEILINGS_BULKHEAD_FRAMING_TIMBER_LABOUR
    ) &&
    (hosted.requirements ?? []).some(
      (row) => row.componentKey === CEILINGS_BULKHEAD_LINING_LABOUR
    )
);
check(
  "bulkhead lining installed 4m²",
  near(takeoff.liningAreaM2, 4) &&
    bhLining != null &&
    (bhLining.baseQuantity ?? 0) > 0
);
check(
  "plastering requirement emitted and persists",
  stopping != null &&
    stopping.materialKey === CEILINGS_STOPPING_MATERIAL_KEY &&
    near(stopping.baseQuantity, 16) &&
    stopping.baseUnit === "m2"
);
check(
  "painting requirement emitted and persists",
  painting != null &&
    painting.materialKey === CEILINGS_PAINTING_MATERIAL_KEY &&
    near(painting.baseQuantity, 16) &&
    painting.baseUnit === "m2"
);
check(
  "finish quantity is main lining + bulkhead lining",
  near(stopping?.baseQuantity, 16) &&
    near(painting?.baseQuantity, 16) &&
    near(takeoff.liningAreaM2, 4) &&
    near(afterBackNav.geometry.area_m2, 12)
);
check(
  "no duplicated finish or bulkhead lines",
  (hosted.requirements ?? []).filter((row) => row.componentKey === CEILINGS_STOPPING_COMPONENT)
    .length === 1 &&
    (hosted.requirements ?? []).filter((row) => row.componentKey === CEILINGS_PAINTING_COMPONENT)
      .length === 1 &&
    (hosted.requirements ?? []).filter(
      (row) => row.componentKey === CEILINGS_BULKHEAD_LINING_COMPONENT
    ).length === 1 &&
    !hosted.lineItems.some((item) => ceilingCommercialOwnsFinishMoney(item))
);

const stoppingPriced = stopping?.priced === true && (stopping.unitCost ?? 0) > 0;
const paintingPriced = painting?.priced === true && (painting.unitCost ?? 0) > 0;
check(
  "stopping uses existing Level 4 catalogue or explicit PR",
  stoppingPriced
    ? near(stopping?.unitCost, 28) && stopping?.rateSource !== "missing"
    : stopping?.priced === false &&
      stopping?.unitCost == null &&
      stopping?.totalCost == null &&
      stopping?.rateSource === "missing"
);
check(
  "painting resolves with approved material authority (not false $0)",
  paintingPriced &&
    near(painting?.unitCost, 18) &&
    near(painting?.totalCost, 288) &&
    painting?.rateSource === "benchmark" &&
    painting?.materialKey === CEILINGS_PAINTING_MATERIAL_KEY
);
check(
  "neither finish disappears and missing rates are not $0",
  stopping != null &&
    painting != null &&
    hosted.lineItems.some((item) => item.componentKey === CEILINGS_STOPPING_COMPONENT) &&
    hosted.lineItems.some((item) => item.componentKey === CEILINGS_PAINTING_COMPONENT) &&
    (hosted.requirements ?? [])
      .filter((row) => row.priced === false)
      .every((row) => row.unitCost == null && row.totalCost == null)
);
check(
  "main Ceiling sibling still prices",
  mainLining?.priced === true &&
    (mainLining.unitCost ?? 0) > 0 &&
    (mainLining.totalCost ?? 0) > 0 &&
    mainLining.rateSource !== "missing"
);
check(
  "ordinary bulkhead receives valid pricing when rates resolve",
  (bhFrame?.priced === true && (bhFrame.unitCost ?? 0) > 0) ||
    (bhFrame?.priced === false && bhFrame?.unitCost == null)
);
check(
  "resolved painting does not block quote readiness",
  nestedCeilingsQuoteIsBlocked({
    missingInfo: hosted.missingInfo,
    items: hosted.lineItems.map((item) => ({
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

const review = composeBuilderReview({
  estimate: {
    recommendedCost: hosted.recommendedCost,
    recommendedSell: hosted.recommendedSell,
    marginPercent: hosted.marginPercent,
    confidence: hosted.confidence,
    assumptions: hosted.assumptions,
    missingInfo: hosted.missingInfo,
    lineItems: mapReviewLines(hosted.lineItems),
  },
  workAreas: [{ id: "c1", type: "ceilings", name: "Ceilings", status: "confirmed" }],
  requirements: hosted.requirements ?? [],
  facts,
});
const groups = review.workAreas[0]?.portionGroups?.[0]?.lineGroups ?? [];
const bulkheadGroup = groups.find((row) => row.secondary === "Bulkhead");
const finishingGroup = groups.find((row) => row.secondary === "Finishing");
check(
  "Builder Review shows 4m × 0.5m × 0.5m and 4m² lining",
  Boolean(bulkheadGroup?.supporting?.includes("4m long")) &&
    Boolean(bulkheadGroup?.supporting?.includes("0.5m deep")) &&
    Boolean(bulkheadGroup?.supporting?.includes("0.5m high")) &&
    Boolean(bulkheadGroup?.supporting?.match(/4(?:\.0)?m² lining/)) &&
    !bulkheadGroup?.supporting?.includes("4m high")
);
check(
  "Builder Review shows plastering and painting",
  finishingGroup != null &&
    (finishingGroup.children.some((row) => /stop|plaster/i.test(row.label)) ||
      /stop|plaster/i.test(finishingGroup.supporting ?? "") ||
      finishingGroup.label.toLowerCase().includes("stopping")) &&
    (finishingGroup.children.some((row) => /paint/i.test(row.label)) ||
      /paint/i.test(finishingGroup.supporting ?? "") ||
      finishingGroup.label.toLowerCase().includes("paint") ||
      finishingGroup.children.length >= 2)
);

const draft = quoteDraft(facts);
check(
  "client Quote includes finishes and bulkhead without excluding them",
  /stopping\/plastering is included/i.test(draft) &&
    /ceiling painting is included/i.test(draft) &&
    /bulkhead/i.test(draft) &&
    !/stopping and plastering are excluded/i.test(draft) &&
    !/painting is excluded/i.test(draft)
);
check(
  "client Quote has no internal costs, rates, productivity or margin",
  !/\$\d/.test(draft) &&
    !/person-hours/i.test(draft) &&
    !/margin/i.test(draft) &&
    !/productivity/i.test(draft) &&
    !/benchmark/i.test(draft) &&
    !/unitCost/i.test(draft)
);

let refineCrashed = false;
try {
  const workAreas = [
    { id: "c1", type: "ceilings", name: "Ceilings", status: "confirmed" as const },
  ];
  const plan = composeJobPlan({
    workAreas,
    facts,
    qualityLevel: "standard",
    briefText: HUMAN_QA_BRIEF,
  });
  composeRefineView({
    briefText: HUMAN_QA_BRIEF,
    qualityLevel: "standard",
    workAreas,
    facts,
    constraints: [],
    jobPlan: {
      cards: plan.cards.map((card) => ({
        workAreaId: card.workAreaId,
        workAreaType: card.workAreaType,
        name: card.name,
        notConfirmed: card.notConfirmed,
      })),
    },
  });
} catch {
  refineCrashed = true;
}
check("Refine composes without clobbering hosted state", !refineCrashed);
const afterRefine = resolveCeilingsPortions({ facts, workAreaId: "c1" }).portions[0]!;
check(
  "Refine path keeps included finishes",
  afterRefine.finish.stopping_included === true &&
    afterRefine.finish.painting_included === true
);

check(
  "information contract consumes nested finish flags",
  /ceilings\.portion\.stopping_included[\s\S]{0,240}calculatorConsumed:\s*true/.test(
    read("lib/estimate/ceilings-information-contract.ts")
  ) &&
    /ceilings\.portion\.painting_included[\s\S]{0,240}calculatorConsumed:\s*true/.test(
      read("lib/estimate/ceilings-information-contract.ts")
    )
);
check(
  "commercial no longer strips nested finish identities",
  read("lib/estimate/ceilings-commercial.ts").includes("CEILINGS_STOPPING_COMPONENT") &&
    read("lib/estimate/ceilings-commercial.ts").includes("return false") &&
    !read("lib/estimate/ceilings-commercial.ts").includes("FITOUT_BENCHMARKS") &&
    !read("lib/estimate/ceilings-commercial.ts").includes("stoppingPerM2")
);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
