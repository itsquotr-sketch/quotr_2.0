/**
 * CLADDING-04B — material COST and productivity authority.
 * Commercial line items stay empty.
 */
import { readFileSync } from "node:fs";
import type { OrganisationRate } from "../components/setup/types";
import { calculateCladding } from "../lib/estimate/calculators/cladding";
import {
  CLADDING_MATERIAL_BENCHMARKS,
  CLADDING_PRODUCTIVITY_BENCHMARKS,
  CLADDING_UNRESOLVED_AUTHORITY_KEYS,
  claddingMaterialExtendedCost,
  resolveCladdingMaterialAuthority,
  resolveCladdingProductivityAuthority,
} from "../lib/estimate/cladding-authority";
import {
  CLADDING_BOARD_AND_BATTEN_SHEET_M2,
  CLADDING_CARPENTER_LABOUR_RATE_KEY,
  CLADDING_CAVITY_UNRESOLVED_M2,
  CLADDING_CUSTOM_INSTALL_HOURS_PER_LM,
  CLADDING_CUSTOM_REMOVE_HOURS_PER_M2,
  CLADDING_LABOUR_OPERATION_KEYS,
  CLADDING_LINEAR_MATERIAL_KEYS,
  CLADDING_SPECIALIST_BRICK_VENEER,
  CLADDING_SPECIALIST_CUSTOM,
  CLADDING_SPECIALIST_MASONRY,
  CLADDING_TIMBER_BEVELBACK_142X18_LM,
  CLADDING_TIMBER_BEVELBACK_187X18_LM,
  CLADDING_TRIMS_UNRESOLVED,
  CLADDING_UNDERLAY_OR_RAB_UNRESOLVED_M2,
  claddingBattenMaterialKey,
} from "../lib/estimate/cladding-identities";
import { calculateCladdingPhysical } from "../lib/estimate/cladding-physical";
import { resolveCladdingCarpenterHourlyCost } from "../lib/estimate/cladding-rate-resolution";
import {
  CLADDING_PORTIONS_FACT_KEY,
  CLADDING_V1_HUMAN_QA_FROZEN,
  createEmptyCladdingPortion,
  type CladdingPortion,
} from "../lib/estimate/cladding-portions";
import { DOORS_V1_HUMAN_QA_FROZEN } from "../lib/estimate/doors-identities";
import { FLOORING_V1_HUMAN_QA_FROZEN } from "../lib/estimate/flooring-identities";
import { getQuotrProductivityBenchmark } from "../lib/estimate/productivity";
import type { LabourRequirement, MaterialRequirement } from "../lib/estimate/requirements";
import { workAreaMayCloseAtL5 } from "../lib/estimate/benchmark-coverage";
import { verifyRegisteredWorkAreaBenchmarkCoverage } from "../lib/estimate/work-area-benchmark-coverage";
import { getCatalogueEntry } from "../lib/rates/catalogue";
import { buildMaterialRegistry } from "../lib/rates/material-registry";
import { buildProductivityRegistry, isProductivityCalibrationSupported } from "../lib/rates/productivity-registry";
import type { EstimateFact } from "../lib/estimate/types";
import { getWorkAreaSupportEntry } from "../lib/work-areas/support-contract";

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
  return actual != null && Math.abs(actual - expected) < 1e-9;
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

function factsFor(rows: CladdingPortion[]): EstimateFact[] {
  return [
    {
      key: CLADDING_PORTIONS_FACT_KEY,
      work_area_id: "c1",
      value: rows,
      source: "user",
    },
  ];
}

function physicalOf(rows: CladdingPortion[]) {
  return calculateCladdingPhysical({
    facts: factsFor(rows),
    workArea: { id: "c1", type: "cladding" },
  });
}

function companyRate(
  overrides: Partial<OrganisationRate> & Pick<OrganisationRate, "item_key" | "rate_type">
): OrganisationRate {
  return {
    id: overrides.id ?? "rate-1",
    trade: null,
    work_area_type: "cladding",
    label: overrides.item_key,
    unit: "lm",
    cost_rate: 9,
    sell_rate: null,
    markup_percent: null,
    active: true,
    ...overrides,
  };
}

