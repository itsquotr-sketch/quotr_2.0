/**
 * Stage 3B — floating click-lock laminate on a ready substrate.
 *
 * Run: npx tsx scripts/verify-estimating-v3-stage-3b.ts
 */
import type { OrganisationRate } from "../components/setup/types";
import { extractFlooringPortionsFromBrief } from "../lib/estimate/flooring-brief";
import { listFlooringClarifyCandidates } from "../lib/estimate/flooring-clarify";
import { commercializeFlooring } from "../lib/estimate/flooring-commercial";
import { flooringFactIsRelevant } from "../lib/estimate/flooring-information-contract";
import {
  FLOORING_LAMINATE_CLICK_LOCK_SUPPLY_M2,
  FLOORING_LAMINATE_CLICK_LOCK_SUPPLY_PACK,
  FLOORING_LAMINATE_INSTALL_COMPONENT,
  FLOORING_LAMINATE_INSTALL_HOURS_PER_M2,
  FLOORING_LAMINATE_MOISTURE_COMPONENT,
  FLOORING_LAMINATE_MOISTURE_M2,
  FLOORING_LAMINATE_PACKAGE_M2,
  FLOORING_LAMINATE_SUPPLY_COMPONENT,
  FLOORING_LAMINATE_UNDERLAY_COMPONENT,
  FLOORING_LAMINATE_UNDERLAY_M2,
  FLOORING_LAMINATE_UNDERLAY_ROLL,
} from "../lib/estimate/flooring-laminate";
import { calculateFlooringPhysical } from "../lib/estimate/flooring-physical";
import { flooringPricingRecovery } from "../lib/estimate/flooring-pricing-recovery";
import {
  FLOORING_PORTIONS_FACT_KEY,
  applyFlooringFactWrite,
  resolveFlooringPortions,
  type FlooringPortion,
} from "../lib/estimate/flooring-portions";
import type { EstimateFact, EstimateLineItemInput, EstimateWorkArea } from "../lib/estimate/types";
import { FITOUT_BENCHMARKS } from "../lib/estimate/benchmark-rates";
import {
  estimateRequirementScopes,
  matchPricingToEstimateLines,
  pricingDraftReconciliationBlocked,
  pricingRowsNeedingReviewNote,
  pricingRowsToRetire,
  type EstimateLineItemRow,
} from "../lib/pricing/recalibration-helpers";
import type { PricingItem } from "../lib/pricing/types";
import { getCatalogueEntry } from "../lib/rates/catalogue";

const ORIGINAL =
  "Supply and install 30m² of laminate flooring in an empty rectangular room measuring 6m × 5m. The existing floor is bare concrete, clean, dry and ready for installation. Include underlay and 10% waste on the laminate. No skirting, floor preparation, demolition or disposal is required. Normal weekday access at ground level.";

const PARAPHRASE =
  "Please supply and install about 30m2 of laminate flooring. The room is 6m x 5m and empty. Bare concrete, clean and dry, ready for installation. Include underlay and 10% waste on the laminate. No skirting, floor preparation, demolition or disposal is required.";

const MIXED_UNITS =
  "Supply and install 30m² of laminate flooring in a room measuring 6 m × 5000 mm. Bare concrete, ready for installation. Include underlay and 10% waste on the laminate. No skirting, floor preparation, demolition or disposal.";

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

function price(row: FlooringPortion, rates: OrganisationRate[]) {
  const workArea = {
    id: "flooring",
    type: "flooring",
    name: "Flooring",
  } as EstimateWorkArea;
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
    constraints: [],
  });
}

function findLine(items: readonly EstimateLineItemInput[], componentKey: string) {
  return items.find((item) => item.componentKey === componentKey);
}

function includedCost(items: readonly EstimateLineItemInput[]): number {
  return (
    Math.round(
      items
        .filter((item) => item.includedInTotal !== false)
        .reduce((sum, item) => sum + (item.recommendedCost ?? 0), 0) * 100
    ) / 100
  );
}

function includedSell(items: readonly EstimateLineItemInput[]): number {
  return (
    Math.round(
      items
        .filter((item) => item.includedInTotal !== false)
        .reduce((sum, item) => sum + (item.recommendedSell ?? 0), 0) * 100
    ) / 100
  );
}

