/**
 * WA-BATHROOM-03 — physical substrate, lining, local framing requirements.
 *
 * Run: npx --yes tsx scripts/verify-work-area-bathroom-03.ts
 *
 * No paid AI. No Production. No migration 055.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { composeBuilderReview } from "../lib/assistant/builder-review/compose";
import { BATHROOM_WALL_HEIGHT_ASSUMPTION_STATEMENT } from "../lib/estimate/bathroom-geometry";
import {
  BATHROOM_AQUALINE_SHEET_KEY,
  BATHROOM_CEILING_LINING_COMPONENT,
  BATHROOM_CEILING_LINING_LABOUR_COMPONENT,
  BATHROOM_FLOOR_SUBSTRATE_COMPONENT,
  BATHROOM_FLOOR_SUBSTRATE_FIBRE_CEMENT_KEY,
  BATHROOM_FLOOR_SUBSTRATE_LABOUR_COMPONENT,
  BATHROOM_FLOOR_SUBSTRATE_PLYWOOD_KEY,
  BATHROOM_FRAMING_COMPONENT,
  BATHROOM_FRAMING_INTENSITY_LM_PER_M2,
  BATHROOM_FRAMING_LABOUR_COMPONENT,
  BATHROOM_FRAMING_TIMBER_KEY,
  BATHROOM_PRODUCTIVITY_BENCHMARKS,
  BATHROOM_PRODUCTIVITY_KEYS,
  BATHROOM_SHEET_AREA_M2,
  BATHROOM_SHEET_WASTE_FACTOR,
  BATHROOM_WALL_LINING_COMPONENT,
  BATHROOM_WALL_LINING_LABOUR_COMPONENT,
} from "../lib/estimate/bathroom-identities";
import { bathroomFramingTakeoff } from "../lib/estimate/bathroom-framing";
import { bathroomSheetTakeoff } from "../lib/estimate/bathroom-linings";
import {
  bathroomQuestionGroupVisible,
  isMatureBathroomPath,
} from "../lib/estimate/bathroom-scope";
import { calculateBathroom } from "../lib/estimate/calculators/bathroom";
import { calculateDeck } from "../lib/estimate/calculators/deck";
import { defaultJoistIdentity } from "../lib/estimate/deck-default-identities";
import { buildMaterialRateItemKey } from "../lib/materials/identity";
import { getCatalogueEntry } from "../lib/rates/catalogue";
import type { EstimateLineItem } from "../components/assistant/types";
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

function near(actual: number | null | undefined, expected: number, tol = 1e-9): boolean {
  return actual != null && Number.isFinite(actual) && Math.abs(actual - expected) <= tol;
}

function read(rel: string): string {
  return readFileSync(join(process.cwd(), rel), "utf8");
}

function numberedMigrations(): string[] {
  return readdirSync(join(process.cwd(), "supabase/migrations"))
    .filter((name) => /^\d+_/.test(name) && name.endsWith(".sql"))
    .sort();
}

function fact(key: string, workAreaId: string, value: unknown): EstimateFact {
  return { key, work_area_id: workAreaId, value };
}

function wa(
  id: string,
  type: string,
  name: string
): EstimateWorkArea & { status: "confirmed" } {
  return { id, type, name, sort_order: 1, status: "confirmed" };
}

function ctx(
  workAreas: EstimateWorkArea[],
  facts: EstimateFact[]
): EstimateContext {
  return {
    project: { id: "p1", qualityLevel: "standard" },
    confirmedWorkAreas: workAreas,
    facts,
    constraints: [],
    organisationSettings: {
      allow_benchmark_rates: true,
      default_margin_percent: 20,
    },
    materialWastageSettings: {
      sheet_material: 10,
      flooring: 10,
      paint: 10,
      default: 5,
    },
    rates: [],
  } as unknown as EstimateContext;
}

function mapCalcLines(items: readonly EstimateLineItemInput[]): EstimateLineItem[] {
  return items.map((item, index) => ({
    id: `line-${index}`,
    workAreaName: item.workAreaName,
    label: item.label,
    category: item.category as EstimateLineItem["category"],
    costLow: item.costLow,
    costHigh: item.costHigh,
    sellLow: item.sellLow,
    sellHigh: item.sellHigh,
    recommendedCost: item.recommendedCost,
    recommendedSell: item.recommendedSell,
    grossProfit: item.grossProfit,
    marginPercent: item.marginPercent,
    markupPercent: item.markupPercent,
    rateSource: item.rateSource,
    quantity: item.quantity,
    unit: item.unit,
    labourHours: item.labourHours,
    costRate: item.costRate,
    sellRate: item.sellRate,
    itemKey: item.itemKey,
    componentKey: item.componentKey,
    notes: item.notes,
    identitySummary: item.identitySummary,
    includedInTotal: item.includedInTotal,
    rateSourceType: item.rateSourceType,
  }));
}

function bathroom(
  facts: EstimateFact[],
  id = "b1"
): ReturnType<typeof calculateBathroom> {
  return calculateBathroom(ctx([wa(id, "bathroom", "Bathroom")], facts), wa(id, "bathroom", "Bathroom"));
}

function materials(result: ReturnType<typeof calculateBathroom>): MaterialRequirement[] {
  return (result.requirements ?? []).filter(
    (row): row is MaterialRequirement => row.kind === "material"
  );
}

function labour(result: ReturnType<typeof calculateBathroom>): LabourRequirement[] {
  return (result.requirements ?? []).filter(
    (row): row is LabourRequirement => row.kind === "labour"
  );
}

const fixtureAFacts: EstimateFact[] = [
  fact("bathroom.job_scope", "b1", "full_renovation"),
  fact("bathroom.length_m", "b1", 3),
  fact("bathroom.width_m", "b1", 2.4),
  fact("bathroom.wall_height_m", "b1", 2.4),
  fact("bathroom.floor_substrate_system", "b1", "treated_plywood"),
  fact("bathroom.wall_lining_included", "b1", true),
  fact("bathroom.ceiling_lining_included", "b1", true),
  fact("bathroom.framing_level", "b1", "standard"),
];

console.log("=== WA-BATHROOM-03 ===\n");

console.log("--- Sheet math ---\n");
const floorTakeoff = bathroomSheetTakeoff(7.2);
check("floor purchase 7.92", near(floorTakeoff.purchaseAreaM2, 7.92));
check("floor sheets 3", floorTakeoff.sheetCount === 3);
check("waste once 10%", near(floorTakeoff.wasteFactor, BATHROOM_SHEET_WASTE_FACTOR));
check("sheet area 2.88", near(floorTakeoff.sheetAreaM2, BATHROOM_SHEET_AREA_M2));
const wallTakeoff = bathroomSheetTakeoff(25.92);
check("wall purchase 28.512", near(wallTakeoff.purchaseAreaM2, 28.512));
check("wall sheets 10", wallTakeoff.sheetCount === 10);
const ceilingTakeoff = bathroomSheetTakeoff(7.2);
check("ceiling sheets 3", ceilingTakeoff.sheetCount === 3);

console.log("\n--- Fixture A ---\n");
const a = bathroom(fixtureAFacts);
const floorMat = materials(a).find((row) => row.componentKey === BATHROOM_FLOOR_SUBSTRATE_COMPONENT);
const wallMat = materials(a).find((row) => row.componentKey === BATHROOM_WALL_LINING_COMPONENT);
const ceilingMat = materials(a).find((row) => row.componentKey === BATHROOM_CEILING_LINING_COMPONENT);
const framingMat = materials(a).find((row) => row.componentKey === BATHROOM_FRAMING_COMPONENT);
const floorLab = labour(a).find((row) => row.componentKey === BATHROOM_FLOOR_SUBSTRATE_LABOUR_COMPONENT);
const wallLab = labour(a).find((row) => row.componentKey === BATHROOM_WALL_LINING_LABOUR_COMPONENT);
const ceilingLab = labour(a).find((row) => row.componentKey === BATHROOM_CEILING_LINING_LABOUR_COMPONENT);
const framingLab = labour(a).find((row) => row.componentKey === BATHROOM_FRAMING_LABOUR_COMPONENT);

check("mature path", isMatureBathroomPath("full_renovation"));
check("floor plywood identity", floorMat?.materialKey === BATHROOM_FLOOR_SUBSTRATE_PLYWOOD_KEY);
check("floor purchase qty 3 sheets", floorMat?.purchaseQuantity === 3 && floorMat.purchaseUnit === "each");
check("floor base 7.2 m²", near(floorMat?.baseQuantity, 7.2));
check("wall aqualine identity", wallMat?.materialKey === BATHROOM_AQUALINE_SHEET_KEY);
check("wall purchase 10 sheets", wallMat?.purchaseQuantity === 10);
check("wall base 25.92 m²", near(wallMat?.baseQuantity, 25.92));
check("ceiling aqualine identity", ceilingMat?.materialKey === BATHROOM_AQUALINE_SHEET_KEY);
check("ceiling purchase 3 sheets", ceilingMat?.purchaseQuantity === 3);
check("ceiling base 7.2 m²", near(ceilingMat?.baseQuantity, 7.2));
check("framing 12.96 lm", near(framingMat?.baseQuantity, 12.96) && near(framingMat?.purchaseQuantity, 12.96));
check("framing H1.2 identity", framingMat?.materialKey === BATHROOM_FRAMING_TIMBER_KEY);
check("framing waste 0", framingMat?.wasteFactor === 0);
check("floor labour 2.88 h", near(floorLab?.baseHours, 2.88));
check("wall labour 7.776 h", near(wallLab?.baseHours, 7.776));
check("ceiling labour 2.88 h", near(ceilingLab?.baseHours, 2.88));
check("framing labour 2.592 h", near(framingLab?.baseHours, 2.592));
check(
  "no generic carpentry on mature Fixture A",
  !a.lineItems.some((item) => /carpentry\/prep/i.test(item.label))
);
check(
  "no $18k package on mature Fixture A",
  !a.lineItems.some((item) => /materials\/finishes allowance/i.test(item.label))
);
check(
  "no generic bathroom labour_hours_per_m2 line",
  !a.lineItems.some((item) => item.itemKey === "bathroom.labour_hours_per_m2")
);
check(
  "requirement union is 8 selected physical rows",
  (a.requirements ?? []).length === 8
);
check(
  "no duplicate material keys",
  new Set(materials(a).map((row) => `${row.componentKey}:${row.materialKey}`)).size ===
    materials(a).length
);
check(
  "no duplicate labour components",
  new Set(labour(a).map((row) => row.componentKey)).size === labour(a).length
);

console.log("\n--- Fixture B fibre cement XOR ---\n");
const b = bathroom([
  ...fixtureAFacts.filter((row) => row.key !== "bathroom.floor_substrate_system"),
  fact("bathroom.floor_substrate_system", "b1", "fibre_cement"),
]);
const bFloor = materials(b).find((row) => row.componentKey === BATHROOM_FLOOR_SUBSTRATE_COMPONENT);
check("fibre cement identity", bFloor?.materialKey === BATHROOM_FLOOR_SUBSTRATE_FIBRE_CEMENT_KEY);
check("fibre cement 3 sheets", bFloor?.purchaseQuantity === 3);
check(
  "no plywood line when fibre cement selected",
  !b.lineItems.some((item) => item.itemKey === BATHROOM_FLOOR_SUBSTRATE_PLYWOOD_KEY) &&
    !materials(b).some((row) => row.materialKey === BATHROOM_FLOOR_SUBSTRATE_PLYWOOD_KEY)
);

console.log("\n--- Framing intensities ---\n");
for (const [level, expectedLm, expectedHours] of [
  ["minor", 5.184, 1.0368],
  ["standard", 12.96, 2.592],
  ["major", 25.92, 5.184],
] as const) {
  const takeoff = bathroomFramingTakeoff({
    level,
    grossWallAreaM2: 25.92,
    hoursPerLm: BATHROOM_PRODUCTIVITY_BENCHMARKS.framingLm,
  });
  check(`${level} intensity ${BATHROOM_FRAMING_INTENSITY_LM_PER_M2[level]}`, near(takeoff?.framingLm, expectedLm));
  check(`${level} labour ${expectedHours} h`, near(takeoff?.labourHours, expectedHours));
  const calc = bathroom([
    ...fixtureAFacts.filter((row) => row.key !== "bathroom.framing_level"),
    fact("bathroom.framing_level", "b1", level),
  ]);
  const framingRows = materials(calc).filter((row) => row.componentKey === BATHROOM_FRAMING_COMPONENT);
  check(`${level} exactly one framing material requirement`, framingRows.length === 1);
  check(`${level} calc lm`, near(framingRows[0]?.baseQuantity, expectedLm));
}

const noneFraming = bathroom([
  ...fixtureAFacts.filter((row) => row.key !== "bathroom.framing_level"),
  fact("bathroom.framing_level", "b1", "none"),
]);
check(
  "none framing emits no framing requirement",
  !materials(noneFraming).some((row) => row.componentKey === BATHROOM_FRAMING_COMPONENT) &&
    !labour(noneFraming).some((row) => row.componentKey === BATHROOM_FRAMING_LABOUR_COMPONENT)
);

console.log("\n--- Partial scope vanity-only ---\n");
const vanity = bathroom([fact("bathroom.job_scope", "b1", "vanity_only")]);
check(
  "vanity-only has no substrate/lining/framing",
  !materials(vanity).some((row) =>
    [
      BATHROOM_FLOOR_SUBSTRATE_COMPONENT,
      BATHROOM_WALL_LINING_COMPONENT,
      BATHROOM_CEILING_LINING_COMPONENT,
      BATHROOM_FRAMING_COMPONENT,
    ].includes(row.componentKey as typeof BATHROOM_FLOOR_SUBSTRATE_COMPONENT)
  ) &&
    !vanity.lineItems.some((item) =>
      /floor substrate|wall lining|ceiling lining|local framing/i.test(item.label)
    )
);
check(
  "vanity-only does not ask lining/framing groups",
  !bathroomQuestionGroupVisible("linings", "vanity_only") &&
    !bathroomQuestionGroupVisible("ceiling_lining", "vanity_only") &&
    !bathroomQuestionGroupVisible("floor_substrate", "vanity_only") &&
    !bathroomQuestionGroupVisible("framing", "vanity_only")
);
check(
  "vanity-only does not invent geometry missing-info",
  !vanity.missingInfo.some((line) => /length and width/i.test(line))
);

console.log("\n--- Assumed height ---\n");
const assumed = bathroom([
  fact("bathroom.job_scope", "b1", "full_renovation"),
  fact("bathroom.length_m", "b1", 3),
  fact("bathroom.width_m", "b1", 2.4),
  fact("bathroom.floor_substrate_system", "b1", "treated_plywood"),
  fact("bathroom.wall_lining_included", "b1", true),
  fact("bathroom.ceiling_lining_included", "b1", true),
  fact("bathroom.framing_level", "b1", "standard"),
]);
const assumedWall = materials(assumed).find(
  (row) => row.componentKey === BATHROOM_WALL_LINING_COMPONENT
);
check("assumed height still yields 25.92 wall m²", near(assumedWall?.baseQuantity, 25.92));
check(
  "wall height assumption disclosed once",
  assumed.assumptions.filter((line) => line === BATHROOM_WALL_HEIGHT_ASSUMPTION_STATEMENT)
    .length === 1
);
check(
  "physical calc does not require persisted gross_wall_area_m2",
  !assumed.missingInfo.some((line) => /gross wall/i.test(line)) &&
    assumedWall != null
);

console.log("\n--- Not sure / unknown framing ---\n");
const notSureFloor = bathroom([
  fact("bathroom.job_scope", "b1", "full_renovation"),
  fact("bathroom.length_m", "b1", 3),
  fact("bathroom.width_m", "b1", 2.4),
  fact("bathroom.wall_height_m", "b1", 2.4),
  fact("bathroom.floor_substrate_system", "b1", "Not sure"),
  fact("bathroom.wall_lining_included", "b1", "Not sure"),
  fact("bathroom.ceiling_lining_included", "b1", "Not sure"),
  fact("bathroom.framing_level", "b1", "Not sure"),
]);
check(
  "Not sure floor → disclosed plywood",
  materials(notSureFloor).some(
    (row) => row.materialKey === BATHROOM_FLOOR_SUBSTRATE_PLYWOOD_KEY
  ) &&
    notSureFloor.assumptions.some((line) => /19 mm H3\.2 treated plywood/i.test(line))
);
check(
  "Not sure linings → disclosed Aqualine",
  notSureFloor.assumptions.some((line) => /Aqualine wall lining/i.test(line)) &&
    notSureFloor.assumptions.some((line) => /Aqualine ceiling lining/i.test(line))
);
check(
  "unknown framing is INFO_REQUIRED, not silent Standard",
  notSureFloor.missingInfo.some((line) => /local framing or nogging/i.test(line)) &&
    !materials(notSureFloor).some((row) => row.componentKey === BATHROOM_FRAMING_COMPONENT)
);

console.log("\n--- Rate sources ---\n");
const plywoodCat = getCatalogueEntry(BATHROOM_FLOOR_SUBSTRATE_PLYWOOD_KEY);
const fibreCat = getCatalogueEntry(BATHROOM_FLOOR_SUBSTRATE_FIBRE_CEMENT_KEY);
const aqualineCat = getCatalogueEntry(BATHROOM_AQUALINE_SHEET_KEY);
const framingCat = getCatalogueEntry(BATHROOM_FRAMING_TIMBER_KEY);
const genericPlywood = getCatalogueEntry("sheet.plywood.each");
check("19 mm H3.2 plywood catalogue identity exists", plywoodCat?.item_key === BATHROOM_FLOOR_SUBSTRATE_PLYWOOD_KEY);
check("19 mm plywood has no invented defaultCostRate", plywoodCat?.defaultCostRate == null);
check("fibre cement has no invented defaultCostRate", fibreCat?.defaultCostRate == null);
check("H1.2 framing has no invented defaultCostRate", framingCat?.defaultCostRate == null);
check(
  "Aqualine reuses existing sheet identity with Quotr benchmark",
  aqualineCat?.item_key === BATHROOM_AQUALINE_SHEET_KEY &&
    aqualineCat.defaultCostRate != null &&
    aqualineCat.defaultCostRate > 0
);
check(
  "generic plywood identity is not reused",
  genericPlywood?.item_key === "sheet.plywood.each" &&
    BATHROOM_FLOOR_SUBSTRATE_PLYWOOD_KEY !== "sheet.plywood.each"
);
check(
  "Fixture A plywood line is Pricing Required",
  a.lineItems.some(
    (item) =>
      item.itemKey === BATHROOM_FLOOR_SUBSTRATE_PLYWOOD_KEY &&
      item.rateSourceType === "missing"
  )
);
check(
  "Fixture A Aqualine wall is benchmark-priced, not package",
  a.lineItems.some(
    (item) =>
      item.itemKey === BATHROOM_AQUALINE_SHEET_KEY &&
      item.componentKey === BATHROOM_WALL_LINING_COMPONENT &&
      item.rateSourceType !== "missing"
  )
);

console.log("\n--- Productivity keys ---\n");
check(
  "floor productivity key",
  BATHROOM_PRODUCTIVITY_KEYS.floorSubstrateM2 ===
    "bathroom.floor_substrate.install.hours_per_m2" &&
    near(BATHROOM_PRODUCTIVITY_BENCHMARKS.floorSubstrateM2, 0.4)
);
check(
  "wall productivity 0.30",
  near(BATHROOM_PRODUCTIVITY_BENCHMARKS.wallLiningM2, 0.3)
);
check(
  "ceiling productivity 0.40 and distinct from wall",
  near(BATHROOM_PRODUCTIVITY_BENCHMARKS.ceilingLiningM2, 0.4) &&
    BATHROOM_PRODUCTIVITY_KEYS.ceilingLiningM2 !==
      BATHROOM_PRODUCTIVITY_KEYS.wallLiningM2
);
check(
  "framing productivity 0.20 h/lm",
  near(BATHROOM_PRODUCTIVITY_BENCHMARKS.framingLm, 0.2)
);

console.log("\n--- Legacy path ---\n");
const legacy = bathroom([
  fact("bathroom.area_m2", "b1", 8),
  fact("bathroom.renovation_type", "b1", "Full strip-out and rebuild"),
]);
check("legacy without job_scope is not mature", !isMatureBathroomPath(null));
check(
  "legacy still emits carpentry/prep",
  legacy.lineItems.some((item) => /carpentry\/prep/i.test(item.label))
);
check(
  "legacy does not emit new physical envelope",
  (legacy.requirements ?? []).length === 0
);

console.log("\n--- Bathroom + Deck isolation ---\n");
const deckWa = wa("d1", "deck", "Deck");
const mixedFacts = [
  ...fixtureAFacts,
  fact("deck.area_m2", "d1", 12),
  fact("deck.board_material", "d1", "Hardwood"),
];
const mixedCtx = ctx(
  [wa("b1", "bathroom", "Bathroom"), deckWa],
  mixedFacts
);
const bathMixed = calculateBathroom(mixedCtx, wa("b1", "bathroom", "Bathroom"));
const deckOnly = calculateDeck(ctx([deckWa], mixedFacts.filter((row) => row.work_area_id === "d1")), deckWa);
const deckMixed = calculateDeck(mixedCtx, deckWa);
const deckJoistKey = defaultJoistIdentity()
  ? buildMaterialRateItemKey(defaultJoistIdentity()!, "lm")
  : "";
check(
  "Bathroom H1.2 key is not Deck H3.2 90×45",
  BATHROOM_FRAMING_TIMBER_KEY !== deckJoistKey &&
    !BATHROOM_FRAMING_TIMBER_KEY.includes("h3.2")
);
check(
  "Deck line-item snapshot unchanged beside Bathroom",
  JSON.stringify(deckOnly.lineItems.map((item) => [item.label, item.quantity, item.itemKey])) ===
    JSON.stringify(deckMixed.lineItems.map((item) => [item.label, item.quantity, item.itemKey]))
);
check(
  "Bathroom Aqualine did not become a Deck material",
  bathMixed.lineItems.some((item) => item.itemKey === BATHROOM_AQUALINE_SHEET_KEY) &&
    !deckMixed.lineItems.some((item) => item.itemKey === BATHROOM_AQUALINE_SHEET_KEY)
);

console.log("\n--- Builder Review ---\n");
const review = composeBuilderReview({
  estimate: {
    recommendedCost: a.lineItems.reduce((sum, item) => sum + (item.recommendedCost ?? 0), 0),
    recommendedSell: a.lineItems.reduce((sum, item) => sum + (item.recommendedSell ?? 0), 0),
    marginPercent: 20,
    confidence: a.confidence,
    assumptions: a.assumptions,
    missingInfo: a.missingInfo,
    lineItems: mapCalcLines(a.lineItems),
  },
  workAreas: [{ id: "b1", type: "bathroom", name: "Bathroom", status: "confirmed" }],
  requirements: a.requirements ?? [],
});
const reviewText = JSON.stringify(review);
check(
  "Review shows 3 plywood sheets",
  /3 sheets/.test(reviewText) && /19 mm H3\.2 treated plywood/i.test(reviewText)
);
check("Review shows 10 Aqualine wall sheets", /10 sheets/.test(reviewText));
check("Review shows Standard framing 12.96 lm", /12\.96 lm/.test(reviewText));
check(
  "Review retains wall-height assumption only when assumed",
  !a.assumptions.includes(BATHROOM_WALL_HEIGHT_ASSUMPTION_STATEMENT) ||
    review.assumptions.filter((row) => /wall height assumed at 2\.4/i.test(row.label + (row.detail ?? ""))).length <= 1
);
check(
  "Review groups Bathroom linings",
  review.workAreas.some((waGroup) =>
    waGroup.categories.some((cat) => cat.lineGroups.some((group) => group.label === "Bathroom linings"))
  )
);
check(
  "openings not deducted is disclosed",
  a.assumptions.some((line) => /openings are not currently deducted/i.test(line))
);

console.log("\n--- Sibling WA overlap contract ---\n");
const arch = read("docs/architecture/QUOTR_BATHROOM_ESTIMATING_ARCHITECTURE.md");
check(
  "architecture records future Internal Walls / Ceilings XOR",
  /future isolation contract/i.test(arch) || /sibling Work Area already owns/i.test(arch)
);
check(
  "no Internal Walls / Ceilings maturity invented in 03",
  !read("lib/estimate/bathroom-physical.ts").includes("internal_walls") ||
    read("lib/estimate/bathroom-physical.ts").includes("CEILING_NESTED")
);

console.log("\n--- Migrations / production guard ---\n");
const migrations = numberedMigrations();
check("no migration 055", !migrations.some((name) => name.startsWith("055_")));
check(
  "latest numbered migration still 054 or earlier",
  migrations.every((name) => Number(name.slice(0, 3)) <= 54)
);
check("no production supabase project in 03 files", !read("lib/estimate/bathroom-physical.ts").includes("production"));

if (existsSync(join(process.cwd(), "supabase/migrations/055_placeholder.sql"))) {
  check("055 placeholder must not exist", false);
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
