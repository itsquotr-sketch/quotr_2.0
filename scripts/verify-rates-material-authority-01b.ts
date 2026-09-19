/**
 * RATES-MATERIAL-AUTHORITY-01B — IW derived sheets + missing Rates identities.
 *
 * Run: npx --yes tsx scripts/verify-rates-material-authority-01b.ts
 *
 * Permanent coverage gate. No Production. No new invented Quotr COSTs.
 */
import type { OrganisationRate } from "../components/setup/types";
import { mapRateLabel } from "../lib/assistant/builder-review/compose";
import { calculateInternalWalls } from "../lib/estimate/calculators/fitout";
import { liveQuotrMaterialCost } from "../lib/estimate/benchmark-coverage";
import { derivedDimensionedPlasterboardCost } from "../lib/estimate/ceilings-plasterboard-derived-cost";
import {
  CEILING_BENCHMARK_REQUIREMENTS,
  INTERNAL_WALLS_BENCHMARK_REQUIREMENTS,
  verifyRegisteredWorkAreaBenchmarkCoverage,
} from "../lib/estimate/work-area-benchmark-coverage";
import {
  INTERNAL_WALLS_ADD_WALL_TYPE_KEY,
  applyInternalWallsFactWrite,
} from "../lib/estimate/internal-walls-wall-types";
import {
  INTERNAL_WALLS_CORNICE_GIB_COVE_CLASSIC_55_3600_KEY,
  INTERNAL_WALLS_CORNICE_MATERIAL_KEY,
  INTERNAL_WALLS_GIB_COVE_COST_EACH,
  INTERNAL_WALLS_PAINTING_MATERIAL_KEY,
} from "../lib/estimate/internal-walls-identities";
import { INTERNAL_WALLS_JOB_SCOPE_FACT_KEY } from "../lib/estimate/internal-walls-scope";
import { round2 } from "../lib/estimate/facts";
import type {
  EstimateContext,
  EstimateFact,
  EstimateWorkArea,
} from "../lib/estimate/types";
import type { MaterialRequirement } from "../lib/estimate/requirements";
import {
  buildMaterialRegistry,
  filterMaterialCategories,
  materialSearchMatches,
} from "../lib/rates/material-registry";
import { getCatalogueEntry } from "../lib/rates/catalogue";
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

function near(actual: number | null | undefined, expected: number, tol = 0.011): boolean {
  return actual != null && Number.isFinite(actual) && Math.abs(actual - expected) <= tol;
}

const LENGTHS = [2700, 3000, 3600, 4800, 6000] as const;

const DERIVED_MATRIX: Array<{
  family: string;
  productLabel: string;
  thicknessMm: number;
  lengths: readonly number[];
}> = [
  { family: "standard", productLabel: "Standard GIB", thicknessMm: 10, lengths: LENGTHS },
  { family: "standard", productLabel: "Standard GIB", thicknessMm: 13, lengths: LENGTHS },
  { family: "aqualine", productLabel: "Aqualine", thicknessMm: 10, lengths: LENGTHS },
  { family: "aqualine", productLabel: "Aqualine", thicknessMm: 13, lengths: LENGTHS },
  { family: "fyreline", productLabel: "Fyreline", thicknessMm: 13, lengths: LENGTHS },
  { family: "braceline", productLabel: "Braceline", thicknessMm: 13, lengths: LENGTHS },
];

function dimensionedKey(family: string, thicknessMm: number, lengthMm: number): string {
  return `sheet.plasterboard.${family}.${thicknessMm}mm.${lengthMm}x1200.each`;
}

function fact(key: string, workAreaId: string, value: unknown): EstimateFact {
  return { key, work_area_id: workAreaId, value };
}

function wa(id: string): EstimateWorkArea & { status: "confirmed" } {
  return {
    id,
    type: "internal_walls",
    name: "Internal Walls",
    sort_order: 1,
    status: "confirmed",
  };
}

function ctx(
  workAreas: EstimateWorkArea[],
  facts: EstimateFact[],
  rates: OrganisationRate[] = []
): EstimateContext {
  return {
    project: { id: "p1", qualityLevel: "standard" },
    confirmedWorkAreas: workAreas,
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
    rates,
  } as unknown as EstimateContext;
}

function writeWall(
  workAreaId: string,
  writes: Array<{ key: string; value: unknown }>
): EstimateFact[] {
  let facts: EstimateFact[] = [];
  for (const row of writes) {
    facts = applyInternalWallsFactWrite({
      facts,
      workAreaId,
      key: row.key,
      value: row.value,
    });
  }
  return facts;
}

