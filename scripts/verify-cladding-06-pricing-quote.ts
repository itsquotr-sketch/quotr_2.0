/**
 * CLADDING-06 — Pricing adoption and client Quote.
 */
import { readFileSync } from "node:fs";
import type { OrganisationRate } from "../components/setup/types";
import { deriveSellFromCost } from "../lib/commercial-engine/core/sell-from-margin";
import { calculateEstimate } from "../lib/estimate/calculate-estimate";
import {
  CLADDING_QUOTE_INCOMPLETE_ONLY,
  CLADDING_QUOTE_INCOMPLETE_SIBLING,
  CLADDING_QUOTE_OPENINGS,
  CLADDING_QUOTE_PAINTING,
  CLADDING_QUOTE_REMOVAL_EXCLUSIONS,
  CLADDING_QUOTE_SCAFFOLD,
  CLADDING_QUOTE_SPECIALIST_PENDING,
  CLADDING_QUOTE_CUSTOM_PENDING,
  CLADDING_QUOTE_TRIMS_PENDING,
  claddingLineIsManualPricingEligible,
} from "../lib/estimate/cladding-quote";
import { CLADDING_V1_HUMAN_QA_FROZEN } from "../lib/estimate/cladding-portions";
import {
  CLADDING_PORTIONS_FACT_KEY,
  createEmptyCladdingPortion,
  type CladdingPortion,
} from "../lib/estimate/cladding-portions";
import { round2 } from "../lib/estimate/facts";
import { buildLineItemNotes } from "../lib/estimate/line-items";
import { workAreaMayCloseAtL5 } from "../lib/estimate/benchmark-coverage";
import { verifyRegisteredWorkAreaBenchmarkCoverage } from "../lib/estimate/work-area-benchmark-coverage";
import type { EstimateFact, EstimateLineItemInput, EstimateWorkArea } from "../lib/estimate/types";
import { DOORS_V1_HUMAN_QA_FROZEN } from "../lib/estimate/doors-identities";
import { FLOORING_V1_HUMAN_QA_FROZEN } from "../lib/estimate/flooring-identities";
import { classifyCladdingOwnership } from "../lib/work-areas/cladding-ownership";
import { buildWorkAreaQuoteDescriptionDraft } from "../lib/work-areas/quote-description";
import { calculateDocumentTotals } from "../lib/pricing/calculations";
import {
  computeManualPromotionMoney,
  evaluateManualPricingEligibility,
  projectEligibleUnresolvedPricingItems,
} from "../lib/pricing/manual-requirement-promotion";
import { valuesFromEstimateLineItem } from "../lib/pricing/recalibration-helpers";
import { DEFAULT_GST_RATE } from "../lib/pricing/status";
import type { PricingItem } from "../lib/pricing/types";
import { calculateQuoteTotals } from "../lib/quotes/calculations";
import { mapPricingItemsToQuoteItems } from "../lib/quotes/from-pricing";

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
  return actual != null && Math.abs(actual - expected) < 0.001;
}

function portion(overrides: Partial<CladdingPortion> & { id: string }): CladdingPortion {
  return {
    ...createEmptyCladdingPortion({ id: overrides.id }),
    scope_intent: "install",
    cladding_family: "timber",
    orientation: "horizontal",
    cladding_system: "timber_bevelback",
    approved_profile_id: "timber_bevelback_187x18",
    nominal_width_mm: 187,
    nominal_thickness_mm: 18,
    effective_cover_mm: 155,
    area_method: "direct_m2",
    direct_area_m2: 30,
    openings_already_deducted: true,
    cavity_included: false,
    wall_underlay_or_rab_included: false,
    trims_flashings_corners_included: false,
    existing_cladding_removal_required: false,
    painting_or_coating_included: false,
    ...overrides,
  };
}

const baseContext = {
  project: { id: "p1", qualityLevel: "standard" as const },
  confirmedWorkAreas: [] as EstimateWorkArea[],
  facts: [] as EstimateFact[],
  constraints: [],
  organisationSettings: { allow_benchmark_rates: true, default_margin_percent: 20, default_gst_rate: 15 },
  materialWastageSettings: { sheet_material: 10, flooring: 10, paint: 10, default: 5 },
  rates: [] as OrganisationRate[],
};

