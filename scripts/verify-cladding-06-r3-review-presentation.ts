/**
 * CLADDING-06-R3 — pricing notice ownership and Builder Review number formatting.
 *
 * Run: npx --yes tsx scripts/verify-cladding-06-r3-review-presentation.ts
 */
import { readFileSync } from "node:fs";
import { composeBuilderReview } from "../lib/assistant/builder-review/compose";
import { pricingNoticeForWorkAreaTypes } from "../lib/assistant/builder-review/pricing-notice";
import type { EstimateLineItem } from "../components/assistant/types";
import { calculateEstimate } from "../lib/estimate/calculate-estimate";
import { extractCladdingPortionsFromBrief } from "../lib/estimate/cladding-brief";
import { calculateCladdingPhysical } from "../lib/estimate/cladding-physical";
import {
  CLADDING_PORTIONS_FACT_KEY,
  type CladdingPortion,
} from "../lib/estimate/cladding-portions";
import { buildNestedCladdingQuoteDraft } from "../lib/estimate/cladding-quote";
import { DOORS_V1_HUMAN_QA_FROZEN } from "../lib/estimate/doors-identities";
import { DOORS_QUOTE_SPECIALIST_PENDING } from "../lib/estimate/doors-quote";
import { FLOORING_V1_HUMAN_QA_FROZEN } from "../lib/estimate/flooring-identities";
import { FLOORING_QUOTE_SPECIALIST_PENDING } from "../lib/estimate/flooring-quote";
import { round2 } from "../lib/estimate/facts";
import type { EstimateFact, EstimateWorkArea } from "../lib/estimate/types";
import { CEILINGS_PARTIAL_ESTIMATE_MESSAGE } from "../lib/estimate/ceilings-identities";
import { evaluateManualPricingEligibility } from "../lib/pricing/manual-requirement-promotion";

const QA1 =
  "Supply and install 30 m² of 187 × 18 mm horizontal timber bevelback cladding to the North elevation. Also supply and install 20 m² of 180 mm horizontal fibre-cement weatherboard cladding to the South elevation. The areas already exclude openings. Existing wall underlay, cavity and trims are to remain. No cladding removal is required. Painting and scaffolding are excluded.";
const QA2 =
  "Supply and install timber board-and-batten cladding to the Garage elevation, 6.0 m long × 2.4 m high, using 65 × 19 mm battens. The area already excludes openings. No removal is required. Existing wall underlay and cavity are to remain. Trims, painting and scaffolding are excluded.";
const QA3 =
  "Supply and install 25 m² of brick veneer cladding to the Lower elevation. The area already excludes openings. No existing cladding removal is required. The final brick selection is still to be confirmed.";
const QA4 =
  "Supply and install 20 m² of 180 mm horizontal fibre-cement weatherboard cladding to the South elevation. The area already excludes openings. Include a new drained cavity and a new flexible wall underlay. No cladding removal is required. Trims, painting and scaffolding are excluded.";

const LONG_FLOAT = /\d+\.\d{8,}/;
const workArea = { id: "c1", type: "cladding", name: "Cladding", sort_order: 1, status: "confirmed" } as EstimateWorkArea;