function mats(result: ReturnType<typeof calculateInternalWalls>): MaterialRequirement[] {
  return (result.requirements ?? []).filter(
    (row): row is MaterialRequirement => row.kind === "material"
  );
}

function rateRow(
  partial: Partial<OrganisationRate> & Pick<OrganisationRate, "item_key" | "cost_rate">
): OrganisationRate {
  return {
    id: `rate-${partial.item_key}`,
    organisation_id: "org1",
    rate_type: "material",
    item_key: partial.item_key,
    label: partial.item_key,
    unit: partial.unit ?? "each",
    cost_rate: partial.cost_rate,
    sell_rate: partial.sell_rate ?? null,
    active: true,
    source: "manual",
    ...partial,
  } as OrganisationRate;
}

function pageRate(
  partial: Partial<RatesPageRate> & Pick<RatesPageRate, "item_key">
): RatesPageRate {
  return {
    id: `page-${partial.item_key}`,
    organisation_id: "org1",
    rate_type: "material",
    item_key: partial.item_key,
    label: partial.item_key,
    unit: partial.unit ?? "m2",
    cost_rate: partial.cost_rate ?? null,
    sell_rate: partial.sell_rate ?? null,
    active: true,
    source: "manual",
    ...partial,
  } as RatesPageRate;
}

console.log("=== RATES-MATERIAL-AUTHORITY-01B ===\n");

console.log("--- A. All 30 derived keys ---\n");
const derivedKeys: string[] = [];
for (const row of DERIVED_MATRIX) {
  for (const lengthMm of row.lengths) {
    const key = dimensionedKey(row.family, row.thicknessMm, lengthMm);
    derivedKeys.push(key);
    const derived = derivedDimensionedPlasterboardCost(key);
    check(
      `helper ${key}`,
      derived != null &&
        derived.derivedCost > 0 &&
        derived.family === row.family &&
        derived.thicknessMm === row.thicknessMm &&
        near(liveQuotrMaterialCost(key), derived.derivedCost)
    );

    const walls = wa("w1");
    const lengthLabel = `${lengthMm} mm`;
    const thicknessLabel = `${row.thicknessMm} mm`;
    const heightM = lengthMm / 1000;
    const facts = [
      fact(INTERNAL_WALLS_JOB_SCOPE_FACT_KEY, "w1", "reline_existing"),
      ...writeWall("w1", [
        { key: INTERNAL_WALLS_ADD_WALL_TYPE_KEY, value: true },
        { key: "internal_walls.wall_type.label", value: `${row.family} ${lengthMm}` },
        { key: "internal_walls.wall_type.frame_system", value: "Existing frame" },
        { key: "internal_walls.wall_type.length_lm", value: 3.6 },
        { key: "internal_walls.wall_type.height_m", value: heightM },
        { key: "internal_walls.wall_type.side_a_product", value: row.productLabel },
        { key: "internal_walls.wall_type.side_a_thickness_mm", value: thicknessLabel },
        { key: "internal_walls.wall_type.side_a_sheet_length_mm", value: lengthLabel },
        { key: "internal_walls.wall_type.same_lining_both_sides", value: false },
      ]).filter((rowFact) => rowFact.key !== INTERNAL_WALLS_JOB_SCOPE_FACT_KEY),
    ];
    const result = calculateInternalWalls(ctx([walls], facts), walls);
    const lining = mats(result).filter((m) => m.materialKey === key);
    const req = lining[0];
    check(
      `IW emit ${key}`,
      req != null &&
        req.priced === true &&
        req.rateSource === "benchmark" &&
        derived != null &&
        near(req.unitCost, derived.derivedCost) &&
        req.purchaseQuantity > 0 &&
        near(req.totalCost, round2(req.purchaseQuantity * derived.derivedCost))
    );
    const line = result.lineItems.find((item) => item.itemKey === key);
    check(
      `IW line ${key}`,
      line != null &&
        line.rateSourceType === "benchmark" &&
        /Derived Quotr benchmark/i.test(line.rateSource ?? "") &&
        derived != null &&
        near(line.recommendedCost, round2((line.quantity ?? 0) * derived.derivedCost))
    );
  }
}
check("exactly 30 derived identities under test", derivedKeys.length === 30);