const extracted = extractFlooringPortionsFromBrief(ORIGINAL)[0];
check("original brief recognises one laminate area", Boolean(extracted), extracted);
check(
  "original brief stores 30 m2, 6 by 5, 10% waste, underlay and concrete",
  extracted?.specialist_kind === "laminate" &&
    extracted.area_m2 === 30 &&
    extracted.length_m === 6 &&
    extracted.width_m === 5 &&
    extracted.waste_percent === 10 &&
    extracted.underlay_required === true &&
    extracted.laminate_substrate === "concrete" &&
    extracted.laminate_substrate_authority === "extracted",
  extracted
);
check(
  "unstated method is not stored as an extracted fact",
  extracted?.laminate_method == null && extracted?.laminate_method_authority == null,
  extracted?.laminate_method
);
check(
  "excluded preparation, removal and skirting are not requirements",
  extracted?.floor_preparation_required === false &&
    extracted?.finish_removal_required === false &&
    extracted?.skirting_replacement_excluded === true &&
    extracted?.substrate_required === false,
  extracted
);

const facts = [
  {
    id: "fact-1",
    project_id: "project",
    work_area_id: "flooring",
    key: FLOORING_PORTIONS_FACT_KEY,
    value: [extracted],
    source: "extracted",
  },
] as EstimateFact[];
const asked = listFlooringClarifyCandidates({
  facts,
  workAreaId: "flooring",
  workAreaName: "Flooring",
});
const methodQuestion = asked.find((row) => row.factKey === "flooring.portion.laminate_method");
check(
  "unstated method is asked as a proposed assumption",
  methodQuestion?.question.includes("Proposed assumption") === true &&
    methodQuestion.question.includes("not stored"),
  asked.map((row) => row.factKey)
);

function writeFact(current: EstimateFact[], key: string, value: string): EstimateFact[] {
  return applyFlooringFactWrite({
    facts: current,
    workAreaId: "flooring",
    key,
    value,
    nestedItemId: extracted?.id,
  });
}
function currentPortion(current: EstimateFact[]): FlooringPortion | undefined {
  return resolveFlooringPortions({ facts: current, workAreaId: "flooring" }).portions[0];
}
let jobFacts = facts;
jobFacts = writeFact(jobFacts, "flooring.portion.laminate_method", "Floating click-lock");
const confirmed = currentPortion(jobFacts);
check(
  "confirmed method is a user answer, not an extracted fact",
  confirmed?.laminate_method === "floating_click_lock" &&
    confirmed.laminate_method_authority === "user",
  confirmed?.laminate_method_authority
);
const afterMethod = listFlooringClarifyCandidates({
  facts: jobFacts,
  workAreaId: "flooring",
  workAreaName: "Flooring",
});
const moistureQuestion = afterMethod.find(
  (row) => row.factKey === "flooring.portion.laminate_moisture"
);
check(
  "concrete asks moisture control before a barrier is added",
  moistureQuestion?.question.includes("not added twice") === true,
  afterMethod.map((row) => row.factKey)
);
jobFacts = writeFact(jobFacts, "flooring.portion.laminate_moisture", "Separate moisture barrier");
const afterMoisture = listFlooringClarifyCandidates({
  facts: jobFacts,
  workAreaId: "flooring",
  workAreaName: "Flooring",
});
const ownershipQuestion = afterMoisture.find(
  (row) => row.factKey === "flooring.portion.finish_pricing"
);
check(
  "laminate price ownership is required and is not assumed",
  ownershipQuestion?.askClass === "HARD_MINIMUM" && ownershipQuestion.assumable === false,
  ownershipQuestion
);
jobFacts = writeFact(
  jobFacts,
  "flooring.portion.finish_pricing",
  "Separate finish supply and installation"
);
const separatePortion = currentPortion(jobFacts) as FlooringPortion;

const companyRates = [
  rate({
    item_key: FLOORING_LAMINATE_CLICK_LOCK_SUPPLY_M2,
    rate_type: "material",
    unit: "m2",
    cost_rate: 40,
  }),
  rate({
    item_key: FLOORING_LAMINATE_UNDERLAY_M2,
    rate_type: "material",
    unit: "m2",
    cost_rate: 8,
  }),
  rate({
    item_key: FLOORING_LAMINATE_MOISTURE_M2,
    rate_type: "material",
    unit: "m2",
    cost_rate: 3,
  }),
  rate({
    item_key: FLOORING_LAMINATE_INSTALL_HOURS_PER_M2,
    rate_type: "productivity",
    unit: "m2",
    cost_rate: 0.2,
  }),
  rate({
    item_key: "labour.carpenter.hour",
    rate_type: "labour",
    unit: "hour",
    cost_rate: 75,
  }),
];