const EXPECTED_MATERIAL: Record<string, number> = {
  "cladding.timber.bevelback.142x18.lm": 12,
  "cladding.timber.bevelback.187x18.lm": 15,
  "cladding.timber.bevelback.215x18.lm": 18,
  "cladding.timber.bevelback.230x18.lm": 19,
  "cladding.timber.rusticated.135x18.lm": 13,
  "cladding.timber.rusticated.180x18.lm": 16,
  "cladding.timber.rusticated.215x18.lm": 19,
  "cladding.timber.rusticated.230x18.lm": 20,
  "cladding.timber.vertical_shiplap.90x21.lm": 10,
  "cladding.timber.vertical_shiplap.135x21.lm": 14,
  "cladding.fibre_cement.weatherboard.150.lm": 12,
  "cladding.fibre_cement.weatherboard.180.lm": 18.5,
  "cladding.timber.board_and_batten.sheet_board.m2": 65,
  "cladding.timber.board_and_batten.batten.45x19.lm": 3.5,
  "cladding.timber.board_and_batten.batten.45x20.lm": 3.6,
  "cladding.timber.board_and_batten.batten.65x19.lm": 4.75,
  "cladding.timber.board_and_batten.batten.65x20.lm": 4.9,
  "cladding.timber.board_and_batten.batten.90x19.lm": 6.5,
  "cladding.timber.board_and_batten.batten.90x20.lm": 6.7,
  "cladding.cavity.timber_batten.m2": 9,
  "cladding.wall_underlay.flexible.m2": 5,
  "cladding.rigid_air_barrier.m2": 28,
};

const EXPECTED_HOURS: Record<string, number> = {
  "cladding.timber.bevelback.install.hours_per_lm": 0.12,
  "cladding.timber.rusticated.install.hours_per_lm": 0.12,
  "cladding.timber.vertical_shiplap.install.hours_per_lm": 0.11,
  "cladding.fibre_cement.weatherboard.install.hours_per_lm": 0.13,
  "cladding.timber.board_and_batten.sheet_board.install.hours_per_m2": 0.65,
  "cladding.timber.board_and_batten.batten.install.hours_per_lm": 0.08,
  "cladding.timber.bevelback.remove.hours_per_m2": 0.3,
  "cladding.timber.rusticated.remove.hours_per_m2": 0.3,
  "cladding.timber.vertical_shiplap.remove.hours_per_m2": 0.35,
  "cladding.timber.board_and_batten.remove.hours_per_m2": 0.4,
  "cladding.fibre_cement.weatherboard.remove.hours_per_m2": 0.4,
  "cladding.cavity.install.hours_per_m2": 0.15,
  "cladding.wall_underlay.install.hours_per_m2": 0.08,
  "cladding.rigid_air_barrier.install.hours_per_m2": 0.18,
};

check(
  "ordinary material benchmarks match the owner values",
  CLADDING_MATERIAL_BENCHMARKS.length === Object.keys(EXPECTED_MATERIAL).length &&
    CLADDING_MATERIAL_BENCHMARKS.every(
      (row) =>
        EXPECTED_MATERIAL[row.key] === row.costExGst &&
        resolveCladdingMaterialAuthority({ identity: row.key }).value === row.costExGst &&
        resolveCladdingMaterialAuthority({ identity: row.key }).source === "quotr"
    )
);

check(
  "ordinary productivity benchmarks match the owner values",
  CLADDING_PRODUCTIVITY_BENCHMARKS.length === Object.keys(EXPECTED_HOURS).length &&
    CLADDING_PRODUCTIVITY_BENCHMARKS.every((row) => {
      const live = getQuotrProductivityBenchmark(row.key);
      const resolved = resolveCladdingProductivityAuthority({ identity: row.key });
      return (
        EXPECTED_HOURS[row.key] === row.hoursPerUnit &&
        live?.hoursPerUnit === row.hoursPerUnit &&
        resolved.value === row.hoursPerUnit &&
        resolved.source === "quotr"
      );
    })
);

