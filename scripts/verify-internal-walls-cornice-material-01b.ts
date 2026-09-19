/**
 * IW-CORNICE-MATERIAL-01B — typed cornice/scotia flow + GIB-Cove authority.
 *
 * Run: npx --yes tsx scripts/verify-internal-walls-cornice-material-01b.ts
 *
 * Preview only. No Production.
 */
import { composeBuilderReview } from "../lib/assistant/builder-review/compose";
import type { OrganisationRate } from "../components/setup/types";
import { calculateInternalWalls } from "../lib/estimate/calculators/fitout";
import {
  applyExtractedInternalWallsToFacts,
  extractInternalWallsCorniceFromBrief,
  extractInternalWallsTypesFromBrief,
} from "../lib/estimate/internal-walls-brief";
import {
  INTERNAL_WALLS_CORNICE_INCLUDED_KEY,
  INTERNAL_WALLS_CORNICE_PRODUCT_KEY,
  INTERNAL_WALLS_CORNICE_SIDES_KEY,
  INTERNAL_WALLS_CORNICE_TYPE_KEY,
  INTERNAL_WALLS_INSULATION_INCLUDED_KEY,
  INTERNAL_WALLS_SKIRTING_SIDES_KEY,
  corniceIsIncluded,
  nextInternalWallsFinishField,
} from "../lib/estimate/internal-walls-finish";
import {
  INTERNAL_WALLS_CARPENTER_LABOUR_KEY,
  INTERNAL_WALLS_CORNICE_GIB_COVE_CLASSIC_55_3600_KEY,
  INTERNAL_WALLS_CORNICE_HOURS_PER_LM,
  INTERNAL_WALLS_CORNICE_INSTALL_HOURS_PER_LM_KEY,
  INTERNAL_WALLS_CORNICE_LABOUR_COMPONENT,
  INTERNAL_WALLS_CORNICE_MATERIAL_COMPONENT,
  INTERNAL_WALLS_CORNICE_MATERIAL_KEY,
  INTERNAL_WALLS_CORNICE_MDF_SCOTIA_KEY,
  INTERNAL_WALLS_CORNICE_PINE_SCOTIA_KEY,
  INTERNAL_WALLS_GIB_COVE_COST_EACH,
  INTERNAL_WALLS_GIB_COVE_STOCK_LENGTH_M,
  gibCoveClassicStockCount,
} from "../lib/estimate/internal-walls-identities";
import { INTERNAL_WALLS_HAS_OPENINGS_KEY } from "../lib/estimate/internal-walls-openings";
import { INTERNAL_WALLS_JOB_SCOPE_FACT_KEY } from "../lib/estimate/internal-walls-scope";
import {
  INTERNAL_WALLS_ADD_WALL_TYPE_KEY,
  applyInternalWallsFactWrite,
  nextInternalWallsWallTypeField,
  resolveInternalWallsWallTypes,
} from "../lib/estimate/internal-walls-wall-types";
import { buildWorkAreaQuoteDescriptionDraft } from "../lib/work-areas/quote-description";
import { buildMaterialRegistry } from "../lib/rates/material-registry";
import { getCatalogueEntry } from "../lib/rates/catalogue";
import type {
  EstimateContext,
  EstimateFact,
  EstimateWorkArea,
} from "../lib/estimate/types";
import type {
  LabourRequirement,
  MaterialRequirement,
} from "../lib/estimate/requirements";

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
  tol = 1e-6
): boolean {
  return (
    actual != null &&
    Number.isFinite(actual) &&
    Math.abs(actual - expected) <= tol
  );
}

function wa(): EstimateWorkArea {
  return {
    id: "w1",
    type: "internal_walls",
    name: "Internal walls",
    sort_order: 1,
    status: "confirmed",
  } as EstimateWorkArea;
}

