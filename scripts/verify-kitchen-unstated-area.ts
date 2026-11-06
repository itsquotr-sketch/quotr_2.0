/**
 * Kitchen pricing boundary.
 * Run: npx tsx scripts/verify-kitchen-unstated-area.ts
 *
 * 1. "Replace the kitchen."
 * 2. "Replace the kitchen. The room is 12 m²."
 * 3. "Include a splashback."
 *
 * Before this boundary, on b5d4957d:
 * 1. No line. Missing area. No 10 m².
 * 2. Labour 12 m², $11,520 cost / $14,400 sell, in the known total.
 *    Materials $20,000 cost / $30,000 sell, in the known total.
 * 3. Splashback allowance $800 cost / $1,200 sell, note "Approx. 3 m²".
 */
import { KITCHEN_BENCHMARKS } from "../lib/estimate/benchmark-rates";
import {
  calculateKitchen,
  KITCHEN_PACKAGE_CHOICE_NOTE,
  KITCHEN_REPLACEMENT_VISIBLE,
  KITCHEN_SPLASHBACK_LUMP_BASIS,
  kitchenPackageLabourCoverage,
  kitchenPackageMaterialsCoverage,
  kitchenSplashbackMeasuredBasis,
} from "../lib/estimate/calculators/kitchen";
import { SCOPE_CATALOGUE } from "../lib/scopes/catalogue";
import type {
  EstimateContext,
  EstimateFact,
  EstimateWorkArea,
} from "../lib/estimate/types";
import { composeBuilderReview, lineVisibleInEstimateReview } from "../lib/assistant/builder-review/compose";
import { presentEstimateWorkAreaTotals } from "../lib/estimate/presentation-breakdown";
import { readFileSync } from "node:fs";
import { buildWorkAreaQuoteDescriptionDraft } from "../lib/work-areas/quote-description";

const workArea = {
  id: "k1",
  type: "kitchen",
  name: "Kitchen",
  sort_order: 1,
  status: "confirmed",
} as EstimateWorkArea;

function context(facts: EstimateFact[]): EstimateContext {
  return {
    project: { id: "p1", qualityLevel: "standard" },
    confirmedWorkAreas: [workArea],
    facts,
    constraints: [],
    organisationSettings: {
      allow_benchmark_rates: true,
      default_margin_percent: 20,
      budget_rate_factor: 0.9,
    },
    materialWastageSettings: {
      deckingWastagePercent: 10,
      defaultMaterialWastagePercent: 10,
    },
    rates: [],
  } as unknown as EstimateContext;
}

function fact(key: string, value: unknown): EstimateFact {
  return { key, work_area_id: "k1", value };
}

let failed = 0;
function check(name: string, ok: boolean) {
  console.log(`${ok ? "PASS" : "FAIL"} ${name}`);
  if (!ok) failed += 1;
}

function knownSell(items: { includedInTotal?: boolean; recommendedSell?: number | null }[]) {
  return items
    .filter((item) => item.includedInTotal !== false)
    .reduce((sum, item) => sum + (item.recommendedSell ?? 0), 0);
}

const catalogue = SCOPE_CATALOGUE.find((item) => item.type === "kitchen");
check(
  "catalogue does not promise cabinetry and trade allowances",
  catalogue?.description ===
    "Kitchen renovation. A stated area and a stated component can be priced. Unstated area, cabinetry, and trade work stay unresolved."
);

const replace = calculateKitchen(context([]), workArea);
const replaceQuote = buildWorkAreaQuoteDescriptionDraft({
  type: "kitchen",
  name: "Kitchen",
  facts: [],
});
const replacement = replace.lineItems.find((item) => item.label === "Kitchen replacement");
check("1 request stays visible", replacement?.notes === KITCHEN_REPLACEMENT_VISIBLE);
check(
  "1 request stays visible in the estimate review",
  replacement != null && lineVisibleInEstimateReview(replacement)
);
const replaceReview = composeBuilderReview({
  estimate: {
    recommendedCost: 0,
    recommendedSell: 0,
    marginPercent: 0,
    confidence: 0,
    assumptions: replace.assumptions,
    missingInfo: replace.missingInfo,
    lineItems: replace.lineItems,
  },
  workAreas: [{ id: "k1", name: "Kitchen", type: "kitchen", status: "confirmed" }],
});
const replaceGroup = replaceReview.workAreas.find((area) => area.workAreaName === "Kitchen");
check(
  "1 review group lists the request outside the known total",
  replaceGroup?.sell === 0 &&
    replaceGroup.categories.some((category) =>
      category.lines.some((line) => line.label === "Kitchen replacement")
    ) &&
    replaceGroup.categories.every((category) => category.cost === 0)
);
check("1 request stays out of the known total", replacement?.includedInTotal === false && knownSell(replace.lineItems) === 0);
check(
  "1 asks for the area and the scope choice",
  replace.missingInfo.includes("Kitchen area not confirmed") &&
    replace.missingInfo.includes("Kitchen scope not confirmed") &&
    replace.missingInfo.includes("Cabinetry scope not confirmed") &&
    replace.missingInfo.includes("Benchtop scope not confirmed") &&
    replace.missingInfo.includes("Plumbing scope not confirmed") &&
    replace.missingInfo.includes("Electrical scope not confirmed")
);
check(
  "1 does not invent 10 m²",
  !replace.lineItems.some((item) => item.quantity === 10) &&
    !replace.assumptions.some((row) => /10 m²/.test(row))
);
check(
  "1 client text does not name unstated cabinetry, benchtop, or appliances",
  !/cabinetry|benchtop|appliance/i.test(replaceQuote)
);