const unresolved = price(separatePortion, []);
const missingSupply = findLine(unresolved.lineItems, FLOORING_LAMINATE_SUPPLY_COMPONENT);
const missingInstall = findLine(unresolved.lineItems, FLOORING_LAMINATE_INSTALL_COMPONENT);
check(
  "missing catalogue values stay unresolved with the quantities visible",
  missingSupply?.quantity === 33 &&
    missingSupply.unit === "m2" &&
    missingSupply.includedInTotal === false &&
    missingInstall?.quantity === 30 &&
    missingInstall.includedInTotal === false &&
    includedCost(unresolved.lineItems) === 0,
  unresolved.lineItems.map((item) => [item.componentKey, item.quantity, item.recommendedCost])
);
check(
  "missing laminate supply opens the laminate rate, not a vinyl rate",
  flooringPricingRecovery({
    componentKey: missingSupply?.componentKey ?? null,
    itemKey: missingSupply?.itemKey ?? null,
    notes: missingSupply?.notes ?? null,
    label: missingSupply?.label ?? "",
    roomName: "Room",
    unit: missingSupply?.unit ?? null,
  })?.itemKey === FLOORING_LAMINATE_CLICK_LOCK_SUPPLY_M2,
  missingSupply
);
check(
  "missing laminate productivity does not reuse the vinyl hours key",
  flooringPricingRecovery({
    componentKey: missingInstall?.componentKey ?? null,
    itemKey: missingInstall?.itemKey ?? null,
    notes: missingInstall?.notes ?? null,
    label: missingInstall?.label ?? "",
    roomName: "Room",
    unit: missingInstall?.unit ?? null,
  })?.itemKey === FLOORING_LAMINATE_INSTALL_HOURS_PER_M2,
  missingInstall?.notes
);

const priced = price(separatePortion, companyRates);
const supply = findLine(priced.lineItems, FLOORING_LAMINATE_SUPPLY_COMPONENT);
const underlay = findLine(priced.lineItems, FLOORING_LAMINATE_UNDERLAY_COMPONENT);
const moisture = findLine(priced.lineItems, FLOORING_LAMINATE_MOISTURE_COMPONENT);
const install = findLine(priced.lineItems, FLOORING_LAMINATE_INSTALL_COMPONENT);
check(
  "separate supply is 33 m2 at the company rate",
  supply?.quantity === 33 &&
    supply.unit === "m2" &&
    supply.recommendedCost === 1320 &&
    supply.recommendedSell === 1650 &&
    supply.itemKey === FLOORING_LAMINATE_CLICK_LOCK_SUPPLY_M2 &&
    supply.rateSourceType === "user_rate" &&
    /33\.00 m²/.test(supply.notes ?? ""),
  supply
);
check(
  "underlay and moisture use the net 30 m2 and are not given laminate waste",
  underlay?.quantity === 30 &&
    underlay.recommendedCost === 240 &&
    underlay.unit === "m2" &&
    moisture?.quantity === 30 &&
    moisture.recommendedCost === 90 &&
    moisture.itemKey === FLOORING_LAMINATE_MOISTURE_M2,
  { underlay, moisture }
);
check(
  "installation is 6 hours at the company $75 carpenter rate",
  install?.quantity === 30 &&
    install.recommendedCost === 450 &&
    install.rateSourceType === "user_rate" &&
    /0\.2 h\/m2/.test(install.notes ?? "") &&
    /company hourly rate/.test(install.notes ?? "") &&
    /\$60 benchmark is not used/.test(install.notes ?? ""),
  install
);
check(
  "direct cost is 2100 and sell is 2625",
  includedCost(priced.lineItems) === 2100 && includedSell(priced.lineItems) === 2625,
  priced.lineItems.map((item) => [item.label, item.recommendedCost, item.recommendedSell])
);
check(
  "excluded work and the vinyl package are not priced",
  priced.lineItems.every(
    (item) =>
      item.componentKey !== "flooring.floor_preparation.allowance.m2" &&
      item.componentKey !== "flooring.vinyl_plank.supply_install.m2" &&
      !/skirting|disposal|demolition/i.test(item.label)
  ) && findLine(priced.lineItems, FLOORING_LAMINATE_PACKAGE_M2) == null,
  priced.lineItems.map((item) => item.componentKey)
);
check(
  "the unused laminate benchmark is not applied",
  priced.lineItems.every((item) => item.recommendedCost !== FITOUT_BENCHMARKS.laminateFlooringPerM2.cost * 30),
  FITOUT_BENCHMARKS.laminateFlooringPerM2
);

