/**
 * Stage 3D — straight-lay carpet tiles on a ready substrate.
 *
 * Run: npx tsx scripts/verify-estimating-v3-stage-3d.ts
 */
import { formatUnitRate } from "../components/assistant/format";
import type { EstimateLineItem } from "../components/assistant/types";
import type { OrganisationRate } from "../components/setup/types";
import { toPricedLine } from "../lib/assistant/builder-review/compose";
import { calculateQuantityRate } from "../lib/commercial-engine/calculations/quantity-rate";
import { applyFlooringReviewGroups } from "../lib/assistant/builder-review/flooring-review-groups";
import { enrichExtractionFromBrief } from "../lib/ai/enrich-extraction";
import {
  projectLabourTakeoff,
  projectMaterialsTakeoff,
} from "../lib/assistant/presentation/estimate-takeoffs";
import {
  carpetTileSupplyArea,
  planCarpetTilePurchase,
} from "../lib/estimate/flooring-carpet-tile";
import { extractFlooringPortionsFromBrief } from "../lib/estimate/flooring-brief";
import {
  listFlooringClarifyCandidates,
  summariseFlooringPortion,
} from "../lib/estimate/flooring-clarify";
import { commercializeFlooring } from "../lib/estimate/flooring-commercial";
import { calculateFlooringPhysical } from "../lib/estimate/flooring-physical";
import { flooringPricingRecovery } from "../lib/estimate/flooring-pricing-recovery";
import { buildLineItemNotes } from "../lib/estimate/line-items";
import {
  FLOORING_PORTIONS_FACT_KEY,
  applyFlooringFactWrite,
  normalizeExtractedFlooringPortions,
  overlayUserAuthoritativeFlooringPortion,
  parseFlooringFinishType,
  resolveFlooringPortions,
  type FlooringPortion,
} from "../lib/estimate/flooring-portions";
import type { EstimateConstraint, EstimateFact, EstimateLineItemInput, EstimateWorkArea } from "../lib/estimate/types";
import { calculateAuthoritativeFieldsFromEstimateLine } from "../lib/pricing/estimate-to-pricing-adapter";
import type { PricingItem } from "../lib/pricing/types";
import { resolveQuoteUnitPrice } from "../lib/quotes/from-pricing";
import { getCatalogueEntry } from "../lib/rates/catalogue";
import { assertQuoteSnapshotMutable } from "../lib/quotes/transaction";
import { getAnalysisCapableWorkAreaTypes } from "../lib/scopes/capability";
import { STAGE_2A_OFFICE_FITOUT_BRIEF } from "./fixtures/stage-2a-original-briefs";

const FOCUSED =
  "Supply and install 120m² of modular carpet tiles, straight lay, on a ready substrate in the open plan. No removal, no preparation and no underlay.";
const PARAPHRASE =
  "Please supply and lay about 120 m2 of carpet tiles in the open office. The old floor is already gone. No underlay.";
const MIXED =
  "Supply and install 120m² of carpet tiles in a room measuring 12 m × 10000 mm. Straight lay on a ready substrate. No removal.";

const failures: string[] = [];
function check(name: string, ok: boolean, detail?: unknown): void {
  if (ok) {
    console.log(`ok ${name}`);
    return;
  }
  failures.push(name);
  console.error(`FAIL ${name}`, detail ?? "");
}

function rate(
  row: Partial<OrganisationRate> &
    Pick<OrganisationRate, "item_key" | "rate_type" | "cost_rate" | "unit">
): OrganisationRate {
  return {
    id: row.item_key + row.rate_type,
    trade: null,
    work_area_type: "flooring",
    label: row.item_key,
    sell_rate: null,
    markup_percent: null,
    active: true,
    ...row,
  };
}

const companyRates = [
  rate({ item_key: "flooring.carpet_tile.straight.supply.m2", rate_type: "material", cost_rate: 40, unit: "m2" }),
  rate({ item_key: "flooring.carpet_tile.adhesive.m2", rate_type: "material", cost_rate: 2.5, unit: "m2" }),
  rate({ item_key: "flooring.carpet_tile.straight.install.hours_per_m2", rate_type: "productivity", cost_rate: 0.15, unit: "m2" }),
  rate({ item_key: "labour.carpenter.hour", rate_type: "labour", cost_rate: 75, unit: "hour" }),
  rate({ item_key: "flooring.carpet_tile.straight.supply_install.m2", rate_type: "subcontractor", cost_rate: 55, unit: "m2" }),
];