let passed = 0;
let failed = 0;
function check(name: string, ok: boolean, detail = ""): void {
  if (ok) {
    passed += 1;
    console.log(`PASS  ${passed + failed}. ${name}`);
  } else {
    failed += 1;
    console.log(`FAIL  ${passed + failed}. ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

function factsFor(rows: CladdingPortion[]): EstimateFact[] {
  return [{ key: CLADDING_PORTIONS_FACT_KEY, work_area_id: "c1", value: rows, source: "user" }];
}
function estimateOf(rows: CladdingPortion[]) {
  return calculateEstimate({
    project: { id: "p1", qualityLevel: "standard" },
    confirmedWorkAreas: [workArea],
    facts: factsFor(rows),
    constraints: [],
    organisationSettings: { allow_benchmark_rates: true, default_margin_percent: 20 },
    materialWastageSettings: { sheet_material: 10, flooring: 10, paint: 10, default: 5 },
    rates: [],
  });
}
function reviewOf(rows: CladdingPortion[], estimate = estimateOf(rows)) {
  return composeBuilderReview({
    estimate: {
      recommendedCost: estimate.recommendedCost,
      recommendedSell: estimate.recommendedSell,
      marginPercent: estimate.marginPercent,
      confidence: estimate.confidence,
      assumptions: estimate.assumptions,
      missingInfo: estimate.missingInfo,
      lineItems: estimate.lineItems.map((item, index) => ({ ...item, id: `line-${index}` })) as EstimateLineItem[],
    },
    workAreas: [{ id: "c1", name: "Cladding", type: "cladding", status: "confirmed" }],
    requirements: estimate.requirements,
    facts: factsFor(rows),
  });
}
function visibleText(review: ReturnType<typeof reviewOf>): string {
  const bits: string[] = [];
  if (review.overview.partialEstimateLabel) bits.push(review.overview.partialEstimateLabel);
  for (const area of review.workAreas) {
    if (area.partialEstimateLabel) bits.push(area.partialEstimateLabel);
    for (const portion of area.portionGroups ?? []) {
      bits.push(portion.label, portion.summary ?? "", portion.areaLabel ?? "", ...portion.assumptions);
      for (const group of portion.lineGroups) {
        bits.push(group.label, group.supporting ?? "", group.rateContext ?? "");
        for (const child of group.children ?? []) {
          bits.push(child.label, child.supporting ?? "", child.detail ?? "");
        }
      }
    }
  }
  return bits.filter(Boolean).join("\n");
}
function quoteOf(rows: CladdingPortion[], estimate = estimateOf(rows)): string {
  return buildNestedCladdingQuoteDraft(
    [{ key: CLADDING_PORTIONS_FACT_KEY, work_area_id: "quote", value: JSON.stringify(rows), source: "user" }],
    estimate.lineItems
      .filter((row) => row.includedInTotal !== false && (row.recommendedCost ?? 0) > 0)
      .map((row) => ({
        label: row.label,
        component_key: row.componentKey,
        nested_item_id: row.nestedItemId,
        cost_known: true,
        total_cost: row.recommendedCost,
        total_sell: row.recommendedSell,
        notes_internal: row.notes,
      }))
  );
}

function syntheticNotice(params: {
  areas: { id: string; name: string; type: string }[];
  lines: Partial<EstimateLineItem>[];
  missingInfo?: string[];
}) {
  return composeBuilderReview({
    estimate: {
      recommendedCost: 100,
      recommendedSell: 125,
      marginPercent: 20,
      confidence: 0.8,
      assumptions: [],
      missingInfo: params.missingInfo ?? [],
      lineItems: params.lines.map((line, index) => ({
        id: `s-${index}`,
        workAreaName: line.workAreaName ?? "Cladding",
        label: line.label ?? "Item",
        category: line.category ?? "materials",
        costLow: line.recommendedCost ?? 0,
        costHigh: line.recommendedCost ?? 0,
        sellLow: 0,
        sellHigh: 0,
        recommendedCost: line.recommendedCost ?? 0,
        recommendedSell: 0,
        grossProfit: 0,
        marginPercent: 0,
        rateSource: line.rateSource ?? "Quotr benchmark",
        workAreaId: line.workAreaId,
        componentKey: line.componentKey,
        includedInTotal: line.includedInTotal,
        quantity: line.quantity,
        unit: line.unit,
      })) as EstimateLineItem[],
    },
    workAreas: params.areas.map((area) => ({ ...area, status: "confirmed" })),
    requirements: [],
  });
}

check(
  "Cladding-only unresolved warning says Cladding",
  syntheticNotice({
    areas: [{ id: "c1", name: "Cladding", type: "cladding" }],
    lines: [{ workAreaId: "c1", workAreaName: "Cladding", recommendedCost: 0, includedInTotal: false, rateSource: "Pricing required", componentKey: "ceilings.specialist.should.not.win" }],
  }).overview.partialEstimateLabel === "Some Cladding items still require pricing."
);
check(
  "Ceiling-only warning still says Ceiling",
  syntheticNotice({
    areas: [{ id: "ceil", name: "Ceilings", type: "ceilings" }],
    lines: [{ workAreaId: "ceil", workAreaName: "Ceilings", recommendedCost: 0, rateSource: "Pricing required", componentKey: "cladding.specialist.brick_veneer" }],
  }).overview.partialEstimateLabel === "Some Ceiling items still require pricing."
);
check(
  "Flooring-only warning says Flooring",
  syntheticNotice({
    areas: [{ id: "f1", name: "Flooring", type: "flooring" }],
    lines: [{ workAreaId: "f1", workAreaName: "Flooring", recommendedCost: 0, includedInTotal: false, rateSource: "Pricing required" }],
  }).overview.partialEstimateLabel === "Some Flooring items still require pricing."
);
check(
  "Doors-only warning says Doors",
  syntheticNotice({
    areas: [{ id: "d1", name: "Doors", type: "doors" }],
    lines: [{ workAreaId: "d1", workAreaName: "Doors", recommendedCost: 0, includedInTotal: false, rateSource: "Pricing required" }],
  }).overview.partialEstimateLabel === "Some Doors items still require pricing."
);
check(
  "multiple unresolved Work Areas use neutral copy",
  syntheticNotice({
    areas: [
      { id: "f1", name: "Flooring", type: "flooring" },
      { id: "c1", name: "Cladding", type: "cladding" },
    ],
    lines: [
      { workAreaId: "f1", workAreaName: "Flooring", recommendedCost: 0, includedInTotal: false, rateSource: "Pricing required" },
      { workAreaId: "c1", workAreaName: "Cladding", recommendedCost: 0, includedInTotal: false, rateSource: "Pricing required" },
    ],
  }).overview.partialEstimateLabel === "Some items still require pricing."
);
check(
  "no unresolved requirements means no warning",
  syntheticNotice({
    areas: [{ id: "ceil", name: "Ceilings", type: "ceilings" }],
    lines: [{ workAreaId: "ceil", workAreaName: "Ceilings", recommendedCost: 80, includedInTotal: true, rateSource: "Quotr benchmark" }],
    missingInfo: [CEILINGS_PARTIAL_ESTIMATE_MESSAGE],
  }).overview.partialEstimateLabel == null
);
check(
  "warning ownership survives mixed priced and unpriced lines",
  syntheticNotice({
    areas: [
      { id: "f1", name: "Flooring", type: "flooring" },
      { id: "c1", name: "Cladding", type: "cladding" },
    ],
    lines: [
      { workAreaId: "f1", workAreaName: "Flooring", recommendedCost: 400, includedInTotal: true, rateSource: "Quotr benchmark", componentKey: "flooring.finish" },
      { workAreaId: "c1", workAreaName: "Cladding", recommendedCost: 0, includedInTotal: false, rateSource: "Pricing required", componentKey: "cladding.specialist.brick_veneer" },
    ],
  }).overview.partialEstimateLabel === "Some Cladding items still require pricing."
);
check(
  "notice helper does not default to Ceiling",
  pricingNoticeForWorkAreaTypes(["cladding"]) === "Some Cladding items still require pricing." &&
    pricingNoticeForWorkAreaTypes([]) == null &&
    pricingNoticeForWorkAreaTypes(["ceilings", "doors"]) === "Some items still require pricing."
);

const qa3 = extractCladdingPortionsFromBrief(QA3);
const brickEstimate = estimateOf(qa3);
const brickReview = reviewOf(qa3, brickEstimate);
const brickPhysical = calculateCladdingPhysical({ facts: factsFor(qa3), workArea });
const brickReq = brickPhysical.requirements.find((row) => row.componentKey.includes("brick"));
const brickLine = brickEstimate.lineItems.find((row) => row.componentKey.includes("brick"));
check("brick requirement retains Cladding ownership", brickReq?.workAreaType === "cladding" && brickReq.workAreaId === "c1" && brickReview.overview.partialEstimateLabel === "Some Cladding items still require pricing.");
check("brick quantity remains 25 m2", brickReq?.kind === "material" && brickReq.purchaseQuantity === 25 && brickReq.purchaseUnit === "m2" && brickLine?.quantity === 25);
check(
  "brick emits no invented material or labour",
  brickPhysical.requirements.length === 1 &&
    !brickPhysical.requirements.some((row) => row.kind === "labour") &&
    brickEstimate.recommendedCost === 0 &&
    !brickEstimate.lineItems.some((row) => row.includedInTotal !== false && (row.recommendedCost ?? 0) === 0)
);
check("manual pricing remains eligible", brickLine != null && evaluateManualPricingEligibility(brickLine).ok === true);
check(
  "brick review keeps the specialist hierarchy",
  (brickReview.workAreas[0]?.portionGroups?.[0]?.label ?? "").includes("Lower elevation") &&
    (brickReview.workAreas[0]?.portionGroups?.[0]?.label ?? "").includes("25 m² brick veneer") &&
    (brickReview.workAreas[0]?.partialEstimateLabel ?? "").includes("Continue to Pricing")
);

const qa1Rows = extractCladdingPortionsFromBrief(QA1);
const qa1Estimate = estimateOf(qa1Rows);
const qa1Review = reviewOf(qa1Rows, qa1Estimate);
const qa1Text = visibleText(qa1Review);
check("QA 1 contains no long floating values", !LONG_FLOAT.test(qa1Text), qa1Text.match(LONG_FLOAT)?.[0] ?? "");
check("QA 1 north labour calculation is presented to two decimals", qa1Text.includes("193.55 lm × 0.12 h/lm = 23.23 h base. Access × 1 = 23.23 h."));
check("QA 1 south labour calculation is presented to two decimals", qa1Text.includes("133.33 lm × 0.13 h/lm = 17.33 h base. Access × 1 = 17.33 h."));
check("QA 1 has no pricing warning", qa1Review.overview.partialEstimateLabel == null);

const qa1Physical = calculateCladdingPhysical({ facts: factsFor(qa1Rows), workArea });
const northLm = qa1Physical.requirements.find((row) => row.kind === "material" && row.componentKey.includes("bevelback"));
check(
  "underlying physical quantities remain exact",
  northLm?.kind === "material" && northLm.purchaseQuantity === 30 / 0.155 && qa1Physical.portions[0]?.netAreaM2 === 30
);

const qa1Labour = qa1Estimate.lineItems.find((row) => (row.componentKey ?? "").includes("bevelback") && row.category === "labour");
check(
  "hosted COST ignores the displayed hour rounding",
  qa1Labour?.labourHours != null &&
    qa1Labour.recommendedCost === round2(qa1Labour.labourHours * 60) &&
    qa1Labour.recommendedCost !== round2(23.23 * 60)
);

const qa2Rows = extractCladdingPortionsFromBrief(QA2);
const qa2Estimate = estimateOf(qa2Rows);
const qa2Text = visibleText(reviewOf(qa2Rows, qa2Estimate));
const qa2Physical = calculateCladdingPhysical({ facts: factsFor(qa2Rows), workArea });
check("QA 2 contains no long floating values", !LONG_FLOAT.test(qa2Text) && qa2Text.includes("14.4 m²"), qa2Text.match(LONG_FLOAT)?.[0] ?? "");
check("QA 2 board and batten hours stay presented", qa2Text.includes("9.36 h") && qa2Text.includes("0.77 h"));
check("QA 2 sheet equivalent remains 5", qa2Text.includes("5 sheets") || qa2Physical.requirements.some((row) => row.kind === "material" && row.purchaseQuantity === 5));
check("QA 2 direct COST stays 1589.28", qa2Estimate.recommendedCost === 1589.28);
check("board quantity stays the exact 6 by 2.4 product", qa2Physical.portions[0]?.netAreaM2 === 6 * 2.4);

const qa4Extracted = extractCladdingPortionsFromBrief(QA4);
const qa4Rows = qa4Extracted.map((row) => ({
  ...row,
  wall_underlay_or_rab_included: true,
  underlay_state: "new" as const,
  wall_preparation: "flexible_underlay" as const,
}));
const qa4Estimate = estimateOf(qa4Rows);
const qa4Text = visibleText(reviewOf(qa4Rows, qa4Estimate));
check("QA 4 contains no long floating values", !LONG_FLOAT.test(qa4Text), qa4Text.match(LONG_FLOAT)?.[0] ?? "");
check("QA 4 presents fibre-cement, cavity and underlay hours", qa4Text.includes("17.33 h") && qa4Text.includes("3 h") && qa4Text.includes("1.6 h"));

const quote = quoteOf(qa1Rows, qa1Estimate);
check(
  "quote remains free of internal diagnostics",
  !LONG_FLOAT.test(quote) &&
    !quote.includes("h base") &&
    !quote.includes("cladding.timber") &&
    !quote.includes("UNSUPPORTED_SPECIALIST") &&
    !quote.includes("Pricing required")
);
check(
  "frozen Doors and Flooring copy does not regress",
  DOORS_V1_HUMAN_QA_FROZEN === true &&
    FLOORING_V1_HUMAN_QA_FROZEN === true &&
    DOORS_QUOTE_SPECIALIST_PENDING === "Specialist door system is excluded pending separate specification and pricing." &&
    FLOORING_QUOTE_SPECIALIST_PENDING === "Specialist flooring works are excluded pending separate specification and pricing."
);

const composeSource = readFileSync("lib/assistant/builder-review/compose.ts", "utf8");
check(
  "Ceiling sentence is not the generic fallback",
  !composeSource.includes("CEILINGS_BUILDER_REVIEW_PARTIAL_MESSAGE") &&
    !composeSource.includes("Some Ceiling items still require pricing.")
);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