const materialOnly = price(separatePortion, [
  ...companyRates.filter((row) => row.item_key !== FLOORING_LAMINATE_CLICK_LOCK_SUPPLY_M2),
  rate({
    item_key: FLOORING_LAMINATE_CLICK_LOCK_SUPPLY_M2,
    rate_type: "material",
    unit: "m2",
    cost_rate: 50,
  }),
]);
check(
  "changing only the laminate rate changes supply cost and not the other quantities",
  findLine(materialOnly.lineItems, FLOORING_LAMINATE_SUPPLY_COMPONENT)?.recommendedCost === 1650 &&
    findLine(materialOnly.lineItems, FLOORING_LAMINATE_UNDERLAY_COMPONENT)?.quantity === 30 &&
    findLine(materialOnly.lineItems, FLOORING_LAMINATE_INSTALL_COMPONENT)?.recommendedCost === 450 &&
    includedCost(materialOnly.lineItems) === 2430,
  includedCost(materialOnly.lineItems)
);

const projectOverride = price(separatePortion, [
  ...companyRates,
  rate({
    item_key: FLOORING_LAMINATE_CLICK_LOCK_SUPPLY_M2,
    rate_type: "project_material",
    unit: "m2",
    cost_rate: 45,
  }),
]);
check(
  "a project material override beats the company laminate rate",
  findLine(projectOverride.lineItems, FLOORING_LAMINATE_SUPPLY_COMPONENT)?.recommendedCost === 1485 &&
    findLine(projectOverride.lineItems, FLOORING_LAMINATE_SUPPLY_COMPONENT)?.rateSourceType ===
      "work_area_rate" &&
    findLine(projectOverride.lineItems, FLOORING_LAMINATE_SUPPLY_COMPONENT)?.rateSource ===
      "Your work area rate",
  findLine(projectOverride.lineItems, FLOORING_LAMINATE_SUPPLY_COMPONENT)
);

const slower = price(separatePortion, [
  ...companyRates.filter((row) => row.item_key !== FLOORING_LAMINATE_INSTALL_HOURS_PER_M2),
  rate({
    item_key: FLOORING_LAMINATE_INSTALL_HOURS_PER_M2,
    rate_type: "productivity",
    unit: "m2",
    cost_rate: 0.3,
  }),
]);
check(
  "changing only productivity changes hours and not the material quantity",
  findLine(slower.lineItems, FLOORING_LAMINATE_INSTALL_COMPONENT)?.recommendedCost === 675 &&
    findLine(slower.lineItems, FLOORING_LAMINATE_SUPPLY_COMPONENT)?.quantity === 33,
  findLine(slower.lineItems, FLOORING_LAMINATE_INSTALL_COMPONENT)
);

const dearerLabour = price(separatePortion, [
  ...companyRates.filter((row) => row.item_key !== "labour.carpenter.hour"),
  rate({
    item_key: "labour.carpenter.hour",
    rate_type: "labour",
    unit: "hour",
    cost_rate: 80,
  }),
]);
check(
  "changing only the carpenter rate changes labour cost and not quantities",
  findLine(dearerLabour.lineItems, FLOORING_LAMINATE_INSTALL_COMPONENT)?.recommendedCost === 480 &&
    findLine(dearerLabour.lineItems, FLOORING_LAMINATE_SUPPLY_COMPONENT)?.quantity === 33 &&
    findLine(dearerLabour.lineItems, FLOORING_LAMINATE_UNDERLAY_COMPONENT)?.quantity === 30,
  findLine(dearerLabour.lineItems, FLOORING_LAMINATE_INSTALL_COMPONENT)
);