function pricePortion(
  row: FlooringPortion,
  rates: OrganisationRate[],
  constraints: EstimateConstraint[] = []
) {
  const workArea = { id: "flooring", type: "flooring", name: "Flooring" } as EstimateWorkArea;
  const physical = calculateFlooringPhysical({
    facts: [
      {
        id: "fact-1",
        project_id: "project",
        work_area_id: "flooring",
        key: FLOORING_PORTIONS_FACT_KEY,
        value: [row],
        source: "user",
      },
    ] as EstimateFact[],
    workArea,
  });
  return commercializeFlooring({
    physical,
    workArea,
    rates,
    organisationSettings: null,
    constraints,
  });
}

function money(items: readonly EstimateLineItemInput[], field: "recommendedCost" | "recommendedSell"): number {
  return (
    Math.round(
      items
        .filter((item) => item.includedInTotal !== false)
        .reduce((sum, item) => sum + (item[field] ?? 0), 0) * 100
    ) / 100
  );
}

function line(items: readonly EstimateLineItemInput[], componentKey: string) {
  return items.find((item) => item.componentKey === componentKey);
}

check("unresolved waste does not become 132 m2", carpetTileSupplyArea(120, null) == null);
check("explicit zero waste stays 120 m2", carpetTileSupplyArea(120, 0) === 120);
check("confirmed 5% supply allowance is 126 m2", carpetTileSupplyArea(120, 5) === 126);
check("stated 10% supply allowance is 132 m2", carpetTileSupplyArea(120, 10) === 132);

const grid = planCarpetTilePurchase({
  netM2: 120,
  wastePercent: 5,
  tileWidthMm: 500,
  tileLengthMm: 500,
  roomLengthM: 12,
  roomWidthM: 10,
  boxCoverageM2: null,
  tilesPerBox: null,
});
check(
  "known room and tile size count the grid and do not stack the 5% allowance",
  grid?.tileCount === 480 && grid.unit === "tile" && grid.quantity === 480,
  grid
);
const boxes = planCarpetTilePurchase({
  netM2: 120,
  wastePercent: 5,
  tileWidthMm: null,
  tileLengthMm: null,
  roomLengthM: null,
  roomWidthM: null,
  boxCoverageM2: 20,
  tilesPerBox: null,
});
check("known box coverage purchases 7 boxes for 126 m2", boxes?.quantity === 7 && boxes.unit === "box", boxes);

const office = enrichExtractionFromBrief({
  briefText: STAGE_2A_OFFICE_FITOUT_BRIEF,
  extraction: {
    workAreas: [],
    facts: [],
    assumptions: [],
    possibleConstraints: [],
    confidence: 0.5,
    warnings: [],
  },
  allowedTypes: getAnalysisCapableWorkAreaTypes(),
});
const officeFloorFact = office.extraction.facts.find((row) => row.key === FLOORING_PORTIONS_FACT_KEY);
const officeFloor = normalizeExtractedFlooringPortions(officeFloorFact?.value)[0];
check(
  "office brief keeps 120 m2 carpet tiles and no removal",
  officeFloor?.specialist_kind === "carpet_tile" &&
    officeFloor.other_description === "carpet tiles" &&
    officeFloor.finish_type === "other" &&
    officeFloor.area_m2 === 120 &&
    officeFloor.finish_removal_required === false &&
    officeFloor.carpet_tile_waste == null &&
    officeFloor.waste_percent == null &&
    officeFloor.underlay_required !== true,
  {
    id: officeFloorFact?.work_area_id,
    floor: officeFloor,
    keys: office.extraction.facts.filter((row) => String(row.key).includes("floor")).map((row) => row.key),
  }
);
check(
  "office walls doors and skirting stay beside the flooring",
  office.extraction.workAreas.some((row) => row.type === "internal_walls") &&
    office.extraction.workAreas.some((row) => row.type === "doors") &&
    office.extraction.facts.some(
      (row) => row.key === "internal_walls.skirting_length_lm" && row.value === 45
    )
);
check(
  "preliminaries stay an unpriced coverage gap",
  /site establishment/.test(String(office.extraction.facts.find((row) => row.key === "internal_walls.coverage_note")?.value ?? ""))
);

