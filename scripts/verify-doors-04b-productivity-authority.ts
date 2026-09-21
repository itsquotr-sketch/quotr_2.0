/**
 * DOORS-04B — productivity authority and Rates visibility.
 *
 * Run: npx --yes tsx scripts/verify-doors-04b-productivity-authority.ts
 *
 * No paid AI. No Production. No commercialisation / Builder Review money.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { OrganisationRate } from "../components/setup/types";
import { FITOUT_BENCHMARKS } from "../lib/estimate/benchmark-rates";
import {
  liveQuotrMaterialCost,
  liveQuotrProductivity,
  workAreaMayCloseAtL5,
} from "../lib/estimate/benchmark-coverage";
import { PAINTING_LABOUR_HOURS_PER_M2_KEY } from "../lib/estimate/ceilings-identities";
import { calculateDoors } from "../lib/estimate/calculators/fitout";
import { calculateDoorsPhysical } from "../lib/estimate/doors-physical";
import {
  DOORS_CARPENTER_LABOUR_RATE_KEY,
  DOORS_CUSTOM_LEAF_COMPONENT,
  DOORS_HARDWARE_INSTALL_HOURS_PER_SET_KEY,
  DOORS_HARDWARE_INSTALL_LABEL,
  DOORS_HARDWARE_STANDARD_COST_EX_GST,
  DOORS_HARDWARE_STANDARD_KEY,
  DOORS_LEAF_HOLLOW_CORE_COST_EX_GST,
  DOORS_LEAF_HOLLOW_CORE_KEY,
  DOORS_LEAF_SOLID_CORE_KEY,
  DOORS_ORDINARY_MATERIAL_KEYS,
  DOORS_ORDINARY_PRODUCTIVITY_KEYS,
  DOORS_PREHUNG_HOLLOW_CORE_SET_COST_EX_GST,
  DOORS_PREHUNG_HOLLOW_CORE_SET_KEY,
  DOORS_PREHUNG_INSTALL_HOURS_PER_DOOR_KEY,
  DOORS_PREHUNG_INSTALL_LABEL,
  DOORS_REPLACEMENT_LEAF_INSTALL_HOURS_PER_DOOR_KEY,
  DOORS_REPLACEMENT_LEAF_INSTALL_LABEL,
} from "../lib/estimate/doors-identities";
import {
  resolveDoorsProductivityHours,
} from "../lib/estimate/doors-productivity";
import {
  DOORS_NESTED_NOT_CALCULATED_MESSAGE,
  DOORS_PORTIONS_FACT_KEY,
  type DoorPortion,
} from "../lib/estimate/doors-portions";
import { INTERNAL_WALLS_CORNICE_INSTALL_HOURS_PER_LM_KEY } from "../lib/estimate/internal-walls-identities";
import {
  getQuotrProductivityBenchmark,
  resolveProductivity,
} from "../lib/estimate/productivity";
import { resolveLabourRate } from "../lib/estimate/rates";
import { resolveMaterialRate } from "../lib/estimate/resolve-material-rate";
import type {
  EstimateContext,
  EstimateFact,
  EstimateWorkArea,
} from "../lib/estimate/types";
import type { LabourRequirement, MaterialRequirement } from "../lib/estimate/requirements";
import {
  DOORS_BENCHMARK_REQUIREMENTS,
  verifyRegisteredWorkAreaBenchmarkCoverage,
} from "../lib/estimate/work-area-benchmark-coverage";
import {
  FULL_RATE_CATALOGUE,
  formatProductivityHours,
  getCatalogueEntry,
} from "../lib/rates/catalogue";
import {
  buildProductivityRegistry,
  filterProductivityGroups,
  isProductivityCalibrationSupported,
  listRegisteredProductivityCatalogueEntries,
  productivitySearchMatches,
} from "../lib/rates/productivity-registry";
import { DOORS_PRODUCTIVITY_RATE_CATALOGUE } from "../lib/rates/specific-material-catalogue";
import type { RatesPageRate } from "../lib/rates/types";

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

function near(
  actual: number | null | undefined,
  expected: number,
  tol = 1e-9
): boolean {
  return (
    actual != null &&
    Number.isFinite(actual) &&
    Math.abs(actual - expected) <= tol
  );
}

function read(rel: string): string {
  return readFileSync(join(process.cwd(), rel), "utf8");
}

const KEYS = {
  prehung: DOORS_PREHUNG_INSTALL_HOURS_PER_DOOR_KEY,
  replacement: DOORS_REPLACEMENT_LEAF_INSTALL_HOURS_PER_DOOR_KEY,
  hardware: DOORS_HARDWARE_INSTALL_HOURS_PER_SET_KEY,
} as const;

const UNITS = {
  [KEYS.prehung]: "door",
  [KEYS.replacement]: "door",
  [KEYS.hardware]: "set",
} as const;

const LABELS = {
  [KEYS.prehung]: DOORS_PREHUNG_INSTALL_LABEL,
  [KEYS.replacement]: DOORS_REPLACEMENT_LEAF_INSTALL_LABEL,
  [KEYS.hardware]: DOORS_HARDWARE_INSTALL_LABEL,
} as const;

const THREE = Object.values(KEYS);

const SETTINGS = {
  allow_benchmark_rates: true,
  default_margin_percent: 20,
} as const;

const WA: EstimateWorkArea = {
  id: "d1",
  type: "doors",
  name: "Doors",
  sort_order: 1,
};

const LEGACY = [
  "doorInstallEach",
  "doorsEach",
  "scope.doors.each",
  "doors.install.each",
  "doors.solid_core.each",
  "door_supply_solid_core_each",
] as const;

function persist(portions: readonly DoorPortion[]): EstimateFact[] {
  return [
    {
      key: DOORS_PORTIONS_FACT_KEY,
      work_area_id: WA.id,
      value: portions,
      source: "user",
    },
  ];
}

function ctx(facts: EstimateFact[]): EstimateContext {
  return {
    project: { id: "p1", qualityLevel: "standard" },
    confirmedWorkAreas: [WA],
    facts,
    constraints: [],
    organisationSettings: {
      allow_benchmark_rates: true,
      default_margin_percent: 20,
      premium_rate_factor: 1.15,
    },
    materialWastageSettings: {
      defaultMaterialWastagePercent: 10,
      timberFramingWastagePercent: 10,
      sheetMaterialWastagePercent: 10,
    },
    rates: [],
  } as unknown as EstimateContext;
}

function ordinary(patch: Partial<DoorPortion> = {}): DoorPortion {
  return {
    id: patch.id ?? "door-set-ordinary-1",
    label: patch.label ?? null,
    installation_type: "prehung_internal",
    leaf_construction: "hollow_core",
    height_mm: 1980,
    width_mm: 810,
    quantity: 1,
    hardware_included: true,
    other_description: null,
    height_authority: "extracted",
    specialist_kind: null,
    ...patch,
  };
}

function replacement(patch: Partial<DoorPortion> = {}): DoorPortion {
  return ordinary({
    id: "door-set-replacement-1",
    installation_type: "replacement_leaf",
    leaf_construction: "solid_core",
    height_mm: 2200,
    width_mm: 910,
    quantity: 1,
    hardware_included: false,
    ...patch,
  });
}

function specialist(patch: Partial<DoorPortion> = {}): DoorPortion {
  return {
    id: patch.id ?? "door-set-specialist-1",
    label: patch.label ?? null,
    installation_type: "other_unsupported",
    leaf_construction: null,
    height_mm: null,
    width_mm: null,
    quantity: 1,
    hardware_included: null,
    other_description:
      patch.other_description ?? "fire-rated acoustic access-control door",
    specialist_kind: patch.specialist_kind ?? "fire_rated",
    ...patch,
  };
}

function physical(portions: readonly DoorPortion[]) {
  return calculateDoorsPhysical({ facts: persist(portions), workArea: WA });
}

function labour(rows: readonly { kind: string }[]): LabourRequirement[] {
  return rows.filter((row): row is LabourRequirement => row.kind === "labour");
}

function materials(rows: readonly { kind: string }[]): MaterialRequirement[] {
  return rows.filter((row): row is MaterialRequirement => row.kind === "material");
}

function companyProductivity(
  itemKey: string,
  hours: number,
  unit = UNITS[itemKey as keyof typeof UNITS] ?? "door"
): OrganisationRate {
  return {
    id: `org-${itemKey}`,
    rate_type: "productivity",
    trade: null,
    work_area_type: "doors",
    item_key: itemKey,
    label: itemKey,
    unit,
    cost_rate: hours,
    sell_rate: null,
    markup_percent: null,
    active: true,
    source: "explicit_company",
  };
}

function toPageRate(rate: OrganisationRate): RatesPageRate {
  return {
    id: rate.id,
    item_key: rate.item_key,
    rate_type: rate.rate_type,
    label: rate.label,
    unit: rate.unit,
    cost_rate: rate.cost_rate,
    sell_rate: rate.sell_rate,
    markup_percent: rate.markup_percent,
    active: rate.active,
    trade: rate.trade,
    work_area_type: rate.work_area_type,
    source: rate.source,
    source_calibration_id: null,
    updated_at: null,
  };
}

function hoursFor(
  key: string,
  quantity: number,
  rates: OrganisationRate[] = []
) {
  return resolveDoorsProductivityHours({
    productivityKey: key,
    quantity,
    unit: UNITS[key as keyof typeof UNITS],
    rates,
  });
}

function resolveDoorMaterial(itemKey: string, orgRates: OrganisationRate[] = []) {
  const entry = getCatalogueEntry(itemKey);
  return resolveMaterialRate({
    orgRates,
    materialKey: itemKey,
    workAreaType: "doors",
    unit: entry?.unit ?? "each",
    benchmarkCostRate: entry?.defaultCostRate ?? 0,
    organisationSettings: { ...SETTINGS },
  });
}

const catalogueHits = FULL_RATE_CATALOGUE.filter((row) =>
  THREE.includes(row.item_key as (typeof THREE)[number])
);
const registered = listRegisteredProductivityCatalogueEntries().filter((row) =>
  THREE.includes(row.item_key as (typeof THREE)[number])
);

console.log("=== DOORS-04B registration ===\n");

check(
  "1. All three keys exist exactly once",
  THREE.every((key) => getCatalogueEntry(key)?.item_key === key) &&
    catalogueHits.length === 3 &&
    DOORS_PRODUCTIVITY_RATE_CATALOGUE.length === 3 &&
    new Set(catalogueHits.map((row) => row.item_key)).size === 3 &&
    DOORS_ORDINARY_PRODUCTIVITY_KEYS.length === 3
);

check(
  "2. Keys are in BENCHMARK_PRODUCTIVITY",
  THREE.every((key) => getQuotrProductivityBenchmark(key)?.key === key)
);

check(
  "3. Keys are in the productivity catalogue",
  registered.length === 3 &&
    THREE.every(
      (key) => registered.filter((row) => row.item_key === key).length === 1
    )
);

check(
  "4. Keys are in FULL_RATE_CATALOGUE",
  THREE.every(
    (key) =>
      FULL_RATE_CATALOGUE.filter((row) => row.item_key === key).length === 1
  )
);

check(
  "5. Work area is Doors",
  THREE.every((key) => getCatalogueEntry(key)?.work_area_type === "doors") &&
    THREE.every((key) => getCatalogueEntry(key)?.rate_type === "productivity")
);

check(
  "6. Units are correct",
  getCatalogueEntry(KEYS.prehung)?.unit === "door" &&
    getCatalogueEntry(KEYS.replacement)?.unit === "door" &&
    getCatalogueEntry(KEYS.hardware)?.unit === "set" &&
    getQuotrProductivityBenchmark(KEYS.prehung)?.unit === "door" &&
    getQuotrProductivityBenchmark(KEYS.hardware)?.unit === "set"
);

check(
  "7. Benchmarks are exactly 2.00, 1.50 and 0.50",
  near(getCatalogueEntry(KEYS.prehung)?.defaultCostRate, 2) &&
    near(getCatalogueEntry(KEYS.replacement)?.defaultCostRate, 1.5) &&
    near(getCatalogueEntry(KEYS.hardware)?.defaultCostRate, 0.5) &&
    near(liveQuotrProductivity(KEYS.prehung), 2) &&
    near(liveQuotrProductivity(KEYS.replacement), 1.5) &&
    near(liveQuotrProductivity(KEYS.hardware), 0.5)
);

check(
  "8. Values are hours, not dollars",
  THREE.every((key) => {
    const entry = getCatalogueEntry(key);
    const text = `${entry?.label ?? ""} ${entry?.description ?? ""}`;
    return (
      entry?.rate_type === "productivity" &&
      entry.defaultSellRate == null &&
      /person-hours/i.test(text) &&
      /hours, not dollars/i.test(text) &&
      !/\$/.test(text)
    );
  })
);

check(
  "9. No legacy dollar allowance is reused",
  THREE.every((key) => {
    const blob = `${getCatalogueEntry(key)?.description ?? ""} ${read("lib/estimate/doors-productivity.ts")}`;
    return (
      !LEGACY.some((legacy) => blob.includes(legacy)) &&
      !blob.includes("110") &&
      !blob.includes("280")
    );
  }) &&
    FITOUT_BENCHMARKS.doorInstallEach.cost === 110 &&
    FITOUT_BENCHMARKS.doorsEach.cost === 280
);

const ratesSrc = read("lib/estimate/rates.ts");
check(
  "10. No competing aliases exist",
  THREE.every((key) => !ratesSrc.includes(`"${key}"`)) &&
    THREE.every(
      (key) =>
        FULL_RATE_CATALOGUE.filter((row) => row.item_key === key).length === 1
    ) &&
    !THREE.some((key) =>
      DOORS_ORDINARY_MATERIAL_KEYS.includes(
        key as (typeof DOORS_ORDINARY_MATERIAL_KEYS)[number]
      )
    )
);

console.log("\n=== DOORS-04B resolution ===\n");

const prehungResolved = resolveProductivity({
  productivityKey: KEYS.prehung,
  unit: "door",
  fallbackHoursPerUnit: 99,
});
const replacementResolved = resolveProductivity({
  productivityKey: KEYS.replacement,
  unit: "door",
  fallbackHoursPerUnit: 99,
});
const hardwareResolved = resolveProductivity({
  productivityKey: KEYS.hardware,
  unit: "set",
  fallbackHoursPerUnit: 99,
});

check("11. Prehung resolves to 2.00 h/door", near(prehungResolved.hoursPerUnit, 2));
check(
  "12. Replacement resolves to 1.50 h/door",
  near(replacementResolved.hoursPerUnit, 1.5)
);
check("13. Hardware resolves to 0.50 h/set", near(hardwareResolved.hoursPerUnit, 0.5));
check(
  "14. Effective source is Quotr benchmark",
  prehungResolved.sourceType === "benchmark" &&
    replacementResolved.sourceType === "benchmark" &&
    hardwareResolved.sourceType === "benchmark" &&
    hoursFor(KEYS.prehung, 1).sourceType === "benchmark"
);

const unknown = resolveDoorsProductivityHours({
  productivityKey: "doors.unknown.install.hours_per_door",
  quantity: 2,
  unit: "door",
});
check(
  "15. Unknown Doors productivity remains unresolved rather than zero",
  unknown.hours == null &&
    unknown.hoursPerUnit == null &&
    unknown.sourceType === "missing" &&
    unknown.hours !== 0
);

check(
  "16. No operation uses another work area’s key",
  THREE.every((key) => key.startsWith("doors.")) &&
    !THREE.includes("painting.labour_hours_per_m2" as never) &&
    getCatalogueEntry(KEYS.prehung)?.work_area_type === "doors" &&
    getQuotrProductivityBenchmark(PAINTING_LABOUR_HOURS_PER_M2_KEY)?.key ===
      PAINTING_LABOUR_HOURS_PER_M2_KEY
);

console.log("\n=== DOORS-04B company overrides ===\n");

const prehungOverride = hoursFor(KEYS.prehung, 1, [
  companyProductivity(KEYS.prehung, 2.5),
]);
const replacementOverride = hoursFor(KEYS.replacement, 1, [
  companyProductivity(KEYS.replacement, 2),
]);
const hardwareOverride = hoursFor(KEYS.hardware, 1, [
  companyProductivity(KEYS.hardware, 0.75),
]);

check(
  "17. Prehung 2.50 override wins",
  near(prehungOverride.hoursPerUnit, 2.5) &&
    prehungOverride.sourceType === "user_rate"
);
check(
  "18. Replacement 2.00 override wins",
  near(replacementOverride.hoursPerUnit, 2) &&
    replacementOverride.sourceType === "user_rate"
);
check(
  "19. Hardware 0.75 override wins",
  near(hardwareOverride.hoursPerUnit, 0.75) &&
    hardwareOverride.sourceType === "user_rate"
);

check(
  "20. Removing overrides restores Quotr values",
  near(hoursFor(KEYS.prehung, 1, []).hoursPerUnit, 2) &&
    near(hoursFor(KEYS.replacement, 1, []).hoursPerUnit, 1.5) &&
    near(hoursFor(KEYS.hardware, 1, []).hoursPerUnit, 0.5)
);

const siblingRates = [companyProductivity(KEYS.prehung, 2.5)];
check(
  "21. One-key override does not affect siblings",
  near(hoursFor(KEYS.prehung, 1, siblingRates).hoursPerUnit, 2.5) &&
    near(hoursFor(KEYS.replacement, 1, siblingRates).hoursPerUnit, 1.5) &&
    near(hoursFor(KEYS.hardware, 1, siblingRates).hoursPerUnit, 0.5)
);

const qtyTwo = physical([ordinary({ quantity: 2, hardware_included: false })]);
const qtyTwoLabour = labour(qtyTwo.requirements);
check(
  "22. Override changes hours only",
  near(hoursFor(KEYS.prehung, 2, siblingRates).hours, 5) &&
    near(hoursFor(KEYS.prehung, 2).hours, 4) &&
    qtyTwoLabour.every((row) => row.baseHours === 0)
);

check(
  "23. Material quantities remain unchanged",
  materials(qtyTwo.requirements).every((row) => row.baseQuantity === 2) &&
    materials(qtyTwo.requirements).every((row) => row.purchaseQuantity === 2)
);

check(
  "24. Material COST remains unchanged",
  near(
    resolveDoorMaterial(DOORS_PREHUNG_HOLLOW_CORE_SET_KEY, siblingRates).costRate,
    DOORS_PREHUNG_HOLLOW_CORE_SET_COST_EX_GST
  ) &&
    near(
      resolveDoorMaterial(DOORS_LEAF_HOLLOW_CORE_KEY, siblingRates).costRate,
      DOORS_LEAF_HOLLOW_CORE_COST_EX_GST
    ) &&
    near(
      resolveDoorMaterial(DOORS_HARDWARE_STANDARD_KEY, siblingRates).costRate,
      DOORS_HARDWARE_STANDARD_COST_EX_GST
    )
);

const labourBaseline = resolveLabourRate({
  rates: [],
  organisationSettings: { ...SETTINGS },
});
const labourWithProdOverride = resolveLabourRate({
  rates: siblingRates,
  organisationSettings: { ...SETTINGS },
});
const companyLabour: OrganisationRate = {
  id: "org-labour",
  rate_type: "labour",
  trade: "carpenter",
  work_area_type: null,
  item_key: "labour.carpenter.hour",
  label: "Carpenter / builder",
  unit: "hour",
  cost_rate: 75,
  sell_rate: null,
  markup_percent: null,
  active: true,
  source: "explicit_company",
};
const labourCompany = resolveLabourRate({
  rates: [companyLabour, ...siblingRates],
  organisationSettings: { ...SETTINGS },
});
check(
  "25. Hourly labour COST remains unchanged",
  labourBaseline.itemKey === "labour.carpenter.hour" &&
    labourBaseline.costRate === labourWithProdOverride.costRate &&
    labourCompany.costRate === 75 &&
    DOORS_CARPENTER_LABOUR_RATE_KEY === "labour.carpenter.hour" &&
    !read("lib/estimate/doors-identities.ts").includes("$60") &&
    !read("lib/estimate/doors-productivity.ts").includes("$60") &&
    !read("lib/estimate/doors-physical.ts").includes("$60")
);

const tenantA = hoursFor(KEYS.prehung, 1, [companyProductivity(KEYS.prehung, 2.5)]);
const tenantB = hoursFor(KEYS.prehung, 1, []);
check(
  "26. Other tenants remain unchanged",
  near(tenantA.hoursPerUnit, 2.5) && near(tenantB.hoursPerUnit, 2)
);

console.log("\n=== DOORS-04B quantity calculations ===\n");

check("27. One prehung door = 2.00 base hours", near(hoursFor(KEYS.prehung, 1).hours, 2));
check("28. Two prehung doors = 4.00", near(hoursFor(KEYS.prehung, 2).hours, 4));
check(
  "29. One replacement leaf = 1.50",
  near(hoursFor(KEYS.replacement, 1).hours, 1.5)
);
check(
  "30. Three replacement leaves = 4.50",
  near(hoursFor(KEYS.replacement, 3).hours, 4.5)
);
check("31. One hardware set = 0.50", near(hoursFor(KEYS.hardware, 1).hours, 0.5));
check("32. Three hardware sets = 1.50", near(hoursFor(KEYS.hardware, 3).hours, 1.5));

const prehungWithHw = physical([ordinary({ quantity: 2, hardware_included: true })]);
const prehungHwLabour = labour(prehungWithHw.requirements);
const prehungInstall = prehungHwLabour.find((row) => row.productivityBasis.key === KEYS.prehung);
const prehungHwInstall = prehungHwLabour.find((row) => row.productivityBasis.key === KEYS.hardware);
check(
  "33. Prehung with hardware adds both operations",
  prehungInstall?.productivityBasis.quantity === 2 &&
    prehungHwInstall?.productivityBasis.quantity === 2 &&
    near(
      (hoursFor(KEYS.prehung, prehungInstall!.productivityBasis.quantity).hours ?? 0) +
        (hoursFor(KEYS.hardware, prehungHwInstall!.productivityBasis.quantity).hours ?? 0),
      5
    )
);

const replacementNewHw = physical([
  replacement({ quantity: 2, hardware_included: true, leaf_construction: "hollow_core" }),
]);
const replacementNewHwLabour = labour(replacementNewHw.requirements);
check(
  "34. Replacement with new hardware adds both operations",
  replacementNewHwLabour.some((row) => row.productivityBasis.key === KEYS.replacement) &&
    replacementNewHwLabour.some((row) => row.productivityBasis.key === KEYS.hardware) &&
    near(
      hoursFor(KEYS.replacement, 2).hours! + hoursFor(KEYS.hardware, 2).hours!,
      4
    )
);

const reused = physical([replacement({ quantity: 2, hardware_included: false })]);
const reusedLabour = labour(reused.requirements);
check(
  "35. Reused/excluded hardware emits no hardware hours",
  reusedLabour.every((row) => row.productivityBasis.key !== KEYS.hardware) &&
    materials(reused.requirements).every(
      (row) => row.materialKey !== DOORS_HARDWARE_STANDARD_KEY
    ) &&
    near(hoursFor(KEYS.replacement, 2).hours, 3)
);

console.log("\n=== DOORS-04B independence ===\n");

const hollowPrehung = physical([
  ordinary({ id: "h-pre", leaf_construction: "hollow_core", hardware_included: false }),
]);
const solidPrehung = physical([
  ordinary({
    id: "s-pre",
    leaf_construction: "solid_core",
    hardware_included: false,
  }),
]);
check(
  "36. Hollow and solid prehung use the same productivity",
  labour(hollowPrehung.requirements)[0]?.productivityBasis.key === KEYS.prehung &&
    labour(solidPrehung.requirements)[0]?.productivityBasis.key === KEYS.prehung &&
    near(hoursFor(KEYS.prehung, 2).hours, 4)
);

const hollowRep = physical([
  replacement({ id: "h-rep", leaf_construction: "hollow_core" }),
]);
const solidRep = physical([
  replacement({ id: "s-rep", leaf_construction: "solid_core" }),
]);
check(
  "37. Hollow and solid replacement use the same productivity",
  labour(hollowRep.requirements)[0]?.productivityBasis.key === KEYS.replacement &&
    labour(solidRep.requirements)[0]?.productivityBasis.key === KEYS.replacement
);

const sizes: Array<[number, number]> = [
  [1980, 410],
  [1980, 610],
  [1980, 760],
  [1980, 810],
  [1980, 860],
  [1980, 910],
  [2200, 810],
  [2400, 910],
];
const sizeKeys = sizes.map(([height, width]) => {
  const result = physical([
    ordinary({
      id: `size-${height}x${width}`,
      height_mm: height,
      width_mm: width,
      quantity: 2,
      hardware_included: false,
    }),
  ]);
  return labour(result.requirements)[0]?.productivityBasis.key;
});
check(
  "38. Supported dimensions do not change productivity",
  sizeKeys.every((key) => key === KEYS.prehung) &&
    near(hoursFor(KEYS.prehung, 2).hours, 4)
);

const sizeQtyA = physical([
  ordinary({ id: "dim-a", height_mm: 1980, width_mm: 810, quantity: 2, hardware_included: false }),
]);
const sizeQtyB = physical([
  ordinary({ id: "dim-b", height_mm: 2400, width_mm: 910, quantity: 2, hardware_included: false }),
]);
check(
  "39. Dimension changes do not change material quantities",
  materials(sizeQtyA.requirements)[0]?.baseQuantity === 2 &&
    materials(sizeQtyB.requirements)[0]?.baseQuantity === 2 &&
    materials(sizeQtyA.requirements)[0]?.materialKey ===
      materials(sizeQtyB.requirements)[0]?.materialKey
);

check(
  "40. Productivity changes do not change material COST",
  near(
    resolveDoorMaterial(DOORS_PREHUNG_HOLLOW_CORE_SET_KEY, [
      companyProductivity(KEYS.prehung, 9),
    ]).costRate,
    240
  ) &&
    near(
      resolveDoorMaterial(DOORS_LEAF_SOLID_CORE_KEY, [
        companyProductivity(KEYS.replacement, 9),
      ]).costRate,
      220
    )
);

console.log("\n=== DOORS-04B custom/specialist ===\n");

const customRep = physical([
  replacement({
    leaf_construction: "other",
    other_description: "custom oak panel leaf",
    hardware_included: false,
  }),
]);
check(
  "41. Custom ordinary replacement leaf retains replacement productivity",
  labour(customRep.requirements).some(
    (row) => row.productivityBasis.key === KEYS.replacement
  )
);

const customPrehung = physical([
  ordinary({
    leaf_construction: "other",
    other_description: "custom prehung system",
    hardware_included: false,
  }),
]);
check(
  "42. Custom ordinary prehung retains prehung productivity",
  labour(customPrehung.requirements).some(
    (row) => row.productivityBasis.key === KEYS.prehung
  )
);

check(
  "43. Custom material remains unresolved",
  materials(customRep.requirements).some(
    (row) =>
      row.componentKey === DOORS_CUSTOM_LEAF_COMPONENT && row.materialKey == null
  ) &&
    materials(customPrehung.requirements).some((row) => row.materialKey == null) &&
    liveQuotrMaterialCost(DOORS_CUSTOM_LEAF_COMPONENT) == null
);

const fireAcoustic = physical([
  specialist({
    specialist_kind: "fire_rated",
    other_description: "fire-rated acoustic door",
  }),
]);
check(
  "44. Fire/acoustic gets no ordinary productivity",
  labour(fireAcoustic.requirements).length === 0 &&
    !labour(fireAcoustic.requirements).some((row) =>
      THREE.includes(row.productivityBasis.key as (typeof THREE)[number])
    )
);

const slider = physical([
  specialist({
    specialist_kind: "cavity_slider",
    other_description: "cavity slider",
  }),
]);
check(
  "45. Cavity slider gets no ordinary productivity",
  labour(slider.requirements).length === 0
);

const aluminium = physical([
  specialist({
    specialist_kind: "aluminium",
    other_description: "aluminium exterior door",
  }),
]);
check(
  "46. Aluminium/exterior gets no ordinary productivity",
  labour(aluminium.requirements).length === 0
);

const specialistHours = resolveDoorsProductivityHours({
  productivityKey: "doors.specialist.unsupported.hours_per_door",
  quantity: 1,
  unit: "door",
});
check(
  "47. Unsupported missing hours are null/unresolved, not legitimate zero",
  specialistHours.hours == null &&
    specialistHours.hoursPerUnit == null &&
    specialistHours.hours !== 0 &&
    labour(fireAcoustic.requirements).every((row) => row.baseHours === 0) &&
    labour(fireAcoustic.requirements).length === 0
);

console.log("\n=== DOORS-04B Rates UI ===\n");

const { groups, items } = buildProductivityRegistry({ rates: [], editable: true });
const doorsGroup = groups.find((row) => row.workAreaType === "doors");
const doorsItems = doorsGroup?.ordinaryItems ?? [];

check(
  "48. Doors productivity section is visible",
  doorsGroup != null && doorsGroup.workAreaLabel === "Doors"
);

check(
  "49. Exactly three active Doors operations appear",
  doorsItems.length === 3 &&
    doorsGroup?.legacyItems.length === 0 &&
    THREE.every((key) => doorsItems.some((item) => item.productivityKey === key))
);

check(
  "50. Search finds prehung, replacement and hardware",
  items.some((item) => productivitySearchMatches(item, "prehung")) &&
    items.some((item) => productivitySearchMatches(item, "replacement")) &&
    items.some((item) => productivitySearchMatches(item, "hardware"))
);

const doorsFilter = filterProductivityGroups({
  groups,
  query: "doors",
  status: "all",
});
check(
  "51. Doors filter finds all three",
  (doorsFilter.find((row) => row.workAreaType === "doors")?.ordinaryItems.length ?? 0) === 3
);

check(
  "52. Quotr benchmark values display correctly",
  doorsItems.every((item) => item.effectiveSource === "benchmark") &&
    near(
      doorsItems.find((item) => item.productivityKey === KEYS.prehung)?.benchmarkHours,
      2
    ) &&
    near(
      doorsItems.find((item) => item.productivityKey === KEYS.replacement)?.benchmarkHours,
      1.5
    ) &&
    near(
      doorsItems.find((item) => item.productivityKey === KEYS.hardware)?.benchmarkHours,
      0.5
    ) &&
    formatProductivityHours(2, "door").includes("door") &&
    formatProductivityHours(0.5, "set").includes("set")
);

const seeded = buildProductivityRegistry({
  rates: [
    toPageRate(companyProductivity(KEYS.prehung, 2.5)),
    toPageRate(companyProductivity(KEYS.replacement, 2)),
    toPageRate(companyProductivity(KEYS.hardware, 0.75)),
  ],
  editable: true,
});
const seededDoors = seeded.groups.find((row) => row.workAreaType === "doors");
check(
  "53. Company override displays company source",
  seededDoors?.ordinaryItems.every((item) => item.effectiveSource === "company") === true &&
    near(
      seededDoors?.ordinaryItems.find((item) => item.productivityKey === KEYS.prehung)
        ?.companyOverrideHours,
      2.5
    )
);

check(
  "54. Add/Edit targets exact keys",
  doorsItems.every((item) => item.editable) &&
    THREE.every((key) =>
      doorsItems.some((item) => item.productivityKey === key && item.label === LABELS[key])
    )
);

check(
  "55. No calibration CTA appears unless genuinely supported",
  isProductivityCalibrationSupported("doors") === false &&
    doorsGroup?.calibrationSupported === false &&
    doorsItems.every((item) => item.calibrationAvailable === false)
);

check(
  "56. Raw internal key is not the primary label",
  doorsItems.every((item) => item.label !== item.productivityKey) &&
    doorsItems.every((item) => !item.label.startsWith("doors.")) &&
    doorsItems.some((item) => item.label === DOORS_PREHUNG_INSTALL_LABEL)
);

console.log("\n=== DOORS-04B coverage and legacy ===\n");

const doorsCoverage = verifyRegisteredWorkAreaBenchmarkCoverage("doors");
check(
  "57. Coverage reports the three operations as resolved",
  doorsCoverage.ok &&
    THREE.every((key) =>
      DOORS_BENCHMARK_REQUIREMENTS.some(
        (row) =>
          row.productivityOperation === key && row.outcome === "RESOLVES_WITH_QUOTR"
      )
    ) &&
    near(liveQuotrProductivity(KEYS.prehung), 2)
);

check(
  "58. Coverage still distinguishes custom/specialist PR",
  doorsCoverage.intentionalPr.some((row) => /custom/i.test(row.component)) &&
    doorsCoverage.intentionalPr.some((row) => /specialist/i.test(row.component))
);

check(
  "59. Ordinary Pricing/Quote coverage may close at L5; human QA remains DOORS-07",
  workAreaMayCloseAtL5(doorsCoverage) &&
    DOORS_BENCHMARK_REQUIREMENTS.some(
      (row) =>
        /pricing and quote/i.test(row.component) &&
        row.outcome === "RESOLVES_WITH_QUOTR" &&
        /DOORS-07/.test(row.notes) &&
        /not human-qa frozen/i.test(row.notes)
    )
);

const legacyCalc = calculateDoors(
  ctx([{ key: "doors.count", work_area_id: WA.id, value: 2, source: "user" }]),
  WA
);
check(
  "60. Legacy flat Doors fixture remains unchanged",
  legacyCalc.lineItems.length > 0 &&
    !legacyCalc.missingInfo.includes(DOORS_NESTED_NOT_CALCULATED_MESSAGE) &&
    legacyCalc.lineItems.some(
      (row) => row.recommendedCost === 2 * FITOUT_BENCHMARKS.doorsEach.cost
    ) &&
    FITOUT_BENCHMARKS.doorInstallEach.cost === 110
);

const nestedCalc = calculateDoors(ctx(persist([ordinary({ quantity: 1 })])), WA);
const doorsProdSrc = read("lib/estimate/doors-productivity.ts");
const doorsIdentities = read("lib/estimate/doors-identities.ts");
check(
  "61. Nested Doors does not use legacy dollar-derived hours",
  !nestedCalc.lineItems.some(
    (row) => row.recommendedCost === FITOUT_BENCHMARKS.doorsEach.cost
  ) &&
    !doorsProdSrc.includes("doorInstallEach") &&
    !doorsProdSrc.includes("/ 60") &&
    !doorsIdentities.includes("doorInstallEach") &&
    hoursFor(KEYS.prehung, 1).hours !== FITOUT_BENCHMARKS.doorInstallEach.cost / 60
);

const paintingHours = liveQuotrProductivity(PAINTING_LABOUR_HOURS_PER_M2_KEY);
const corniceHours = liveQuotrProductivity(
  INTERNAL_WALLS_CORNICE_INSTALL_HOURS_PER_LM_KEY
);
check(
  "62. Ceiling/Internal Walls/Painting productivity remains unchanged",
  near(paintingHours, 0.12) &&
    near(corniceHours, 0.2) &&
    !read("lib/estimate/ceilings-identities.ts").includes(KEYS.prehung) &&
    !read("lib/estimate/internal-walls-identities.ts").includes(KEYS.hardware)
);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