const benchmarkOnly = price(separatePortion, [
  rate({
    item_key: FLOORING_LAMINATE_CLICK_LOCK_SUPPLY_M2,
    rate_type: "material",
    unit: "m2",
    cost_rate: 40,
  }),
  rate({
    item_key: FLOORING_LAMINATE_UNDERLAY_M2,
    rate_type: "material",
    unit: "m2",
    cost_rate: 8,
  }),
  rate({
    item_key: FLOORING_LAMINATE_MOISTURE_M2,
    rate_type: "material",
    unit: "m2",
    cost_rate: 3,
  }),
  rate({
    item_key: FLOORING_LAMINATE_INSTALL_HOURS_PER_M2,
    rate_type: "productivity",
    unit: "m2",
    cost_rate: 0.2,
  }),
]);
const benchmarkInstall = findLine(benchmarkOnly.lineItems, FLOORING_LAMINATE_INSTALL_COMPONENT);
check(
  "the $60 carpenter benchmark does not price laminate installation",
  benchmarkInstall?.includedInTotal === false &&
    (benchmarkInstall?.recommendedCost ?? 0) === 0 &&
    flooringPricingRecovery({
      componentKey: benchmarkInstall?.componentKey ?? null,
      itemKey: benchmarkInstall?.itemKey ?? null,
      notes: benchmarkInstall?.notes ?? null,
      label: benchmarkInstall?.label ?? "",
      roomName: "Room",
      unit: benchmarkInstall?.unit ?? null,
    })?.itemKey === "labour.carpenter.hour",
  benchmarkInstall
);

const integratedFacts = writeFact(
  jobFacts,
  "flooring.portion.laminate_moisture",
  "Underlay includes moisture control"
);
const integratedPrice = price(currentPortion(integratedFacts) as FlooringPortion, companyRates);
check(
  "integrated underlay does not add a second moisture barrier",
  findLine(integratedPrice.lineItems, FLOORING_LAMINATE_UNDERLAY_COMPONENT)?.quantity === 30 &&
    findLine(integratedPrice.lineItems, FLOORING_LAMINATE_MOISTURE_COMPONENT) == null &&
    /no separate barrier/.test(
      findLine(integratedPrice.lineItems, FLOORING_LAMINATE_UNDERLAY_COMPONENT)?.notes ?? ""
    ) &&
    includedCost(integratedPrice.lineItems) === 2010,
  integratedPrice.lineItems.map((item) => item.componentKey)
);

const customer = structuredClone(separatePortion) as FlooringPortion;
customer.finish_supplied_by = "customer";
const customerPrice = price(customer, companyRates);
const customerSupply = findLine(customerPrice.lineItems, FLOORING_LAMINATE_SUPPLY_COMPONENT);
check(
  "customer-supplied laminate keeps the quantity and zeros the purchasing cost",
  customerSupply?.quantity === 33 &&
    customerSupply.recommendedCost === 0 &&
    customerSupply.includedInTotal === false &&
    findLine(customerPrice.lineItems, FLOORING_LAMINATE_UNDERLAY_COMPONENT)?.recommendedCost === 240 &&
    findLine(customerPrice.lineItems, FLOORING_LAMINATE_INSTALL_COMPONENT)?.recommendedCost === 450 &&
    includedCost(customerPrice.lineItems) === 780,
  customerPrice.lineItems.map((item) => [item.componentKey, item.quantity, item.recommendedCost, item.includedInTotal])
);

const packed = structuredClone(separatePortion) as FlooringPortion;
packed.laminate_pack_coverage_m2 = 2.2;
packed.laminate_underlay_coverage_m2 = 15;
const packedPrice = price(packed, [
  ...companyRates,
  rate({
    item_key: FLOORING_LAMINATE_CLICK_LOCK_SUPPLY_PACK,
    rate_type: "material",
    unit: "pack",
    cost_rate: 80,
  }),
  rate({
    item_key: FLOORING_LAMINATE_UNDERLAY_ROLL,
    rate_type: "material",
    unit: "roll",
    cost_rate: 45,
  }),
]);
check(
  "known pack and roll coverage purchases whole units without a second waste",
  findLine(packedPrice.lineItems, FLOORING_LAMINATE_SUPPLY_COMPONENT)?.quantity === 15 &&
    findLine(packedPrice.lineItems, FLOORING_LAMINATE_SUPPLY_COMPONENT)?.unit === "pack" &&
    findLine(packedPrice.lineItems, FLOORING_LAMINATE_SUPPLY_COMPONENT)?.recommendedCost === 1200 &&
    findLine(packedPrice.lineItems, FLOORING_LAMINATE_UNDERLAY_COMPONENT)?.quantity === 2 &&
    findLine(packedPrice.lineItems, FLOORING_LAMINATE_UNDERLAY_COMPONENT)?.unit === "roll" &&
    findLine(packedPrice.lineItems, FLOORING_LAMINATE_UNDERLAY_COMPONENT)?.recommendedCost === 90,
  packedPrice.lineItems.map((item) => [item.componentKey, item.quantity, item.unit, item.recommendedCost])
);