const broadloom = extractFlooringPortionsFromBrief("Supply and install 40 m² of carpet with underlay.")[0];
check(
  "broadloom carpet is not a carpet tile",
  broadloom?.finish_type === "carpet" &&
    broadloom.specialist_kind == null &&
    parseFlooringFinishType("carpet tiles") === "other",
  broadloom
);

const focused = extractFlooringPortionsFromBrief(FOCUSED)[0];
check(
  "focused brief extracts straight lay and a ready substrate without inventing waste",
  focused?.specialist_kind === "carpet_tile" &&
    focused.area_m2 === 120 &&
    focused.carpet_tile_pattern === "straight" &&
    focused.carpet_tile_pattern_authority === "extracted" &&
    focused.carpet_tile_substrate === "ready" &&
    focused.carpet_tile_waste == null &&
    focused.underlay_required === false,
  focused
);
const paraphrased = extractFlooringPortionsFromBrief(PARAPHRASE)[0];
check(
  "a paraphrase stays carpet tiles at 120 m2 with waste unanswered",
  paraphrased?.specialist_kind === "carpet_tile" &&
    paraphrased.area_m2 === 120 &&
    paraphrased.carpet_tile_pattern == null &&
    paraphrased.carpet_tile_waste == null &&
    paraphrased.carpet_tile_pattern_authority == null &&
    paraphrased.carpet_tile_waste_authority == null,
  paraphrased
);
check(
  "an unanswered pattern and waste allowance stay unpriced",
  paraphrased != null &&
    pricePortion(paraphrased, companyRates).requirements.every((row) => row.priced === false) &&
    paraphrased.carpet_tile_pattern_authority !== "extracted" &&
    paraphrased.carpet_tile_waste_authority !== "extracted"
);
const assumptionFacts = [
  applyFlooringFactWrite({
    facts: [
      {
        id: "assumption",
        project_id: "project",
        work_area_id: "flooring",
        key: FLOORING_PORTIONS_FACT_KEY,
        value: [paraphrased],
        source: "user",
      },
    ],
    workAreaId: "flooring",
    key: "flooring.portion.carpet_tile_pattern",
    value: "Straight lay",
    nestedItemId: paraphrased?.id,
  }),
].flatMap((facts) => facts);
const confirmedFacts = applyFlooringFactWrite({
  facts: assumptionFacts,
  workAreaId: "flooring",
  key: "flooring.portion.carpet_tile_waste",
  value: "Use proposed 5% supply allowance",
  nestedItemId: paraphrased?.id,
});
const confirmed = resolveFlooringPortions({
  facts: confirmedFacts,
  workAreaId: "flooring",
}).portions[0];
const confirmedAgain = resolveFlooringPortions({
  facts: confirmedFacts,
  workAreaId: "flooring",
}).portions[0];
const reextracted = confirmed
  ? overlayUserAuthoritativeFlooringPortion(
      extractFlooringPortionsFromBrief(PARAPHRASE)[0]!,
      confirmed
    )
  : null;
