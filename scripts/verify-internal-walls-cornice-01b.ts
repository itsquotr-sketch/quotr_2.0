/**
 * IW-CORNICE-01B — register and wire approved ordinary cornice productivity.
 *
 * Run: npx --yes tsx scripts/verify-internal-walls-cornice-01b.ts
 *
 * Preview only. No Production.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { composeBuilderReview } from "../lib/assistant/builder-review/compose";
import type { EstimateLineItem } from "../components/assistant/types";
import type { OrganisationRate } from "../components/setup/types";
import { calculateEstimate } from "../lib/estimate/calculate-estimate";
import { calculateInternalWalls } from "../lib/estimate/calculators/fitout";
import {
  INTERNAL_WALLS_CORNICE_SIDES_KEY,
  INTERNAL_WALLS_SKIRTING_SIDES_KEY,
  corniceTakeoff,
  skirtingTakeoff,
  summariseFinishLine,
} from "../lib/estimate/internal-walls-finish";
import {
  INTERNAL_WALLS_CARPENTER_LABOUR_KEY,
  INTERNAL_WALLS_CORNICE_HOURS_DERIVATION,
  INTERNAL_WALLS_CORNICE_HOURS_PER_LM,
  INTERNAL_WALLS_CORNICE_INSTALL_HOURS_PER_LM_KEY,
  INTERNAL_WALLS_CORNICE_LABOUR_COMPONENT,
  INTERNAL_WALLS_CORNICE_MATERIAL_COMPONENT,
  INTERNAL_WALLS_CORNICE_MATERIAL_KEY,
} from "../lib/estimate/internal-walls-identities";
import { INTERNAL_WALLS_HAS_OPENINGS_KEY } from "../lib/estimate/internal-walls-openings";
import { resolveProductivity } from "../lib/estimate/productivity";
import { INTERNAL_WALLS_JOB_SCOPE_FACT_KEY } from "../lib/estimate/internal-walls-scope";
import {
  INTERNAL_WALLS_ADD_WALL_TYPE_KEY,
  applyInternalWallsFactWrite,
  resolveInternalWallsWallTypes,
} from "../lib/estimate/internal-walls-wall-types";
import { clientSafeQuoteLineDescription } from "../lib/quotes/client-line-description";
import { mapPricingItemsToQuoteItems } from "../lib/quotes/from-pricing";
import type { PricingItem } from "../lib/pricing/types";
import {
  buildProductivityRegistry,
  listRegisteredProductivityCatalogueEntries,
} from "../lib/rates/productivity-registry";
import type {
  EstimateContext,
  EstimateFact,
  EstimateLineItemInput,
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

function read(rel: string): string {
  return readFileSync(join(process.cwd(), rel), "utf8");
}

function fact(key: string, workAreaId: string, value: unknown): EstimateFact {
  return { key, work_area_id: workAreaId, value };
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
    rate_type: "material",
    trade: null,
    work_area_type: null,
    item_key: itemKey,
    label: itemKey,
    unit,
    cost_rate: cost,
    sell_rate: null,
    markup_percent: null,
    active: true,
    ...extras,
  };
}

function ctx(
  facts: EstimateFact[],
  rates: OrganisationRate[] = []
): EstimateContext {
  return {
    project: { id: "iw-cornice-01b", qualityLevel: "standard" },
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
  writes: Array<{
    key: string;
    value: unknown;
    wallTypeId?: string;
    openingId?: string;
  }>
): EstimateFact[] {
  let facts: EstimateFact[] = [];
  for (const row of writes) {
    facts = applyInternalWallsFactWrite({
      facts,
      workAreaId: "w1",
      key: row.key,
      value: row.value,
      wallTypeId: row.wallTypeId,
      openingId: row.openingId,
    });
  }
  return facts;
}

function fixture4m(params: {
  cornice?: string;
  skirting?: string;
  opening?: boolean;
  secondPortion?: boolean;
}): EstimateFact[] {
  let facts = writeWall([
    { key: INTERNAL_WALLS_ADD_WALL_TYPE_KEY, value: true },
    { key: "internal_walls.wall_type.label", value: "Wall Type 1" },
    { key: "internal_walls.wall_type.frame_system", value: "Timber framing" },
    {
      key: "internal_walls.wall_type.frame_size",
      value: "90 mm timber framing — 90×45",
    },
    { key: "internal_walls.wall_type.length_lm", value: 4 },
    { key: "internal_walls.wall_type.height_m", value: 2.7 },
    { key: "internal_walls.wall_type.stud_centres_mm", value: "600 mm" },
    { key: "internal_walls.wall_type.side_a_product", value: "Standard GIB" },
    { key: "internal_walls.wall_type.same_lining_both_sides", value: true },
    {
      key: INTERNAL_WALLS_HAS_OPENINGS_KEY,
      value: params.opening ? "Yes" : "No",
    },
  ]);
  const type1 = resolveInternalWallsWallTypes({
    facts,
    workAreaId: "w1",
  }).types[0]!;
  if (params.opening) {
    const openingId = type1.openings[0]!.id;
    facts = applyInternalWallsFactWrite({
      facts,
      workAreaId: "w1",
      key: "internal_walls.opening.type",
      value: "Door opening",
      wallTypeId: type1.id,
      openingId,
    });
    facts = applyInternalWallsFactWrite({
      facts,
      workAreaId: "w1",
      key: "internal_walls.opening.width_m",
      value: 0.81,
      wallTypeId: type1.id,
      openingId,
    });
    facts = applyInternalWallsFactWrite({
      facts,
      workAreaId: "w1",
      key: "internal_walls.opening.height_m",
      value: 1.98,
      wallTypeId: type1.id,
      openingId,
    });
  }
  if (params.skirting != null) {
    facts = applyInternalWallsFactWrite({
      facts,
      workAreaId: "w1",
      key: INTERNAL_WALLS_SKIRTING_SIDES_KEY,
      value: params.skirting,
      wallTypeId: type1.id,
    });
  }
  if (params.cornice != null) {
    facts = applyInternalWallsFactWrite({
      facts,
      workAreaId: "w1",
      key: INTERNAL_WALLS_CORNICE_SIDES_KEY,
      value: params.cornice,
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
      key: "internal_walls.wall_type.frame_size",
      value: "90 mm timber framing — 90×45",
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
      key: "internal_walls.wall_type.stud_centres_mm",
      value: "600 mm",
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
      key: "internal_walls.wall_type.same_lining_both_sides",
      value: true,
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
  }
  return [
    fact(INTERNAL_WALLS_JOB_SCOPE_FACT_KEY, "w1", "new_partition"),
    ...facts.filter((row) => row.key !== INTERNAL_WALLS_JOB_SCOPE_FACT_KEY),
  ];
}

function included(items: readonly EstimateLineItemInput[]) {
  return items.filter((row) => row.includedInTotal !== false);
}

function mats(req: readonly { kind: string }[]): MaterialRequirement[] {
  return req.filter(
    (row): row is MaterialRequirement => row.kind === "material"
  );
}

function labs(req: readonly { kind: string }[]): LabourRequirement[] {
  return req.filter((row): row is LabourRequirement => row.kind === "labour");
}

function mapCalcLines(items: readonly EstimateLineItemInput[]): EstimateLineItem[] {
  return items.map((item, index) => ({
    id: `line-${index}`,
    workAreaId: item.workAreaId,
    workAreaName: item.workAreaName,
    label: item.label,
    category: item.category,
    quantity: item.quantity,
    unit: item.unit,
    recommendedCost: item.recommendedCost ?? 0,
    recommendedSell: item.recommendedSell ?? 0,
    rateSource: item.rateSource,
    rateSourceType: item.rateSourceType,
    itemKey: item.itemKey,
    componentKey: item.componentKey,
    notes: item.notes,
    identitySummary: item.identitySummary,
    labourHours: item.labourHours,
    costRate: item.costRate,
    productivityRate: item.productivityRate,
    productivityUnit: item.productivityUnit,
    productivitySourceType: item.productivitySourceType,
    includedInTotal: item.includedInTotal,
    overlapGroup: item.overlapGroup,
    sourceLine: item,
  }));
}

function corniceMats(req: readonly { kind: string }[]) {
  return mats(req).filter(
    (row) => row.componentKey === INTERNAL_WALLS_CORNICE_MATERIAL_COMPONENT
  );
}

function corniceLabs(req: readonly { kind: string }[]) {
  return labs(req).filter(
    (row) => row.componentKey === INTERNAL_WALLS_CORNICE_LABOUR_COMPONENT
  );
}

console.log("=== IW-CORNICE-01B ===\n");

const identities = read("lib/estimate/internal-walls-identities.ts");
const productivitySrc = read("lib/estimate/productivity.ts");
const catalogueSrc = read("lib/rates/specific-material-catalogue.ts");
const finishSrc = read("lib/estimate/internal-walls-finish-physical.ts");
const takeoffSrc = read("lib/estimate/internal-walls-finish.ts");

check(
  "canonical key registered once",
  (identities.match(/internal_walls\.cornice\.install\.hours_per_lm/g) ?? [])
    .length >= 1 &&
    INTERNAL_WALLS_CORNICE_INSTALL_HOURS_PER_LM_KEY ===
      "internal_walls.cornice.install.hours_per_lm" &&
    INTERNAL_WALLS_CORNICE_HOURS_PER_LM === 0.2
);
check(
  "productivity catalogue uses the same key",
  productivitySrc.includes("INTERNAL_WALLS_CORNICE_INSTALL_HOURS_PER_LM_KEY") &&
    catalogueSrc.includes("INTERNAL_WALLS_CORNICE_INSTALL_HOURS_PER_LM_KEY")
);
check(
  "no competing cornice productivity alias",
  !/internal_walls\.cornice\.[a-z_]+\.hours_per_lm/.test(
    identities.replace(
      "internal_walls.cornice.install.hours_per_lm",
      ""
    )
  )
);
check(
  "derivation has no Quotr V1",
  !/Quotr V1/i.test(INTERNAL_WALLS_CORNICE_HOURS_DERIVATION)
);
check(
  "cornice calculator does not hardcode $60",
  !/\$60|costRate:\s*60|hourlyCost:\s*60/.test(
    finishSrc.slice(
      finishSrc.indexOf("const cornice = corniceTakeoff"),
      finishSrc.indexOf("const electrical = type.electrical")
    )
  )
);
check(
  "cornice labour is wired through resolveProductivity",
  finishSrc.includes("hoursKey: INTERNAL_WALLS_CORNICE_INSTALL_HOURS_PER_LM_KEY") &&
    /priceWithQuotr:\s*true/.test(finishSrc)
);
check(
  "corniceTakeoff side-count authority is unchanged",
  takeoffSrc.includes("export function corniceTakeoff") &&
    /sides\.includes\("side_a"\)/.test(takeoffSrc) &&
    /sides\.includes\("side_b"\)/.test(takeoffSrc)
);

const quotrHours = resolveProductivity({
  productivityKey: INTERNAL_WALLS_CORNICE_INSTALL_HOURS_PER_LM_KEY,
  unit: "lm",
  fallbackHoursPerUnit: 0,
  rates: [],
});
const companyHours = resolveProductivity({
  productivityKey: INTERNAL_WALLS_CORNICE_INSTALL_HOURS_PER_LM_KEY,
  unit: "lm",
  fallbackHoursPerUnit: 0,
  rates: [
    orgRate(INTERNAL_WALLS_CORNICE_INSTALL_HOURS_PER_LM_KEY, "lm", 0.25, {
      rate_type: "productivity",
    }),
  ],
});
check(
  "resolver precedence company then 0.20",
  companyHours.hoursPerUnit === 0.25 &&
    companyHours.sourceType === "user_rate" &&
    quotrHours.hoursPerUnit === 0.2 &&
    quotrHours.sourceType === "benchmark"
);
check(
  "unregistered fallback stays zero, not authority",
  resolveProductivity({
    productivityKey: "internal_walls.cornice.missing.hours_per_lm",
    unit: "lm",
    fallbackHoursPerUnit: 0,
    rates: [],
  }).hoursPerUnit === 0
);

console.log("\n--- A. Accepted ordinary fixture ---\n");
const bothFacts = fixture4m({ cornice: "Both sides", skirting: "Both sides" });
const bothType = resolveInternalWallsWallTypes({
  facts: bothFacts,
  workAreaId: "w1",
}).types[0]!;
check("has_openings = false", bothType.has_openings === false);
const bothPhysical = corniceTakeoff({
  type: bothType,
  jobScope: "new_partition",
});
check(
  "physical both-side cornice 8 lm",
  bothPhysical != null && near(bothPhysical.totalLm, 8)
);
const bothCalc = calculateInternalWalls(ctx(bothFacts), wa());
const bothMatReq = corniceMats(bothCalc.requirements ?? []);
const bothLabReq = corniceLabs(bothCalc.requirements ?? []);
check(
  "material quantity 8 lm Pricing Required",
  bothMatReq.length === 1 &&
    near(bothMatReq[0]!.baseQuantity, 8) &&
    bothMatReq[0]!.priced === false &&
    bothMatReq[0]!.totalCost == null &&
    bothMatReq[0]!.materialKey === INTERNAL_WALLS_CORNICE_MATERIAL_KEY
);
check(
  "labour 8 lm × 0.20 = 1.60 hours",
  bothLabReq.length === 1 &&
    bothLabReq[0]!.priced === true &&
    near(bothLabReq[0]!.productivityBasis.quantity, 8) &&
    near(bothLabReq[0]!.productivityBasis.hoursPerUnit, 0.2) &&
    near(bothLabReq[0]!.baseHours, 1.6) &&
    bothLabReq[0]!.productivityBasis.key ===
      INTERNAL_WALLS_CORNICE_INSTALL_HOURS_PER_LM_KEY
);
check(
  "Quotr carpenter COST $60 → $96",
  bothLabReq[0] != null &&
    near(bothLabReq[0]!.hourlyCost, 60) &&
    near(bothLabReq[0]!.totalCost, 96) &&
    bothLabReq[0]!.rateKey === INTERNAL_WALLS_CARPENTER_LABOUR_KEY
);
const bothEst = calculateEstimate(ctx(bothFacts));
const bothMatLines = included(bothEst.lineItems).filter(
  (row) => row.componentKey === INTERNAL_WALLS_CORNICE_MATERIAL_COMPONENT
);
const bothLabLines = included(bothEst.lineItems).filter(
  (row) => row.componentKey === INTERNAL_WALLS_CORNICE_LABOUR_COMPONENT
);
check(
  "hosted material qty 8 remains visible",
  bothMatLines.length === 1 && near(bothMatLines[0]!.quantity, 8)
);
check(
  "hosted labour hours 1.60 COST $96",
  bothLabLines.length === 1 &&
    near(bothLabLines[0]!.labourHours ?? bothLabLines[0]!.quantity, 1.6) &&
    near(bothLabLines[0]!.recommendedCost, 96) &&
    bothLabLines[0]!.rateSourceType !== "missing"
);
check(
  "no cornice labour Pricing Required",
  bothLabReq[0]!.priced === true && bothLabLines[0]!.rateSourceType !== "missing"
);

console.log("\n--- B. Side-count fixtures ---\n");
for (const row of [
  { label: "none", value: "No", lm: 0 },
  { label: "Side A", value: "Side A", lm: 4 },
  { label: "Side B", value: "Side B", lm: 4 },
  { label: "both", value: "Both sides", lm: 8 },
] as const) {
  const facts = fixture4m({ cornice: row.value });
  const type = resolveInternalWallsWallTypes({
    facts,
    workAreaId: "w1",
  }).types[0]!;
  const physical = corniceTakeoff({ type, jobScope: "new_partition" });
  const calc = calculateInternalWalls(ctx(facts), wa());
  const matQty = corniceMats(calc.requirements ?? []).reduce(
    (sum, item) => sum + item.baseQuantity,
    0
  );
  const labQty = corniceLabs(calc.requirements ?? []).reduce(
    (sum, item) => sum + item.productivityBasis.quantity,
    0
  );
  const hours = corniceLabs(calc.requirements ?? []).reduce(
    (sum, item) => sum + item.baseHours,
    0
  );
  check(
    `${row.label} physical ${row.lm} lm`,
    row.lm === 0
      ? physical == null || near(physical.totalLm, 0)
      : physical != null && near(physical.totalLm, row.lm)
  );
  check(
    `${row.label} commercial ${row.lm} lm`,
    near(matQty, row.lm) && near(labQty, row.lm)
  );
  if (row.lm > 0) {
    check(
      `${row.label} hours ${row.lm} × 0.20`,
      near(hours, row.lm * 0.2)
    );
  } else {
    check(`${row.label} no labour line`, hours === 0);
  }
}

console.log("\n--- C. Ordinary door opening ---\n");
const openFacts = fixture4m({
  cornice: "Both sides",
  skirting: "Both sides",
  opening: true,
});
const openType = resolveInternalWallsWallTypes({
  facts: openFacts,
  workAreaId: "w1",
}).types[0]!;
const openCornice = corniceTakeoff({
  type: openType,
  jobScope: "new_partition",
});
const openSkirt = skirtingTakeoff({
  type: openType,
  jobScope: "new_partition",
});
const openCalc = calculateInternalWalls(ctx(openFacts), wa());
check(
  "ordinary door does not reduce cornice 8 lm",
  openCornice != null && near(openCornice.totalLm, 8)
);
check(
  "skirting still deducts the door",
  openSkirt != null && near(openSkirt.totalLm, 6.38)
);
check(
  "opening cornice labour still 1.60 hours",
  corniceLabs(openCalc.requirements ?? []).some(
    (row) =>
      row.priced &&
      near(row.productivityBasis.quantity, 8) &&
      near(row.baseHours, 1.6)
  )
);

console.log("\n--- D. Multi-portion aggregate ---\n");
const multiFacts = fixture4m({
  cornice: "Both sides",
  secondPortion: true,
});
const multiTypes = resolveInternalWallsWallTypes({
  facts: multiFacts,
  workAreaId: "w1",
}).types;
const multiCalc = calculateInternalWalls(ctx(multiFacts), wa());
const multiMat = corniceMats(multiCalc.requirements ?? []);
const multiLab = corniceLabs(multiCalc.requirements ?? []);
const multiLm = multiMat.reduce((sum, row) => sum + row.baseQuantity, 0);
const multiHours = multiLab.reduce((sum, row) => sum + row.baseHours, 0);
check("two portions resolved", multiTypes.length === 2);
check(
  "cornice material aggregates 8 + 6 = 14 lm",
  multiMat.length === 2 && near(multiLm, 14)
);
check(
  "cornice labour aggregates 2.80 hours",
  multiLab.length === 2 &&
    multiLab.every((row) => row.priced) &&
    near(multiHours, 2.8)
);
check(
  "no commercial ownership dedupe of cornice",
  multiMat.length === 2 && multiLab.length === 2
);

console.log("\n--- E. Company overrides ---\n");
const prodOverride = [
  orgRate(INTERNAL_WALLS_CORNICE_INSTALL_HOURS_PER_LM_KEY, "lm", 0.25, {
    rate_type: "productivity",
  }),
];
const prodCalc = calculateInternalWalls(ctx(bothFacts, prodOverride), wa());
const prodLab = corniceLabs(prodCalc.requirements ?? [])[0];
const prodMat = corniceMats(prodCalc.requirements ?? [])[0];
check(
  "company 0.25 h/lm → 8 lm / 2.00 hours",
  prodLab != null &&
    near(prodLab.productivityBasis.quantity, 8) &&
    near(prodLab.productivityBasis.hoursPerUnit, 0.25) &&
    near(prodLab.baseHours, 2) &&
    prodLab.productivityBasis.key ===
      INTERNAL_WALLS_CORNICE_INSTALL_HOURS_PER_LM_KEY
);
check(
  "productivity override leaves material qty 8",
  prodMat != null && near(prodMat.baseQuantity, 8)
);
const restored = calculateInternalWalls(ctx(bothFacts), wa());
const restoredLab = corniceLabs(restored.requirements ?? [])[0];
check(
  "removing company productivity restores 0.20 / 1.60",
  restoredLab != null &&
    near(restoredLab.productivityBasis.hoursPerUnit, 0.2) &&
    near(restoredLab.baseHours, 1.6)
);

const labourOverride = [
  orgRate(INTERNAL_WALLS_CARPENTER_LABOUR_KEY, "hour", 75, {
    rate_type: "labour",
  }),
];
const labourCalc = calculateInternalWalls(ctx(bothFacts, labourOverride), wa());
const labourLab = corniceLabs(labourCalc.requirements ?? [])[0];
const labourMat = corniceMats(labourCalc.requirements ?? [])[0];
check(
  "company $75/hour → 1.60 hours / $120 COST",
  labourLab != null &&
    labourLab.priced &&
    near(labourLab.baseHours, 1.6) &&
    near(labourLab.hourlyCost, 75) &&
    near(labourLab.totalCost, 120)
);
check(
  "hourly override leaves productivity 0.20 and material 8 lm",
  labourLab != null &&
    near(labourLab.productivityBasis.hoursPerUnit, 0.2) &&
    labourMat != null &&
    near(labourMat.baseQuantity, 8)
);

const materialOverride = [orgRate(INTERNAL_WALLS_CORNICE_MATERIAL_KEY, "lm", 18)];
const materialCalc = calculateInternalWalls(
  ctx(bothFacts, materialOverride),
  wa()
);
const materialMat = corniceMats(materialCalc.requirements ?? [])[0];
const materialLab = corniceLabs(materialCalc.requirements ?? [])[0];
check(
  "company material override prices 8 lm independently",
  materialMat != null &&
    materialMat.priced &&
    near(materialMat.baseQuantity, 8) &&
    near(materialMat.unitCost, 18) &&
    near(materialMat.totalCost, 144)
);
check(
  "material override leaves labour 1.60 / $96",
  materialLab != null &&
    materialLab.priced &&
    near(materialLab.baseHours, 1.6) &&
    near(materialLab.totalCost, 96)
);

console.log("\n--- F. Missing material sibling ---\n");
check(
  "missing material stays null COST, not $0 authority",
  bothMatReq[0]!.priced === false &&
    bothMatReq[0]!.totalCost == null &&
    bothMatReq[0]!.unitCost == null &&
    bothMatLines[0]!.rateSourceType === "missing"
);
check(
  "missing material does not zero priced labour",
  bothLabReq[0]!.priced &&
    near(bothLabReq[0]!.totalCost, 96) &&
    bothLabLines[0]!.rateSourceType !== "missing"
);

console.log("\n--- Rates UI ---\n");
const registry = buildProductivityRegistry({ rates: [], editable: true });
const iwGroup = registry.groups.find(
  (row) => row.workAreaType === "internal_walls"
);
const corniceUi = iwGroup?.items.filter(
  (item) => item.productivityKey === INTERNAL_WALLS_CORNICE_INSTALL_HOURS_PER_LM_KEY
);
check(
  "Rates UI shows Internal wall cornice installation once",
  corniceUi?.length === 1 &&
    corniceUi[0]!.label === "Internal wall cornice installation" &&
    corniceUi[0]!.workAreaLabel.toLowerCase().includes("internal wall")
);
check(
  "Rates UI benchmark 0.20 person-hours/lm",
  corniceUi?.[0]?.benchmarkHours === 0.2 &&
    corniceUi?.[0]?.unit === "lm" &&
    corniceUi?.[0]?.effectiveSource === "benchmark"
);
check(
  "canonical registry is the presentation source",
  listRegisteredProductivityCatalogueEntries().some(
    (entry) =>
      entry.item_key === INTERNAL_WALLS_CORNICE_INSTALL_HOURS_PER_LM_KEY
  )
);
const seeded = buildProductivityRegistry({
  rates: [
    {
      id: "r-cornice",
      item_key: INTERNAL_WALLS_CORNICE_INSTALL_HOURS_PER_LM_KEY,
      rate_type: "productivity",
      label: "Internal wall cornice installation",
      unit: "lm",
      cost_rate: 0.25,
      sell_rate: null,
      markup_percent: null,
      active: true,
      trade: null,
      work_area_type: "internal_walls",
      source: "explicit_company",
      source_calibration_id: null,
      updated_at: null,
    },
  ],
  editable: true,
});
const seededCornice = seeded.items.find(
  (item) => item.productivityKey === INTERNAL_WALLS_CORNICE_INSTALL_HOURS_PER_LM_KEY
);
check(
  "Rates UI company override is the effective source",
  seededCornice?.effectiveSource === "company" &&
    seededCornice.effectiveValue === 0.25 &&
    seededCornice.editable === true
);
check(
  "Rates UI copy has no Quotr V1",
  !/Quotr V1/i.test(corniceUi?.[0]?.description ?? "")
);

console.log("\n--- Builder Review ---\n");
const review = composeBuilderReview({
  estimate: {
    recommendedCost: bothEst.lineItems.reduce(
      (sum, item) => sum + (item.recommendedCost ?? 0),
      0
    ),
    recommendedSell: bothEst.lineItems.reduce(
      (sum, item) => sum + (item.recommendedSell ?? 0),
      0
    ),
    marginPercent: 20,
    confidence: bothEst.confidence,
    assumptions: bothEst.assumptions,
    missingInfo: bothEst.missingInfo,
    lineItems: mapCalcLines(bothEst.lineItems),
  },
  workAreas: [
    {
      id: "w1",
      type: "internal_walls",
      name: "Internal walls",
      status: "confirmed",
    },
  ],
  requirements: bothEst.requirements ?? [],
});
const reviewText = JSON.stringify(review);
const reviewCornice = JSON.stringify(
  review.workAreas.flatMap((area) =>
    area.categories.flatMap((category) =>
      category.lineGroups.filter((group) => /cornice/i.test(group.label))
    )
  )
);
check(
  "Builder Review keeps separate cornice material and labour",
  /cornice/i.test(reviewText) &&
    /cornice labour/i.test(reviewText)
);
check(
  "Builder Review material physical basis 8 lm",
  /Both sides · 8 ?lm/i.test(reviewText)
);
const reviewLabour = (
  JSON.parse(reviewCornice) as Array<{
    children?: Array<{
      label?: string;
      labourHours?: number | null;
      supporting?: string | null;
    }>;
  }>
)
  .flatMap((group) => group.children ?? [])
  .find((row) => /cornice labour/i.test(row.label ?? ""));
check(
  "Builder Review labour 0.20 person-hours/lm and 1.60 hours",
  /0\.20 person-hours\/lm/i.test(reviewLabour?.supporting ?? reviewText) &&
    near(reviewLabour?.labourHours, 1.6)
);
check(
  "Builder Review labour is not Pricing Required",
  !/cornice labour[^\n]{0,80}Pricing Required/i.test(reviewText)
);
check(
  "Builder Review material is Pricing Required, not a legitimate $0",
  /Pricing Required|Rate required/i.test(reviewCornice) &&
    !/Quotr V1/i.test(reviewText)
);

console.log("\n--- Quote safety ---\n");
const quoteItems = mapPricingItemsToQuoteItems(
  [
    {
      id: "p-cornice-material",
      work_area_id: "w1",
      internal_label: bothMatLines[0]!.label,
      client_label: "Internal wall cornice",
      client_description:
        "Cornice is included and installed to both sides where selected.",
      item_type: "material",
      quantity: 8,
      unit: "lm",
      visible_on_quote: true,
      sort_order: 1,
    } as PricingItem,
    {
      id: "p-cornice-labour",
      work_area_id: "w1",
      internal_label: bothLabLines[0]!.label,
      client_label: "Internal wall cornice installation",
      client_description: "Cornice is included.",
      item_type: "labour",
      quantity: 1.6,
      unit: "hour",
      visible_on_quote: true,
      sort_order: 2,
    } as PricingItem,
  ],
  new Map([["w1", "Internal walls"]])
);
const quoteBlob = JSON.stringify(quoteItems);
check(
  "Quote may say cornice is included on both sides",
  /cornice is included/i.test(quoteBlob) &&
    /both sides/i.test(quoteBlob)
);
check(
  "Quote hides productivity key, benchmark, hours and COST",
  !/internal_walls\.cornice\.install\.hours_per_lm/.test(quoteBlob) &&
    !/0\.20/.test(quoteBlob) &&
    !/person-hours/i.test(quoteBlob) &&
    !/labour\.carpenter\.hour/.test(quoteBlob) &&
    !/Pricing Required/i.test(quoteBlob)
);
check(
  "estimator identitySummary is not client copy",
  clientSafeQuoteLineDescription(bothLabLines[0]!.identitySummary ?? "") ==
    null
);
check(
  "finish summary still states both sides",
  /Cornice to both sides/i.test(summariseFinishLine(bothType) ?? "")
);

console.log(
  `\nIW-CORNICE-01B result: ${passed} passed, ${failed} failed\n`
);
if (failed > 0) process.exit(1);