function estimateOf(rows: CladdingPortion[], extra?: Partial<typeof baseContext>) {
  return calculateEstimate({
    ...baseContext,
    ...extra,
    confirmedWorkAreas: [{ id: "c1", type: "cladding", name: "Cladding", sort_order: 1 } as EstimateWorkArea],
    facts: [{ key: CLADDING_PORTIONS_FACT_KEY, work_area_id: "c1", value: rows, source: "user" }],
    rates: extra?.rates ?? [],
  });
}

function included(items: readonly EstimateLineItemInput[]) {
  return items.filter((row) => row.includedInTotal !== false && (row.recommendedCost ?? 0) > 0);
}
function costOf(items: readonly EstimateLineItemInput[]) {
  return round2(included(items).reduce((sum, row) => sum + (row.recommendedCost ?? 0), 0));
}
function sellOf(items: readonly EstimateLineItemInput[]) {
  return round2(included(items).reduce((sum, row) => sum + (row.recommendedSell ?? 0), 0));
}
function asEstimateRow(item: EstimateLineItemInput, index: number) {
  return {
    id: `line-${index}`,
    work_area_id: item.workAreaId ?? "c1",
    label: item.label,
    category: item.category,
    recommended_cost: item.recommendedCost,
    recommended_sell: item.recommendedSell,
    notes: buildLineItemNotes(item),
    sort_order: index,
    component_key: item.componentKey ?? null,
  };
}
function adopt(estimate: ReturnType<typeof calculateEstimate>) {
  return included(estimate.lineItems).map((item, index) => valuesFromEstimateLineItem(asEstimateRow(item, index)));
}
function quoteItems(estimate: ReturnType<typeof calculateEstimate>) {
  return estimate.lineItems.map((item) => ({
    label: item.label,
    component_key: item.componentKey,
    nested_item_id: item.nestedItemId,
    cost_known: item.rateSourceType !== "missing" && (item.recommendedCost ?? 0) > 0,
    total_cost: item.recommendedCost ?? 0,
    total_sell: item.recommendedSell ?? 0,
    notes_internal: buildLineItemNotes(item),
  }));
}
function quoteOf(rows: CladdingPortion[], estimate?: ReturnType<typeof calculateEstimate>, extraItems: ReturnType<typeof quoteItems> = []) {
  return buildWorkAreaQuoteDescriptionDraft({
    type: "cladding",
    name: "Cladding",
    facts: [{ key: CLADDING_PORTIONS_FACT_KEY, label: "Cladding sections", value: JSON.stringify(rows) }],
    pricingItems: estimate ? [...quoteItems(estimate), ...extraItems] : extraItems,
  });
}
function moneyProof(cost: number, margin = 20) {
  const sell = deriveSellFromCost(cost, margin);
  const totals = calculateDocumentTotals([{ total_cost: cost, total_sell: sell }], DEFAULT_GST_RATE);
  const quote = calculateQuoteTotals([{ total: sell, visible: true }], DEFAULT_GST_RATE);
  return { sell, totals, quote };
}

const north = portion({ id: "north", label: "North elevation" });
const south = portion({
  id: "south",
  label: "South elevation",
  cladding_family: "fibre_cement",
  orientation: null,
  cladding_system: "fibre_cement_horizontal_weatherboard",
  approved_profile_id: "fibre_cement_horizontal_weatherboard_180",
  nominal_width_mm: 180,
  nominal_thickness_mm: null,
  effective_cover_mm: 150,
  direct_area_m2: 20,
});
const entry = portion({
  id: "entry",
  label: "Entry feature",
  orientation: "vertical",
  cladding_system: "timber_vertical_shiplap",
  approved_profile_id: "timber_vertical_shiplap_135x21",
  nominal_width_mm: 135,
  nominal_thickness_mm: 21,
  effective_cover_mm: 110,
  direct_area_m2: 12,
});
const garage = portion({
  id: "garage",
  label: "Garage elevation",
  orientation: "vertical",
  cladding_system: "timber_sheet_board_and_batten",
  approved_profile_id: "timber_sheet_board_and_batten",
  nominal_width_mm: null,
  nominal_thickness_mm: null,
  effective_cover_mm: null,
  area_method: "length_height",
  direct_area_m2: null,
  length_m: 6,
  height_m: 2.4,
  batten_width_mm: 65,
  batten_thickness_mm: 19,
});
const replace = portion({
  id: "replace",
  label: "North elevation",
  scope_intent: "replace",
  approved_profile_id: "timber_bevelback_142x18",
  nominal_width_mm: 142,
  effective_cover_mm: 110,
  direct_area_m2: 12,
  existing_cladding_removal_required: true,
});
const removal = portion({
  id: "west",
  label: "Existing west wall",
  scope_intent: "removal_only",
  direct_area_m2: 12,
  existing_cladding_removal_required: true,
});
const rustic = portion({
  id: "rustic",
  label: "East elevation",
  cladding_system: "timber_rusticated",
  approved_profile_id: "timber_rusticated_135x18",
  nominal_width_mm: 135,
  nominal_thickness_mm: 18,
  effective_cover_mm: 110,
  direct_area_m2: 12,
});