const confirmedSummary = confirmed ? summariseFlooringPortion(confirmed, 0).summary : "";
const reaffirmed = resolveFlooringPortions({
  facts: applyFlooringFactWrite({
    facts: [
      {
        id: "extracted-pattern",
        project_id: "project",
        work_area_id: "flooring",
        key: FLOORING_PORTIONS_FACT_KEY,
        value: [focused],
        source: "user",
      },
    ],
    workAreaId: "flooring",
    key: "flooring.portion.carpet_tile_pattern",
    value: "Straight lay",
    nestedItemId: focused?.id,
  }),
  workAreaId: "flooring",
}).portions[0];
check(
  "restating an extracted straight lay does not turn it into an assumption",
  reaffirmed?.carpet_tile_pattern === "straight" &&
    reaffirmed.carpet_tile_pattern_authority === "extracted",
  reaffirmed
);
check(
  "confirming the proposals keeps them reviewable assumptions",
  confirmed?.carpet_tile_pattern === "straight" &&
    confirmed.carpet_tile_pattern_authority === "assumed_disclosed" &&
    confirmed.carpet_tile_waste === "proposed" &&
    confirmed.carpet_tile_waste_authority === "assumed_disclosed" &&
    confirmed.waste_percent === 5 &&
    confirmedAgain?.carpet_tile_pattern_authority === "assumed_disclosed" &&
    confirmedAgain.carpet_tile_waste_authority === "assumed_disclosed" &&
    reextracted?.carpet_tile_pattern === "straight" &&
    reextracted.carpet_tile_pattern_authority === "assumed_disclosed" &&
    reextracted.carpet_tile_waste === "proposed" &&
    reextracted.carpet_tile_waste_authority === "assumed_disclosed" &&
    reextracted.waste_percent === 5 &&
    confirmedSummary.includes("straight lay assumption") &&
    confirmedSummary.includes("5% supply allowance assumption") &&
    confirmed.carpet_tile_pattern_authority !== "extracted",
  { confirmed, reextracted, confirmedSummary }
);
const mixed = extractFlooringPortionsFromBrief(MIXED)[0];
check(
  "mixed units keep 120 m2, 12 m by 10 m, and extracted straight lay",
  mixed?.area_m2 === 120 && mixed.length_m === 12 && mixed.width_m === 10 && mixed.carpet_tile_pattern === "straight",
  mixed
);

const herringbone = extractFlooringPortionsFromBrief(
  "Supply and install 18 m² of herringbone carpet tiles in the meeting room."
)[0];
check(
  "another pattern stays visible and unpriced",
  herringbone?.carpet_tile_pattern === "other" &&
    money(pricePortion(herringbone!, companyRates).lineItems, "recommendedSell") === 0,
  herringbone
);

let facts: EstimateFact[] = [
  {
    id: "portions",
    project_id: "project",
    work_area_id: "flooring",
    key: FLOORING_PORTIONS_FACT_KEY,
    value: [focused],
    source: "user",
  },
];
function write(key: string, value: string, nestedItemId = focused?.id): void {
  facts = applyFlooringFactWrite({
    facts,
    workAreaId: "flooring",
    key,
    value,
    nestedItemId,
  });
}
function current(): FlooringPortion | undefined {
  return resolveFlooringPortions({ facts, workAreaId: "flooring" }).portions[0];
}
const firstQuestions = listFlooringClarifyCandidates({
  facts,
  workAreaId: "flooring",
  workAreaName: "Flooring",
});
check(
  "ready straight-lay tiles ask the waste allowance before a quantity is invented",
  firstQuestions.some((row) => row.factKey === "flooring.portion.carpet_tile_waste") &&
    firstQuestions.find((row) => row.factKey === "flooring.portion.carpet_tile_waste")?.question.includes("not converted to 132") === true,
  firstQuestions.map((row) => row.factKey)
);

write("flooring.portion.carpet_tile_waste", "Use proposed 5% supply allowance");
write("flooring.portion.carpet_tile_size", "Size unknown");
write("flooring.portion.carpet_tile_box", "Box coverage unknown");
write("flooring.portion.carpet_tile_fixing", "Pressure-sensitive adhesive");
write("flooring.portion.carpet_tile_supply", "Company supplies the tiles");
write("flooring.portion.finish_pricing", "Separate finish supply and installation");
const answered = current();
check(
  "the 5% allowance is a disclosed assumption",
  answered?.carpet_tile_waste === "proposed" &&
    answered.carpet_tile_waste_authority === "assumed_disclosed" &&
    answered.waste_percent === 5,
  answered
);

const unresolved = pricePortion(
  { ...focused!, carpet_tile_pattern: "straight", carpet_tile_substrate: "ready" },
  companyRates
);
check(
  "unresolved waste is not priced as 120 m2 or 132 m2",
  unresolved.requirements.every((row) => row.priced === false) &&
    money(unresolved.lineItems, "recommendedSell") === 0,
  unresolved.lineItems.map((row) => ({ key: row.componentKey, sell: row.recommendedSell }))
);