const stated = calculateKitchen(context([fact("kitchen.area_m2", 12)]), workArea);
const labour = stated.lineItems.find((item) => item.label === "Kitchen labour");
const materials = stated.lineItems.find(
  (item) => item.label === "Kitchen materials/finishes allowance"
);
const statedQuote = buildWorkAreaQuoteDescriptionDraft({
  type: "kitchen",
  name: "Kitchen",
  facts: [{ key: "kitchen.area_m2", value: "12" }],
});
check(
  "2 keeps the stated 12 m² on the labour line",
  labour?.quantity === 12 && labour.recommendedCost === 11520 && labour.recommendedSell === 14400
);
check(
  "2 shows the existing materials package",
  materials?.recommendedCost === KITCHEN_BENCHMARKS.minimumPackage.cost &&
    materials.recommendedSell === KITCHEN_BENCHMARKS.minimumPackage.sell &&
    (materials.notes ?? "").includes(
      kitchenPackageMaterialsCoverage(12, 20000, 30000)
    ) &&
    (labour?.notes ?? "").includes(kitchenPackageLabourCoverage(12, 16))
);
check(
  "2 package waits for an explicit scope choice",
  labour?.includedInTotal === false &&
    materials?.includedInTotal === false &&
    knownSell(stated.lineItems) === 0 &&
    (labour?.notes ?? "").includes(KITCHEN_PACKAGE_CHOICE_NOTE) &&
    stated.missingInfo.includes("Kitchen scope not confirmed") &&
    !stated.missingInfo.includes("Kitchen area not confirmed") &&
    labour != null &&
    materials != null &&
    lineVisibleInEstimateReview(labour) &&
    lineVisibleInEstimateReview(materials) &&
    presentEstimateWorkAreaTotals(stated.lineItems).every((area) => area.sell === 0)
);
const statedReview = composeBuilderReview({
  estimate: {
    recommendedCost: 0,
    recommendedSell: 0,
    marginPercent: 0,
    confidence: 0,
    assumptions: stated.assumptions,
    missingInfo: stated.missingInfo,
    lineItems: stated.lineItems,
  },
  workAreas: [{ id: "k1", name: "Kitchen", type: "kitchen", status: "confirmed" }],
});
const statedGroup = statedReview.workAreas.find((area) => area.workAreaName === "Kitchen");
check(
  "2 review group lists the package outside the known total",
  statedGroup?.sell === 0 &&
    statedGroup.categories.some((category) =>
      category.lines.some((line) => line.label === "Kitchen labour")
    ) &&
    statedGroup.categories.some((category) =>
      category.lines.some((line) => line.label === "Kitchen materials/finishes allowance")
    ) &&
    statedGroup.categories.every((category) => category.cost === 0)
);
check(
  "2 breakdown lists the held lines without adding them to the total",
  readFileSync("components/assistant/EstimateBreakdownModal.tsx", "utf8").includes(
    "breakdownDisplayItems"
  ) &&
    readFileSync("components/assistant/EstimateBreakdownModal.tsx", "utf8").includes(
      "kitchenHeldLineVisible"
    )
);
check(
  "2 client text keeps the area and omits unstated components",
  /12 m²/.test(statedQuote) && !/cabinetry|benchtop|appliance/i.test(statedQuote)
);

const chosen = calculateKitchen(
  context([
    fact("kitchen.area_m2", 12),
    fact("kitchen.renovation_type", "Full kitchen renovation"),
  ]),
  workArea
);
const chosenLabour = chosen.lineItems.find((item) => item.label === "Kitchen labour");
const chosenMaterials = chosen.lineItems.find(
  (item) => item.label === "Kitchen materials/finishes allowance"
);
check(
  "2 explicit package choice enters the known total",
  chosenLabour?.includedInTotal !== false &&
    chosenMaterials?.includedInTotal !== false &&
    chosenLabour?.quantity === 12 &&
    chosenLabour.recommendedSell === 14400 &&
    chosenMaterials?.recommendedSell === 30000 &&
    !chosen.missingInfo.includes("Kitchen scope not confirmed")
);