let combinedFacts = writeFact(
  jobFacts,
  "flooring.portion.finish_pricing",
  "Combined supply and installation package"
);
combinedFacts = writeFact(
  combinedFacts,
  "flooring.portion.waste_treatment",
  "Charge only the extra waste quantity"
);
const unanswered = currentPortion(combinedFacts) as FlooringPortion;
const packageRate = rate({
  item_key: FLOORING_LAMINATE_PACKAGE_M2,
  rate_type: "subcontractor",
  unit: "m2",
  cost_rate: 90,
});
const unansweredPrice = price(unanswered, [...companyRates, packageRate]);
check(
  "a saved package rate does not decide underlay, moisture or waste coverage",
  unanswered.laminate_package_covers_underlay == null &&
    unanswered.laminate_package_covers_moisture == null &&
    findLine(unansweredPrice.lineItems, FLOORING_LAMINATE_PACKAGE_M2) == null &&
    findLine(unansweredPrice.lineItems, FLOORING_LAMINATE_UNDERLAY_COMPONENT) == null &&
    findLine(unansweredPrice.lineItems, FLOORING_LAMINATE_MOISTURE_COMPONENT) == null,
  unansweredPrice.lineItems.map((item) => item.componentKey)
);
combinedFacts = writeFact(
  combinedFacts,
  "flooring.portion.laminate_package_covers_underlay",
  "Charge the underlay separately"
);
combinedFacts = writeFact(
  combinedFacts,
  "flooring.portion.laminate_package_covers_moisture",
  "Charge the moisture barrier separately"
);
const combined = currentPortion(combinedFacts) as FlooringPortion;
const combinedPrice = price(combined, [...companyRates, packageRate]);
check(
  "a confirmed separate package charges underlay, moisture and waste once each",
  findLine(combinedPrice.lineItems, FLOORING_LAMINATE_PACKAGE_M2)?.quantity === 30 &&
    findLine(combinedPrice.lineItems, FLOORING_LAMINATE_PACKAGE_M2)?.recommendedCost === 2700 &&
    findLine(combinedPrice.lineItems, FLOORING_LAMINATE_SUPPLY_COMPONENT) == null &&
    findLine(combinedPrice.lineItems, FLOORING_LAMINATE_INSTALL_COMPONENT) == null &&
    findLine(combinedPrice.lineItems, FLOORING_LAMINATE_UNDERLAY_COMPONENT)?.quantity === 30 &&
    findLine(combinedPrice.lineItems, FLOORING_LAMINATE_UNDERLAY_COMPONENT)?.recommendedCost === 240 &&
    findLine(combinedPrice.lineItems, FLOORING_LAMINATE_MOISTURE_COMPONENT)?.quantity === 30 &&
    findLine(combinedPrice.lineItems, FLOORING_LAMINATE_MOISTURE_COMPONENT)?.recommendedCost === 90 &&
    findLine(combinedPrice.lineItems, "flooring.finish.waste_increment")?.quantity === 3 &&
    findLine(combinedPrice.lineItems, "flooring.finish.waste_increment")?.recommendedCost === 120,
  combinedPrice.lineItems.map((item) => [item.componentKey, item.quantity, item.recommendedCost])
);
let coveredFacts = writeFact(
  combinedFacts,
  "flooring.portion.laminate_package_covers_underlay",
  "Package rate covers the underlay"
);
coveredFacts = writeFact(
  coveredFacts,
  "flooring.portion.laminate_package_covers_moisture",
  "Package rate covers the moisture barrier"
);
coveredFacts = writeFact(
  coveredFacts,
  "flooring.portion.waste_treatment",
  "Package rate covers the requested waste"
);
const coveredPrice = price(currentPortion(coveredFacts) as FlooringPortion, [
  ...companyRates,
  packageRate,
]);
check(
  "a confirmed inclusive package does not charge underlay, moisture or waste again",
  findLine(coveredPrice.lineItems, FLOORING_LAMINATE_PACKAGE_M2)?.recommendedCost === 2700 &&
    findLine(coveredPrice.lineItems, FLOORING_LAMINATE_UNDERLAY_COMPONENT) == null &&
    findLine(coveredPrice.lineItems, FLOORING_LAMINATE_MOISTURE_COMPONENT) == null &&
    findLine(coveredPrice.lineItems, "flooring.finish.waste_increment") == null &&
    findLine(coveredPrice.lineItems, FLOORING_LAMINATE_SUPPLY_COMPONENT) == null,
  coveredPrice.lineItems.map((item) => [item.componentKey, item.recommendedCost])
);
const noPackage = price(combined, companyRates);
check(
  "a missing package rate stays unresolved and does not use the vinyl package",
  findLine(noPackage.lineItems, FLOORING_LAMINATE_PACKAGE_M2)?.includedInTotal === false &&
    findLine(noPackage.lineItems, "flooring.vinyl_plank.supply_install.m2") == null &&
    flooringPricingRecovery({
      componentKey: FLOORING_LAMINATE_PACKAGE_M2,
      itemKey: FLOORING_LAMINATE_PACKAGE_M2,
      notes: findLine(noPackage.lineItems, FLOORING_LAMINATE_PACKAGE_M2)?.notes ?? null,
      label: "Package",
      roomName: "Room",
      unit: "m2",
    })?.ratesSection === "subcontract",
  findLine(noPackage.lineItems, FLOORING_LAMINATE_PACKAGE_M2)
);