const needsPreparation = pricePortion(
  { ...answered!, carpet_tile_substrate: "preparation" },
  companyRates
);
const preparationPricing = needsPreparation.lineItems.map((item) =>
  calculateAuthoritativeFieldsFromEstimateLine({
    category: item.category,
    recommended_cost: item.recommendedCost ?? null,
    recommended_sell: item.recommendedSell ?? null,
    notes: buildLineItemNotes(item),
  })
);
check(
  "needs preparation keeps the finish and the preparation as separate unpriced gaps",
  needsPreparation.lineItems.some((item) => item.label.includes("carpet tiles")) &&
    needsPreparation.lineItems.some((item) => item.label.includes("floor preparation")) &&
    !needsPreparation.lineItems.some(
      (item) => item.componentKey === "flooring.carpet_tile.straight.supply"
    ) &&
    !needsPreparation.lineItems.some(
      (item) => item.componentKey === "flooring.carpet_tile.fixing"
    ) &&
    !needsPreparation.lineItems.some(
      (item) => item.componentKey === "flooring.carpet_tile.straight.install"
    ) &&
    money(needsPreparation.lineItems, "recommendedSell") === 0 &&
    needsPreparation.missingInfo.some((row) => row.includes("carpet tiles")) &&
    needsPreparation.missingInfo.some((row) => row.includes("floor preparation")) &&
    preparationPricing.every(
      (row) => !row.ok || (row.fields.totalSell ?? 0) === 0
    ),
  needsPreparation.lineItems.map((item) => ({
    label: item.label,
    key: item.componentKey,
    sell: item.recommendedSell,
  }))
);

const priced = pricePortion(answered!, companyRates);
const supply = line(priced.lineItems, "flooring.carpet_tile.straight.supply");
const fixing = line(priced.lineItems, "flooring.carpet_tile.fixing");
const install = line(priced.lineItems, "flooring.carpet_tile.straight.install");
check("supply is 126 m2 at the company $40 rate", supply?.quantity === 126 && supply.recommendedCost === 5040 && supply.rateSourceType === "user_rate", supply);
check("adhesive stays on the net 120 m2", fixing?.quantity === 120 && fixing.recommendedCost === 300, fixing);
const adhesiveRate = calculateQuantityRate({
  mode: "quantity_rate",
  quantity: 120,
  unit: "m2",
  unit_cost: 2.5,
  unit_sell: null,
  target_gross_margin_percent: 20,
});
const smallAdhesiveRate = calculateQuantityRate({
  mode: "quantity_rate",
  quantity: 3,
  unit: "m2",
  unit_cost: 2.5,
  unit_sell: null,
  target_gross_margin_percent: 20,
});
const explicitAdhesiveRate = calculateQuantityRate({
  mode: "quantity_rate",
  quantity: 120,
  unit: "m2",
  unit_cost: 2.5,
  unit_sell: 4,
  target_gross_margin_percent: 20,
});
check(
  "a 20% margin rounds the $2.50 unit sell to $3.13 before extending 120 m2",
  adhesiveRate.outputs.unit_sell === 3.13 &&
    adhesiveRate.outputs.total_cost === 300 &&
    adhesiveRate.outputs.total_sell === 375.6 &&
    fixing?.recommendedSell === 375.6,
  { engine: adhesiveRate.outputs, estimateSell: fixing?.recommendedSell }
);
check(
  "three square metres distinguish unit-first sell from rounding the line cost",
  smallAdhesiveRate.outputs.total_cost === 7.5 && smallAdhesiveRate.outputs.total_sell === 9.39,
  smallAdhesiveRate.outputs
);
check(
  "a saved company sell rate is extended and is not replaced by the margin",
  explicitAdhesiveRate.outputs.unit_sell === 4 && explicitAdhesiveRate.outputs.total_sell === 480,
  explicitAdhesiveRate.outputs
);
const savedSell = pricePortion(answered!, [
  ...companyRates.filter((row) => row.item_key !== "flooring.carpet_tile.adhesive.m2"),
  rate({
    item_key: "flooring.carpet_tile.adhesive.m2",
    rate_type: "material",
    cost_rate: 2.5,
    sell_rate: 4,
    unit: "m2",
  }),
]);
const savedFixing = line(savedSell.lineItems, "flooring.carpet_tile.fixing");
check(
  "the estimate keeps an explicit adhesive sell rate",
  savedFixing?.recommendedCost === 300 && savedFixing.recommendedSell === 480,
  savedFixing
);
const smallArea = pricePortion(
  { ...answered!, area_m2: 3, carpet_tile_waste: "zero", waste_percent: null },
  companyRates
);
const smallFixing = line(smallArea.lineItems, "flooring.carpet_tile.fixing");
check(
  "the estimate extends the rounded unit sell on a small adhesive quantity",
  smallFixing?.quantity === 3 &&
    smallFixing.recommendedCost === 7.5 &&
    smallFixing.recommendedSell === 9.39,
  smallFixing
);
const pricingAdhesive = calculateAuthoritativeFieldsFromEstimateLine({
  category: "materials",
  recommended_cost: fixing?.recommendedCost ?? null,
  recommended_sell: fixing?.recommendedSell ?? null,
  notes: fixing ? buildLineItemNotes(fixing) : null,
});
const quoteUnit =
  pricingAdhesive.ok
    ? resolveQuoteUnitPrice({
        calculation_mode: pricingAdhesive.fields.calculationMode,
        quantity: 120,
        unit_cost: pricingAdhesive.fields.unitCost,
        unit_sell: pricingAdhesive.fields.unitSell,
        total_cost: pricingAdhesive.fields.totalCost,
        total_sell: pricingAdhesive.fields.totalSell,
        item_type: "material",
      } as PricingItem)
    : null;