const fixtureA = estimateOf([north]);
const beforeFacts = JSON.stringify([north]);
const beforeRates = baseContext.rates.length;
const adoptedA = adopt(fixtureA);
check("A hosted COST stays $4,296.78", close(costOf(fixtureA.lineItems), 4296.78));
check("A every ordinary line reaches Pricing", adoptedA.length === included(fixtureA.lineItems).length && adoptedA.length >= 2);
check("A Pricing keeps the section id and scope key", adoptedA.every((row) => row.scopeKey?.startsWith("cladding:c1:north:")));
check("A Pricing keeps physical quantity and unit", adoptedA.some((row) => row.unit === "lm" && (row.quantity ?? 0) > 190));
check("A adoption does not mutate facts or rates", JSON.stringify([north]) === beforeFacts && baseContext.rates.length === beforeRates);
const proofA = moneyProof(4296.78);
check("A shared sell is $5,370.98", close(proofA.sell, 5370.98) && close(sellOf(fixtureA.lineItems), 5370.98));
check("A GST is $805.65 and incl GST is $6,176.63", close(proofA.totals.gstAmount, 805.65) && close(proofA.totals.totalInclGst, 6176.63) && close(proofA.quote.totalInclGst, 6176.63));
check("A 25% margin changes sell only", close(moneyProof(4296.78, 25).sell, deriveSellFromCost(4296.78, 25)) && moneyProof(4296.78, 25).sell !== proofA.sell && close(costOf(fixtureA.lineItems), 4296.78));
check("default GST rate is 15", DEFAULT_GST_RATE === 15);

const fixtureB = estimateOf([south]);
const proofB = moneyProof(3506.67);
check("B hosted COST stays $3,506.67", close(costOf(fixtureB.lineItems), 3506.67));
check("B shared sell, GST and incl GST match", close(proofB.sell, 4383.34) && close(sellOf(fixtureB.lineItems), 4383.34) && close(proofB.totals.gstAmount, 657.5) && close(proofB.totals.totalInclGst, 5040.84));

const fixtureC = estimateOf([entry]);
const proofC = moneyProof(2247.27);
check("C hosted COST stays $2,247.27", close(costOf(fixtureC.lineItems), 2247.27));
check("C shared sell, GST and incl GST match", close(proofC.sell, 2809.09) && close(sellOf(fixtureC.lineItems), 2809.09) && close(proofC.totals.gstAmount, 421.36) && close(proofC.totals.totalInclGst, 3230.45));

const fixtureD = estimateOf([garage]);
const proofD = moneyProof(1589.28);
check("D hosted COST stays $1,589.28", close(costOf(fixtureD.lineItems), 1589.28));
check("D shared sell, GST and incl GST match", close(proofD.sell, 1986.6) && close(sellOf(fixtureD.lineItems), 1986.6) && close(proofD.totals.gstAmount, 297.99) && close(proofD.totals.totalInclGst, 2284.59));
check("D sheet equivalent adds no Pricing cost", !included(fixtureD.lineItems).some((row) => (row.componentKey ?? "").includes("sheet_equivalent")));