const battenKeys = [45, 65, 90].flatMap((width) =>
  [19, 20].map((thickness) => claddingBattenMaterialKey(width, thickness))
);
check(
  "material identities are the physical keys, including every batten size",
  CLADDING_MATERIAL_BENCHMARKS.every((row) => getCatalogueEntry(row.key)?.item_key === row.key) &&
    CLADDING_LINEAR_MATERIAL_KEYS.every((key) => EXPECTED_MATERIAL[key] != null) &&
    battenKeys.every((key) => key != null && EXPECTED_MATERIAL[key] != null) &&
    CLADDING_MATERIAL_BENCHMARKS.some((row) => row.key === CLADDING_BOARD_AND_BATTEN_SHEET_M2)
);

check(
  "productivity identities are the physical operation keys",
  CLADDING_PRODUCTIVITY_BENCHMARKS.every(
    (row) =>
      (CLADDING_LABOUR_OPERATION_KEYS as readonly string[]).includes(row.key) &&
      getCatalogueEntry(row.key)?.item_key === row.key &&
      getCatalogueEntry(row.key)?.defaultSellRate == null
  ) &&
    CLADDING_MATERIAL_BENCHMARKS.every((row) => getCatalogueEntry(row.key)?.defaultSellRate == null)
);

const bevel187 = companyRate({
  item_key: CLADDING_TIMBER_BEVELBACK_187X18_LM,
  rate_type: "material",
  cost_rate: 22,
  unit: "lm",
});
const orgA = [bevel187];
const orgB = [
  companyRate({
    id: "other-org",
    item_key: CLADDING_TIMBER_BEVELBACK_187X18_LM,
    rate_type: "material",
    cost_rate: 40,
    unit: "lm",
  }),
];
check(
  "a company material override wins and removing it restores Quotr",
  resolveCladdingMaterialAuthority({ identity: CLADDING_TIMBER_BEVELBACK_187X18_LM, rates: orgA }).value === 22 &&
    resolveCladdingMaterialAuthority({ identity: CLADDING_TIMBER_BEVELBACK_187X18_LM, rates: orgA }).source === "company" &&
    resolveCladdingMaterialAuthority({ identity: CLADDING_TIMBER_BEVELBACK_187X18_LM }).value === 15 &&
    resolveCladdingMaterialAuthority({ identity: CLADDING_TIMBER_BEVELBACK_187X18_LM }).source === "quotr"
);
check(
  "one material key does not change its sibling or another organisation",
  resolveCladdingMaterialAuthority({ identity: CLADDING_TIMBER_BEVELBACK_142X18_LM, rates: orgA }).value === 12 &&
    resolveCladdingMaterialAuthority({ identity: CLADDING_TIMBER_BEVELBACK_187X18_LM, rates: orgB }).value === 40 &&
    resolveCladdingMaterialAuthority({ identity: CLADDING_TIMBER_BEVELBACK_187X18_LM, rates: orgA }).value === 22
);

const installOverride = companyRate({
  item_key: "cladding.timber.bevelback.install.hours_per_lm",
  rate_type: "productivity",
  unit: "lm",
  cost_rate: 0.2,
});
check(
  "material, productivity and carpenter COST stay independent",
  resolveCladdingProductivityAuthority({
    identity: "cladding.timber.bevelback.install.hours_per_lm",
    rates: [bevel187],
  }).value === 0.12 &&
    resolveCladdingMaterialAuthority({
      identity: CLADDING_TIMBER_BEVELBACK_187X18_LM,
      rates: [installOverride],
    }).value === 15 &&
    resolveCladdingCarpenterHourlyCost({ rates: [bevel187, installOverride] }).source === "quotr" &&
    resolveCladdingProductivityAuthority({
      identity: "cladding.timber.bevelback.install.hours_per_lm",
      rates: [installOverride],
    }).value === 0.2
);