console.log("\n--- B. Company override precedence ---\n");
const overrideCases = [
  {
    key: "sheet.plasterboard.standard.13mm.3000x1200.each",
    product: "Standard GIB",
    thickness: "13 mm",
    length: "3000 mm",
    height: 3,
    company: 41.11,
  },
  {
    key: "sheet.plasterboard.aqualine.13mm.2700x1200.each",
    product: "Aqualine",
    thickness: "13 mm",
    length: "2700 mm",
    height: 2.7,
    company: 55.5,
  },
  {
    key: "sheet.plasterboard.fyreline.13mm.3000x1200.each",
    product: "Fyreline",
    thickness: "13 mm",
    length: "3000 mm",
    height: 3,
    company: 39.9,
  },
  {
    key: "sheet.plasterboard.braceline.13mm.3600x1200.each",
    product: "Braceline",
    thickness: "13 mm",
    length: "3600 mm",
    height: 3.6,
    company: 48.25,
  },
] as const;

for (const sample of overrideCases) {
  const walls = wa("w1");
  const facts = [
    fact(INTERNAL_WALLS_JOB_SCOPE_FACT_KEY, "w1", "reline_existing"),
    ...writeWall("w1", [
      { key: INTERNAL_WALLS_ADD_WALL_TYPE_KEY, value: true },
      { key: "internal_walls.wall_type.frame_system", value: "Existing frame" },
      { key: "internal_walls.wall_type.length_lm", value: 2.4 },
      { key: "internal_walls.wall_type.height_m", value: sample.height },
      { key: "internal_walls.wall_type.side_a_product", value: sample.product },
      { key: "internal_walls.wall_type.side_a_thickness_mm", value: sample.thickness },
      { key: "internal_walls.wall_type.side_a_sheet_length_mm", value: sample.length },
      { key: "internal_walls.wall_type.same_lining_both_sides", value: false },
    ]).filter((rowFact) => rowFact.key !== INTERNAL_WALLS_JOB_SCOPE_FACT_KEY),
  ];
  const withCompany = calculateInternalWalls(
    ctx([walls], facts, [rateRow({ item_key: sample.key, cost_rate: sample.company, unit: "each" })]),
    walls
  );
  const companyReq = mats(withCompany).find((m) => m.materialKey === sample.key);
  check(
    `company beats derived ${sample.key}`,
    companyReq?.priced === true &&
      companyReq.rateSource === "company" &&
      near(companyReq.unitCost, sample.company)
  );

  const restored = calculateInternalWalls(ctx([walls], facts), walls);
  const derived = derivedDimensionedPlasterboardCost(sample.key);
  const restoredReq = mats(restored).find((m) => m.materialKey === sample.key);
  check(
    `override removed restores derived ${sample.key}`,
    derived != null &&
      restoredReq?.priced === true &&
      restoredReq.rateSource === "benchmark" &&
      near(restoredReq.unitCost, derived.derivedCost)
  );
}

{
  const walls = wa("w1");
  const facts = [
    fact(INTERNAL_WALLS_JOB_SCOPE_FACT_KEY, "w1", "reline_existing"),
    ...writeWall("w1", [
      { key: INTERNAL_WALLS_ADD_WALL_TYPE_KEY, value: true },
      { key: "internal_walls.wall_type.frame_system", value: "Existing frame" },
      { key: "internal_walls.wall_type.length_lm", value: 3.6 },
      { key: "internal_walls.wall_type.height_m", value: 3 },
      { key: "internal_walls.wall_type.side_a_product", value: "Standard GIB" },
      { key: "internal_walls.wall_type.side_a_thickness_mm", value: "13 mm" },
      { key: "internal_walls.wall_type.side_a_sheet_length_mm", value: "3000 mm" },
      { key: "internal_walls.wall_type.same_lining_both_sides", value: false },
    ]).filter((rowFact) => rowFact.key !== INTERNAL_WALLS_JOB_SCOPE_FACT_KEY),
  ];
  const siblingKey = "sheet.plasterboard.standard.13mm.2700x1200.each";
  const targetKey = "sheet.plasterboard.standard.13mm.3000x1200.each";
  const only3000 = calculateInternalWalls(
    ctx(
      [walls],
      facts,
      [rateRow({ item_key: targetKey, cost_rate: 99.99, unit: "each" })]
    ),
    walls
  );
  const target = mats(only3000).find((m) => m.materialKey === targetKey);
  const siblingDerived = derivedDimensionedPlasterboardCost(siblingKey);
  check(
    "override one size does not invent sibling company rate",
    target?.rateSource === "company" &&
      siblingDerived != null &&
      getCatalogueEntry(siblingKey)?.defaultCostRate == null
  );
}