const fixtureE = estimateOf([replace]);
const proofE = moneyProof(2310.54);
const sharedLineSellE = sellOf(fixtureE.lineItems);
check("E hosted COST stays $2,310.54", close(costOf(fixtureE.lineItems), 2310.54));
check("E total-level shared sell is $2,888.18", close(proofE.sell, 2888.18) && close(proofE.totals.gstAmount, 433.23) && close(proofE.totals.totalInclGst, 3321.41));
check("E Pricing sell is the sum of shared line sells", close(sharedLineSellE, round2(included(fixtureE.lineItems).reduce((sum, row) => sum + deriveSellFromCost(row.recommendedCost ?? 0, 20), 0))));

const quoteA = quoteOf([north], fixtureA);
check("bevelback quote names the elevation and weatherboards", quoteA.includes("North elevation:") && quoteA.includes("Supply and install 30 m² of horizontal timber bevelback cladding using 187 × 18 mm weatherboards."));
check("bevelback quote hides lineal metres and cover", !quoteA.includes("lm") && !quoteA.includes("155"));
const quoteRustic = quoteOf([rustic], estimateOf([rustic]));
check("rusticated quote uses the profile size", quoteRustic.includes("timber rusticated cladding using 135 × 18 mm weatherboards"));
const quoteSouth = quoteOf([south], fixtureB);
check("fibre-cement quote uses the face width", quoteSouth.includes("Supply and install 20 m² of horizontal 180 mm fibre-cement weatherboard cladding."));
const quoteEntry = quoteOf([entry], fixtureC);
check("shiplap quote is vertical", quoteEntry.includes("Supply and install 12 m² of vertical timber shiplap cladding using 135 × 21 mm boards."));
const quoteGarage = quoteOf([garage], fixtureD);
check("board-and-batten quote separates board and battens", quoteGarage.includes("14.4 m² of timber board-and-batten cladding, comprising sheet-board cladding and 65 × 19 mm vertical battens."));
check("board-and-batten quote hides sheet equivalent and joints", !/sheet equivalent|column|joint/i.test(quoteGarage));
const quoteReplace = quoteOf([replace], fixtureE);
check("replace quote claims removal and new cladding", quoteReplace.includes("Remove the existing cladding and supply and install 12 m²"));
const quoteRemoval = quoteOf([removal], estimateOf([removal]));
check("removal-only quote does not claim new supply", quoteRemoval.includes("Remove the existing timber bevelback cladding from the selected area.") && !quoteRemoval.includes("Supply and install"));
check("removal quote states the exclusion", quoteRemoval.includes(CLADDING_QUOTE_REMOVAL_EXCLUSIONS) && !/disposal is included|scaffold is included/i.test(quoteRemoval));

const withCavity = portion({ id: "north", label: "North elevation", cavity_included: true, wall_underlay_or_rab_included: true, trims_flashings_corners_included: true });
const cavityEstimate = estimateOf([withCavity]);
const unpricedAccessories = quoteOf([withCavity], cavityEstimate);
check("ordinary new cavity is included", unpricedAccessories.includes("Includes a drained cavity") && !unpricedAccessories.includes("drained-cavity construction"));
check("unpriced underlay does not name a product", unpricedAccessories.includes("pending selection and pricing") && !/building paper|synthetic wrap/i.test(unpricedAccessories));
check("unpriced trims stay pending", unpricedAccessories.includes(CLADDING_QUOTE_TRIMS_PENDING));
const pricedAccessories = quoteOf([withCavity], cavityEstimate, [
  { label: "Drained cavity", component_key: "cladding.cavity.unresolved.m2", nested_item_id: "north", cost_known: true, total_cost: 400, total_sell: 500, notes_internal: null },
  { label: "Underlay", component_key: "cladding.underlay_or_rab.unresolved.m2", nested_item_id: "north", cost_known: true, total_cost: 200, total_sell: 250, notes_internal: null },
]);
check("priced cavity and underlay are included", pricedAccessories.includes("Includes a drained cavity system to the selected cladding area.") && pricedAccessories.includes("Includes the specified wall-underlay or rigid-air-barrier system."));
check("priced cavity is not also excluded", !pricedAccessories.includes("drained-cavity construction"));
check("ordinary cladding still prices beside an unpriced accessory", close(costOf(cavityEstimate.lineItems.filter((row) => !String(row.componentKey).includes("cavity") && !String(row.componentKey).includes("wall_underlay"))), 4296.78));