check(
  "pricing and quote rendering keep the unit-first adhesive sell",
  pricingAdhesive.ok &&
    pricingAdhesive.fields.totalCost === 300 &&
    pricingAdhesive.fields.totalSell === 375.6 &&
    pricingAdhesive.fields.unitCost === 2.5 &&
    pricingAdhesive.fields.unitSell === 3.13 &&
    quoteUnit === 3.13,
  pricingAdhesive.ok ? { fields: pricingAdhesive.fields, quoteUnit } : pricingAdhesive
);
check(
  "installation is 18 hours and does not absorb the supply allowance",
  install?.quantity === 120 &&
    install.recommendedCost === 1350 &&
    install.identitySummary?.includes("120 m² × 0.15 person-hours/m² = 18 h") === true &&
    install.identitySummary.includes("$1,350") &&
    !install.identitySummary.includes("access/carry"),
  install?.identitySummary
);
const occupiedInstall = line(
  pricePortion(answered!, companyRates, [
    { key: "site_access", label: "Site access", value: "Easy" },
    { key: "material_carry_distance", label: "Carry", value: "Under 10 m" },
    { key: "occupied_site", label: "Occupied site", value: "Yes" },
    { key: "working_hours", label: "Working hours", value: "Yes" },
  ]).lineItems,
  "flooring.carpet_tile.straight.install"
);
check(
  "occupied site and restricted hours apply once to the 18 hour base",
  occupiedInstall?.labourHours === 19.8 &&
    occupiedInstall.recommendedCost === 1485 &&
    occupiedInstall.identitySummary?.includes("+5% occupied site") === true &&
    occupiedInstall.identitySummary.includes("+5% restricted hours/delivery windows") &&
    occupiedInstall.identitySummary.includes("19.8 h × $75/h = $1,485") &&
    !occupiedInstall.identitySummary.includes("access/carry"),
  occupiedInstall
);
check(
  "separate company rates total 6690 direct cost",
  money(priced.lineItems, "recommendedCost") === 6690 &&
    supply?.recommendedSell === 6300 &&
    install?.recommendedSell === 1687.5,
  priced.lineItems.map((row) => ({ key: row.componentKey, cost: row.recommendedCost, sell: row.recommendedSell }))
);
check(
  "no broadloom carpet key is used",
  priced.lineItems.every((row) => !String(row.itemKey ?? "").includes("flooring.carpet.m2")) &&
    getCatalogueEntry("flooring.carpet_tile.straight.supply.m2")?.defaultCostRate == null
);