const carpenterOverride = companyRate({
  item_key: CLADDING_CARPENTER_LABOUR_RATE_KEY,
  rate_type: "labour",
  unit: "hour",
  cost_rate: 75,
  work_area_type: null,
});
check(
  "carpenter hourly COST uses the existing identity and ignores labourer and general rows",
  resolveCladdingCarpenterHourlyCost({ rates: [carpenterOverride] }).value === 75 &&
    resolveCladdingCarpenterHourlyCost({
      rates: [
        companyRate({
          item_key: "labour.labourer.hour",
          rate_type: "labour",
          unit: "hour",
          cost_rate: 40,
        }),
        companyRate({
          item_key: "labour.general.hour",
          rate_type: "labour",
          unit: "hour",
          cost_rate: 55,
        }),
      ],
    }).source === "quotr" &&
    resolveCladdingCarpenterHourlyCost({}).identity === CLADDING_CARPENTER_LABOUR_RATE_KEY
);

function rejected(row: OrganisationRate): boolean {
  return (
    resolveCladdingMaterialAuthority({
      identity: CLADDING_TIMBER_BEVELBACK_187X18_LM,
      rates: [row],
    }).source === "quotr" &&
    resolveCladdingMaterialAuthority({
      identity: CLADDING_TIMBER_BEVELBACK_187X18_LM,
      rates: [row],
    }).value === 15
  );
}
check(
  "zero, negative, inactive, wrong type and wrong unit do not win",
  rejected(companyRate({ item_key: CLADDING_TIMBER_BEVELBACK_187X18_LM, rate_type: "material", cost_rate: 0, unit: "lm" })) &&
    rejected(companyRate({ item_key: CLADDING_TIMBER_BEVELBACK_187X18_LM, rate_type: "material", cost_rate: -4, unit: "lm" })) &&
    rejected(companyRate({ item_key: CLADDING_TIMBER_BEVELBACK_187X18_LM, rate_type: "material", cost_rate: 30, unit: "lm", active: false })) &&
    rejected(companyRate({ item_key: CLADDING_TIMBER_BEVELBACK_187X18_LM, rate_type: "productivity", cost_rate: 30, unit: "lm" })) &&
    rejected(companyRate({ item_key: CLADDING_TIMBER_BEVELBACK_187X18_LM, rate_type: "material", cost_rate: 30, unit: "m2" })) &&
    rejected(
      companyRate({
        item_key: CLADDING_TIMBER_BEVELBACK_187X18_LM,
        rate_type: "material",
        cost_rate: null,
        unit: "lm",
        sell_rate: 99,
      })
    )
);

check(
  "turning benchmarks off leaves Pricing Required rather than zero",
  resolveCladdingMaterialAuthority({
    identity: CLADDING_TIMBER_BEVELBACK_187X18_LM,
    allowBenchmarkRates: false,
  }).value === null &&
    resolveCladdingMaterialAuthority({
      identity: CLADDING_TIMBER_BEVELBACK_187X18_LM,
      allowBenchmarkRates: false,
    }).source === "pricing_required"
);

const narrow = physicalOf([
  portion({
    id: "narrow",
    approved_profile_id: "timber_bevelback_142x18",
    nominal_width_mm: 142,
    effective_cover_mm: 110,
  }),
]);
const wide = physicalOf([portion({ id: "wide" })]);
const narrowKey = narrow.requirements.find((row) => row.kind === "material" && row.componentKey.includes("142x18"));
const wideKey = wide.requirements.find((row) => row.kind === "material" && row.componentKey.includes("187x18"));
check(
  "profile size selects the matching identity and leaves quantity unchanged by the rate",
  narrowKey?.componentKey === CLADDING_TIMBER_BEVELBACK_142X18_LM &&
    wideKey?.componentKey === CLADDING_TIMBER_BEVELBACK_187X18_LM &&
    close((narrowKey as MaterialRequirement | undefined)?.baseQuantity, 30 / 0.11) &&
    close((wideKey as MaterialRequirement | undefined)?.baseQuantity, 30 / 0.155) &&
    resolveCladdingMaterialAuthority({ identity: CLADDING_TIMBER_BEVELBACK_142X18_LM, rates: orgA }).value === 12
);