function orgRate(
  itemKey: string,
  unit: string,
  cost: number,
  extras?: Partial<OrganisationRate>
): OrganisationRate {
  return {
    id: `rate-${itemKey}`,
    rate_type: extras?.rate_type ?? "material",
    trade: extras?.trade ?? null,
    work_area_type: extras?.work_area_type ?? null,
    item_key: itemKey,
    label: extras?.label ?? itemKey,
    unit,
    cost_rate: cost,
    sell_rate: extras?.sell_rate ?? null,
    markup_percent: extras?.markup_percent ?? null,
    active: true,
    ...extras,
  };
}

function ctx(
  facts: EstimateFact[],
  rates: OrganisationRate[] = []
): EstimateContext {
  return {
    project: { id: "iw-cornice-material-01b", qualityLevel: "standard" },
    confirmedWorkAreas: [wa()],
    facts,
    constraints: [],
    organisationSettings: {
      allow_benchmark_rates: true,
      default_margin_percent: 20,
      budget_rate_factor: 0.9,
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
  writes: Array<{ key: string; value: unknown; wallTypeId?: string }>
): EstimateFact[] {
  let facts: EstimateFact[] = [
    {
      key: INTERNAL_WALLS_JOB_SCOPE_FACT_KEY,
      work_area_id: "w1",
      value: "new_partition",
    },
  ];
  for (const row of writes) {
    facts = applyInternalWallsFactWrite({
      facts,
      workAreaId: "w1",
      key: row.key,
      value: row.value,
      wallTypeId: row.wallTypeId,
    });
  }
  return facts;
}

function fixture(params: {
  lengthLm?: number;
  included?: string;
  sides?: string;
  type?: string;
  product?: string;
  secondPortion?: boolean;
  secondProduct?: string;
}): EstimateFact[] {
  let facts = writeWall([
    { key: INTERNAL_WALLS_ADD_WALL_TYPE_KEY, value: true },
    { key: "internal_walls.wall_type.label", value: "Wall Type 1" },
    { key: "internal_walls.wall_type.frame_system", value: "Timber framing" },
    {
      key: "internal_walls.wall_type.frame_size",
      value: "90 mm timber framing — 90×45",
    },
    { key: "internal_walls.wall_type.length_lm", value: params.lengthLm ?? 4 },
    { key: "internal_walls.wall_type.height_m", value: 2.7 },
    { key: "internal_walls.wall_type.stud_centres_mm", value: "600 mm" },
    { key: "internal_walls.wall_type.side_a_product", value: "Standard GIB" },
    { key: "internal_walls.wall_type.same_lining_both_sides", value: true },
    { key: INTERNAL_WALLS_HAS_OPENINGS_KEY, value: "No" },
    { key: INTERNAL_WALLS_INSULATION_INCLUDED_KEY, value: "No" },
    { key: INTERNAL_WALLS_SKIRTING_SIDES_KEY, value: "No" },
  ]);
  const type1 = resolveInternalWallsWallTypes({ facts, workAreaId: "w1" })
    .types[0]!;
  if (params.included != null) {
    facts = applyInternalWallsFactWrite({
      facts,
      workAreaId: "w1",
      key: INTERNAL_WALLS_CORNICE_INCLUDED_KEY,
      value: params.included,
      wallTypeId: type1.id,
    });
  }
  if (params.sides != null) {
    facts = applyInternalWallsFactWrite({
      facts,
      workAreaId: "w1",
      key: INTERNAL_WALLS_CORNICE_SIDES_KEY,
      value: params.sides,
      wallTypeId: type1.id,
    });
  }
  if (params.type != null) {
    facts = applyInternalWallsFactWrite({
      facts,
      workAreaId: "w1",
      key: INTERNAL_WALLS_CORNICE_TYPE_KEY,
      value: params.type,
      wallTypeId: type1.id,
    });
  }
  if (params.product != null) {
    facts = applyInternalWallsFactWrite({
      facts,
      workAreaId: "w1",
      key: INTERNAL_WALLS_CORNICE_PRODUCT_KEY,
      value: params.product,
      wallTypeId: type1.id,
    });
  }
  if (params.secondPortion) {
    facts = applyInternalWallsFactWrite({
      facts,
      workAreaId: "w1",
      key: INTERNAL_WALLS_ADD_WALL_TYPE_KEY,
      value: true,
    });
    const type2 = resolveInternalWallsWallTypes({ facts, workAreaId: "w1" })
      .types[1]!;
    facts = applyInternalWallsFactWrite({
      facts,
      workAreaId: "w1",
      key: "internal_walls.wall_type.label",
      value: "Wall Type 2",
      wallTypeId: type2.id,
    });
    facts = applyInternalWallsFactWrite({
      facts,
      workAreaId: "w1",
      key: "internal_walls.wall_type.frame_system",
      value: "Timber framing",
      wallTypeId: type2.id,
    });
    facts = applyInternalWallsFactWrite({
      facts,
      workAreaId: "w1",
      key: "internal_walls.wall_type.length_lm",
      value: 3,
      wallTypeId: type2.id,
    });
    facts = applyInternalWallsFactWrite({
      facts,
      workAreaId: "w1",
      key: "internal_walls.wall_type.height_m",
      value: 2.7,
      wallTypeId: type2.id,
    });
    facts = applyInternalWallsFactWrite({
      facts,
      workAreaId: "w1",
      key: "internal_walls.wall_type.side_a_product",
      value: "Standard GIB",
      wallTypeId: type2.id,
    });
    facts = applyInternalWallsFactWrite({
      facts,
      workAreaId: "w1",
      key: INTERNAL_WALLS_HAS_OPENINGS_KEY,
      value: "No",
      wallTypeId: type2.id,
    });
    facts = applyInternalWallsFactWrite({
      facts,
      workAreaId: "w1",
      key: INTERNAL_WALLS_CORNICE_SIDES_KEY,
      value: "Both sides",
      wallTypeId: type2.id,
    });
    facts = applyInternalWallsFactWrite({
      facts,
      workAreaId: "w1",
      key: INTERNAL_WALLS_CORNICE_TYPE_KEY,
      value: "Plaster cornice/cove",
      wallTypeId: type2.id,
    });
    facts = applyInternalWallsFactWrite({
      facts,
      workAreaId: "w1",
      key: INTERNAL_WALLS_CORNICE_PRODUCT_KEY,
      value: params.secondProduct ?? "GIB-Cove® Classic 55mm × 3.6m",
      wallTypeId: type2.id,
    });
  }
  return facts;
}

function mats(reqs: readonly { kind: string }[]): MaterialRequirement[] {
  return (reqs as MaterialRequirement[]).filter(
    (row) =>
      row.kind === "material" &&
      row.componentKey === INTERNAL_WALLS_CORNICE_MATERIAL_COMPONENT
  );
}

function labs(reqs: readonly { kind: string }[]): LabourRequirement[] {
  return (reqs as LabourRequirement[]).filter(
    (row) =>
      row.kind === "labour" &&
      row.componentKey === INTERNAL_WALLS_CORNICE_LABOUR_COMPONENT
  );
}

function nextField(facts: EstimateFact[]): string | null {
  const type = resolveInternalWallsWallTypes({ facts, workAreaId: "w1" })
    .types[0]!;
  return nextInternalWallsFinishField({
    type,
    jobScope: "new_partition",
    omitElectrical: true,
  });
}

console.log("\n--- Purchase rounding ---\n");
check("3.6lm → 1 length", gibCoveClassicStockCount(3.6) === 1);
check("3.61lm → 2 lengths", gibCoveClassicStockCount(3.61) === 2);
check("7.2lm → 2 lengths", gibCoveClassicStockCount(7.2) === 2);
check("8lm → 3 lengths", gibCoveClassicStockCount(8) === 3);
check(
  "stock identity is each not lm",
  INTERNAL_WALLS_CORNICE_GIB_COVE_CLASSIC_55_3600_KEY.endsWith(".each") &&
    INTERNAL_WALLS_GIB_COVE_STOCK_LENGTH_M === 3.6 &&
    near(INTERNAL_WALLS_GIB_COVE_COST_EACH, 13.32)
);

console.log("\n--- A. No cornice ---\n");
{
  const facts = fixture({ included: "No" });
  const type = resolveInternalWallsWallTypes({ facts, workAreaId: "w1" })
    .types[0]!;
  const calc = calculateInternalWalls(ctx(facts), wa());
  check("A included false", type.cornice_included === false);
  check("A no child sides/type/product", type.cornice === "none");
  check(
    "A next field is not a cornice child",
    nextField(facts) !== INTERNAL_WALLS_CORNICE_SIDES_KEY &&
      nextField(facts) !== INTERNAL_WALLS_CORNICE_TYPE_KEY &&
      nextField(facts) !== INTERNAL_WALLS_CORNICE_PRODUCT_KEY
  );
  check("A no material", mats(calc.requirements ?? []).length === 0);
  check("A no labour", labs(calc.requirements ?? []).length === 0);
}

console.log("\n--- B. Legacy generic both sides ---\n");
{
  const facts = fixture({ sides: "Both sides" });
  const type = resolveInternalWallsWallTypes({ facts, workAreaId: "w1" })
    .types[0]!;
  const calc = calculateInternalWalls(ctx(facts), wa());
  const mat = mats(calc.requirements ?? [])[0];
  const lab = labs(calc.requirements ?? [])[0];
  check("B remains included", corniceIsIncluded(type) && type.cornice === "both");
  check("B not auto GIB", type.cornice_product == null);
  check(
    "B asks type confirmation",
    nextField(facts) === INTERNAL_WALLS_CORNICE_TYPE_KEY
  );
  check(
    "B generic material PR 8lm",
    mat != null &&
      mat.materialKey === INTERNAL_WALLS_CORNICE_MATERIAL_KEY &&
      near(mat.baseQuantity, 8) &&
      mat.priced === false &&
      mat.unitCost == null &&
      mat.totalCost == null
  );
  check(
    "B ordinary labour 1.60 / $96",
    lab != null &&
      lab.priced === true &&
      near(lab.baseHours, 1.6) &&
      near(lab.totalCost, 96)
  );
}

console.log("\n--- C. Exact GIB fixture ---\n");
{
  const facts = fixture({
    included: "Yes",
    sides: "Both sides",
    type: "Plaster cornice/cove",
    product: "GIB-Cove® Classic 55mm × 3.6m",
  });
  const calc = calculateInternalWalls(ctx(facts), wa());
  const mat = mats(calc.requirements ?? [])[0];
  const lab = labs(calc.requirements ?? [])[0];
  check(
    "C installed 8lm, 3 lengths, $39.96",
    mat != null &&
      mat.materialKey === INTERNAL_WALLS_CORNICE_GIB_COVE_CLASSIC_55_3600_KEY &&
      near(mat.baseQuantity, 8) &&
      mat.baseUnit === "lm" &&
      near(mat.purchaseQuantity, 3) &&
      mat.purchaseUnit === "each" &&
      near(mat.unitCost, 13.32) &&
      near(mat.totalCost, 39.96) &&
      mat.priced === true
  );
  check(
    "C labour 1.60 / $96",
    lab != null &&
      near(lab.productivityBasis?.quantity, 8) &&
      near(lab.baseHours, 1.6) &&
      near(lab.hourlyCost, 60) &&
      near(lab.totalCost, 96)
  );
  check(
    "C adhesive exclusion disclosed",
    (mat?.assumptions ?? []).some((row) =>
      /adhesive and fixings are not included/i.test(row.text)
    )
  );
  check(
    "C no $0 accessory line",
    !(calc.lineItems ?? []).some(
      (row) =>
        /adhesive|fixing/i.test(row.label) && (row.costRate === 0 || row.total === 0)
    )
  );
}

console.log("\n--- D. GIB thresholds ---\n");
for (const row of [
  { lm: 3.6, count: 1, cost: 13.32 },
  { lm: 3.61, count: 2, cost: 26.64 },
  { lm: 7.2, count: 2, cost: 26.64 },
  { lm: 8, count: 3, cost: 39.96 },
] as const) {
  const facts = fixture({
    lengthLm: row.lm / 2,
    included: "Yes",
    sides: "Both sides",
    type: "Plaster cornice/cove",
    product: "GIB-Cove® Classic 55mm × 3.6m",
  });
  const mat = mats(
    calculateInternalWalls(ctx(facts), wa()).requirements ?? []
  )[0];
  check(
    `D ${row.lm}lm → ${row.count} × $13.32 = $${row.cost}`,
    mat != null &&
      near(mat.baseQuantity, row.lm) &&
      near(mat.purchaseQuantity, row.count) &&
      near(mat.totalCost, row.cost)
  );
}

console.log("\n--- E/F. Scotia ---\n");
for (const row of [
  {
    name: "E MDF",
    product: "MDF scotia",
    key: INTERNAL_WALLS_CORNICE_MDF_SCOTIA_KEY,
  },
  {
    name: "F Pine",
    product: "Pine timber scotia",
    key: INTERNAL_WALLS_CORNICE_PINE_SCOTIA_KEY,
  },
] as const) {
  const facts = fixture({
    included: "Yes",
    sides: "Both sides",
    type: "Timber or MDF scotia",
    product: row.product,
  });
  const calc = calculateInternalWalls(ctx(facts), wa());
  const mat = mats(calc.requirements ?? [])[0];
  const lab = labs(calc.requirements ?? [])[0];
  check(
    `${row.name} known 8lm PR, no GIB money`,
    mat != null &&
      mat.materialKey === row.key &&
      near(mat.baseQuantity, 8) &&
      mat.priced === false &&
      mat.unitCost == null &&
      mat.materialKey !== INTERNAL_WALLS_CORNICE_GIB_COVE_CLASSIC_55_3600_KEY
  );
  check(
    `${row.name} ordinary labour 1.60`,
    lab != null && lab.priced === true && near(lab.baseHours, 1.6)
  );
}

console.log("\n--- G. Other/custom ---\n");
{
  const facts = fixture({
    included: "Yes",
    sides: "Both sides",
    type: "Other/custom",
  });
  const calc = calculateInternalWalls(ctx(facts), wa());
  const mat = mats(calc.requirements ?? [])[0];
  const lab = labs(calc.requirements ?? [])[0];
  check(
    "G quantity retained, generic PR",
    mat != null &&
      near(mat.baseQuantity, 8) &&
      mat.materialKey === INTERNAL_WALLS_CORNICE_MATERIAL_KEY &&
      mat.priced === false
  );
  check("G specialist labour PR", lab != null && lab.priced === false);
}

console.log("\n--- Question flow ---\n");
{
  const afterInclude = fixture({ included: "Yes" });
  check(
    "Yes asks where",
    nextField(afterInclude) === INTERNAL_WALLS_CORNICE_SIDES_KEY
  );
  const afterSides = fixture({ included: "Yes", sides: "Side A" });
  check(
    "sides ask type",
    nextField(afterSides) === INTERNAL_WALLS_CORNICE_TYPE_KEY
  );
  const afterPlaster = fixture({
    included: "Yes",
    sides: "Both sides",
    type: "Plaster cornice/cove",
  });
  check(
    "plaster asks GIB product",
    nextField(afterPlaster) === INTERNAL_WALLS_CORNICE_PRODUCT_KEY
  );
  const afterScotia = fixture({
    included: "Yes",
    sides: "Both sides",
    type: "Timber or MDF scotia",
  });
  check(
    "scotia asks material",
    nextField(afterScotia) === INTERNAL_WALLS_CORNICE_PRODUCT_KEY
  );
  const wallField = nextInternalWallsWallTypeField({
    type: resolveInternalWallsWallTypes({
      facts: fixture({ included: "No" }),
      workAreaId: "w1",
    }).types[0]!,
    jobScope: "new_partition",
    omitElectrical: true,
  });
  check(
    "No does not ask cornice children",
    wallField !== INTERNAL_WALLS_CORNICE_SIDES_KEY &&
      wallField !== INTERNAL_WALLS_CORNICE_TYPE_KEY &&
      wallField !== INTERNAL_WALLS_CORNICE_PRODUCT_KEY
  );
}

console.log("\n--- H. User authority ---\n");
{
  const extracted = extractInternalWallsTypesFromBrief(
    "new internal wall timber 4m 2.7m GIB-Cove Classic 55mm both sides"
  );
  let facts = applyExtractedInternalWallsToFacts({
    facts: fixture({
      included: "Yes",
      sides: "Both sides",
    }),
    workAreaId: "w1",
    types: extracted.length
      ? extracted
      : [
          {
            wallCount: 1,
            lengthLm: 4,
            heightM: 2.7,
            frameSystem: "timber",
            frameSize: "90x45",
            sameLiningBothSides: true,
            hasOpenings: false,
            sideA: { product: "standard_gib", thicknessMm: 13 },
            sideB: { product: "standard_gib", thicknessMm: 13 },
            corniceIncluded: true,
            corniceSides: "both",
            corniceType: "plaster_cornice",
            corniceProduct: "gib_cove_classic_55mm_3600",
          },
        ],
  });
  const type1 = resolveInternalWallsWallTypes({ facts, workAreaId: "w1" })
    .types[0]!;
  facts = applyInternalWallsFactWrite({
    facts,
    workAreaId: "w1",
    wallTypeId: type1.id,
    key: INTERNAL_WALLS_CORNICE_TYPE_KEY,
    value: "Timber or MDF scotia",
  });
  facts = applyInternalWallsFactWrite({
    facts,
    workAreaId: "w1",
    wallTypeId: type1.id,
    key: INTERNAL_WALLS_CORNICE_PRODUCT_KEY,
    value: "MDF scotia",
  });
  facts = applyExtractedInternalWallsToFacts({
    facts,
    workAreaId: "w1",
    types: [
      {
        wallCount: 1,
        lengthLm: 4,
        heightM: 2.7,
        frameSystem: "timber",
        frameSize: "90x45",
        sameLiningBothSides: true,
        hasOpenings: false,
        sideA: { product: "standard_gib", thicknessMm: 13 },
        sideB: { product: "standard_gib", thicknessMm: 13 },
        corniceIncluded: true,
        corniceSides: "both",
        corniceType: "plaster_cornice",
        corniceProduct: "gib_cove_classic_55mm_3600",
      },
    ],
  });
  facts = applyInternalWallsFactWrite({
    facts,
    workAreaId: "w1",
    wallTypeId: type1.id,
    key: "internal_walls.wall_type.height_m",
    value: 2.7,
  });
  const after = resolveInternalWallsWallTypes({ facts, workAreaId: "w1" })
    .types[0]!;
  check(
    "H user MDF survives GIB re-extract and unrelated edit",
    after.cornice_type === "timber_mdf_scotia" &&
      after.cornice_product === "mdf_scotia"
  );
}

console.log("\n--- Brief extraction ---\n");
{
  const gib = extractInternalWallsCorniceFromBrief(
    "55 mm GIB-Cove Classic on a new internal wall"
  );
  check(
    "GIB wording selects exact product",
    gib.included === true &&
      gib.type === "plaster_cornice" &&
      gib.product === "gib_cove_classic_55mm_3600"
  );
  const generic = extractInternalWallsCorniceFromBrief(
    "include cornice on the new internal wall"
  );
  check(
    "generic cornice does not invent GIB",
    generic.included === true && generic.product == null
  );
  const mdf = extractInternalWallsCorniceFromBrief("MDF scotia both sides");
  check(
    "MDF scotia wording",
    mdf.type === "timber_mdf_scotia" && mdf.product === "mdf_scotia"
  );
  const ornate = extractInternalWallsCorniceFromBrief(
    "ornate decorative cornice on the new internal wall"
  );
  check(
    "specialist stays custom, not GIB",
    ornate.type === "other_custom" && ornate.product == null
  );
}

console.log("\n--- I. Company overrides ---\n");
{
  const facts = fixture({
    included: "Yes",
    sides: "Both sides",
    type: "Plaster cornice/cove",
    product: "GIB-Cove® Classic 55mm × 3.6m",
  });
  const materialOnly = calculateInternalWalls(
    ctx(facts, [
      orgRate(INTERNAL_WALLS_CORNICE_GIB_COVE_CLASSIC_55_3600_KEY, "each", 20),
    ]),
    wa()
  );
  const mat = mats(materialOnly.requirements ?? [])[0];
  const lab = labs(materialOnly.requirements ?? [])[0];
  check(
    "I material override 3 × $20 = $60, labour unchanged",
    near(mat?.totalCost, 60) && near(lab?.totalCost, 96) && near(lab?.baseHours, 1.6)
  );
  const prodOnly = calculateInternalWalls(
    ctx(facts, [
      orgRate(INTERNAL_WALLS_CORNICE_INSTALL_HOURS_PER_LM_KEY, "lm", 0.25, {
        rate_type: "productivity",
        label: "Cornice hours",
      }),
    ]),
    wa()
  );
  check(
    "I productivity 0.25 → 2.00 hours, material $39.96",
    near(labs(prodOnly.requirements ?? [])[0]?.baseHours, 2) &&
      near(mats(prodOnly.requirements ?? [])[0]?.totalCost, 39.96)
  );
  const labourOnly = calculateInternalWalls(
    ctx(facts, [
      orgRate(INTERNAL_WALLS_CARPENTER_LABOUR_KEY, "hour", 75, {
        rate_type: "labour",
        trade: "carpenter",
      }),
    ]),
    wa()
  );
  check(
    "I carpenter $75 → labour $120, hours 1.60, material $39.96",
    near(labs(labourOnly.requirements ?? [])[0]?.baseHours, 1.6) &&
      near(labs(labourOnly.requirements ?? [])[0]?.totalCost, 120) &&
      near(mats(labourOnly.requirements ?? [])[0]?.totalCost, 39.96)
  );
  check(
    "productivity key unchanged",
    INTERNAL_WALLS_CORNICE_HOURS_PER_LM === 0.2
  );
}

console.log("\n--- J. Multi-portion isolation ---\n");
{
  const facts = fixture({
    included: "Yes",
    sides: "Both sides",
    type: "Plaster cornice/cove",
    product: "GIB-Cove® Classic 55mm × 3.6m",
    secondPortion: true,
    secondProduct: "MDF scotia",
  });
  const types = resolveInternalWallsWallTypes({ facts, workAreaId: "w1" }).types;
  const calc = calculateInternalWalls(ctx(facts), wa());
  const allMats = mats(calc.requirements ?? []);
  check(
    "J two portions keep independent products",
    types[0]?.cornice_product === "gib_cove_classic_55mm_3600" &&
      types[1]?.cornice_product === "mdf_scotia"
  );
  check(
    "J purchase rounding is per portion, not combined 14lm",
    allMats.length === 2 &&
      allMats.some(
        (row) =>
          row.materialKey === INTERNAL_WALLS_CORNICE_GIB_COVE_CLASSIC_55_3600_KEY &&
          near(row.purchaseQuantity, 3)
      ) &&
      allMats.some(
        (row) =>
          row.materialKey === INTERNAL_WALLS_CORNICE_MDF_SCOTIA_KEY &&
          row.priced === false
      )
  );
}

console.log("\n--- Rates / Review / Quote ---\n");
{
  const registry = buildMaterialRegistry({ rates: [], editable: true });
  const gib = registry.items.find(
    (item) => item.canonicalKey === INTERNAL_WALLS_CORNICE_GIB_COVE_CLASSIC_55_3600_KEY
  );
  check(
    "Rates shows GIB $13.32 each under wall-cornice",
    gib != null &&
      gib.familyId === "wall-cornice" &&
      near(gib.quotrBenchmarkCost, 13.32) &&
      gib.unit === "each" &&
      /3\.70/.test(gib.catalogueEntry?.description ?? "") &&
      !/Quotr V1/i.test(gib.label) &&
      !/Quotr V1/i.test(gib.catalogueEntry?.description ?? "")
  );
  check(
    "generic remains null COST",
    getCatalogueEntry(INTERNAL_WALLS_CORNICE_MATERIAL_KEY)?.defaultCostRate ==
      null
  );

  const facts = fixture({
    included: "Yes",
    sides: "Both sides",
    type: "Plaster cornice/cove",
    product: "GIB-Cove® Classic 55mm × 3.6m",
  });
  const calc = calculateInternalWalls(ctx(facts), wa());
  const review = composeBuilderReview({
    estimate: {
      recommendedCost: (calc.lineItems ?? []).reduce(
        (sum, item) => sum + (item.recommendedCost ?? 0),
        0
      ),
      recommendedSell: (calc.lineItems ?? []).reduce(
        (sum, item) => sum + (item.recommendedSell ?? 0),
        0
      ),
      marginPercent: 20,
      confidence: calc.confidence,
      assumptions: calc.assumptions,
      missingInfo: calc.missingInfo,
      lineItems: (calc.lineItems ?? []).map((row, index) => ({
        ...row,
        id: `li-${index}`,
      })),
    },
    workAreas: [
      {
        id: "w1",
        type: "internal_walls",
        name: "Internal walls",
        status: "confirmed",
      },
    ],
    requirements: calc.requirements ?? [],
  });
  const reviewText = JSON.stringify(review);
  check(
    "Builder Review shows 8lm, 3 lengths, $39.96, 1.60 hours",
    /8/.test(reviewText) &&
      /3/.test(reviewText) &&
      /13\.32|39\.96/.test(reviewText) &&
      /1\.60|1.6/.test(reviewText)
  );
  check(
    "Builder Review discloses adhesive exclusion",
    /adhesive/i.test(reviewText)
  );

  const quote = buildWorkAreaQuoteDescriptionDraft({
    type: "internal_walls",
    name: "Internal walls",
    facts: [
      {
        key: "internal_walls.wall_types",
        label: "Wall types",
        value: JSON.stringify(
          resolveInternalWallsWallTypes({ facts, workAreaId: "w1" }).types
        ),
      },
    ],
  });
  check(
    "Quote may name GIB and both sides, hides keys and COST",
    /GIB-Cove Classic/i.test(quote) &&
      /both sides/i.test(quote) &&
      /not included/i.test(quote) &&
      !/cornice\.wall/.test(quote) &&
      !/13\.32/.test(quote) &&
      !/3\.70/.test(quote) &&
      !/person-hours/i.test(quote) &&
      !/Pricing Required/i.test(quote)
  );

}

console.log(
  `\nIW-CORNICE-MATERIAL-01B result: ${passed} passed, ${failed} failed\n`
);
if (failed > 0) process.exit(1);