const zeroWaste = pricePortion({ ...answered!, carpet_tile_waste: "zero", waste_percent: null }, companyRates);
check(
  "explicit zero waste supplies 120 m2 and keeps 18 installation hours",
  line(zeroWaste.lineItems, "flooring.carpet_tile.straight.supply")?.quantity === 120 &&
    line(zeroWaste.lineItems, "flooring.carpet_tile.straight.install")?.recommendedCost === 1350
);
const stated = pricePortion(
  { ...answered!, carpet_tile_waste: "stated", waste_percent: 10, carpet_tile_waste_authority: "extracted" },
  companyRates
);
check("an explicit 10% allowance supplies 132 m2", line(stated.lineItems, "flooring.carpet_tile.straight.supply")?.quantity === 132);

const customer = pricePortion({ ...answered!, finish_supplied_by: "customer" }, companyRates);
check(
  "customer-supplied tiles keep adhesive and installation",
  line(customer.lineItems, "flooring.carpet_tile.straight.supply")?.recommendedCost === 0 &&
    line(customer.lineItems, "flooring.carpet_tile.fixing")?.recommendedCost === 300 &&
    line(customer.lineItems, "flooring.carpet_tile.straight.install")?.recommendedCost === 1350 &&
    line(customer.lineItems, "flooring.carpet_tile.straight.supply_install.m2") == null
);

write("flooring.portion.finish_pricing", "Combined supply and installation package");
write("flooring.portion.waste_treatment", "Package rate covers the requested waste");
write("flooring.portion.carpet_tile_package_covers_fixing", "Package rate covers the fixing");
const packaged = pricePortion(current()!, companyRates);
check(
  "the confirmed package is one net-area charge",
  line(packaged.lineItems, "flooring.carpet_tile.straight.supply_install.m2")?.quantity === 120 &&
    line(packaged.lineItems, "flooring.carpet_tile.straight.supply_install.m2")?.recommendedCost === 6600 &&
    line(packaged.lineItems, "flooring.carpet_tile.straight.supply") == null &&
    line(packaged.lineItems, "flooring.carpet_tile.fixing") == null &&
    line(packaged.lineItems, "flooring.carpet_tile.straight.install") == null,
  packaged.lineItems.map((row) => row.componentKey)
);

const missing = pricePortion(answered!, companyRates.filter((row) => row.item_key !== "flooring.carpet_tile.straight.supply.m2"));
const recovery = flooringPricingRecovery({
  componentKey: "flooring.carpet_tile.straight.supply",
  itemKey: "flooring.carpet_tile.straight.supply.m2",
  notes: line(missing.lineItems, "flooring.carpet_tile.straight.supply")?.notes ?? "",
  roomName: "Open plan",
  label: "Carpet tile supply",
  unit: "m2",
});
check(
  "a missing supply rate stays unresolved and names its company rate",
  (line(missing.lineItems, "flooring.carpet_tile.straight.supply")?.recommendedCost ?? 0) === 0 &&
    recovery?.itemKey === "flooring.carpet_tile.straight.supply.m2" &&
    recovery.ratesSection === "materials",
  { cost: line(missing.lineItems, "flooring.carpet_tile.straight.supply")?.recommendedCost, recovery }
);

const projectRate = rate({
  item_key: "flooring.carpet_tile.straight.supply.m2",
  rate_type: "project_material",
  cost_rate: 45,
  unit: "m2",
});
const overridden = pricePortion(answered!, [...companyRates, projectRate]);
check(
  "a project material rate beats the company rate in the same unit",
  line(overridden.lineItems, "flooring.carpet_tile.straight.supply")?.recommendedCost === 5670 &&
    line(overridden.lineItems, "flooring.carpet_tile.straight.supply")?.rateSourceType === "work_area_rate"
);