console.log("\n--- C. Negative derivation ---\n");
const negativeKeys = [
  "sheet.plasterboard.fyreline.16mm.2400x1200.each",
  "sheet.plasterboard.fyreline.16mm.3000x1200.each",
  "sheet.plasterboard.braceline.10mm.2400x1200.each",
  "sheet.plasterboard.braceline.10mm.3000x1200.each",
  "sheet.plasterboard.noiseline.13mm.2400x1200.each",
  "sheet.plasterboard.noiseline.13mm.3000x1200.each",
  "sheet.plasterboard.weatherline.13mm.2400x1200.each",
  "sheet.plasterboard.barrierline.13mm.2400x1200.each",
  "sheet.plasterboard.barrierline.16mm.3000x1200.each",
];
for (const key of negativeKeys) {
  check(`no derived ${key}`, derivedDimensionedPlasterboardCost(key) == null);
}
check(
  "no cross-family derivation",
  derivedDimensionedPlasterboardCost("sheet.plasterboard.standard.13mm.3000x1200.each")
    ?.baseKey === "sheet.plasterboard.standard.each" &&
    derivedDimensionedPlasterboardCost("sheet.plasterboard.aqualine.13mm.3000x1200.each")
      ?.baseKey === "sheet.plasterboard.aqualine.each"
);
check(
  "no cross-thickness derivation for fyreline 10",
  derivedDimensionedPlasterboardCost("sheet.plasterboard.fyreline.10mm.3000x1200.each") ==
    null
);

console.log("\n--- D. Missing authority safety ---\n");
{
  const walls = wa("w1");
  const facts = [
    fact(INTERNAL_WALLS_JOB_SCOPE_FACT_KEY, "w1", "reline_existing"),
    ...writeWall("w1", [
      { key: INTERNAL_WALLS_ADD_WALL_TYPE_KEY, value: true },
      { key: "internal_walls.wall_type.frame_system", value: "Existing frame" },
      { key: "internal_walls.wall_type.length_lm", value: 3.6 },
      { key: "internal_walls.wall_type.height_m", value: 2.4 },
      { key: "internal_walls.wall_type.side_a_product", value: "Noiseline" },
      { key: "internal_walls.wall_type.side_a_thickness_mm", value: "13 mm" },
      { key: "internal_walls.wall_type.side_a_sheet_length_mm", value: "2400 mm" },
      { key: "internal_walls.wall_type.same_lining_both_sides", value: false },
      { key: "internal_walls.wall_type.painting", value: "Side A" },
    ]).filter((rowFact) => rowFact.key !== INTERNAL_WALLS_JOB_SCOPE_FACT_KEY),
  ];
  const result = calculateInternalWalls(ctx([walls], facts), walls);
  const noise = mats(result).find((m) =>
    (m.materialKey ?? "").includes("noiseline")
  );
  const paint = mats(result).find(
    (m) => m.materialKey === INTERNAL_WALLS_PAINTING_MATERIAL_KEY
  );
  check(
    "Noiseline stays PR never $0",
    noise != null &&
      noise.priced === false &&
      noise.unitCost == null &&
      noise.totalCost == null &&
      noise.rateSource === "missing"
  );
  check(
    "paint stays PR never $0",
    paint == null ||
      (paint.priced === false &&
        paint.unitCost == null &&
        paint.totalCost == null &&
        paint.rateSource === "missing")
  );
}

console.log("\n--- E. Five new Rates identities ---\n");
const fiveKeys = [
  {
    key: INTERNAL_WALLS_PAINTING_MATERIAL_KEY,
    familyId: "wall-painting",
    unit: "m2",
    search: "Wall paint",
  },
  {
    key: INTERNAL_WALLS_CORNICE_MATERIAL_KEY,
    familyId: "wall-cornice",
    unit: "lm",
    search: "Cornice",
  },
  {
    key: "stopping.plasterboard.level5.m2",
    familyId: "stopping",
    unit: "m2",
    search: "Level 5",
  },
  {
    key: "insulation.wall.acoustic.m2",
    familyId: "wall-specialty-insulation",
    unit: "m2",
    search: "Acoustic wall",
  },
  {
    key: "insulation.wall.fire_acoustic.m2",
    familyId: "wall-specialty-insulation",
    unit: "m2",
    search: "Fire and acoustic",
  },
] as const;