const demolition = calculateKitchen(
  context([fact("kitchen.demolition_required", true)]),
  workArea
);
const demolitionLine = demolition.lineItems.find((item) => item.label === "Demolition/strip-out");
check(
  "2 demolition with its own input prices, and the package does not",
  demolitionLine?.includedInTotal !== false &&
    (demolitionLine.recommendedSell ?? 0) > 0 &&
    !demolition.lineItems.some((item) => item.label === "Kitchen labour") &&
    !demolition.lineItems.some((item) => item.label === "Kitchen materials/finishes allowance") &&
    !demolition.lineItems.some((item) => item.quantity === 10)
);

const splash = calculateKitchen(context([fact("kitchen.splashback_included", true)]), workArea);
const splashLine = splash.lineItems.find((item) => item.label === "Splashback allowance");
const splashAt3 = calculateKitchen(
  context([
    fact("kitchen.splashback_included", true),
    fact("kitchen.splashback_area_m2", 3),
  ]),
  workArea
);
const splashAt8 = calculateKitchen(
  context([
    fact("kitchen.splashback_included", true),
    fact("kitchen.splashback_area_m2", 8),
  ]),
  workArea
);
const splash3 = splashAt3.lineItems.find((item) => item.label === "Splashback allowance");
const splash8 = splashAt8.lineItems.find((item) => item.label === "Splashback allowance");
const splashQuote = buildWorkAreaQuoteDescriptionDraft({
  type: "kitchen",
  name: "Kitchen",
  facts: [{ key: "kitchen.splashback_included", value: "true" }],
});
check(
  "3 the 3 m² default does not change the allowance money",
  splashLine?.recommendedCost === KITCHEN_BENCHMARKS.splashback.cost &&
    splashLine.recommendedSell === KITCHEN_BENCHMARKS.splashback.sell &&
    splash3?.recommendedCost === splashLine.recommendedCost &&
    splash3.recommendedSell === splashLine.recommendedSell &&
    splash8?.recommendedCost === splashLine.recommendedCost &&
    splash8.recommendedSell === splashLine.recommendedSell
);
check(
  "3 an unmeasured splashback does not show 3 m²",
  splashLine?.notes === KITCHEN_SPLASHBACK_LUMP_BASIS &&
    !/3 m²/.test(splashLine.notes ?? "") &&
    splash.missingInfo.includes("Splashback area not confirmed") &&
    !splash.lineItems.some((item) => item.label === "Kitchen replacement")
);
check(
  "3 a measured area is disclosed and does not multiply the lump",
  splash3?.notes === kitchenSplashbackMeasuredBasis(3) &&
    splash8?.notes === kitchenSplashbackMeasuredBasis(8)
);
check(
  "3 client text names the splashback and not an assumed area",
  /Splashback allowance is included where applicable/.test(splashQuote) &&
    !/3 m²/.test(splashQuote) &&
    !/cabinetry|benchtop|appliance/i.test(splashQuote)
);
function catalogueDescription(type: string): string | undefined {
  return SCOPE_CATALOGUE.find((item) => item.type === type)?.description;
}
check(
  "deck catalogue does not promise composite, stairs, balustrades, or pergolas",
  catalogueDescription("deck") ===
    "Measured timber decks. Composite, stairs, balustrades, and pergolas are not part of this price."
);
check(
  "bathroom catalogue does not promise fixtures or a whole bathroom",
  catalogueDescription("bathroom") ===
    "Stated bathroom removals, disposal, vanity installation, floor tiling, and painting. Fixtures and a whole-bathroom package stay unresolved."
);
check(
  "pergola, stairs, ceilings, and plaster do not claim a finished package",
  catalogueDescription("pergola") ===
    "Pergola questions only. No complete pergola price is claimed." &&
    catalogueDescription("external_stairs") ===
      "External stair components. A complete stair package is not claimed." &&
    catalogueDescription("ceilings") ===
      "Ceiling components. A finished ceiling package is not claimed." &&
    catalogueDescription("plastering") ===
      "Stopping and plaster components. A finished plaster package is not claimed."
);
check(
  "benchmark dollar values are unchanged",
  KITCHEN_BENCHMARKS.materialsPerM2.cost === 1500 &&
    KITCHEN_BENCHMARKS.materialsPerM2.sell === 2300 &&
    KITCHEN_BENCHMARKS.minimumPackage.cost === 20000 &&
    KITCHEN_BENCHMARKS.minimumPackage.sell === 30000 &&
    KITCHEN_BENCHMARKS.splashback.cost === 800 &&
    KITCHEN_BENCHMARKS.splashback.sell === 1200
);

if (failed > 0) {
  console.error(`${failed} failed`);
  process.exit(1);
}
console.log("kitchen pricing boundary passed");
