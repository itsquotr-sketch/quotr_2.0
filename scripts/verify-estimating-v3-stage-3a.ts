/**
 * Stage 3A — flooring pricing recovery.
 *
 * Run: npx tsx scripts/verify-estimating-v3-stage-3a.ts
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { BuilderReviewPricedLine, BuilderReviewView } from "../lib/assistant/builder-review";
import { projectWorkAreaBreakdown } from "../lib/assistant/presentation/work-area-breakdown";
import type { OrganisationRate } from "../components/setup/types";
import { commercializeFlooring } from "../lib/estimate/flooring-commercial";
import {
  FLOORING_CARPENTER_LABOUR_RATE_KEY,
  FLOORING_VINYL_PLANK_REMOVE_HOURS_PER_M2,
  FLOORING_VINYL_PLANK_SUPPLY_INSTALL_M2,
} from "../lib/estimate/flooring-identities";
import { calculateFlooringPhysical } from "../lib/estimate/flooring-physical";
import {
  FLOORING_FINISH_ANCILLARY_COMPONENT,
  FLOORING_FINISH_INSTALL_COMPONENT,
  FLOORING_FINISH_INSTALL_HOURS_PER_M2,
  FLOORING_FINISH_SUPPLY_COMPONENT,
  FLOORING_FINISH_WASTE_COMPONENT,
  FLOORING_VINYL_ADHESIVE_ACCESSORIES_M2,
  FLOORING_VINYL_SUPPLY_M2,
} from "../lib/estimate/flooring-purchasing";
import {
  FLOORING_PORTIONS_FACT_KEY,
  type FlooringPortion,
} from "../lib/estimate/flooring-portions";
import {
  canonicalFinishMaterialUnit,
  flooringManualAmountBlocked,
  flooringPricingRecovery,
  flooringPurchasingUnitsMatch,
  flooringRateEditorHref,
  safeFlooringReturnPath,
} from "../lib/estimate/flooring-pricing-recovery";
import type { EstimateFact, EstimateLineItemInput, EstimateWorkArea } from "../lib/estimate/types";
import { listMaterialsPageCatalogueEntries } from "../lib/rates/material-registry";
import {
  FLOORING_PRODUCTIVITY_RATE_CATALOGUE,
  FLOORING_SPECIFIC_MATERIAL_CATALOGUE,
} from "../lib/rates/specific-material-catalogue";

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
  row: Partial<OrganisationRate> & Pick<OrganisationRate, "item_key" | "rate_type" | "cost_rate" | "unit">
): OrganisationRate {
  return {
    id: row.item_key + row.rate_type,
    trade: null,
    work_area_type: "flooring",
    label: row.item_key,
    sell_rate: row.sell_rate ?? null,
    markup_percent: null,
    active: true,
    ...row,
  };
}

function portion(overrides: Partial<FlooringPortion> = {}): FlooringPortion {
  return {
    id: "hall",
    label: "Hallway",
    finish_type: "vinyl_plank",
    area_input_method: "direct_m2",
    length_m: null,
    width_m: null,
    area_m2: 9.6,
    underlay_required: null,
    floor_preparation_required: false,
    tile_width_mm: null,
    tile_length_mm: null,
    hardwood_board_width_mm: null,
    substrate_required: false,
    substrate_family: null,
    substrate_item_key: null,
    framing_required: false,
    framing_allowance_level: null,
    finish_removal_required: true,
    existing_finish_type: "vinyl",
    substrate_removal_required: false,
    waste_percent: 10,
    other_description: null,
    specialist_kind: null,
    ...overrides,
  };
}

function price(row: FlooringPortion, rates: OrganisationRate[]) {
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
    constraints: [],
  });
}

function findLine(items: readonly EstimateLineItemInput[], componentKey: string) {
  return items.find((item) => item.componentKey === componentKey);
}

const labour = rate({
  item_key: FLOORING_CARPENTER_LABOUR_RATE_KEY,
  rate_type: "labour",
  unit: "hour",
  cost_rate: 60,
});
const removalHours = rate({
  item_key: FLOORING_VINYL_PLANK_REMOVE_HOURS_PER_M2,
  rate_type: "productivity",
  unit: "m2",
  cost_rate: 0.1,
});
const installHours = rate({
  item_key: FLOORING_FINISH_INSTALL_HOURS_PER_M2,
  rate_type: "productivity",
  unit: "m2",
  cost_rate: 0.25,
});
const material = rate({
  item_key: FLOORING_VINYL_SUPPLY_M2,
  rate_type: "material",
  unit: "m2",
  cost_rate: 40,
});
const adhesive = rate({
  item_key: FLOORING_VINYL_ADHESIVE_ACCESSORIES_M2,
  rate_type: "material",
  unit: "m2",
  cost_rate: 5,
});

const separate = price(portion({ finish_pricing: "separate_supply" }), [
  labour,
  removalHours,
  installHours,
  material,
  adhesive,
]);
const supply = findLine(separate.lineItems, FLOORING_FINISH_SUPPLY_COMPONENT);
const ancillary = findLine(separate.lineItems, FLOORING_FINISH_ANCILLARY_COMPONENT);
const install = findLine(separate.lineItems, FLOORING_FINISH_INSTALL_COMPONENT);
const removal = separate.lineItems.find((item) => item.label.includes("finish removal"));
const included = separate.lineItems.filter((item) => item.includedInTotal !== false);
const includedCost = Math.round(included.reduce((sum, item) => sum + (item.recommendedCost ?? 0), 0) * 100) / 100;

check("separate supply is 10.56 m2 once", supply?.quantity === 10.56 && supply.recommendedCost === 422.4, supply);
check("adhesive is 9.6 m2 once", ancillary?.quantity === 9.6 && ancillary.recommendedCost === 48, ancillary);
check(
  "installation uses saved 0.25 h/m2 and $60/h",
  install?.quantity === 9.6 && install.recommendedCost === 144 && /0\.25 h\/m2/.test(install.notes ?? ""),
  install
);
check("removal stays independent on the net area", removal?.quantity === 9.6 && removal.recommendedCost === 57.6, removal);
check(
  "separate total is supply plus adhesive plus install plus removal",
  includedCost === 672 &&
    findLine(separate.lineItems, FLOORING_VINYL_PLANK_SUPPLY_INSTALL_M2) == null &&
    separate.lineItems.filter((item) => item.recommendedCost === 48).length === 1,
  { includedCost, lines: included.map((item) => [item.label, item.recommendedCost]) }
);

const combined = price(portion(), [labour, removalHours]);
const packageLine = findLine(combined.lineItems, FLOORING_VINYL_PLANK_SUPPLY_INSTALL_M2);
const waste = findLine(combined.lineItems, FLOORING_FINISH_WASTE_COMPONENT);
check(
  "combined package stays on the net area and leaves waste unresolved",
  packageLine?.quantity === 9.6 &&
    packageLine.recommendedCost === 912 &&
    packageLine.recommendedSell === 1140 &&
    waste?.quantity === 0.96 &&
    waste.includedInTotal === false &&
    (waste.recommendedCost ?? 0) === 0,
  { packageLine, waste }
);

const wasteRecovery = flooringPricingRecovery({
  componentKey: waste?.componentKey ?? null,
  itemKey: waste?.itemKey ?? null,
  notes: waste?.notes ?? null,
  label: waste?.label ?? "",
  roomName: "Hallway",
  unit: waste?.unit ?? null,
});
check(
  "unresolved waste opens the treatment choice and blocks a typed amount",
  wasteRecovery?.kind === "decision" &&
    wasteRecovery.blocksManualAmount &&
    wasteRecovery.factKey === "flooring.portion.waste_treatment" &&
    wasteRecovery.roomName === "Hallway",
  wasteRecovery
);

const missingInstall = price(portion({ finish_pricing: "separate_supply" }), [
  labour,
  removalHours,
  material,
]);
const installGap = findLine(missingInstall.lineItems, FLOORING_FINISH_INSTALL_COMPONENT);
const installRecovery = flooringPricingRecovery({
  componentKey: installGap?.componentKey ?? null,
  itemKey: installGap?.itemKey ?? null,
  notes: installGap?.notes ?? null,
  label: installGap?.label ?? "",
  roomName: "Hallway",
  unit: installGap?.unit ?? null,
});
const installHref = flooringRateEditorHref({
  section: "productivity",
  itemKey: FLOORING_FINISH_INSTALL_HOURS_PER_M2,
  projectId: "project-1",
  workAreaId: "area-1",
});
check(
  "missing productivity names the room and opens that rate",
  installRecovery?.kind === "company_productivity" &&
    installRecovery.itemKey === FLOORING_FINISH_INSTALL_HOURS_PER_M2 &&
    installRecovery.blocksManualAmount === false &&
    installHref.includes("item=flooring.finish.install.hours_per_m2") &&
    installHref.includes("section=productivity") &&
    installHref.includes("returnTo=") &&
    !installHref.endsWith("/app/rates"),
  { installRecovery, installHref }
);

const litre = price(portion({ finish_pricing: "separate_supply" }), [
  labour,
  removalHours,
  installHours,
  rate({
    item_key: FLOORING_VINYL_SUPPLY_M2,
    rate_type: "material",
    unit: "l",
    cost_rate: 40,
  }),
]);
const litreSupply = findLine(litre.lineItems, FLOORING_FINISH_SUPPLY_COMPONENT);
check(
  "a litre rate is not treated as a square-metre rate",
  (litreSupply?.recommendedCost ?? 0) === 0 &&
    litreSupply?.includedInTotal === false &&
    /not converted/i.test(litreSupply?.notes ?? "") &&
    flooringPurchasingUnitsMatch("l", "m2").ok === false &&
    flooringPurchasingUnitsMatch("m²", "m2").ok === true,
  litreSupply?.notes
);

const badProject = price(portion({ finish_pricing: "separate_supply" }), [
  labour,
  material,
  rate({
    item_key: FLOORING_VINYL_SUPPLY_M2,
    rate_type: "project_material",
    unit: "pack",
    cost_rate: 25,
  }),
]);
check(
  "a mismatched project override does not fall through to the company rate",
  (findLine(badProject.lineItems, FLOORING_FINISH_SUPPLY_COMPONENT)?.recommendedCost ?? 0) === 0,
  findLine(badProject.lineItems, FLOORING_FINISH_SUPPLY_COMPONENT)
);

check(
  "new supply rows have no benchmark",
  [FLOORING_VINYL_SUPPLY_M2, FLOORING_VINYL_ADHESIVE_ACCESSORIES_M2].every((key) => {
    const entry = FLOORING_SPECIFIC_MATERIAL_CATALOGUE.find((row) => row.item_key === key);
    return entry?.defaultCostRate == null && entry?.calculatorSupport === "used_now";
  }) &&
    FLOORING_PRODUCTIVITY_RATE_CATALOGUE.find(
      (row) => row.item_key === FLOORING_FINISH_INSTALL_HOURS_PER_M2
    )?.defaultCostRate == null &&
    listMaterialsPageCatalogueEntries().some((row) => row.item_key === FLOORING_VINYL_SUPPLY_M2) &&
    canonicalFinishMaterialUnit(FLOORING_VINYL_SUPPLY_M2) === "m2"
);

check(
  "planned vinyl catalogue key stays off the separate supply line",
  supply?.itemKey === FLOORING_VINYL_SUPPLY_M2 && supply.itemKey !== "flooring.vinyl.m2"
);

check(
  "a typed amount cannot close an unanswered waste line",
  flooringManualAmountBlocked({
    componentKey: FLOORING_FINISH_WASTE_COMPONENT,
    notes: waste?.notes ?? null,
    itemKey: null,
  }) &&
    flooringManualAmountBlocked({
      componentKey: FLOORING_FINISH_SUPPLY_COMPONENT,
      notes: "Pricing Required",
      itemKey: FLOORING_VINYL_SUPPLY_M2,
    }) === false
);

check(
  "return path stays inside the project",
  safeFlooringReturnPath("/app/projects/abc?recovery=saved") === "/app/projects/abc?recovery=saved" &&
    safeFlooringReturnPath("https://example.com") == null &&
    safeFlooringReturnPath("//app/projects/abc") == null
);

function attentionLine(input: {
  id: string;
  label: string;
  componentKey: string;
  itemKey: string;
}): BuilderReviewPricedLine {
  return {
    id: input.id,
    label: input.label,
    category: "PRICING_REQUIRED",
    recommendedCost: 0,
    recommendedSell: 0,
    quantity: 9.6,
    unit: "m2",
    labourHours: null,
    costRate: null,
    rateLabel: "Pricing Required",
    labourRateLabel: null,
    productivityLabel: null,
    itemKey: input.itemKey,
    componentKey: input.componentKey,
    isAllowance: false,
    specification: null,
    supporting: null,
    detail: null,
    pricingHelper: null,
    rateContext: null,
    quantityFallback: null,
    sourceLine: { notes: "", nestedItemId: "hall" } as BuilderReviewPricedLine["sourceLine"],
  };
}

const supplyAttentionLine = attentionLine({
  id: "supply",
  label: "Hallway · vinyl plank supply 10.56 m²",
  componentKey: FLOORING_FINISH_SUPPLY_COMPONENT,
  itemKey: FLOORING_VINYL_SUPPLY_M2,
});
const installAttentionLine = attentionLine({
  id: "install",
  label: "Finish installation",
  componentKey: FLOORING_FINISH_INSTALL_COMPONENT,
  itemKey: FLOORING_FINISH_INSTALL_HOURS_PER_M2,
});
const attentionView: BuilderReviewView = {
  overview: {
    recommendedSell: 72,
    recommendedCost: 57.6,
    marginPercent: 20,
    confidenceBand: null,
    confidenceExplanation: null,
    marginSourceLabel: null,
    workAreaCount: 1,
    workAreaNames: ["Flooring"],
    categorySummary: [],
    isStale: false,
    partialEstimateLabel: null,
    recommendedSellIsPartial: true,
  },
  workAreas: [
    {
      workAreaId: "flooring",
      workAreaName: "Flooring",
      workAreaType: "flooring",
      cost: 57.6,
      sell: 72,
      categories: [],
      portionGroups: [
        {
          id: "hallway",
          label: "Hallway — 9.6 m² vinyl plank/LVT",
          summary: null,
          areaLabel: "9.6 m²",
          assumptions: [],
          lineGroups: [
            {
              id: "pricing",
              label: "Pricing Required",
              recommendedCost: 0,
              supporting: null,
              secondary: null,
              itemKey: null,
              showChangeMaterial: false,
              rateContext: "Pricing Required",
              pricingRequired: true,
              children: [supplyAttentionLine, installAttentionLine],
            },
          ],
        },
      ],
    },
  ],
  assumptions: [],
  checks: [],
  improvements: [],
  costReconciles: true,
  projectedCost: 57.6,
  estimateCost: 57.6,
  takeoffAffectsMoney: false,
  requirements: [],
};
const attentionModel = projectWorkAreaBreakdown(attentionView);
const supplyAttention = attentionModel.cards[0]?.attention.find((row) => row.id === "supply");
const installAttention = attentionModel.cards[0]?.attention.find((row) => row.id === "install");
const supplyRecovery = flooringPricingRecovery({
  componentKey: supplyAttention?.componentKey ?? null,
  itemKey: supplyAttention?.itemKey ?? null,
  notes: supplyAttention?.detailNotes ?? null,
  label: "vinyl plank supply 10.56 m²",
  roomName: supplyAttention?.roomName ?? "",
  unit: supplyAttention?.unit ?? null,
});
const hallwayInstallRecovery = flooringPricingRecovery({
  componentKey: installAttention?.componentKey ?? null,
  itemKey: installAttention?.itemKey ?? null,
  notes: installAttention?.detailNotes ?? null,
  label: "Finish installation",
  roomName: installAttention?.roomName ?? "",
  unit: installAttention?.unit ?? null,
});
const breakdownSource = readFileSync(
  join(__dirname, "../components/assistant/mode/WorkAreaBreakdown.tsx"),
  "utf8"
);
check(
  "required attention names the hallway and opens the exact rate",
  supplyAttention?.roomName === "Hallway" &&
    installAttention?.roomName === "Hallway" &&
    supplyRecovery?.kind === "company_material" &&
    supplyRecovery.itemKey === FLOORING_VINYL_SUPPLY_M2 &&
    hallwayInstallRecovery?.kind === "company_productivity" &&
    hallwayInstallRecovery.itemKey === FLOORING_FINISH_INSTALL_HOURS_PER_M2 &&
    breakdownSource.includes("data-pricing-required") &&
    breakdownSource.includes("<FlooringRecoveryActions"),
  { supplyAttention, supplyRecovery, hallwayInstallRecovery }
);

if (failures.length > 0) {
  console.error(`${failures.length} failed`);
  process.exit(1);
}
console.log("stage 3a verifier passed");