const registry = buildMaterialRegistry({ rates: [], editable: true });
for (const row of fiveKeys) {
  const matches = registry.items.filter((item) => item.canonicalKey === row.key);
  const item = matches[0];
  check(
    `Rates once ${row.key}`,
    matches.length === 1 &&
      item != null &&
      item.ordinary === true &&
      item.unit === row.unit &&
      item.familyId === row.familyId &&
      item.effectiveSource === "pricing_required" &&
      item.quotrBenchmarkCost == null &&
      item.workAreaTypes.includes("internal_walls") &&
      item.editable === true
  );
  check(
    `searchable ${row.key}`,
    item != null && materialSearchMatches(item, row.search)
  );
  const filtered = filterMaterialCategories({
    categories: registry.categories,
    categoryId: "all",
    workArea: "internal_walls",
    status: "all",
    query: "",
  });
  check(
    `IW filter ${row.key}`,
    filtered.some((category) =>
      category.families.some((family) =>
        family.ordinaryItems.some((entry) => entry.canonicalKey === row.key)
      )
    )
  );
  const entry = getCatalogueEntry(row.key);
  check(
    `catalogue null COST ${row.key}`,
    entry != null && entry.defaultCostRate == null
  );
}

{
  const gibMatches = registry.items.filter(
    (item) => item.canonicalKey === INTERNAL_WALLS_CORNICE_GIB_COVE_CLASSIC_55_3600_KEY
  );
  const gib = gibMatches[0];
  check(
    "GIB-Cove Classic is a single exact product",
    gibMatches.length === 1 &&
      gib != null &&
      gib.ordinary === true &&
      gib.unit === "each" &&
      gib.familyId === "wall-cornice" &&
      (gib.effectiveSource === "benchmark" ||
        gib.effectiveSource === "direct_benchmark") &&
      near(gib.quotrBenchmarkCost, INTERNAL_WALLS_GIB_COVE_COST_EACH) &&
      gib.workAreaTypes.includes("internal_walls")
  );
  check(
    "generic cornice.wall.lm is not the GIB product",
    INTERNAL_WALLS_CORNICE_MATERIAL_KEY !==
      INTERNAL_WALLS_CORNICE_GIB_COVE_CLASSIC_55_3600_KEY &&
      getCatalogueEntry(INTERNAL_WALLS_CORNICE_MATERIAL_KEY)?.defaultCostRate ==
        null
  );
}

{
  const seeded = buildMaterialRegistry({
    rates: [
      pageRate({
        item_key: INTERNAL_WALLS_PAINTING_MATERIAL_KEY,
        cost_rate: 12.5,
        unit: "m2",
      }),
    ],
    editable: true,
  });
  const paint = seeded.items.find(
    (item) => item.canonicalKey === INTERNAL_WALLS_PAINTING_MATERIAL_KEY
  );
  check(
    "company override resolves painting.wall.m2",
    paint?.effectiveSource === "company" && near(paint.effectiveRate, 12.5)
  );
}

console.log("\n--- F. Calculator-to-Rates completeness ---\n");
const ceilingEmitted = CEILING_BENCHMARK_REQUIREMENTS.map(
  (row) => row.materialIdentity
).filter((key): key is string => Boolean(key));
const iwEmitted = [
  ...INTERNAL_WALLS_BENCHMARK_REQUIREMENTS.map((row) => row.materialIdentity).filter(
    (key): key is string => Boolean(key)
  ),
  ...fiveKeys.map((row) => row.key),
  ...derivedKeys,
];
const ratesKeys = new Set(registry.items.map((item) => item.canonicalKey));
const missingCeiling = ceilingEmitted.filter((key) => !ratesKeys.has(key));
const missingIw = iwEmitted.filter((key) => !ratesKeys.has(key));
check(
  "Ceiling emitted keys present in Rates",
  missingCeiling.length === 0,
  missingCeiling.join(", ")
);
check(
  "IW emitted keys present in Rates",
  missingIw.length === 0,
  missingIw.join(", ")
);

console.log("\n--- G. Builder Review derived label ---\n");
check(
  "mapRateLabel Derived Quotr benchmark",
  mapRateLabel("Derived Quotr benchmark") === "Derived Quotr benchmark"
);
check(
  "mapRateLabel keeps Quotr benchmark",
  mapRateLabel("Quotr benchmark") === "Quotr benchmark"
);

console.log("\n--- H. Coverage registry ---\n");
const ceilingCoverage = verifyRegisteredWorkAreaBenchmarkCoverage("ceilings");
const iwCoverage = verifyRegisteredWorkAreaBenchmarkCoverage("internal_walls");
check(
  "Ceilings coverage registry clean",
  ceilingCoverage.failures.length === 0,
  ceilingCoverage.failures.join(" | ")
);
check(
  "Internal Walls coverage registry clean",
  iwCoverage.failures.length === 0,
  iwCoverage.failures.join(" | ")
);

console.log(`\nRATES-MATERIAL-AUTHORITY-01B ${failed === 0 ? "PASSED" : "FAILED"} ${passed}/${passed + failed}`);
process.exit(failed === 0 ? 0 : 1);