const cavityLine = cavityEstimate.lineItems.find((row) => row.componentKey === "cladding.underlay_or_rab.unresolved.m2") ?? null;
const trimsLine = cavityEstimate.lineItems.find((row) => row.componentKey === "cladding.trims_flashings_corners.unresolved") ?? null;
check("unselected wall preparation stays manually priceable", evaluateManualPricingEligibility(cavityLine).ok && claddingLineIsManualPricingEligible(cavityLine ?? {}));
check("trims without a quantity are not manually priceable", !evaluateManualPricingEligibility(trimsLine).ok);
const projected = projectEligibleUnresolvedPricingItems({
  items: [],
  estimateLines: cavityEstimate.lineItems,
  orgId: "org",
  projectId: "p1",
  pricingDocumentId: "pd",
});
const projectedAgain = projectEligibleUnresolvedPricingItems({
  items: projected,
  estimateLines: cavityEstimate.lineItems,
  orgId: "org",
  projectId: "p1",
  pricingDocumentId: "pd",
});
check("manual promotion inserts the unresolved wall-preparation layer", projected.some((row) => row.component_key === "cladding.underlay_or_rab.unresolved.m2" && row.project_id === "p1" && row.org_id === "org") && !projected.some((row) => row.component_key === "cladding.cavity.timber_batten.m2"));
check("refresh is idempotent", projectedAgain.length === 0);
const manualMoney = computeManualPromotionMoney({ totalCost: 400, quantity: 30, unit: "m2", itemType: "material", marginPercent: 20 });
check("manual COST uses shared margin", manualMoney.ok && close(manualMoney.ok ? manualMoney.fields.totalSell : 0, deriveSellFromCost(400, 20)));
const zeroManual = computeManualPromotionMoney({ totalCost: 0, quantity: 30, unit: "m2", itemType: "material", marginPercent: 20 });
check("zero manual COST does not become a known inclusion", zeroManual.ok && zeroManual.fields.totalCost === 0 && zeroManual.costKnown === false);
const cleared = quoteOf([withCavity], cavityEstimate, [
  { label: "Drained cavity", component_key: "cladding.cavity.unresolved.m2", nested_item_id: "north", cost_known: false, total_cost: 0, total_sell: 0, notes_internal: null },
]);
check("clearing an unresolved layer restores pending selection", cleared.includes("pending selection") );

const second = portion({ id: "south-cavity", label: "South elevation", direct_area_m2: 20, cavity_included: true });
const twoCavities = estimateOf([withCavity, second]);
const onlyNorth = quoteOf([withCavity, second], twoCavities, [
  { label: "Drained cavity", component_key: "cladding.cavity.unresolved.m2", nested_item_id: "north", cost_known: true, total_cost: 400, total_sell: 500, notes_internal: null },
]);
check("each section keeps its own cavity inclusion", onlyNorth.includes("North elevation:") && onlyNorth.includes("South elevation:") && onlyNorth.split("Includes a drained cavity").length >= 3);
check("manual pricing creates no company rate", baseContext.rates.length === 0);

const custom = portion({
  id: "feature",
  label: "Feature wall",
  cladding_family: "other",
  cladding_system: "specialist_unresolved",
  approved_profile_id: null,
  specialist_kind: "custom_profile",
  effective_cover_mm: 120,
  effective_cover_authority: "user",
  direct_area_m2: 18,
  other_description: "Proprietary vertical profile",
});
const customEstimate = estimateOf([custom]);
const customQuote = quoteOf([custom], customEstimate);
check("unpriced custom stays excluded", customQuote.includes(CLADDING_QUOTE_CUSTOM_PENDING));
const supplyOnly = quoteOf([custom], customEstimate, [
  { label: "Custom cladding", component_key: "cladding.custom.weatherboard.informational.lm", nested_item_id: "feature", cost_known: true, total_cost: 900, total_sell: 1100, notes_internal: null },
]);
check("priced custom supply does not claim installation", supplyOnly.includes("Supply of Proprietary vertical profile") && supplyOnly.includes("installation is excluded"));
const installOnly = quoteOf([custom], customEstimate, [
  { label: "Custom install", component_key: "cladding.custom.install.hours_per_lm", nested_item_id: "feature", cost_known: true, total_cost: 700, total_sell: 800, notes_internal: null },
]);
check("priced custom installation does not claim supply", installOnly.includes("Installation of the specified owner-selected cladding is included") && installOnly.includes("material supply is excluded"));
const bothCustom = quoteOf([custom], customEstimate, [
  { label: "Custom cladding", component_key: "cladding.custom.weatherboard.informational.lm", nested_item_id: "feature", cost_known: true, total_cost: 900, total_sell: 1100, notes_internal: null },
  { label: "Custom install", component_key: "cladding.custom.install.hours_per_lm", nested_item_id: "feature", cost_known: true, total_cost: 700, total_sell: 800, notes_internal: null },
]);
check("priced custom supply and installation uses the description", bothCustom.includes("Supply and install 18 m² of Proprietary vertical profile."));