const second = extractFlooringPortionsFromBrief("Supply and install 18 m² of carpet tiles in the meeting room. No removal.")[0];
const isolated = applyFlooringFactWrite({
  facts: [
    {
      id: "both",
      project_id: "project",
      work_area_id: "flooring",
      key: FLOORING_PORTIONS_FACT_KEY,
      value: [answered, second],
      source: "user",
    },
  ],
  workAreaId: "flooring",
  key: "flooring.portion.carpet_tile_waste",
  value: "No waste",
  nestedItemId: second?.id,
});
const isolatedPortions = resolveFlooringPortions({ facts: isolated, workAreaId: "flooring" }).portions;
check(
  "a meeting-room answer does not change the open-plan allowance",
  isolatedPortions.find((row) => row.id === answered?.id)?.waste_percent === 5 &&
    isolatedPortions.find((row) => row.id === second?.id)?.carpet_tile_waste === "zero",
  isolatedPortions.map((row) => ({ id: row.id, waste: row.carpet_tile_waste, percent: row.waste_percent }))
);

const takeoff = (() => {
  const pricedLines = priced.lineItems.map((item, index) =>
    toPricedLine({ ...item, id: `${item.componentKey}-${index}` } as EstimateLineItem)
  );
  const grouped = applyFlooringReviewGroups({
    categories: [
      {
        id: "MATERIALS",
        label: "Materials",
        cost: 0,
        lines: pricedLines.filter((row) => row.category === "MATERIALS"),
        takeoff: [],
        takeoffDisclaimer: null,
        takeoffUnavailableHint: null,
        takeoffCollapsedByDefault: false,
        takeoffTitle: "Planning takeoff",
        groupNotes: [],
        lineGroups: [],
      },
      {
        id: "LABOUR",
        label: "Labour",
        cost: 0,
        lines: pricedLines.filter((row) => row.category === "LABOUR"),
        takeoff: [],
        takeoffDisclaimer: null,
        takeoffUnavailableHint: null,
        takeoffCollapsedByDefault: false,
        takeoffTitle: "Planning takeoff",
        groupNotes: [],
        lineGroups: [],
      },
    ],
    facts,
    workAreaId: "flooring",
  });
  const view = {
    overview: { isStale: false },
    workAreas: [
      {
        workAreaId: "flooring",
        workAreaName: "Flooring",
        cost: 0,
        sell: 0,
        categories: grouped.categories,
        portionGroups: grouped.portionGroups,
        groupNotes: [],
      },
    ],
    checks: [],
  } as unknown as Parameters<typeof projectMaterialsTakeoff>[0];
  return { materials: projectMaterialsTakeoff(view), labour: projectLabourTakeoff(view) };
})();
const materialRows = takeoff.materials.groups.flatMap((group) => group.rows);
const labourRows = takeoff.labour.groups.flatMap((group) => group.rows);
const adhesiveTakeoff = materialRows.find((row) => /adhesive/i.test(row.description));
check(
  "materials and labour takeoffs keep supply, adhesive and installation",
  takeoff.materials.lineCount >= 2 && takeoff.labour.lineCount === 1,
  { materials: takeoff.materials.lineCount, labour: takeoff.labour.lineCount }
);
check(
  "the materials takeoff shows the $2.50 adhesive unit cost",
  formatUnitRate(2.5).includes("2.50") &&
    formatUnitRate(40).includes("40") &&
    !formatUnitRate(40).includes("40.00") &&
    adhesiveTakeoff?.unitCost?.includes("2.50") === true &&
    adhesiveTakeoff.quantity?.startsWith("120") === true &&
    adhesiveTakeoff.total?.includes("300") === true &&
    adhesiveTakeoff.unitCost !== adhesiveTakeoff.total,
  adhesiveTakeoff
);
check(
  "the labour takeoff shows the unadjusted person-hour formula",
  labourRows.some(
    (row) =>
      row.productivityBasis?.includes("120 m² × 0.15 person-hours/m² = 18 h") &&
      row.hourlyCost?.includes("75")
  ),
  labourRows.map((row) => ({ basis: row.productivityBasis, hourly: row.hourlyCost }))
);
check(
  "an issued quote snapshot stays immutable",
  assertQuoteSnapshotMutable({
    status: "sent",
    superseded_by_quote_id: null,
    send_lock_delivery_id: null,
  }) != null
);

if (failures.length > 0) {
  console.error(`\n${failures.length} Stage 3D checks failed`);
  process.exit(1);
}
console.log("\nStage 3D checks passed");