const gluedFacts = writeFact(jobFacts, "flooring.portion.laminate_method", "Glued down");
const gluedPrice = price(currentPortion(gluedFacts) as FlooringPortion, companyRates);
check(
  "glued laminate stays visible and does not use the click-lock recipe",
  gluedPrice.lineItems.length === 1 &&
    gluedPrice.lineItems[0]?.componentKey === "flooring.specialist.unsupported" &&
    /not priced by the floating click-lock recipe/.test(gluedPrice.lineItems[0]?.notes ?? "") &&
    includedCost(gluedPrice.lineItems) === 0,
  gluedPrice.lineItems
);
check(
  "a glued brief extracts glued and does not assume click-lock",
  extractFlooringPortionsFromBrief(
    "Supply and install 30m² of glue down laminate flooring on bare concrete. Include underlay."
  )[0]?.laminate_method === "glued",
  extractFlooringPortionsFromBrief(
    "Supply and install 30m² of glue down laminate flooring on bare concrete. Include underlay."
  )[0]
);
check(
  "conflicting method phrases are not stored",
  extractFlooringPortionsFromBrief(
    "Supply and install 30m² of click-lock or glue down laminate on concrete."
  )[0]?.laminate_method == null
);

const paraphrased = extractFlooringPortionsFromBrief(PARAPHRASE)[0];
check(
  "a paraphrased brief keeps the same quantities and does not invent the method",
  paraphrased?.area_m2 === 30 &&
    paraphrased.length_m === 6 &&
    paraphrased.width_m === 5 &&
    paraphrased.waste_percent === 10 &&
    paraphrased.underlay_required === true &&
    paraphrased.laminate_substrate === "concrete" &&
    paraphrased.laminate_method == null &&
    paraphrased.floor_preparation_required === false,
  paraphrased
);
const mixed = extractFlooringPortionsFromBrief(MIXED_UNITS)[0];
check(
  "mixed metre and millimetre dimensions agree with the stated 30 m2",
  mixed?.length_m === 6 && mixed.width_m === 5 && mixed.area_m2 === 30 && mixed.laminate_method == null,
  mixed
);
check(
  "ordinary vinyl ownership is still assumable",
  flooringFactIsRelevant("flooring.portion.finish_pricing", {
    facts: [],
    workAreaId: "flooring",
    portion: {
      ...separatePortion,
      specialist_kind: null,
      finish_type: "vinyl_plank",
      laminate_method: null,
    },
  })
);

