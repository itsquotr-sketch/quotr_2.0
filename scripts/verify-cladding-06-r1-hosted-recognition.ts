/**
 * CLADDING-06-R1 — hosted recognition of retained accessories,
 * openings, and board-and-batten.
 *
 * Run: npx --yes tsx scripts/verify-cladding-06-r1-hosted-recognition.ts
 */
import { composeBuilderReview } from "../lib/assistant/builder-review/compose";
import { listCladdingClarifyCandidates } from "../lib/estimate/cladding-clarify";
import {
  extractCladdingPortionsFromBrief,
  mergeCladdingPortionsPreferringDeterministic,
} from "../lib/estimate/cladding-brief";
import { calculateEstimate } from "../lib/estimate/calculate-estimate";
import { calculateCladdingPhysical } from "../lib/estimate/cladding-physical";
import {
  CLADDING_PORTIONS_FACT_KEY,
  CLADDING_V1_HUMAN_QA_FROZEN,
  mergePersistedCladdingPortionsOnReanalyse,
  parseCladdingPortions,
  type CladdingPortion,
} from "../lib/estimate/cladding-portions";
import { buildNestedCladdingQuoteDraft } from "../lib/estimate/cladding-quote";
import type { EstimateFact, EstimateLineItem, EstimateWorkArea } from "../lib/estimate/types";
import { projectEligibleUnresolvedPricingItems } from "../lib/pricing/manual-requirement-promotion";

const QA1 =
  "Supply and install 30 m² of 187 × 18 mm horizontal timber bevelback cladding to the North elevation. Also supply and install 20 m² of 180 mm horizontal fibre-cement weatherboard cladding to the South elevation. The areas already exclude openings. Existing wall underlay, cavity and trims are to remain. No cladding removal is required. Painting and scaffolding are excluded.";
const QA2 =
  "Supply and install timber board-and-batten cladding to the Garage elevation, 6.0 m long × 2.4 m high, using 65 × 19 mm battens. The area already excludes openings. No removal is required. Existing wall underlay and cavity are to remain. Trims, painting and scaffolding are excluded.";

let passed = 0;
let failed = 0;
function check(name: string, ok: boolean): void {
  if (ok) {
    passed += 1;
    console.log(`PASS  ${passed + failed}. ${name}`);
  } else {
    failed += 1;
    console.log(`FAIL  ${passed + failed}. ${name}`);
  }
}
function close(actual: number | null | undefined, expected: number): boolean {
  return actual != null && Math.abs(actual - expected) < 0.02;
}

