/**
 * FLOORING-04C — substrate, framing and removal authority.
 *
 * Run: npx --yes tsx scripts/verify-flooring-04c-substrate-removal-authority.ts
 *
 * No paid AI. No Production. No hosted commercial line items.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { OrganisationRate } from "../components/setup/types";
import {
  DEMOLITION_BENCHMARKS,
  FITOUT_BENCHMARKS,
  KITCHEN_BENCHMARKS,
} from "../lib/estimate/benchmark-rates";
import {
  liveQuotrMaterialCost,
  liveQuotrProductivity,
  workAreaMayCloseAtL5,
} from "../lib/estimate/benchmark-coverage";
import {
  BATHROOM_FLOOR_SUBSTRATE_FC_19MM_GENERIC_KEY,
  BATHROOM_FLOOR_SUBSTRATE_FC_19MM_1800_KEY,
  BATHROOM_FLOOR_SUBSTRATE_FC_19MM_2700_KEY,
  BATHROOM_FLOOR_SUBSTRATE_PLYWOOD_KEY,
  BATHROOM_FLOOR_SUBSTRATE_SECURA_KEY,
  BATHROOM_SHEET_AREA_M2,
  BATHROOM_SHEET_WASTE_FACTOR,
} from "../lib/estimate/bathroom-identities";
import { calculateFlooring } from "../lib/estimate/calculators/fitout";
import {
  FLOORING_CARPENTER_LABOUR_RATE_KEY,
  FLOORING_CARPET_REMOVE_HOURS_DESCRIPTION,
  FLOORING_CARPET_REMOVE_HOURS_LABEL,
  FLOORING_CARPET_REMOVE_HOURS_PER_M2,
  FLOORING_CARPET_REMOVE_HOURS_PER_M2_VALUE,
  FLOORING_CARPET_SUPPLY_INSTALL_M2,
  FLOORING_CUSTOM_REMOVAL_COMPONENT,
  FLOORING_HARDWOOD_REMOVE_HOURS_PER_M2,
  FLOORING_HARDWOOD_REMOVE_HOURS_PER_M2_VALUE,
  FLOORING_ORDINARY_FRAMING_KEYS,
  FLOORING_PRODUCTIVITY_KEYS,
  FLOORING_SPECIALIST_COMPONENT,
  FLOORING_SUBFLOOR_FRAMING_MAJOR_ALLOWANCE_COST_EX_GST,
  FLOORING_SUBFLOOR_FRAMING_MAJOR_ALLOWANCE_LABEL,
  FLOORING_SUBFLOOR_FRAMING_MAJOR_ALLOWANCE_M2,
  FLOORING_SUBFLOOR_FRAMING_MINOR_ALLOWANCE_COST_EX_GST,
  FLOORING_SUBFLOOR_FRAMING_MINOR_ALLOWANCE_LABEL,
  FLOORING_SUBFLOOR_FRAMING_MINOR_ALLOWANCE_M2,
  FLOORING_SUBFLOOR_FRAMING_STANDARD_ALLOWANCE_COST_EX_GST,
  FLOORING_SUBFLOOR_FRAMING_STANDARD_ALLOWANCE_LABEL,
  FLOORING_SUBFLOOR_FRAMING_STANDARD_ALLOWANCE_M2,
  FLOORING_SUBSTRATE_INSTALL_HOURS_DESCRIPTION,
  FLOORING_SUBSTRATE_INSTALL_HOURS_LABEL,
  FLOORING_SUBSTRATE_INSTALL_HOURS_PER_SHEET,
  FLOORING_SUBSTRATE_INSTALL_HOURS_PER_SHEET_VALUE,
  FLOORING_SUBSTRATE_REMOVE_HOURS_PER_M2,
  FLOORING_SUBSTRATE_REMOVE_HOURS_PER_M2_VALUE,
  FLOORING_TILE_REMOVE_HOURS_PER_M2,
  FLOORING_TILE_REMOVE_HOURS_PER_M2_VALUE,
  FLOORING_VINYL_PLANK_REMOVE_HOURS_PER_M2,
  FLOORING_VINYL_PLANK_REMOVE_HOURS_PER_M2_VALUE,
  flooringSubstrateSheetCoverageM2,
} from "../lib/estimate/flooring-identities";
import {
  flooringFramingAuthorityCost,
  isFlooringFramingAllowanceKey,
  resolveFlooringFramingAllowance,
} from "../lib/estimate/flooring-framing-authority";
import {
  calculateFlooringPortionPhysical,
  flooringSubstrateSheetCount,
} from "../lib/estimate/flooring-physical";
import {
  createEmptyFlooringPortion,
  FLOORING_PORTIONS_FACT_KEY,
  type FlooringPortion,
} from "../lib/estimate/flooring-portions";
import { resolveFlooringProductivityHours } from "../lib/estimate/flooring-productivity-authority";
import { getQuotrProductivityBenchmark } from "../lib/estimate/productivity";
import type {
  EstimateContext,
  EstimateFact,
  EstimateWorkArea,
} from "../lib/estimate/types";
import {
  FLOORING_BENCHMARK_REQUIREMENTS,
  verifyRegisteredWorkAreaBenchmarkCoverage,
} from "../lib/estimate/work-area-benchmark-coverage";
import {
  FULL_RATE_CATALOGUE,
  getCatalogueEntry,
  groupCatalogueByWorkArea,
} from "../lib/rates/catalogue";
import { listMaterialsPageCatalogueEntries } from "../lib/rates/material-registry";
import {
  buildProductivityRegistry,
  isProductivityCalibrationSupported,
  productivitySearchMatches,
  productivityStatusMatches,
} from "../lib/rates/productivity-registry";
import {
  FLOORING_FRAMING_ALLOWANCE_CATALOGUE,
  FLOORING_PRODUCTIVITY_RATE_CATALOGUE,
  listSubcontractRatesCatalogueEntries,
} from "../lib/rates/specific-material-catalogue";

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

const PROD_KEYS = [...FLOORING_PRODUCTIVITY_KEYS];
const FRAMING_KEYS = [...FLOORING_ORDINARY_FRAMING_KEYS];
const PROD_HOURS: Record<string, number> = {
  [FLOORING_SUBSTRATE_INSTALL_HOURS_PER_SHEET]:
    FLOORING_SUBSTRATE_INSTALL_HOURS_PER_SHEET_VALUE,
  [FLOORING_CARPET_REMOVE_HOURS_PER_M2]: FLOORING_CARPET_REMOVE_HOURS_PER_M2_VALUE,
  [FLOORING_VINYL_PLANK_REMOVE_HOURS_PER_M2]:
    FLOORING_VINYL_PLANK_REMOVE_HOURS_PER_M2_VALUE,
  [FLOORING_TILE_REMOVE_HOURS_PER_M2]: FLOORING_TILE_REMOVE_HOURS_PER_M2_VALUE,
  [FLOORING_HARDWOOD_REMOVE_HOURS_PER_M2]:
    FLOORING_HARDWOOD_REMOVE_HOURS_PER_M2_VALUE,
  [FLOORING_SUBSTRATE_REMOVE_HOURS_PER_M2]:
    FLOORING_SUBSTRATE_REMOVE_HOURS_PER_M2_VALUE,
};
const FRAMING_COST: Record<string, number> = {
  [FLOORING_SUBFLOOR_FRAMING_MINOR_ALLOWANCE_M2]:
    FLOORING_SUBFLOOR_FRAMING_MINOR_ALLOWANCE_COST_EX_GST,
  [FLOORING_SUBFLOOR_FRAMING_STANDARD_ALLOWANCE_M2]:
    FLOORING_SUBFLOOR_FRAMING_STANDARD_ALLOWANCE_COST_EX_GST,
  [FLOORING_SUBFLOOR_FRAMING_MAJOR_ALLOWANCE_M2]:
    FLOORING_SUBFLOOR_FRAMING_MAJOR_ALLOWANCE_COST_EX_GST,
};
const COMPANY_HOURS: Record<string, number> = {
  [FLOORING_SUBSTRATE_INSTALL_HOURS_PER_SHEET]: 0.65,
  [FLOORING_CARPET_REMOVE_HOURS_PER_M2]: 0.15,
  [FLOORING_VINYL_PLANK_REMOVE_HOURS_PER_M2]: 0.25,
  [FLOORING_TILE_REMOVE_HOURS_PER_M2]: 0.7,
  [FLOORING_HARDWOOD_REMOVE_HOURS_PER_M2]: 0.45,
  [FLOORING_SUBSTRATE_REMOVE_HOURS_PER_M2]: 0.4,
};
const COMPANY_FRAMING: Record<string, number> = {
  [FLOORING_SUBFLOOR_FRAMING_MINOR_ALLOWANCE_M2]: 55,
  [FLOORING_SUBFLOOR_FRAMING_STANDARD_ALLOWANCE_M2]: 105,
  [FLOORING_SUBFLOOR_FRAMING_MAJOR_ALLOWANCE_M2]: 185,
};

const WA: EstimateWorkArea = {
  id: "f1",
  type: "flooring",
  name: "Flooring",
  sort_order: 1,
  status: "confirmed",
} as EstimateWorkArea;

function persist(portions: readonly FlooringPortion[]): EstimateFact[] {
  return [
    {
      key: FLOORING_PORTIONS_FACT_KEY,
      work_area_id: WA.id,
      value: portions,
      source: "user",
    },
  ];
}

function ctx(facts: EstimateFact[], rates: OrganisationRate[] = []): EstimateContext {
  return {
    project: { id: "p1", qualityLevel: "standard" },
    confirmedWorkAreas: [WA],
    facts,
    constraints: [],
    organisationSettings: {
      allow_benchmark_rates: true,
      default_margin_percent: 20,
    },
    rates,
  } as unknown as EstimateContext;
}

function ordinary(patch: Partial<FlooringPortion> = {}): FlooringPortion {
  return {
    ...createEmptyFlooringPortion({
      id: patch.id ?? "fa_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa1",
      label: patch.label ?? "Living",
    }),
    finish_type: "carpet",
    area_input_method: "direct_m2",
    area_m2: 10,
    underlay_required: false,
    floor_preparation_required: false,
    substrate_required: false,
    framing_required: false,
    finish_removal_required: false,
    ...patch,
  };
}

function orgRate(
  itemKey: string,
  cost: number | null,
  extra: Partial<OrganisationRate> = {}
): OrganisationRate {
  return {
    id: extra.id ?? `org-${itemKey}`,
    item_key: itemKey,
    rate_type: extra.rate_type ?? "productivity",
    label: itemKey,
    unit: extra.unit ?? "m2",
    cost_rate: cost,
    sell_rate: extra.sell_rate ?? null,
    markup_percent: null,
    active: extra.active ?? true,
    trade: null,
    work_area_type: extra.work_area_type ?? "flooring",
    source: extra.source ?? "explicit_company",
  };
}

console.log("=== 1. Canonical identities ===\n");

check(
  "1a. Six productivity identities exist",
  PROD_KEYS.length === 6 &&
    PROD_KEYS.every((key) => getCatalogueEntry(key)?.item_key === key)
);
check(
  "1b. Three framing identities exist",
  FRAMING_KEYS.length === 3 &&
    FRAMING_KEYS.every((key) => getCatalogueEntry(key)?.item_key === key)
);
check(
  "1c. Physical keys were not renamed to flooring.removal.* or flooring.framing.*",
  PROD_KEYS.includes(FLOORING_CARPET_REMOVE_HOURS_PER_M2) &&
    FLOORING_CARPET_REMOVE_HOURS_PER_M2 === "flooring.carpet.remove.hours_per_m2" &&
    FLOORING_SUBFLOOR_FRAMING_MINOR_ALLOWANCE_M2 ===
      "flooring.subfloor_framing.minor.allowance.m2" &&
    getCatalogueEntry("flooring.removal.carpet.hours_per_m2") == null &&
    getCatalogueEntry("flooring.framing.minor.allowance.m2") == null
);

console.log("\n=== 2. Benchmark values and units ===\n");

check(
  "2a. Productivity hours and units",
  PROD_KEYS.every((key) => {
    const entry = getCatalogueEntry(key);
    const bench = getQuotrProductivityBenchmark(key);
    return (
      entry?.defaultCostRate === PROD_HOURS[key] &&
      bench?.hoursPerUnit === PROD_HOURS[key] &&
      liveQuotrProductivity(key) === PROD_HOURS[key] &&
      (key === FLOORING_SUBSTRATE_INSTALL_HOURS_PER_SHEET
        ? entry.unit === "sheet"
        : entry?.unit === "m2")
    );
  })
);
check(
  "2b. Framing allowance COST and m²",
  FRAMING_KEYS.every((key) => {
    const entry = getCatalogueEntry(key);
    return (
      entry?.defaultCostRate === FRAMING_COST[key] &&
      entry.unit === "m2" &&
      entry.rate_type === "allowance" &&
      entry.category === "allowance" &&
      entry.defaultSellRate == null
    );
  })
);
check(
  "2c. Substrate install is hours not dollars",
  getCatalogueEntry(FLOORING_SUBSTRATE_INSTALL_HOURS_PER_SHEET)?.rate_type ===
    "productivity" &&
    getCatalogueEntry(FLOORING_SUBSTRATE_INSTALL_HOURS_PER_SHEET)
      ?.defaultCostRate === 0.5 &&
    liveQuotrMaterialCost(FLOORING_CARPENTER_LABOUR_RATE_KEY) === 60
);

console.log("\n=== 3. Catalogue uniqueness ===\n");

check(
  "3a. Each productivity key once",
  PROD_KEYS.every(
    (key) => FULL_RATE_CATALOGUE.filter((row) => row.item_key === key).length === 1
  ) && FLOORING_PRODUCTIVITY_RATE_CATALOGUE.length === 6
);
check(
  "3b. Each framing key once",
  FRAMING_KEYS.every(
    (key) => FULL_RATE_CATALOGUE.filter((row) => row.item_key === key).length === 1
  ) && FLOORING_FRAMING_ALLOWANCE_CATALOGUE.length === 3
);
check(
  "3c. Work area Flooring",
  [...PROD_KEYS, ...FRAMING_KEYS].every(
    (key) => getCatalogueEntry(key)?.work_area_type === "flooring"
  )
);
check(
  "3d. Exact labels",
  getCatalogueEntry(FLOORING_SUBSTRATE_INSTALL_HOURS_PER_SHEET)?.label ===
    FLOORING_SUBSTRATE_INSTALL_HOURS_LABEL &&
    getCatalogueEntry(FLOORING_CARPET_REMOVE_HOURS_PER_M2)?.label ===
      FLOORING_CARPET_REMOVE_HOURS_LABEL &&
    getCatalogueEntry(FLOORING_SUBFLOOR_FRAMING_MINOR_ALLOWANCE_M2)?.label ===
      FLOORING_SUBFLOOR_FRAMING_MINOR_ALLOWANCE_LABEL &&
    getCatalogueEntry(FLOORING_SUBFLOOR_FRAMING_STANDARD_ALLOWANCE_M2)?.label ===
      FLOORING_SUBFLOOR_FRAMING_STANDARD_ALLOWANCE_LABEL &&
    getCatalogueEntry(FLOORING_SUBFLOOR_FRAMING_MAJOR_ALLOWANCE_M2)?.label ===
      FLOORING_SUBFLOOR_FRAMING_MAJOR_ALLOWANCE_LABEL
);
check(
  "3e. Descriptions include inclusions/exclusions",
  /purchased whole substrate sheet/.test(FLOORING_SUBSTRATE_INSTALL_HOURS_DESCRIPTION) &&
    /Excludes disposal\/cartage/.test(FLOORING_CARPET_REMOVE_HOURS_DESCRIPTION) &&
    /Not material-only/.test(
      getCatalogueEntry(FLOORING_SUBFLOOR_FRAMING_MINOR_ALLOWANCE_M2)?.description ??
        ""
    )
);

console.log("\n=== 4. Rates UI visibility ===\n");

const { groups: prodGroups } = buildProductivityRegistry({ rates: [], editable: true });
const flooringProd = prodGroups.find((group) => group.workAreaType === "flooring");
const subcontract = listSubcontractRatesCatalogueEntries();
const framingUi = subcontract.filter((row) =>
  FRAMING_KEYS.includes(row.item_key as (typeof FRAMING_KEYS)[number])
);
const framingGroups = groupCatalogueByWorkArea(framingUi);
const materialsPage = listMaterialsPageCatalogueEntries();

check(
  "4a. Flooring productivity group has six rows",
  flooringProd?.ordinaryItems.length === 6 &&
    PROD_KEYS.every((key) =>
      flooringProd?.ordinaryItems.some((row) => row.productivityKey === key)
    )
);
check(
  "4b. No DNA calibration CTA for Flooring",
  flooringProd?.calibrationSupported === false &&
    isProductivityCalibrationSupported("flooring") === false
);
check(
  "4c. Framing allowances appear once on Subcontract",
  framingUi.length === 3 &&
    framingGroups.some((group) => group.workAreaLabel === "Flooring framing allowances")
);
check(
  "4d. Add/Edit path retained",
  read("components/rates/RatesNonDefaultSections.tsx").includes("showAddButton") &&
    read("components/rates/RatesTableSection.tsx").includes("RateEditDialog")
);
check(
  "4e. Search/filter find Flooring productivity",
  flooringProd?.ordinaryItems.every((item) =>
    productivitySearchMatches(item, "flooring")
  ) === true &&
    flooringProd?.ordinaryItems.some((item) =>
      productivitySearchMatches(item, "carpet")
    ) === true &&
    flooringProd?.ordinaryItems.every((item) =>
      productivityStatusMatches(item, "benchmark")
    ) === true
);
check(
  "4f. Productivity and framing are not Materials rows",
  [...PROD_KEYS, ...FRAMING_KEYS].every(
    (key) => !materialsPage.some((row) => row.item_key === key)
  )
);
check(
  "4g. Exact substrate products remain on Materials with honest COST",
  liveQuotrMaterialCost(BATHROOM_FLOOR_SUBSTRATE_PLYWOOD_KEY) === 145 &&
    liveQuotrMaterialCost(BATHROOM_FLOOR_SUBSTRATE_FC_19MM_2700_KEY) == null &&
    liveQuotrMaterialCost(BATHROOM_FLOOR_SUBSTRATE_SECURA_KEY) == null &&
    materialsPage.some((row) => row.item_key === BATHROOM_FLOOR_SUBSTRATE_PLYWOOD_KEY) &&
    materialsPage.some((row) => row.item_key === BATHROOM_FLOOR_SUBSTRATE_FC_19MM_2700_KEY)
);
check(
  "4h. Remaining exact FC/Secura rows stay Pricing Required, not $0",
  liveQuotrMaterialCost(BATHROOM_FLOOR_SUBSTRATE_FC_19MM_1800_KEY) == null &&
    liveQuotrMaterialCost(BATHROOM_FLOOR_SUBSTRATE_FC_19MM_GENERIC_KEY) == null &&
    liveQuotrMaterialCost(BATHROOM_FLOOR_SUBSTRATE_SECURA_KEY) == null &&
    materialsPage.some((row) => row.item_key === BATHROOM_FLOOR_SUBSTRATE_FC_19MM_1800_KEY) &&
    materialsPage.some((row) => row.item_key === BATHROOM_FLOOR_SUBSTRATE_SECURA_KEY)
);

console.log("\n=== 5–7. Company overrides, restore, tenant isolation ===\n");

for (const key of PROD_KEYS) {
  const unit = key === FLOORING_SUBSTRATE_INSTALL_HOURS_PER_SHEET ? "sheet" : "m2";
  const resolved = resolveFlooringProductivityHours({
    productivityKey: key,
    quantity: 1,
    unit,
    rates: [orgRate(key, COMPANY_HOURS[key], { unit })],
  });
  check(
    `5. ${key} company hours win`,
    resolved.hoursPerUnit === COMPANY_HOURS[key] && resolved.sourceType === "user_rate"
  );
  const restored = resolveFlooringProductivityHours({
    productivityKey: key,
    quantity: 1,
    unit,
    rates: [],
  });
  check(
    `6. ${key} removal restores Quotr`,
    restored.hoursPerUnit === PROD_HOURS[key] && restored.sourceType === "benchmark"
  );
}
for (const key of FRAMING_KEYS) {
  const resolved = resolveFlooringFramingAllowance({
    itemKey: key,
    rates: [orgRate(key, COMPANY_FRAMING[key], { rate_type: "allowance", unit: "m2" })],
  });
  check(
    `5. ${key} company COST wins`,
    resolved.costRate === COMPANY_FRAMING[key] && resolved.source === "company"
  );
  const restored = resolveFlooringFramingAllowance({ itemKey: key, rates: [] });
  check(
    `6. ${key} removal restores Quotr`,
    restored.costRate === FRAMING_COST[key] && restored.source === "quotr"
  );
}
check(
  "5z. One-key productivity override does not change sibling",
  resolveFlooringProductivityHours({
    productivityKey: FLOORING_VINYL_PLANK_REMOVE_HOURS_PER_M2,
    quantity: 1,
    rates: [
      orgRate(FLOORING_CARPET_REMOVE_HOURS_PER_M2, 0.15, { unit: "m2" }),
    ],
  }).hoursPerUnit === 0.2
);
check(
  "5y. One-key framing override does not change sibling",
  resolveFlooringFramingAllowance({
    itemKey: FLOORING_SUBFLOOR_FRAMING_STANDARD_ALLOWANCE_M2,
    rates: [
      orgRate(FLOORING_SUBFLOOR_FRAMING_MINOR_ALLOWANCE_M2, 55, {
        rate_type: "allowance",
      }),
    ],
  }).costRate === 90
);
check(
  "7. Tenant isolation",
  resolveFlooringProductivityHours({
    productivityKey: FLOORING_CARPET_REMOVE_HOURS_PER_M2,
    quantity: 1,
    rates: [orgRate(FLOORING_CARPET_REMOVE_HOURS_PER_M2, 0.15, { id: "tenant-a" })],
  }).hoursPerUnit === 0.15 &&
    resolveFlooringProductivityHours({
      productivityKey: FLOORING_CARPET_REMOVE_HOURS_PER_M2,
      quantity: 1,
      rates: [],
    }).hoursPerUnit === 0.12 &&
    resolveFlooringFramingAllowance({
      itemKey: FLOORING_SUBFLOOR_FRAMING_MINOR_ALLOWANCE_M2,
      rates: [
        orgRate(FLOORING_SUBFLOOR_FRAMING_MINOR_ALLOWANCE_M2, 55, {
          id: "tenant-a",
          rate_type: "allowance",
        }),
      ],
    }).costRate === 55 &&
    resolveFlooringFramingAllowance({
      itemKey: FLOORING_SUBFLOOR_FRAMING_MINOR_ALLOWANCE_M2,
      rates: [],
    }).costRate === 45
);

console.log("\n=== 8–9. Sheet-count basis and hours arithmetic ===\n");

const ply12 = calculateFlooringPortionPhysical({
  workArea: WA,
  portion: ordinary({
    area_m2: 12,
    substrate_required: true,
    substrate_family: "structural_plywood",
    substrate_item_key: BATHROOM_FLOOR_SUBSTRATE_PLYWOOD_KEY,
  }),
});
const plySheets = ply12.portion.substrate?.sheetCount ?? 0;
check(
  "8a. 12 m² plywood coverage 2.88 m² → 5 sheets",
  flooringSubstrateSheetCoverageM2(BATHROOM_FLOOR_SUBSTRATE_PLYWOOD_KEY) ===
    BATHROOM_SHEET_AREA_M2 &&
    BATHROOM_SHEET_AREA_M2 === 2.88 &&
    plySheets === 5 &&
    ply12.portion.substrate?.itemKey === BATHROOM_FLOOR_SUBSTRATE_PLYWOOD_KEY
);
check(
  "8b. Substrate install basis is purchased sheets not net m²",
  ply12.requirements.some(
    (row) =>
      row.kind === "labour" &&
      row.productivityBasis.key === FLOORING_SUBSTRATE_INSTALL_HOURS_PER_SHEET &&
      row.productivityBasis.quantity === 5 &&
      row.productivityBasis.unit === "sheet"
  )
);
check(
  "8c. No Bathroom waste on nested Flooring sheet count",
  plySheets === flooringSubstrateSheetCount(12, 2.88) &&
    BATHROOM_SHEET_WASTE_FACTOR === 0.1 &&
    flooringSubstrateSheetCount(20, 2.88) === 7 &&
    flooringSubstrateSheetCount(20, 2.88) !==
      Math.ceil((20 * (1 + BATHROOM_SHEET_WASTE_FACTOR)) / 2.88) &&
    !read("lib/estimate/flooring-physical.ts").includes("BATHROOM_SHEET_WASTE_FACTOR")
);
const substrateHours = resolveFlooringProductivityHours({
  productivityKey: FLOORING_SUBSTRATE_INSTALL_HOURS_PER_SHEET,
  quantity: plySheets,
  unit: "sheet",
});
check(
  "9a. 5 sheets × 0.50 h = 2.50 person-hours",
  substrateHours.hours === 2.5 && substrateHours.hoursPerUnit === 0.5
);
check(
  "9b. Carpet 10 m² × 0.12 = 1.20 hours",
  resolveFlooringProductivityHours({
    productivityKey: FLOORING_CARPET_REMOVE_HOURS_PER_M2,
    quantity: 10,
  }).hours === 1.2
);
check(
  "9c. Vinyl 10 m² × 0.20 = 2.00 hours",
  resolveFlooringProductivityHours({
    productivityKey: FLOORING_VINYL_PLANK_REMOVE_HOURS_PER_M2,
    quantity: 10,
  }).hours === 2
);
check(
  "9d. Tile 10 m² × 0.55 = 5.50 hours",
  resolveFlooringProductivityHours({
    productivityKey: FLOORING_TILE_REMOVE_HOURS_PER_M2,
    quantity: 10,
  }).hours === 5.5
);
check(
  "9e. Hardwood 10 m² × 0.35 = 3.50 hours",
  resolveFlooringProductivityHours({
    productivityKey: FLOORING_HARDWOOD_REMOVE_HOURS_PER_M2,
    quantity: 10,
  }).hours === 3.5
);
check(
  "9f. Substrate removal 10 m² × 0.30 = 3.00 hours",
  resolveFlooringProductivityHours({
    productivityKey: FLOORING_SUBSTRATE_REMOVE_HOURS_PER_M2,
    quantity: 10,
  }).hours === 3
);

console.log("\n=== 10. Removal additivity ===\n");

const carpetOnly = calculateFlooringPortionPhysical({
  workArea: WA,
  portion: ordinary({
    finish_removal_required: true,
    existing_finish_type: "carpet",
    substrate_removal_required: false,
  }),
});
const carpetAndSub = calculateFlooringPortionPhysical({
  workArea: WA,
  portion: ordinary({
    finish_removal_required: true,
    existing_finish_type: "carpet",
    substrate_removal_required: true,
  }),
});
const carpetHoursKey = carpetOnly.requirements.filter(
  (row) =>
    row.kind === "labour" &&
    row.productivityBasis.key === FLOORING_CARPET_REMOVE_HOURS_PER_M2
);
const bothHoursKeys = carpetAndSub.requirements.filter((row) => row.kind === "labour");
check(
  "10a. Finish removal without substrate emits only finish hours identity",
  carpetHoursKey.length === 1 &&
    carpetHoursKey[0] &&
    carpetHoursKey[0].kind === "labour" &&
    carpetHoursKey[0].productivityBasis.quantity === 10 &&
    !carpetOnly.requirements.some(
      (row) =>
        row.kind === "labour" &&
        row.productivityBasis.key === FLOORING_SUBSTRATE_REMOVE_HOURS_PER_M2
    )
);
check(
  "10b. Finish + substrate removal are separate and additive",
  bothHoursKeys.length === 2 &&
    bothHoursKeys.some(
      (row) =>
        row.kind === "labour" &&
        row.productivityBasis.key === FLOORING_CARPET_REMOVE_HOURS_PER_M2
    ) &&
    bothHoursKeys.some(
      (row) =>
        row.kind === "labour" &&
        row.productivityBasis.key === FLOORING_SUBSTRATE_REMOVE_HOURS_PER_M2
    ) &&
    resolveFlooringProductivityHours({
      productivityKey: FLOORING_CARPET_REMOVE_HOURS_PER_M2,
      quantity: 10,
    }).hours! +
      resolveFlooringProductivityHours({
        productivityKey: FLOORING_SUBSTRATE_REMOVE_HOURS_PER_M2,
        quantity: 10,
      }).hours! ===
      4.2
);

console.log("\n=== 11. Framing allowance arithmetic ===\n");

check(
  "11a. 10 m² minor = $450",
  flooringFramingAuthorityCost(FLOORING_SUBFLOOR_FRAMING_MINOR_ALLOWANCE_M2, 10) ===
    450
);
check(
  "11b. 10 m² standard = $900",
  flooringFramingAuthorityCost(
    FLOORING_SUBFLOOR_FRAMING_STANDARD_ALLOWANCE_M2,
    10
  ) === 900
);
check(
  "11c. 10 m² major = $1,600",
  flooringFramingAuthorityCost(FLOORING_SUBFLOOR_FRAMING_MAJOR_ALLOWANCE_M2, 10) ===
    1600
);
const framingPhysical = calculateFlooringPortionPhysical({
  workArea: WA,
  portion: ordinary({
    framing_required: true,
    framing_allowance_level: "standard",
  }),
});
check(
  "11d. Physical framing quantity is net Flooring Area m²",
  framingPhysical.requirements.some(
    (row) =>
      row.kind === "material" &&
      row.componentKey === FLOORING_SUBFLOOR_FRAMING_STANDARD_ALLOWANCE_M2 &&
      row.baseQuantity === 10 &&
      row.baseUnit === "m2"
  )
);

console.log("\n=== 12. Physical-quantity independence ===\n");

const withHoursOverride = calculateFlooringPortionPhysical({
  workArea: WA,
  portion: ordinary({
    area_m2: 12,
    substrate_required: true,
    substrate_family: "structural_plywood",
    substrate_item_key: BATHROOM_FLOOR_SUBSTRATE_PLYWOOD_KEY,
    finish_removal_required: true,
    existing_finish_type: "carpet",
    substrate_removal_required: false,
    framing_required: true,
    framing_allowance_level: "minor",
  }),
});
const finishOnly = calculateFlooringPortionPhysical({
  workArea: WA,
  portion: ordinary({ area_m2: 12 }),
});
check(
  "12a. Override does not change physical quantities",
  withHoursOverride.portion.substrate?.sheetCount === 5 &&
    withHoursOverride.portion.physicalNetAreaM2 === 12 &&
    withHoursOverride.requirements.some(
      (row) =>
        row.kind === "subcontract" &&
        row.componentKey === FLOORING_CARPET_SUPPLY_INSTALL_M2
    )
);
check(
  "12b. Productivity override changes hours only",
  resolveFlooringProductivityHours({
    productivityKey: FLOORING_SUBSTRATE_INSTALL_HOURS_PER_SHEET,
    quantity: 5,
    unit: "sheet",
    rates: [orgRate(FLOORING_SUBSTRATE_INSTALL_HOURS_PER_SHEET, 0.65, { unit: "sheet" })],
  }).hours === 3.25 &&
    liveQuotrMaterialCost(BATHROOM_FLOOR_SUBSTRATE_PLYWOOD_KEY) === 145 &&
    liveQuotrMaterialCost(FLOORING_CARPENTER_LABOUR_RATE_KEY) === 60
);
check(
  "12c. Framing override changes allowance money only",
  flooringFramingAuthorityCost(
    FLOORING_SUBFLOOR_FRAMING_MINOR_ALLOWANCE_M2,
    10,
    [orgRate(FLOORING_SUBFLOOR_FRAMING_MINOR_ALLOWANCE_M2, 55, { rate_type: "allowance" })]
  ) === 550 &&
    resolveFlooringProductivityHours({
      productivityKey: FLOORING_CARPET_REMOVE_HOURS_PER_M2,
      quantity: 10,
    }).hours === 1.2
);
check(
  "12d. Removal/substrate selection does not alter finish-package quantity",
  withHoursOverride.requirements.some(
    (row) =>
      row.kind === "material" &&
      row.componentKey === FLOORING_CARPET_SUPPLY_INSTALL_M2 &&
      row.baseQuantity === 12
  ) &&
    finishOnly.requirements.some(
      (row) =>
        row.kind === "material" &&
        row.componentKey === FLOORING_CARPET_SUPPLY_INSTALL_M2 &&
        row.baseQuantity === 12
    )
);
check(
  "12e. Invalid company entries do not become authority",
  resolveFlooringProductivityHours({
    productivityKey: FLOORING_CARPET_REMOVE_HOURS_PER_M2,
    quantity: 10,
    rates: [orgRate(FLOORING_CARPET_REMOVE_HOURS_PER_M2, 0)],
  }).hoursPerUnit === 0.12 &&
    resolveFlooringProductivityHours({
      productivityKey: FLOORING_CARPET_REMOVE_HOURS_PER_M2,
      quantity: 10,
      rates: [
        orgRate(FLOORING_CARPET_REMOVE_HOURS_PER_M2, 0.15, { rate_type: "material" }),
      ],
    }).hoursPerUnit === 0.12 &&
    resolveFlooringFramingAllowance({
      itemKey: FLOORING_SUBFLOOR_FRAMING_MINOR_ALLOWANCE_M2,
      rates: [
        orgRate(FLOORING_SUBFLOOR_FRAMING_MINOR_ALLOWANCE_M2, 0, {
          rate_type: "allowance",
        }),
      ],
    }).costRate === 45 &&
    resolveFlooringFramingAllowance({
      itemKey: FLOORING_SUBFLOOR_FRAMING_MINOR_ALLOWANCE_M2,
      rates: [
        orgRate(FLOORING_SUBFLOOR_FRAMING_MINOR_ALLOWANCE_M2, 55, {
          rate_type: "subcontractor",
        }),
      ],
    }).costRate === 45
);
check(
  "12f. Missing, NaN, or inactive company rows do not become authority",
  resolveFlooringProductivityHours({
    productivityKey: FLOORING_CARPET_REMOVE_HOURS_PER_M2,
    quantity: 10,
    rates: [orgRate(FLOORING_CARPET_REMOVE_HOURS_PER_M2, null)],
  }).hoursPerUnit === 0.12 &&
    resolveFlooringProductivityHours({
      productivityKey: FLOORING_TILE_REMOVE_HOURS_PER_M2,
      quantity: 10,
      rates: [orgRate(FLOORING_TILE_REMOVE_HOURS_PER_M2, Number.NaN)],
    }).hoursPerUnit === 0.55 &&
    resolveFlooringFramingAllowance({
      itemKey: FLOORING_SUBFLOOR_FRAMING_STANDARD_ALLOWANCE_M2,
      rates: [
        orgRate(FLOORING_SUBFLOOR_FRAMING_STANDARD_ALLOWANCE_M2, 105, {
          rate_type: "allowance",
          active: false,
        }),
      ],
    }).costRate === 90
);

console.log("\n=== 13–15. Custom/specialist/unresolved/$0 safety ===\n");

const customRemoval = calculateFlooringPortionPhysical({
  workArea: WA,
  portion: ordinary({
    finish_removal_required: true,
    existing_finish_type: "other",
    substrate_removal_required: false,
  }),
});
check(
  "13a. Custom finish removal does not receive ordinary removal rates",
  customRemoval.requirements.some(
    (row) => row.componentKey === FLOORING_CUSTOM_REMOVAL_COMPONENT
  ) &&
    !customRemoval.requirements.some(
      (row) =>
        row.kind === "labour" &&
        (PROD_KEYS as readonly string[]).includes(row.productivityBasis.key)
    )
);
const specialist = calculateFlooringPortionPhysical({
  workArea: WA,
  portion: {
    ...createEmptyFlooringPortion({
      id: "fa_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa2",
      label: "Entry",
    }),
    finish_type: "other",
    specialist_kind: "structural",
    other_description: "Engineered structural flooring",
    area_input_method: "direct_m2",
    area_m2: 10,
    finish_removal_required: true,
    existing_finish_type: "tile",
    framing_required: true,
    framing_allowance_level: "major",
  },
});
check(
  "13b. Specialist does not inherit ordinary removal or framing",
  specialist.requirements.every(
    (row) => row.componentKey === FLOORING_SPECIALIST_COMPONENT
  ) &&
    !specialist.requirements.some((row) =>
      isFlooringFramingAllowanceKey(row.componentKey)
    ) &&
    !specialist.requirements.some(
      (row) =>
        row.kind === "labour" &&
        (PROD_KEYS as readonly string[]).includes(row.productivityBasis.key)
    )
);
check(
  "13c. Structural specialist does not use minor/standard/major allowances",
  resolveFlooringFramingAllowance({
    itemKey: "flooring.subfloor_framing.structural.allowance.m2",
  }).costRate == null && specialist.portion.completeness === "UNSUPPORTED_SPECIALIST"
);
const genericFc = liveQuotrMaterialCost(BATHROOM_FLOOR_SUBSTRATE_FC_19MM_GENERIC_KEY);
check(
  "14. Unresolved substrate products do not inherit plywood COST",
  liveQuotrMaterialCost(BATHROOM_FLOOR_SUBSTRATE_PLYWOOD_KEY) === 145 &&
    genericFc == null &&
    liveQuotrMaterialCost("sheet.particleboard.flooring.each") == null &&
    liveQuotrMaterialCost("sheet.plywood.22mm.each") == null &&
    getCatalogueEntry("sheet.particleboard.flooring.each") == null &&
    getCatalogueEntry("sheet.plywood.22mm.each") == null
);
check(
  "15. Unresolved money/hours are null, not $0",
  resolveFlooringProductivityHours({
    productivityKey: FLOORING_CUSTOM_REMOVAL_COMPONENT,
    quantity: 10,
  }).hours == null &&
    resolveFlooringFramingAllowance({ itemKey: FLOORING_SPECIALIST_COMPONENT })
      .costRate == null &&
    liveQuotrMaterialCost(BATHROOM_FLOOR_SUBSTRATE_SECURA_KEY) == null &&
    resolveFlooringProductivityHours({
      productivityKey: FLOORING_CARPET_REMOVE_HOURS_PER_M2,
      quantity: 10,
      rates: [orgRate(FLOORING_CARPET_REMOVE_HOURS_PER_M2, 0)],
    }).hours !== 0
);

console.log("\n=== 16–18. Legacy isolation, no hosted money, coverage ===\n");

check(
  "16a. No legacy $22 / 0.8 h / Bathroom 0.25–0.40 / Demolition $28 / Kitchen $180 reuse",
  liveQuotrProductivity(FLOORING_CARPET_REMOVE_HOURS_PER_M2) !==
    FITOUT_BENCHMARKS.removalPerM2.cost &&
    liveQuotrProductivity(FLOORING_SUBSTRATE_INSTALL_HOURS_PER_SHEET) !== 0.4 &&
    liveQuotrProductivity(FLOORING_CARPET_REMOVE_HOURS_PER_M2) !== 0.25 &&
    liveQuotrProductivity(FLOORING_TILE_REMOVE_HOURS_PER_M2) !== 0.25 &&
    liveQuotrProductivity("flooring.labour_hours_per_m2") == null &&
    getQuotrProductivityBenchmark("flooring.labour_hours_per_m2") == null &&
    liveQuotrMaterialCost(FLOORING_CARPET_SUPPLY_INSTALL_M2) !==
      FITOUT_BENCHMARKS.flooringPerM2.cost &&
    liveQuotrMaterialCost(FLOORING_CARPET_SUPPLY_INSTALL_M2) !==
      DEMOLITION_BENCHMARKS.flooringPerM2.cost &&
    liveQuotrMaterialCost(FLOORING_CARPET_SUPPLY_INSTALL_M2) !==
      KITCHEN_BENCHMARKS.flooring.cost
);
const nested = calculateFlooring(ctx(persist([ordinary({ area_m2: 12 })])), WA);
const legacy = calculateFlooring(
  ctx([{ key: "flooring.area_m2", work_area_id: WA.id, value: 20 }]),
  WA
);
check(
  "16b. Nested commercialises without FITOUT; flat legacy unchanged",
  nested.lineItems.length > 0 &&
    nested.lineItems.every(
      (row) => row.costRate !== FITOUT_BENCHMARKS.flooringPerM2.cost
    ) &&
    (nested.requirements?.length ?? 0) > 0 &&
    legacy.lineItems.length > 0 &&
    legacy.lineItems.some(
      (row) => row.costRate === FITOUT_BENCHMARKS.flooringPerM2.cost
    )
);
check(
  "17. Nested calculator emits hosted money from 04C identities after commercialisation",
  nested.lineItems.length > 0 &&
    calculateFlooring(
      ctx(
        persist([
          ordinary({
            area_m2: 12,
            substrate_required: true,
            substrate_family: "structural_plywood",
            substrate_item_key: BATHROOM_FLOOR_SUBSTRATE_PLYWOOD_KEY,
            framing_required: true,
            framing_allowance_level: "major",
            finish_removal_required: true,
            existing_finish_type: "tile",
            substrate_removal_required: true,
          }),
        ])
      ),
      WA
    ).lineItems.some(
      (row) => row.itemKey === FLOORING_SUBFLOOR_FRAMING_MAJOR_ALLOWANCE_M2
    )
);
check(
  "17b. Nested Flooring still does not consume FITOUT $120/m²",
  nested.lineItems.every((row) => row.costRate !== FITOUT_BENCHMARKS.flooringPerM2.cost) &&
    FITOUT_BENCHMARKS.flooringPerM2.cost === 120 &&
    calculateFlooring(
      ctx(
        persist([
          ordinary({
            area_m2: 12,
            substrate_required: true,
            substrate_family: "structural_plywood",
            substrate_item_key: BATHROOM_FLOOR_SUBSTRATE_PLYWOOD_KEY,
          }),
        ])
      ),
      WA
    ).lineItems.every((row) => row.costRate !== FITOUT_BENCHMARKS.flooringPerM2.cost)
);
const coverage = verifyRegisteredWorkAreaBenchmarkCoverage("flooring");
check(
  "18. Coverage: packages, plywood, productivity, framing, removal resolve; L5 blocked",
  coverage.ok &&
    coverage.resolves.length >= 6 + 1 + 1 + 3 + 5 &&
    liveQuotrProductivity(FLOORING_SUBSTRATE_INSTALL_HOURS_PER_SHEET) === 0.5 &&
    coverage.needsOwnerApproval.length > 0 &&
    workAreaMayCloseAtL5(coverage) === false &&
    FLOORING_BENCHMARK_REQUIREMENTS.some(
      (row) =>
        row.component === "Hosted commercial line items" &&
        row.outcome === "RESOLVES_WITH_QUOTR"
    ) &&
    FLOORING_BENCHMARK_REQUIREMENTS.some(
      (row) =>
        row.component === "Pricing page integration" &&
        row.outcome === "NEEDS_NEW_QUOTR_BENCHMARK"
    )
);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