const brick = portion({
  id: "brick",
  label: "Lower elevation",
  cladding_family: "brick_veneer",
  cladding_system: "specialist_unresolved",
  approved_profile_id: null,
  effective_cover_mm: null,
  direct_area_m2: 25,
  other_description: "Recycled brick veneer",
});
const brickEstimate = estimateOf([north, brick]);
const brickQuote = quoteOf([north, brick], brickEstimate);
check("unpriced brick stays specialist pending", brickQuote.includes("Brick veneer cladding is excluded pending final specification and pricing.") && !brickQuote.includes("brick_veneer"));
const brickPriced = quoteOf([north, brick], brickEstimate, [
  { label: "Brick", component_key: "cladding.specialist.brick_veneer", nested_item_id: "brick", cost_known: true, total_cost: 5000, total_sell: 6000, notes_internal: null },
]);
check("priced brick uses the specialist sentence and keeps the sibling", brickPriced.includes("Supply and install 25 m² of the specified brick veneer cladding, subject to final product selection and confirmed construction details.") && brickPriced.includes("187 × 18 mm") && !brickPriced.includes("brick_veneer"));

const gap = portion({ id: "gap", label: "South elevation", direct_area_m2: null, area_method: null });
const mixed = quoteOf([north, gap], estimateOf([north, gap]));
check("complete sibling stays and incomplete is omitted from included scope", mixed.includes("187 × 18 mm") && mixed.includes(CLADDING_QUOTE_INCOMPLETE_SIBLING) && !mixed.includes("$0"));
check("all incomplete sections use the pending sentence", quoteOf([gap]).includes(CLADDING_QUOTE_INCOMPLETE_ONLY));
check("incomplete scope is not manually priceable", !estimateOf([gap]).lineItems.some((row) => evaluateManualPricingEligibility(row).ok));

const secret = `${quoteA} ${quoteGarage} ${quoteReplace}`;
for (const token of ["$", "h/", "hours_per", "labour.carpenter", "benchmark", "Pricing Required", "COMPLETE_PHYSICAL", "cladding.section:", "margin", "effective cover", "sheet equivalent"]) {
  check(`client quote hides ${token}`, !secret.toLowerCase().includes(token.toLowerCase()));
}
const bothSections = quoteOf([north, entry], estimateOf([north, entry]));
check("two sections stay separate", bothSections.includes("North elevation:") && bothSections.includes("Entry feature:") && bothSections.indexOf("North elevation:") < bothSections.indexOf("Entry feature:"));
check("labels are not collapsed", bothSections.includes("bevelback") && bothSections.includes("shiplap"));

const painted = classifyCladdingOwnership("paint new weatherboards and install cladding");
check("painting coexists without cladding painting money", painted.claddingPresent && painted.paintingCoexists && !quoteA.toLowerCase().includes("paint is included"));
check("cladding quote keeps painting ownership", quoteA.includes(CLADDING_QUOTE_PAINTING));
const demo = classifyCladdingOwnership("strip out the house including cladding removal");
const connected = classifyCladdingOwnership("strip out and install new weatherboards");
check("wider demolition stays out of Cladding and connected removal stays in", demo.widerDemolitionOwnsPackage && !demo.claddingPresent && connected.claddingPresent);
check("windows do not create Doors or Internal Walls", (() => {
  const windows = classifyCladdingOwnership("replace windows while recladding");
  return windows.claddingPresent && !windows.unrelatedWorkAreas.includes("doors") && !windows.unrelatedWorkAreas.includes("internal_walls");
})());
check("bathroom location does not create Bathroom", classifyCladdingOwnership("install timber cladding in the bathroom").unrelatedWorkAreas.length === 0);
check("Doors and Flooring remain frozen", DOORS_V1_HUMAN_QA_FROZEN === true && FLOORING_V1_HUMAN_QA_FROZEN === true && CLADDING_V1_HUMAN_QA_FROZEN === false);