const workArea = { id: "c1", type: "cladding", name: "Cladding", sort_order: 1 } as EstimateWorkArea;

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
function quoteOf(rows: CladdingPortion[], estimate: ReturnType<typeof estimateOf>): string {
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
function reviewOf(estimate: ReturnType<typeof estimateOf>, rows: CladdingPortion[]) {
  const items = estimate.lineItems.map((item, index) => ({
    id: `line-${index}`,
    workAreaName: item.workAreaName,
    label: item.label,
    category: item.category,
    recommendedCost: item.recommendedCost,
    recommendedSell: item.recommendedSell,
    quantity: item.quantity,
    unit: item.unit,
    labourHours: item.labourHours,
    costRate: item.costRate,
    itemKey: item.itemKey,
    componentKey: item.componentKey,
    nestedItemId: item.nestedItemId,
    notes: item.notes,
    includedInTotal: item.includedInTotal,
    scopeKey: item.scopeKey,
    overlapGroup: item.overlapGroup,
  })) as EstimateLineItem[];
  return composeBuilderReview({
    estimate: {
      recommendedCost: estimate.recommendedCost,
      recommendedSell: estimate.recommendedSell,
      marginPercent: estimate.marginPercent,
      confidence: estimate.confidence,
      assumptions: estimate.assumptions,
      missingInfo: estimate.missingInfo,
      lineItems: items,
    },
    workAreas: [{ id: "c1", name: "Cladding", type: "cladding", status: "confirmed" }],
    requirements: estimate.requirements,
    facts: factsFor(rows),
  });
}

const qa1 = extractCladdingPortionsFromBrief(QA1);
const north = qa1.find((row) => row.label === "North elevation");
const south = qa1.find((row) => row.label === "South elevation");
check("QA1 extracts two clause-local sections", qa1.length === 2 && north != null && south != null);
check("North direct area stays 30", north?.direct_area_m2 === 30 && north.area_method === "direct_m2");
check("South direct area stays 20", south?.direct_area_m2 === 20 && south.area_method === "direct_m2");
check("both sections already exclude openings", north?.openings_already_deducted === true && south?.openings_already_deducted === true);
check("North is bevelback timber", north?.cladding_family === "timber" && north.cladding_system === "timber_bevelback" && north.nominal_width_mm === 187);
check("South is 180 mm fibre-cement", south?.cladding_family === "fibre_cement" && south.nominal_width_mm === 180);
check("retained cavity is not new work", north?.cavity_included === false && north.cavity_state === "retained" && south?.cavity_state === "retained");
check("retained underlay is not new work", north?.underlay_state === "retained" && south?.wall_underlay_or_rab_included === false);
check("retained trims are not new work", north?.trims_state === "retained" && south?.trims_flashings_corners_included === false);
check("removal stays No", north?.existing_cladding_removal_required === false && south?.existing_cladding_removal_required === false);
check("painting and scaffold are excluded", north?.painting_state === "excluded" && north.scaffold_state === "excluded");

const hostile = qa1.map((row) => ({
  ...row,
  direct_area_m2: 99,
  direct_area_authority: "ai_inferred" as const,
  openings_already_deducted: false,
  opening_area_m2: 4,
  cavity_included: true,
  cavity_state: "new" as const,
  wall_underlay_or_rab_included: true,
  underlay_state: "new" as const,
}));
const merged = mergeCladdingPortionsPreferringDeterministic(hostile, qa1);
check("deterministic area beats an AI alternative", merged[0]?.direct_area_m2 === 30 && merged[1]?.direct_area_m2 === 20);
check("deterministic openings beat an AI deduction", merged.every((row) => row.openings_already_deducted === true && row.opening_area_m2 == null));
check("deterministic retained cavity beats an AI Yes", merged.every((row) => row.cavity_included === false && row.cavity_state === "retained"));

const userOwned = { ...merged[0]!, direct_area_m2: 28, direct_area_authority: "user" as const };
const kept = mergePersistedCladdingPortionsOnReanalyse({ extracted: merged, persisted: [userOwned, merged[1]!] });
check("a later user area edit still wins", kept[0]?.direct_area_m2 === 28 && kept[1]?.direct_area_m2 === 20);

const persisted = parseCladdingPortions(JSON.parse(JSON.stringify(merged)));
check("persistence keeps both areas and retained states", persisted[0]?.direct_area_m2 === 30 && persisted[0]?.cavity_state === "retained" && persisted[1]?.direct_area_m2 === 20);

const physical1 = calculateCladdingPhysical({ facts: factsFor(persisted), workArea });
check("North net area stays 30", physical1.portions.find((row) => row.label === "North elevation")?.netAreaM2 === 30);
check("South net area stays 20", physical1.portions.find((row) => row.label === "South elevation")?.netAreaM2 === 20);
check("retained accessories emit no requirement", !physical1.requirements.some((row) => /cavity|underlay|rigid_air|trims/.test(row.componentKey)));
const estimate1 = estimateOf(persisted);
const included1 = estimate1.lineItems.filter((row) => row.includedInTotal !== false);
check("QA1 prices both ordinary sections", close(included1.reduce((sum, row) => sum + (row.recommendedCost ?? 0), 0), 7803.45));
check("QA1 has no accessory Pricing Required line", !estimate1.lineItems.some((row) => /cavity|underlay|trims_flashings/.test(row.componentKey ?? "")));
const projected1 = projectEligibleUnresolvedPricingItems({
  items: [],
  estimateLines: estimate1.lineItems,
  orgId: "org",
  projectId: "p1",
  pricingDocumentId: "pd",
});
check("retained accessories do not project pending Pricing items", projected1.length === 0);
const quote1 = quoteOf(persisted, estimate1);
check("QA1 quote names both elevations", quote1.includes("North elevation:") && quote1.includes("30 m²") && quote1.includes("South elevation:") && quote1.includes("20 m²"));
check("QA1 quote does not include a new cavity or underlay", !quote1.includes("Includes a drained cavity") && !quote1.includes("Includes the specified flexible"));
const review1 = reviewOf(estimate1, persisted);
const groups1 = review1.workAreas[0]?.portionGroups ?? [];
check("Builder Review keeps both priced sections", groups1.length === 2 && groups1.some((row) => row.label.includes("North")) && groups1.some((row) => row.label.includes("South")));
check("review discloses retained cavity without pricing it", groups1.some((row) => (row.summary ?? "").includes("Existing drained cavity retained")) && !groups1.some((row) => row.lineGroups.some((group) => group.label === "Accessories")));

const qa2 = extractCladdingPortionsFromBrief(QA2);
const garage = qa2[0];
check("board-and-batten is one Garage section", qa2.length === 1 && garage?.label === "Garage elevation");
check("system is board-and-batten and vertical", garage?.cladding_family === "timber" && garage.cladding_system === "timber_sheet_board_and_batten" && garage.orientation === "vertical");
check("area method is length by height", garage?.area_method === "length_height" && garage.length_m === 6 && garage.height_m === 2.4);
check("openings are already deducted", garage?.openings_already_deducted === true);
check("battens are 65 by 19", garage?.batten_width_mm === 65 && garage.batten_thickness_mm === 19);
check("removal is No and cavity is retained", garage?.existing_cladding_removal_required === false && garage.cavity_state === "retained");
check("underlay is retained and trims are excluded", garage?.underlay_state === "retained" && garage.trims_state === "excluded");
check("painting and scaffold are excluded", garage?.painting_state === "excluded" && garage.scaffold_state === "excluded");
const questions = listCladdingClarifyCandidates({ facts: factsFor(qa2), workAreaId: "c1", workAreaName: "Cladding" });
check("board-and-batten asks no orientation or weatherboard question", questions.every((row) => !/orientation|bevel|rusticated|profile|effective cover/i.test(`${row.factKey} ${row.question}`)));
const physical2 = calculateCladdingPhysical({ facts: factsFor(qa2), workArea });
const board = physical2.requirements.find((row) => row.componentKey.includes("sheet_board"));
const sheets = physical2.requirements.find((row) => row.componentKey.includes("sheet_equivalent"));
const battens = physical2.requirements.find((row) => row.componentKey.includes("batten.65x19"));
check("board quantity is 14.4 m2", board?.kind === "material" && close(board.baseQuantity, 14.4));
check("sheet equivalent is informational 5", sheets?.kind === "material" && sheets.baseQuantity === 5 && sheets.materialKey == null);
check("batten quantity is 9.6 lm", battens?.kind === "material" && close(battens.baseQuantity, 9.6));
const estimate2 = estimateOf(qa2);
const cost2 = estimate2.lineItems.filter((row) => row.includedInTotal !== false).reduce((sum, row) => sum + (row.recommendedCost ?? 0), 0);
check("board-and-batten direct COST is 1589.28", close(cost2, 1589.28));
check("board material is 936", close(estimate2.lineItems.find((row) => row.componentKey?.includes("sheet_board.m2"))?.recommendedCost, 936));
check("batten material is 45.60", close(estimate2.lineItems.find((row) => row.componentKey?.includes("batten.65x19"))?.recommendedCost, 45.6));
check("installation labour is 607.68", close(estimate2.lineItems.filter((row) => row.category === "labour").reduce((sum, row) => sum + (row.recommendedCost ?? 0), 0), 607.68));
const quote2 = quoteOf(qa2, estimate2);
check("Garage quote names board-and-batten", quote2.includes("Garage elevation:") && quote2.includes("14.4 m² of timber board-and-batten") && quote2.includes("65 × 19 mm"));
check("Garage quote hides sheet equivalent", !/sheet equivalent/i.test(quote2));
const review2 = reviewOf(estimate2, qa2);
check("Garage review is priced", (review2.workAreas[0]?.portionGroups ?? []).some((row) => row.label.includes("Garage") && row.lineGroups.some((group) => group.label === "Cladding material")));
check("freeze stays closed", CLADDING_V1_HUMAN_QA_FROZEN === true);

const retainedPhrases = [
  "existing cavity remains",
  "existing wall underlay remains",
  "retain the existing rigid air barrier",
  "trims are to remain",
  "no new cavity is required",
  "wall underlay is not included",
  "painting excluded",
  "scaffolding excluded",
];
for (const phrase of retainedPhrases) {
  const row = extractCladdingPortionsFromBrief(`Supply and install 10 m² of 187 × 18 mm horizontal timber bevelback cladding to the North elevation. ${phrase}.`)[0];
  const emits = row?.cavity_state === "new" || row?.underlay_state === "new" || row?.trims_state === "new" || row?.painting_state === "new" || row?.scaffold_state === "new";
  check(`phrase does not create new accessory work: ${phrase}`, row != null && !emits);
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