const sheet = physicalOf([
  portion({
    id: "sheet",
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
  }),
]);
const board = sheet.requirements.find(
  (row) => row.componentKey === CLADDING_BOARD_AND_BATTEN_SHEET_M2
) as MaterialRequirement | undefined;
const batten = sheet.requirements.find((row) =>
  row.componentKey.includes("batten.65x19")
) as MaterialRequirement | undefined;
const sheetCount = sheet.requirements.find((row) =>
  row.componentKey.includes("sheet_equivalent")
) as MaterialRequirement | undefined;
const boardRate = resolveCladdingMaterialAuthority({ identity: CLADDING_BOARD_AND_BATTEN_SHEET_M2 }).value ?? 0;
const battenRate =
  resolveCladdingMaterialAuthority({
    identity: claddingBattenMaterialKey(65, 19) ?? "",
  }).value ?? 0;
check(
  "board m² and batten lm resolve separately, and sheet count does not multiply COST",
  close(board?.baseQuantity, 14.4) &&
    close(batten?.baseQuantity, 9.6) &&
    sheetCount?.baseQuantity === 5 &&
    sheetCount?.materialKey == null &&
    close(claddingMaterialExtendedCost(boardRate, board?.baseQuantity ?? 0), 65 * 14.4) &&
    !close(claddingMaterialExtendedCost(boardRate, sheetCount?.baseQuantity ?? 0), 65 * 14.4) &&
    close(claddingMaterialExtendedCost(battenRate, batten?.baseQuantity ?? 0), 4.75 * 9.6) &&
    resolveCladdingMaterialAuthority({
      identity: CLADDING_BOARD_AND_BATTEN_SHEET_M2,
      rates: [
        companyRate({
          item_key: claddingBattenMaterialKey(65, 19) ?? "",
          rate_type: "material",
          unit: "lm",
          cost_rate: 9,
        }),
      ],
    }).value === 65
);

const removal = physicalOf([
  portion({
    id: "remove",
    scope_intent: "removal_only",
    existing_cladding_removal_required: true,
    cladding_system: "timber_bevelback",
  }),
]);
const removalLabour = removal.requirements.filter(
  (row) => row.kind === "labour"
) as LabourRequirement[];
check(
  "ordinary removal uses carpenter and not labourer",
  removalLabour.length > 0 &&
    removalLabour.every(
      (row) => row.trade === "carpenter" && row.rateKey === CLADDING_CARPENTER_LABOUR_RATE_KEY
    ) &&
    !removalLabour.some((row) => row.trade === "labourer")
);

const nullMoneyKeys = [
  CLADDING_CAVITY_UNRESOLVED_M2,
  CLADDING_UNDERLAY_OR_RAB_UNRESOLVED_M2,
  CLADDING_TRIMS_UNRESOLVED,
  CLADDING_SPECIALIST_BRICK_VENEER,
  CLADDING_SPECIALIST_MASONRY,
  CLADDING_SPECIALIST_CUSTOM,
  CLADDING_CUSTOM_INSTALL_HOURS_PER_LM,
  CLADDING_CUSTOM_REMOVE_HOURS_PER_M2,
];
check(
  "custom, specialist and accessory identities stay null, never zero",
  nullMoneyKeys.every((key) => {
    const material = resolveCladdingMaterialAuthority({
      identity: key,
      rates: [companyRate({ item_key: key, rate_type: "material", unit: "m2", cost_rate: 10 })],
    });
    const productivity = resolveCladdingProductivityAuthority({
      identity: key,
      rates: [companyRate({ item_key: key, rate_type: "productivity", unit: "m2", cost_rate: 0.2 })],
    });
    return material.value === null && productivity.value === null && material.value !== 0;
  }) &&
    (CLADDING_UNRESOLVED_AUTHORITY_KEYS as readonly string[]).every(
      (key) => getQuotrProductivityBenchmark(key) == null
    )
);

const withAccessories = physicalOf([
  portion({
    id: "accessories",
    cavity_included: true,
    wall_underlay_or_rab_included: true,
    trims_flashings_corners_included: true,
  }),
]);
const accessoryMoney = withAccessories.requirements.filter((row) =>
  [CLADDING_UNDERLAY_OR_RAB_UNRESOLVED_M2, CLADDING_TRIMS_UNRESOLVED].includes(
    row.componentKey as typeof CLADDING_CAVITY_UNRESOLVED_M2
  )
) as MaterialRequirement[];
check(
  "accessory requirements keep null money",
  accessoryMoney.length === 2 &&
    accessoryMoney.every(
      (row) => row.unitCost == null && row.totalCost == null && row.priced === false && row.unitCost !== 0
    )
);

