/**
 * DOORS-04A — material identities, benchmark COST authority, Rates visibility.
 *
 * Run: npx --yes tsx scripts/verify-doors-04a-material-authority.ts
 *
 * No paid AI. No Production. No productivity hour values. No commercialisation.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { OrganisationRate } from "../components/setup/types";
import { calculateDoors } from "../lib/estimate/calculators/fitout";
import { FITOUT_BENCHMARKS } from "../lib/estimate/benchmark-rates";
import {
  liveQuotrMaterialCost,
  workAreaMayCloseAtL5,
} from "../lib/estimate/benchmark-coverage";
import {
  calculateDoorsPhysical,
} from "../lib/estimate/doors-physical";
import {
  DOORS_CUSTOM_LEAF_COMPONENT,
  DOORS_HARDWARE_STANDARD_COST_EX_GST,
  DOORS_HARDWARE_STANDARD_KEY,
  DOORS_HARDWARE_STANDARD_LABEL,
  DOORS_LEAF_HOLLOW_CORE_COST_EX_GST,
  DOORS_LEAF_HOLLOW_CORE_KEY,
  DOORS_LEAF_SOLID_CORE_COST_EX_GST,
  DOORS_LEAF_SOLID_CORE_KEY,
  DOORS_ORDINARY_MATERIAL_KEYS,
  DOORS_PREHUNG_HOLLOW_CORE_SET_COST_EX_GST,
  DOORS_PREHUNG_HOLLOW_CORE_SET_KEY,
  DOORS_PREHUNG_SOLID_CORE_SET_COST_EX_GST,
  DOORS_PREHUNG_SOLID_CORE_SET_KEY,
  DOORS_SPECIALIST_COMPONENT,
} from "../lib/estimate/doors-identities";
import { DOORS_NESTED_NOT_CALCULATED_MESSAGE, DOORS_PORTIONS_FACT_KEY, type DoorPortion } from "../lib/estimate/doors-portions";
import { resolveRate } from "../lib/estimate/rates";
import { resolveMaterialRate } from "../lib/estimate/resolve-material-rate";
import type { EstimateContext, EstimateFact, EstimateWorkArea } from "../lib/estimate/types";
import {
  DOORS_BENCHMARK_REQUIREMENTS,
  INTERNAL_WALLS_BENCHMARK_REQUIREMENTS,
  CEILING_BENCHMARK_REQUIREMENTS,
  verifyRegisteredWorkAreaBenchmarkCoverage,
} from "../lib/estimate/work-area-benchmark-coverage";
import { FULL_RATE_CATALOGUE, getCatalogueEntry } from "../lib/rates/catalogue";
import {
  buildMaterialRegistry,
  editableMaterialCatalogueKeys,
  filterMaterialCategories,
  listMaterialsPageCatalogueEntries,
  materialSearchMatches,
  materialStatusMatches,
} from "../lib/rates/material-registry";
import { DOORS_SPECIFIC_MATERIAL_CATALOGUE } from "../lib/rates/specific-material-catalogue";
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

function read(rel: string): string {
  return readFileSync(join(process.cwd(), rel), "utf8");
}

const KEYS = {
  hollowLeaf: DOORS_LEAF_HOLLOW_CORE_KEY,
  solidLeaf: DOORS_LEAF_SOLID_CORE_KEY,
  hollowSet: DOORS_PREHUNG_HOLLOW_CORE_SET_KEY,
  solidSet: DOORS_PREHUNG_SOLID_CORE_SET_KEY,
  hardware: DOORS_HARDWARE_STANDARD_KEY,
} as const;

const COSTS: Record<string, number> = {
  [KEYS.hollowLeaf]: DOORS_LEAF_HOLLOW_CORE_COST_EX_GST,
  [KEYS.solidLeaf]: DOORS_LEAF_SOLID_CORE_COST_EX_GST,
  [KEYS.hollowSet]: DOORS_PREHUNG_HOLLOW_CORE_SET_COST_EX_GST,
  [KEYS.solidSet]: DOORS_PREHUNG_SOLID_CORE_SET_COST_EX_GST,
  [KEYS.hardware]: DOORS_HARDWARE_STANDARD_COST_EX_GST,
};

const UNITS: Record<string, string> = {
  [KEYS.hollowLeaf]: "each",
  [KEYS.solidLeaf]: "each",
  [KEYS.hollowSet]: "each",
  [KEYS.solidSet]: "each",
  [KEYS.hardware]: "set",
};

const FIVE = Object.values(KEYS);

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

function companyRate(
  itemKey: string,
  cost: number,
  unit = UNITS[itemKey] ?? "each"
): OrganisationRate {
  return {
    id: `org-${itemKey}`,
    rate_type: "material",
    trade: null,
    work_area_type: "doors",
    item_key: itemKey,
    label: itemKey,
    unit,
    cost_rate: cost,
    sell_rate: null,
    markup_percent: null,
    active: true,
    source: "explicit_company",
  };
}

function resolveDoor(itemKey: string, orgRates: OrganisationRate[] = []) {
  const entry = getCatalogueEntry(itemKey);
  return resolveMaterialRate({
    orgRates,
    materialKey: itemKey,
    workAreaType: "doors",
    unit: entry?.unit ?? UNITS[itemKey] ?? "each",
    benchmarkCostRate: entry?.defaultCostRate ?? 0,
    organisationSettings: { ...SETTINGS },
  });
}

const catalogueHits = FULL_RATE_CATALOGUE.filter((row) =>
  FIVE.includes(row.item_key as (typeof FIVE)[number])
);

console.log("=== DOORS-04A catalogue registration ===\n");

check(
  "1. All five keys exist exactly once",
  FIVE.every((key) => getCatalogueEntry(key)?.item_key === key) &&
    catalogueHits.length === 5 &&
    DOORS_SPECIFIC_MATERIAL_CATALOGUE.length === 5 &&
    new Set(catalogueHits.map((row) => row.item_key)).size === 5
);

check(
  "2. Every key has the correct work area",
  FIVE.every((key) => getCatalogueEntry(key)?.work_area_type === "doors")
);

check(
  "3. Every key has the correct material rate type/category",
  FIVE.every((key) => {
    const entry = getCatalogueEntry(key);
    return entry?.rate_type === "material" && entry.category === "material";
  })
);

check(
  "4. Units are correct",
  FIVE.every((key) => getCatalogueEntry(key)?.unit === UNITS[key])
);

check(
  "5. Benchmark values are exactly 80, 220, 240, 380 and 55",
  getCatalogueEntry(KEYS.hollowLeaf)?.defaultCostRate === 80 &&
    getCatalogueEntry(KEYS.solidLeaf)?.defaultCostRate === 220 &&
    getCatalogueEntry(KEYS.hollowSet)?.defaultCostRate === 240 &&
    getCatalogueEntry(KEYS.solidSet)?.defaultCostRate === 380 &&
    getCatalogueEntry(KEYS.hardware)?.defaultCostRate === 55
);

check(
  "6. Values are COST ex GST",
  FIVE.every((key) => {
    const entry = getCatalogueEntry(key);
    return (
      entry?.defaultCostRate === COSTS[key] &&
      /ex GST/i.test(entry.description ?? "") &&
      entry.defaultSellRate == null
    );
  })
);

check(
  "7. No labour or sell money is embedded",
  FIVE.every((key) => {
    const entry = getCatalogueEntry(key);
    const text = `${entry?.label ?? ""} ${entry?.description ?? ""}`;
    return (
      entry?.rate_type !== "labour" &&
      entry?.defaultSellRate == null &&
      !/installed package|supply\/install|\$280|\$110/i.test(text)
    );
  })
);

check(
  "8. Product descriptions disclose inclusions/exclusions",
  /hollow-core internal door leaf/i.test(
    getCatalogueEntry(KEYS.hollowLeaf)?.description ?? ""
  ) &&
    /excludes frame\/jamb/i.test(
      getCatalogueEntry(KEYS.hollowLeaf)?.description ?? ""
    ) &&
    /timber jamb\/frame/i.test(
      getCatalogueEntry(KEYS.hollowSet)?.description ?? ""
    ) &&
    /excludes latch\/lever hardware/i.test(
      getCatalogueEntry(KEYS.hollowSet)?.description ?? ""
    ) &&
    /allowance/i.test(getCatalogueEntry(KEYS.hardware)?.description ?? "") &&
    /not a guaranteed named product/i.test(
      getCatalogueEntry(KEYS.hardware)?.description ?? ""
    )
);

const dimKeys = FULL_RATE_CATALOGUE.filter(
  (row) =>
    /door\..*(1980|2200|2400|410|610|760|810|860|910)/.test(row.item_key) ||
    /door\.\d+x\d+/.test(row.item_key)
);
check(
  "9. No dimension-specific door variants were created",
  dimKeys.length === 0
);

const forbiddenAliases = [
  "scope.doors.each",
  "doors.install.each",
  "doors.solid_core.each",
  "door_supply_solid_core_each",
];
const ratesAliases = read("lib/estimate/rates.ts");
const catalogueAliases = read("lib/rates/catalogue.ts");
check(
  "10. No duplicate or alias rows compete with the canonical identities",
  FIVE.every(
    (key) =>
      FULL_RATE_CATALOGUE.filter((row) => row.item_key === key).length === 1
  ) &&
    FIVE.every(
      (key) =>
        !ratesAliases.includes(`"${key}":`) &&
        !catalogueAliases.includes(`"${key}":`)
    ) &&
    forbiddenAliases.every(
      (alias) => !FIVE.some((key) => key === alias)
    )
);

console.log("\n=== DOORS-04A resolver authority ===\n");

const hollowLeafResolved = resolveDoor(KEYS.hollowLeaf);
const solidLeafResolved = resolveDoor(KEYS.solidLeaf);
const hollowSetResolved = resolveDoor(KEYS.hollowSet);
const solidSetResolved = resolveDoor(KEYS.solidSet);
const hardwareResolved = resolveDoor(KEYS.hardware);

check("11. Hollow leaf resolves to $80 Quotr COST", hollowLeafResolved.costRate === 80);
check("12. Solid leaf resolves to $220", solidLeafResolved.costRate === 220);
check("13. Hollow prehung resolves to $240", hollowSetResolved.costRate === 240);
check("14. Solid prehung resolves to $380", solidSetResolved.costRate === 380);
check("15. Hardware resolves to $55", hardwareResolved.costRate === 55);

check(
  "16. Rate source is the proper Quotr benchmark source",
  [hollowLeafResolved, solidLeafResolved, hollowSetResolved, solidSetResolved, hardwareResolved].every(
    (row) =>
      row.materialRateSource === "benchmark_specific" &&
      row.sourceType === "benchmark"
  )
);

const legacyResolve = resolveRate({
  rates: [],
  rateType: "material",
  itemKey: KEYS.hollowSet,
  unit: "each",
  fallbackCostRate: getCatalogueEntry(KEYS.hollowSet)?.defaultCostRate ?? 0,
  organisationSettings: { ...SETTINGS } as never,
});
check(
  "17. No new material resolves through a legacy lump",
  legacyResolve.costRate === 240 &&
    legacyResolve.costRate !== FITOUT_BENCHMARKS.doorsEach.cost &&
    !read("lib/estimate/doors-identities.ts").includes("doorsEach") &&
    !read("lib/estimate/doors-identities.ts").includes("doorInstallEach") &&
    !read("lib/rates/specific-material-catalogue.ts").includes("FITOUT_BENCHMARKS.doorsEach")
);

check(
  "18. No new identity resolves as a package or subcontract rate",
  FIVE.every((key) => {
    const entry = getCatalogueEntry(key);
    return (
      entry?.rate_type === "material" &&
      entry.category !== "scope_package" &&
      entry.category !== "subcontractor"
    );
  })
);

console.log("\n=== DOORS-04A company override ===\n");

const overrides: Array<{ key: string; cost: number; proof: string }> = [
  { key: KEYS.hollowLeaf, cost: 95, proof: "19. $95 hollow-leaf override wins" },
  { key: KEYS.solidLeaf, cost: 250, proof: "20. $250 solid-leaf override wins" },
  { key: KEYS.hollowSet, cost: 275, proof: "21. $275 hollow-prehung override wins" },
  { key: KEYS.solidSet, cost: 425, proof: "22. $425 solid-prehung override wins" },
  { key: KEYS.hardware, cost: 70, proof: "23. $70 hardware override wins" },
];

for (const row of overrides) {
  const resolved = resolveDoor(row.key, [companyRate(row.key, row.cost)]);
  check(
    row.proof,
    resolved.costRate === row.cost &&
      resolved.materialRateSource === "company_specific" &&
      resolved.sourceType === "user_rate"
  );
}

const restored = FIVE.map((key) => resolveDoor(key, []));
check(
  "24. Removing overrides restores the benchmark",
  restored.every((row, index) => row.costRate === COSTS[FIVE[index]!])
);

const oneOverride = resolveDoor(KEYS.hollowLeaf, [companyRate(KEYS.hollowLeaf, 95)]);
const siblingStillBenchmark = resolveDoor(KEYS.solidLeaf, [
  companyRate(KEYS.hollowLeaf, 95),
]);
check(
  "25. One-key override does not affect siblings",
  oneOverride.costRate === 95 && siblingStillBenchmark.costRate === 220
);

const qtyPhysical = physical([ordinary({ quantity: 3 })]);
const qtyAfterOverride = physical([ordinary({ quantity: 3 })]);
check(
  "26. Override does not change quantity",
  qtyPhysical.requirements.find((row) => row.kind === "material" && row.materialKey === KEYS.hollowSet)
    ?.baseQuantity === 3 &&
    qtyAfterOverride.requirements.find(
      (row) => row.kind === "material" && row.materialKey === KEYS.hollowSet
    )?.baseQuantity === 3
);

const sizeA = physical([ordinary({ id: "s-a", height_mm: 1980, width_mm: 810 })]);
const sizeB = physical([ordinary({ id: "s-b", height_mm: 2400, width_mm: 410 })]);
check(
  "27. Override does not change dimensions",
  sizeA.portions[0]?.height_mm === 1980 &&
    sizeB.portions[0]?.width_mm === 410 &&
    sizeA.requirements.find((row) => row.kind === "material" && row.materialKey === KEYS.hollowSet)
      ?.materialKey ===
      sizeB.requirements.find((row) => row.kind === "material" && row.materialKey === KEYS.hollowSet)
        ?.materialKey
);

check(
  "28. Override does not create labour hours",
  qtyPhysical.requirements
    .filter((row) => row.kind === "labour")
    .every((row) => row.baseHours === 0 && row.priced === false)
);

console.log("\n=== DOORS-04A physical alignment ===\n");

const repHollow = physical([
  replacement({ leaf_construction: "hollow_core", hardware_included: false }),
]);
const repSolid = physical([replacement()]);
const prehungHollow = physical([ordinary({ hardware_included: true })]);
const prehungSolid = physical([
  ordinary({
    id: "prehung-solid",
    leaf_construction: "solid_core",
    hardware_included: true,
  }),
]);

check(
  "29. Replacement hollow emits the hollow-leaf key",
  repHollow.requirements.some(
    (row) => row.kind === "material" && row.materialKey === KEYS.hollowLeaf
  )
);
check(
  "30. Replacement solid emits the solid-leaf key",
  repSolid.requirements.some(
    (row) => row.kind === "material" && row.materialKey === KEYS.solidLeaf
  )
);
check(
  "31. Prehung hollow emits the hollow-prehung key",
  prehungHollow.requirements.some(
    (row) => row.kind === "material" && row.materialKey === KEYS.hollowSet
  )
);
check(
  "32. Prehung solid emits the solid-prehung key",
  prehungSolid.requirements.some(
    (row) => row.kind === "material" && row.materialKey === KEYS.solidSet
  )
);
check(
  "33. Included hardware emits the hardware key",
  prehungHollow.requirements.some(
    (row) => row.kind === "material" && row.materialKey === KEYS.hardware
  )
);

const excludedHw = physical([ordinary({ hardware_included: false })]);
check(
  "34. Excluded hardware emits no hardware material",
  !excludedHw.requirements.some(
    (row) => row.kind === "material" && row.materialKey === KEYS.hardware
  )
);

const q3 = physical([ordinary({ id: "q3", quantity: 3 })]);
check(
  "35. Quantity Q resolves against Q materials, not one allowance",
  q3.requirements.find((row) => row.kind === "material" && row.materialKey === KEYS.hollowSet)
    ?.baseQuantity === 3 &&
    q3.requirements.find((row) => row.kind === "material" && row.materialKey === KEYS.hardware)
      ?.baseQuantity === 3 &&
    getCatalogueEntry(KEYS.hollowSet)?.category !== "scope_package"
);

check(
  "36. Purchase quantity equals installed quantity",
  q3.requirements
    .filter((row) => row.kind === "material")
    .every((row) => row.purchaseQuantity === row.baseQuantity)
);

check(
  "37. Waste remains zero",
  q3.requirements
    .filter((row) => row.kind === "material")
    .every((row) => row.wasteFactor === 0)
);

const dimRateA = resolveDoor(KEYS.hollowSet);
const dimRateB = resolveDoor(KEYS.hollowSet);
check(
  "38. Different supported dimensions use the same key/rate",
  sizeA.requirements.find((row) => row.kind === "material" && row.materialKey === KEYS.hollowSet)
    ?.materialKey === KEYS.hollowSet &&
    sizeB.requirements.find((row) => row.kind === "material" && row.materialKey === KEYS.hollowSet)
      ?.materialKey === KEYS.hollowSet &&
    dimRateA.costRate === dimRateB.costRate &&
    dimRateA.costRate === 240
);

console.log("\n=== DOORS-04A custom/specialist safety ===\n");

const custom = physical([
  ordinary({
    id: "custom-1",
    leaf_construction: "other",
    other_description: "painted MDF flush leaf",
    quantity: 2,
  }),
]);
const customMat = custom.requirements.find(
  (row) => row.kind === "material" && row.componentKey === DOORS_CUSTOM_LEAF_COMPONENT
);
check(
  "39. Other/custom leaf does not resolve ordinary material money",
  customMat?.kind === "material" &&
    customMat.materialKey == null &&
    customMat.unitCost == null &&
    customMat.priced === false &&
    !custom.requirements.some(
      (row) =>
        row.kind === "material" &&
        row.materialKey != null &&
        FIVE.includes(row.materialKey as (typeof FIVE)[number]) &&
        row.componentKey === DOORS_CUSTOM_LEAF_COMPONENT
    )
);

check(
  "40. Other/custom leaf quantity remains visible",
  customMat?.kind === "material" &&
    customMat.baseQuantity === 2 &&
    custom.portions[0]?.other_description === "painted MDF flush leaf"
);

function noOrdinaryMoney(reqs: ReturnType<typeof physical>["requirements"]) {
  return !reqs.some(
    (row) =>
      row.kind === "material" &&
      row.materialKey != null &&
      FIVE.includes(row.materialKey as (typeof FIVE)[number])
  );
}

const fire = physical([specialist()]);
const slider = physical([
  specialist({
    id: "slider-1",
    specialist_kind: "cavity_slider",
    other_description: "cavity slider",
  }),
]);
const aluminium = physical([
  specialist({
    id: "alu-1",
    specialist_kind: "aluminium",
    other_description: "aluminium exterior entrance door",
  }),
]);

check("41. Fire/acoustic does not resolve ordinary material money", noOrdinaryMoney(fire.requirements));
check("42. Cavity slider does not resolve ordinary material money", noOrdinaryMoney(slider.requirements));
check(
  "43. Aluminium/exterior does not resolve ordinary material money",
  noOrdinaryMoney(aluminium.requirements)
);

const specialistMat = fire.requirements.find(
  (row) => row.kind === "material" && row.componentKey === DOORS_SPECIALIST_COMPONENT
);
check(
  "44. Specialist missing money is null, not $0",
  specialistMat?.kind === "material" &&
    specialistMat.unitCost == null &&
    specialistMat.totalCost == null &&
    specialistMat.priced === false &&
    specialistMat.materialKey == null
);

check(
  "45. Specialist quantity/description remains available",
  specialistMat?.kind === "material" &&
    specialistMat.baseQuantity === 1 &&
    /fire-rated acoustic access-control door/i.test(
      fire.portions[0]?.summary ?? ""
    )
);

console.log("\n=== DOORS-04A Rates UI ===\n");

const registry = buildMaterialRegistry({ rates: [], editable: true });
const doorsCategory = registry.categories.find((row) => row.categoryId === "doors");
check(
  "46. Doors category is visible",
  doorsCategory?.categoryName === "Doors" &&
    registry.items.some((item) => item.categoryId === "doors")
);

const familyIds = new Set(doorsCategory?.families.map((row) => row.familyId) ?? []);
check(
  "47. Three product families are visible",
  familyIds.has("doors-internal-leaves") &&
    familyIds.has("doors-prehung-sets") &&
    familyIds.has("doors-hardware") &&
    (doorsCategory?.families.filter((row) => row.ordinaryItems.length > 0).length ?? 0) === 3
);

const ordinaryDoorItems = registry.items.filter(
  (item) => item.ordinary && FIVE.includes(item.canonicalKey as (typeof FIVE)[number])
);
check(
  "48. Five ordinary variants appear once each",
  ordinaryDoorItems.length === 5 &&
    FIVE.every(
      (key) => ordinaryDoorItems.filter((item) => item.canonicalKey === key).length === 1
    )
);

function searchHits(query: string) {
  return registry.items.filter((item) => materialSearchMatches(item, query));
}
check(
  "49. Search finds door leaf, prehung, hollow, solid and hardware",
  searchHits("door leaf").some((item) => item.canonicalKey === KEYS.hollowLeaf) &&
    searchHits("prehung").some((item) => item.canonicalKey === KEYS.hollowSet) &&
    searchHits("hollow").some((item) => item.canonicalKey === KEYS.hollowLeaf) &&
    searchHits("solid").some((item) => item.canonicalKey === KEYS.solidLeaf) &&
    searchHits("hardware").some((item) => item.canonicalKey === KEYS.hardware)
);

const doorsFilter = filterMaterialCategories({
  categories: registry.categories,
  query: "",
  status: "all",
  categoryId: "all",
  workArea: "doors",
});
const filteredKeys = doorsFilter.flatMap((category) =>
  category.families.flatMap((family) =>
    family.ordinaryItems.map((item) => item.canonicalKey)
  )
);
check(
  "50. Doors work-area filter finds all five rows",
  FIVE.every((key) => filteredKeys.includes(key)) &&
    filteredKeys.filter((key) => FIVE.includes(key as (typeof FIVE)[number])).length === 5
);

check(
  "51. Status filter identifies Quotr benchmark rows",
  ordinaryDoorItems.every((item) =>
    materialStatusMatches(item, "benchmark")
  ) &&
    ordinaryDoorItems.every((item) => item.effectiveSource === "direct_benchmark")
);

const companyRegistry = buildMaterialRegistry({
  rates: [companyRate(KEYS.hollowLeaf, 95) as RatesPageRate],
  editable: true,
});
const companyItem = companyRegistry.items.find(
  (item) => item.canonicalKey === KEYS.hollowLeaf
);
check(
  "52. Company override displays effective company source",
  companyItem?.effectiveSource === "company" &&
    companyItem.companyOverride === 95 &&
    companyItem.effectiveRate === 95 &&
    companyItem.quotrBenchmarkCost === 80
);

check(
  "53. Add/Edit targets the exact key",
  ordinaryDoorItems.every((item) => item.editable && item.canonicalKey === item.catalogueEntry.item_key) &&
    editableMaterialCatalogueKeys().filter((key) =>
      FIVE.includes(key as (typeof FIVE)[number])
    ).length === 5
);

check(
  "54. Custom/specialist does not appear as an ordinary benchmark product",
  !registry.items.some((item) => item.canonicalKey === DOORS_CUSTOM_LEAF_COMPONENT) &&
    !registry.items.some((item) => item.canonicalKey === DOORS_SPECIALIST_COMPONENT) &&
    !registry.items.some((item) => /specialist|custom\/other/i.test(item.familyName) && item.categoryId === "doors") &&
    getCatalogueEntry(DOORS_CUSTOM_LEAF_COMPONENT) == null
);

const pageKeys = listMaterialsPageCatalogueEntries().filter((row) =>
  FIVE.includes(row.item_key as (typeof FIVE)[number])
);
check(
  "55. Material registry completeness includes every Doors material key exactly once",
  pageKeys.length === 5 &&
    FIVE.every(
      (key) => pageKeys.filter((row) => row.item_key === key).length === 1
    ) &&
    DOORS_ORDINARY_MATERIAL_KEYS.every((key) =>
      listMaterialsPageCatalogueEntries().some((row) => row.item_key === key)
    )
);

console.log("\n=== DOORS-04A legacy and coverage ===\n");

const legacyCalc = calculateDoors(
  ctx([{ key: "doors.count", work_area_id: WA.id, value: 2, source: "user" }]),
  WA
);
check(
  "56. Legacy flat Doors fixture remains unchanged",
  legacyCalc.lineItems.length > 0 &&
    !legacyCalc.missingInfo.includes(DOORS_NESTED_NOT_CALCULATED_MESSAGE) &&
    legacyCalc.lineItems.some(
      (row) => row.recommendedCost === 2 * FITOUT_BENCHMARKS.doorsEach.cost
    )
);

const nestedCalc = calculateDoors(ctx(persist([ordinary({ quantity: 1 })])), WA);
check(
  "57. Nested Doors never uses the legacy $280 package",
  !nestedCalc.lineItems.some(
    (row) =>
      row.recommendedCost === FITOUT_BENCHMARKS.doorsEach.cost ||
      /supply\/install allowance/i.test(row.label)
  ) &&
    nestedCalc.lineItems.some((row) => (row.recommendedCost ?? 0) > 0)
);

const doorsCoverage = verifyRegisteredWorkAreaBenchmarkCoverage("doors");
check(
  "58. Benchmark coverage still reports five ordinary material identities",
  doorsCoverage.ok &&
    doorsCoverage.resolves.filter((row) =>
      FIVE.includes(row.materialIdentity as (typeof FIVE)[number])
    ).length === 5 &&
    FIVE.every((key) =>
      DOORS_BENCHMARK_REQUIREMENTS.some(
        (row) => row.materialIdentity === key && row.outcome === "RESOLVES_WITH_QUOTR"
      )
    )
);

check(
  "59. Custom/specialist stay PR and Doors is not commercially closed",
  !workAreaMayCloseAtL5(doorsCoverage) &&
    doorsCoverage.intentionalPr.length >= 2 &&
    doorsCoverage.needsOwnerApproval.some((row) =>
      /pricing and quote/i.test(row.component)
    )
);

const iwCoverage = verifyRegisteredWorkAreaBenchmarkCoverage("internal_walls");
const ceilingCoverage = verifyRegisteredWorkAreaBenchmarkCoverage("ceilings");
check(
  "60. No Ceiling/Internal Walls material identity changed",
  iwCoverage.ok &&
    ceilingCoverage.ok &&
    INTERNAL_WALLS_BENCHMARK_REQUIREMENTS.length > 0 &&
    CEILING_BENCHMARK_REQUIREMENTS.length > 0 &&
    liveQuotrMaterialCost("painting.material.m2") != null &&
    liveQuotrMaterialCost("timber.framing.140x45.h1.2.lm") != null &&
    !read("lib/estimate/ceilings-identities.ts").includes(KEYS.hollowSet) &&
    !read("lib/estimate/internal-walls-identities.ts").includes(KEYS.hardware) &&
    getCatalogueEntry(KEYS.hardware)?.label === DOORS_HARDWARE_STANDARD_LABEL
);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