const scanned = [
  "lib/estimate/cladding-quote.ts",
  "lib/estimate/cladding-commercial.ts",
  "lib/estimate/calculators/cladding.ts",
].map((path) => readFileSync(path, "utf8")).join("\n");
for (const token of ["CCS-035", "CCS-047", "scope.cladding.m2", "painting.material", "demolition.", "sheet.plasterboard", "retaining_wall.masonry"]) {
  check(`quote path does not reuse ${token}`, !scanned.includes(token));
}
check("quote path does not invent waste, scaffold money or disposal money", !/waste allowance|scaffold lump|disposal charge/i.test(scanned));
check("zero-dollar cladding lines stay off the client quote", mapPricingItemsToQuoteItems([
  { id: "z", org_id: "org", pricing_document_id: "pd", project_id: "p1", work_area_id: "c1", source_estimate_line_item_id: null, component_key: "cladding.cavity.unresolved.m2", item_type: "material", delivery_method: "in_house", internal_label: "Cavity", client_label: "Cavity", internal_description: null, client_description: null, quantity: 30, unit: "m2", unit_cost: 0, unit_sell: 0, total_cost: 0, total_sell: 0, gross_profit: 0, margin_percent: 0, markup_percent: 0, visible_on_quote: true, optional: false, sort_order: 1, notes_internal: null, notes_client: null, created_at: "", updated_at: "", manually_edited: false, orphaned: false, recalibration_note: null, calculation_mode: "lump_sum", productivity_rate: null, productivity_unit: null, calculated_quantity: null, cost_known: false } as PricingItem,
], new Map()).length === 0);

const openings = portion({ id: "open", label: "North elevation", openings_already_deducted: false, opening_area_m2: 2, direct_area_m2: 30 });
const openingQuote = quoteOf([openings], estimateOf([openings]));
check("opening disclosure is client-safe", openingQuote.includes(CLADDING_QUOTE_OPENINGS) && !openingQuote.includes("opening_area"));
check("scaffold exclusion is shared once", quoteA.includes(CLADDING_QUOTE_SCAFFOLD) && quoteA.split(CLADDING_QUOTE_SCAFFOLD).length === 2);
const coverage = verifyRegisteredWorkAreaBenchmarkCoverage("cladding");
check("Pricing and Quote resolve and human QA stays open", coverage.ok && workAreaMayCloseAtL5(coverage) && CLADDING_V1_HUMAN_QA_FROZEN === false && coverage.resolves.some((row) => row.component === "Client Quote"));
check("E per-line sell sums to $2,888.17 under shared rounding", close(sharedLineSellE, 2888.17));
check("quote does not claim weathertightness or consent", !/weathertight|consent compliance|structural adequacy/i.test(quoteA));
check("identical sections keep separate scope keys", new Set(adopt(estimateOf([north, portion({ ...north, id: "north-2", label: "North elevation" })])).map((row) => row.scopeKey)).size >= 4);
check("masonry stays specialist until priced", quoteOf([portion({ id: "masonry", label: "Side wall", cladding_family: "masonry", cladding_system: "specialist_unresolved", approved_profile_id: null, effective_cover_mm: null, direct_area_m2: 10, other_description: "Cut stone veneer" })]).includes(CLADDING_QUOTE_SPECIALIST_PENDING));
check("no generic cladding lump reaches Pricing", adoptedA.every((row) => row.scopeKey !== "scope.cladding.m2"));
check("cladding estimate lines are not painting lines", fixtureA.lineItems.every((row) => !/paint/i.test(row.componentKey ?? "")));

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