const beforeQuantities = JSON.stringify(
  wide.requirements.map((row) => ({
    key: row.componentKey,
    quantity: row.kind === "material" ? (row as MaterialRequirement).baseQuantity : (row as LabourRequirement).baseHours,
  }))
);
resolveCladdingMaterialAuthority({ identity: CLADDING_TIMBER_BEVELBACK_187X18_LM, rates: orgA });
const after = physicalOf([portion({ id: "wide" })]);
const afterQuantities = JSON.stringify(
  after.requirements.map((row) => ({
    key: row.componentKey,
    quantity: row.kind === "material" ? (row as MaterialRequirement).baseQuantity : (row as LabourRequirement).baseHours,
  }))
);
check("rate resolution does not change physical quantities", beforeQuantities === afterQuantities);

const calculated = calculateCladding(
  {
    project: { id: "p1", qualityLevel: "standard" },
    confirmedWorkAreas: [{ id: "c1", type: "cladding", name: "Cladding", sort_order: 1 }],
    facts: factsFor([portion({ id: "commercial" })]),
    constraints: [],
    organisationSettings: { allow_benchmark_rates: true, default_margin_percent: 20 },
    materialWastageSettings: { sheet_material: 10, flooring: 10, paint: 10, default: 5 },
    rates: orgA,
  },
  { id: "c1", type: "cladding", name: "Cladding", sort_order: 1 }
);
check(
  "calculateCladding prices a complete section without changing the physical quantity",
  calculated.lineItems.some((row) => (row.recommendedCost ?? 0) > 0) &&
    (calculated.requirements?.length ?? 0) > 0 &&
    close(
      (calculated.requirements?.find((row) => row.kind === "material") as MaterialRequirement | undefined)
        ?.baseQuantity,
      30 / 0.155
    )
);

const materials = buildMaterialRegistry({ rates: [] });
const claddingCategory = materials.categories.find((category) => category.categoryId === "cladding");
const familyNames = claddingCategory?.families.map((family) => family.familyName) ?? [];
check(
  "Rates materials group Cladding into the six ordinary families",
  claddingCategory?.categoryName === "Cladding" &&
    familyNames.join("|") ===
      [
        "Timber bevelback weatherboards",
        "Timber rusticated weatherboards",
        "Timber vertical shiplap",
        "Fibre-cement weatherboards",
        "Board-and-batten boards",
        "Board-and-batten battens",
        "Cladding accessories",
      ].join("|") &&
    (claddingCategory?.families.flatMap((family) => family.ordinaryItems) ?? []).every(
      (item) =>
        item.label.length > 0 &&
        (item.catalogueEntry.description?.length ?? 0) > 0 &&
        item.unit.length > 0 &&
        item.quotrBenchmarkCost != null &&
        item.effectiveSource === "direct_benchmark" &&
        item.editable &&
        item.workAreaLabels.includes("Cladding")
    )
);

const editedMaterials = buildMaterialRegistry({
  rates: [
    {
      ...bevel187,
      updated_at: null,
    },
  ],
});
const edited = editedMaterials.items.find((item) => item.canonicalKey === CLADDING_TIMBER_BEVELBACK_187X18_LM);
const sibling = editedMaterials.items.find((item) => item.canonicalKey === CLADDING_TIMBER_BEVELBACK_142X18_LM);
check(
  "a materials row shows the company value and a zero company row does not win",
  edited?.companyOverride === 22 &&
    edited?.effectiveSource === "company" &&
    sibling?.effectiveSource === "direct_benchmark" &&
    buildMaterialRegistry({
      rates: [
        {
          ...companyRate({
            item_key: CLADDING_TIMBER_BEVELBACK_187X18_LM,
            rate_type: "material",
            unit: "lm",
            cost_rate: 0,
          }),
          updated_at: null,
        },
      ],
    }).items.find((item) => item.canonicalKey === CLADDING_TIMBER_BEVELBACK_187X18_LM)?.effectiveSource ===
      "direct_benchmark"
);