for (const key of [
  FLOORING_LAMINATE_CLICK_LOCK_SUPPLY_M2,
  FLOORING_LAMINATE_CLICK_LOCK_SUPPLY_PACK,
  FLOORING_LAMINATE_UNDERLAY_M2,
  FLOORING_LAMINATE_UNDERLAY_ROLL,
  FLOORING_LAMINATE_MOISTURE_M2,
  FLOORING_LAMINATE_PACKAGE_M2,
  FLOORING_LAMINATE_INSTALL_HOURS_PER_M2,
]) {
  const entry = getCatalogueEntry(key);
  check(`${key} is editable and has no default cost or hours`, entry?.defaultCostRate == null, entry?.defaultCostRate);
}

const scope = supply?.scopeKey ?? "";
check("laminate supply has a stable scope key", scope.includes(FLOORING_LAMINATE_SUPPLY_COMPONENT), scope);
function meta(display: string, fields: Record<string, unknown>): string {
  return `${display}\n__quotr_meta__:${JSON.stringify(fields)}`;
}
const estimateLine: EstimateLineItemRow = {
  id: "new-supply",
  work_area_id: "flooring",
  label: "Laminate supply",
  category: "materials",
  recommended_cost: 1320,
  recommended_sell: 1650,
  notes: meta("33 m2", {
    quantity: 33,
    unit: "m2",
    scopeKey: scope,
    rateSourceType: "user_rate",
    includedInTotal: true,
  }),
  sort_order: 0,
  component_key: FLOORING_LAMINATE_SUPPLY_COMPONENT,
};
const kept: PricingItem = {
  id: "pricing-supply",
  org_id: "org",
  pricing_document_id: "doc",
  project_id: "project",
  work_area_id: "flooring",
  source_estimate_line_item_id: "old-supply",
  component_key: FLOORING_LAMINATE_SUPPLY_COMPONENT,
  item_type: "material",
  delivery_method: "in_house",
  internal_label: "Laminate supply",
  client_label: "Laminate supply",
  internal_description: "33 m2",
  client_description: null,
  quantity: 33,
  unit: "m2",
  unit_cost: 40,
  unit_sell: 50,
  total_cost: 1320,
  total_sell: 1650,
  gross_profit: 330,
  margin_percent: 20,
  markup_percent: null,
  visible_on_quote: true,
  optional: false,
  sort_order: 0,
  notes_internal: meta("33 m2", {
    quantity: 33,
    unit: "m2",
    scopeKey: scope,
    rateSourceType: "user_rate",
    includedInTotal: true,
  }),
  notes_client: null,
  created_at: "",
  updated_at: "",
  manually_edited: false,
  orphaned: false,
  recalibration_note: null,
  calculation_mode: "lump_sum",
  productivity_rate: null,
  productivity_unit: null,
  calculated_quantity: null,
  cost_known: true,
};
const edited: PricingItem = {
  ...kept,
  id: "pricing-edited",
  source_estimate_line_item_id: null,
  manually_edited: true,
  notes_internal: meta("manual", { quantity: 33, unit: "m2" }),
  total_cost: 1500,
  total_sell: 1875,
};
const matches = matchPricingToEstimateLines([estimateLine], [kept, edited]);
const matchedIds = new Set([...matches.values()].map((item) => item.id));
const scopes = estimateRequirementScopes([estimateLine]);
check(
  "a regenerated laminate row matches the old pricing row by scope",
  matches.get("new-supply")?.id === "pricing-supply",
  [...matches.entries()]
);
check(
  "an edited laminate row is kept when its generated scope is gone",
  pricingRowsNeedingReviewNote([edited], matchedIds, new Set(["new-supply"]), scopes).includes(
    "pricing-edited"
  ) &&
    !pricingRowsToRetire([edited], matchedIds, new Set(["new-supply"]), scopes).includes(
      "pricing-edited"
    ),
  edited.id
);
check(
  "an issued snapshot is not rewritten",
  pricingDraftReconciliationBlocked("converted_to_quote") ===
    "An issued quote is not changed when the estimate is updated."
);

if (failures.length > 0) {
  console.error(`${failures.length} failed`);
  process.exit(1);
}
console.log("stage 3b laminate checks passed");