const productivity = buildProductivityRegistry({ rates: [] });
const claddingOps = productivity.groups.find((group) => group.workAreaType === "cladding");
const accessoryKeys = claddingOps?.ordinaryItems.filter((item) =>
  item.productivityKey.includes(".cavity.") ||
  item.productivityKey.includes(".wall_underlay.") ||
  item.productivityKey.includes(".rigid_air_barrier.")
) ?? [];
const installKeys = claddingOps?.ordinaryItems.filter((item) => item.productivityKey.includes(".install.") && !accessoryKeys.some((row) => row.productivityKey === item.productivityKey)) ?? [];
const removalKeys = claddingOps?.ordinaryItems.filter((item) => item.productivityKey.includes(".remove.")) ?? [];
check(
  "Rates productivity groups Cladding installation and removal without a DNA calibration CTA",
  claddingOps?.workAreaLabel === "Cladding" &&
    installKeys.length === 6 &&
    removalKeys.length === 5 &&
    accessoryKeys.length === 3 &&
    [...installKeys, ...removalKeys, ...accessoryKeys].every(
      (item) =>
        item.label.length > 0 &&
        (item.description?.length ?? 0) > 0 &&
        item.unit.length > 0 &&
        item.benchmarkHours != null &&
        item.effectiveSource === "benchmark" &&
        item.editable &&
        item.calibrationAvailable === false
    ) &&
    isProductivityCalibrationSupported("cladding") === false
);

const coverage = verifyRegisteredWorkAreaBenchmarkCoverage("cladding");
const outcomes = new Map(coverage.resolves.map((row) => [row.component, row.outcome]));
check(
  "coverage resolves ordinary authority and Pricing, and keeps accessories Pricing Required",
  coverage.ok &&
    coverage.resolves.length ===
      CLADDING_MATERIAL_BENCHMARKS.length + CLADDING_PRODUCTIVITY_BENCHMARKS.length + 5 &&
    coverage.intentionalPr.length >= 9 &&
    coverage.needsOwnerApproval.length === 0 &&
    workAreaMayCloseAtL5(coverage) &&
    outcomes.get("142 × 18 mm bevelback weatherboard") === "RESOLVES_WITH_QUOTR" &&
    outcomes.get("Pricing integration") === "RESOLVES_WITH_QUOTR" &&
    outcomes.get("Client Quote") === "RESOLVES_WITH_QUOTR" &&
    CLADDING_V1_HUMAN_QA_FROZEN === false
);

const support = getWorkAreaSupportEntry("cladding");
check(
  "Cladding stays unfrozen, staged, and not estimatable",
  CLADDING_V1_HUMAN_QA_FROZEN === false &&
    FLOORING_V1_HUMAN_QA_FROZEN === true &&
    DOORS_V1_HUMAN_QA_FROZEN === true &&
    support?.band === "staged" &&
    support?.estimatableAsWorkArea === false
);

const forbidden = [
  "CCS-035",
  "CCS-047",
  "painting.material",
  "painting.labour",
  "demolition.",
  "deck.material",
  "fence.material",
  "sheet.plasterboard",
  "retaining_wall",
  "scope.cladding.m2",
  "labour.general.hour",
  "labour.labourer.hour",
  "labourer",
];
const scanned = [
  "lib/estimate/cladding-authority.ts",
  "lib/estimate/cladding-identities.ts",
  "lib/estimate/cladding-physical.ts",
  "lib/estimate/cladding-rate-resolution.ts",
  "lib/estimate/calculators/cladding.ts",
]
  .map((path) => readFileSync(path, "utf8"))
  .join("\n");
check(
  "Cladding modules do not reuse forbidden authority or a hardcoded carpenter dollar",
  forbidden.every((token) => !scanned.includes(token)) && !/(?<![0-9.])60(?![0-9])/.test(scanned)
);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
