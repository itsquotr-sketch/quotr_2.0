/**
 * WA-BATHROOM-07 — rate authority + commercial close + legacy fallback removal.
 *
 * Run: npx --yes tsx scripts/verify-work-area-bathroom-07.ts
 *
 * No paid AI. No Production. No migration 055.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { composeBuilderReview } from "../lib/assistant/builder-review/compose";
import { mapRateLabel } from "../lib/assistant/builder-review/compose";
import {
  BATHROOM_AQUALINE_SHEET_KEY,
  BATHROOM_CEILING_LINING_COMPONENT,
  BATHROOM_CEILING_LINING_LABOUR_COMPONENT,
  BATHROOM_DEMOLITION_COMPONENTS,
  BATHROOM_ELECTRICAL_ALLOWANCE_KEY,
  BATHROOM_ELECTRICAL_COMPONENT,
  BATHROOM_FIXTURE_INSTALL_COMPONENTS,
  BATHROOM_FIXTURE_PC_KEYS,
  BATHROOM_FIXTURE_SUPPLY_COMPONENTS,
  BATHROOM_FLOOR_SUBSTRATE_COMPONENT,
  BATHROOM_FLOOR_SUBSTRATE_LABOUR_COMPONENT,
  BATHROOM_FLOOR_SUBSTRATE_PLYWOOD_KEY,
  BATHROOM_FLOOR_TILE_INSTALL_COMPONENT,
  BATHROOM_FLOOR_TILE_MATERIAL_COMPONENT,
  BATHROOM_FRAMING_COMPONENT,
  BATHROOM_FRAMING_LABOUR_COMPONENT,
  BATHROOM_FRAMING_TIMBER_KEY,
  BATHROOM_PAINTING_COMPONENT,
  BATHROOM_PLUMBING_ALLOWANCE_KEY,
  BATHROOM_PLUMBING_COMPONENT,
  BATHROOM_STOPPING_COMPONENT,
  BATHROOM_TILE_INSTALL_KEY,
  BATHROOM_TILE_MATERIAL_BENCHMARK,
  BATHROOM_TILE_MATERIAL_KEY,
  BATHROOM_TILER_BENCHMARK,
  BATHROOM_WALL_LINING_COMPONENT,
  BATHROOM_WALL_LINING_LABOUR_COMPONENT,
  BATHROOM_WALL_TILE_INSTALL_COMPONENT,
  BATHROOM_WALL_TILE_MATERIAL_COMPONENT,
  BATHROOM_WASTE_COMPONENT,
  BATHROOM_WATERPROOFING_COMPONENT,
  BATHROOM_WATERPROOFING_INSTALL_KEY,
} from "../lib/estimate/bathroom-identities";
import {
  BATHROOM_MATURE_FALLBACK_PROHIBITION_STATEMENT,
  BATHROOM_PC_OVERRIDE_RULE,
  findMatureBathroomLegacyViolations,
} from "../lib/estimate/bathroom-commercial-authority";
import { BATHROOM_BENCHMARKS } from "../lib/estimate/benchmark-rates";
import { calculateBathroom } from "../lib/estimate/calculators/bathroom";
import { calculateDeck } from "../lib/estimate/calculators/deck";
import { defaultJoistIdentity } from "../lib/estimate/deck-default-identities";
import { buildMaterialRateItemKey } from "../lib/materials/identity";
import {
  FULL_RATE_CATALOGUE,
  getCatalogueEntry,
} from "../lib/rates/catalogue";
import { SPECIFIC_MATERIAL_RATE_GROUPS } from "../lib/rates/specific-material-catalogue";
import type { OrganisationRate } from "../components/setup/types";
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
  SubcontractRequirement,
  WasteRequirement,
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

function near(actual: number | null | undefined, expected: number, tol = 0.05): boolean {
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

function orgRate(
  itemKey: string,
  cost: number,
  rateType = "material",
  extras?: Partial<OrganisationRate>
): OrganisationRate {
  return {
    id: `rate-${itemKey}`,
    rate_type: rateType,
    trade: null,
    work_area_type: null,
    item_key: itemKey,
    label: itemKey,
    unit: "each",
    cost_rate: cost,
    sell_rate: extras?.sell_rate ?? null,
    markup_percent: null,
    active: true,
    ...extras,
  };
}

function ctx(
  workAreas: EstimateWorkArea[],
  facts: EstimateFact[],
  options?: {
    qualityLevel?: "standard" | "premium" | "budget";
    rates?: OrganisationRate[];
    allowBenchmarkRates?: boolean;
  }
): EstimateContext {
  return {
    project: { id: "p1", qualityLevel: options?.qualityLevel ?? "standard" },
    confirmedWorkAreas: workAreas,
    facts,
    constraints: [],
    organisationSettings: {
      allow_benchmark_rates: options?.allowBenchmarkRates ?? true,
      default_margin_percent: 20,
      premium_rate_factor: 1.15,
      budget_rate_factor: 0.9,
    },
    materialWastageSettings: {
      sheet_material: 10,
      flooring: 10,
      paint: 10,
      default: 5,
    },
    rates: options?.rates ?? [],
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
  options?: {
    qualityLevel?: "standard" | "premium" | "budget";
    rates?: OrganisationRate[];
    allowBenchmarkRates?: boolean;
    extras?: EstimateWorkArea[];
  }
): ReturnType<typeof calculateBathroom> {
  return calculateBathroom(
    ctx(
      [wa("b1", "bathroom", "Bathroom"), ...(options?.extras ?? [])],
      facts,
      options
    ),
    wa("b1", "bathroom", "Bathroom")
  );
}

function labour(result: ReturnType<typeof calculateBathroom>): LabourRequirement[] {
  return (result.requirements ?? []).filter(
    (row): row is LabourRequirement => row.kind === "labour"
  );
}

function materials(result: ReturnType<typeof calculateBathroom>): MaterialRequirement[] {
  return (result.requirements ?? []).filter(
    (row): row is MaterialRequirement => row.kind === "material"
  );
}

function subcontracts(
  result: ReturnType<typeof calculateBathroom>
): SubcontractRequirement[] {
  return (result.requirements ?? []).filter(
    (row): row is SubcontractRequirement => row.kind === "subcontract"
  );
}

function waste(result: ReturnType<typeof calculateBathroom>): WasteRequirement[] {
  return (result.requirements ?? []).filter(
    (row): row is WasteRequirement => row.kind === "waste"
  );
}

function reviewOf(result: ReturnType<typeof calculateBathroom>) {
  return composeBuilderReview({
    estimate: {
      recommendedCost: result.lineItems.reduce((sum, item) => sum + (item.recommendedCost ?? 0), 0),
      recommendedSell: result.lineItems.reduce((sum, item) => sum + (item.recommendedSell ?? 0), 0),
      marginPercent: 20,
      confidence: result.confidence,
      assumptions: result.assumptions,
      missingInfo: result.missingInfo,
      lineItems: mapCalcLines(result.lineItems),
    },
    workAreas: [{ id: "b1", type: "bathroom", name: "Bathroom", status: "confirmed" }],
    requirements: result.requirements ?? [],
  });
}

function totalCost(result: ReturnType<typeof calculateBathroom>): number {
  return result.lineItems.reduce((sum, item) => sum + (item.recommendedCost ?? 0), 0);
}

function totalSell(result: ReturnType<typeof calculateBathroom>): number {
  return result.lineItems.reduce((sum, item) => sum + (item.recommendedSell ?? 0), 0);
}

function visibleReviewCopy(value: unknown, parentKey = ""): string {
  if (value == null) return "";
  if (typeof value === "string" || typeof value === "number") {
    if (
      parentKey === "itemKey" ||
      parentKey === "componentKey" ||
      parentKey === "rateKey" ||
      parentKey === "materialKey" ||
      parentKey === "requirementId"
    ) {
      return "";
    }
    return String(value);
  }
  if (Array.isArray(value)) {
    return value.map((row) => visibleReviewCopy(row, parentKey)).join(" ");
  }
  if (typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .map(([key, child]) => visibleReviewCopy(child, key))
      .join(" ");
  }
  return "";
}

const room = [
  fact("bathroom.length_m", "b1", 3),
  fact("bathroom.width_m", "b1", 2.4),
  fact("bathroom.wall_height_m", "b1", 2.4),
];

const fullDemoComponents = [
  "Floor finish",
  "Wall lining",
  "Ceiling lining",
  "Vanity",
  "Toilet",
  "Shower / enclosure",
];

const comprehensiveFacts: EstimateFact[] = [
  fact("bathroom.job_scope", "b1", "full_renovation"),
  ...room,
  fact("bathroom.demolition_required", "b1", true),
  fact("bathroom.demolition.components", "b1", fullDemoComponents),
  fact("bathroom.floor_substrate_system", "b1", "treated_plywood"),
  fact("bathroom.wall_lining_included", "b1", true),
  fact("bathroom.wall_lining_system", "b1", "aqualine"),
  fact("bathroom.ceiling_lining_included", "b1", true),
  fact("bathroom.framing_level", "b1", "standard"),
  fact("bathroom.floor_finish_system", "b1", "tile"),
  fact("bathroom.tile_extent", "b1", "half_height"),
  fact("bathroom.waterproofing_included", "b1", true),
  fact("bathroom.waterproofing_extent", "b1", "floor_and_shower"),
  fact("bathroom.shower.width_m", "b1", 0.9),
  fact("bathroom.shower.depth_m", "b1", 0.9),
  fact("bathroom.shower.wall_height_m", "b1", 2.1),
  fact("bathroom.fixtures_included", "b1", [
    "Vanity",
    "Toilet",
    "Mirror/cabinet",
    "Heated towel rail",
  ]),
  fact("bathroom.fixture.vanity.ownership", "b1", "Supply and install"),
  fact("bathroom.fixture.toilet.ownership", "b1", "Supply and install"),
  fact("bathroom.fixture.mirror.ownership", "b1", "Supply and install"),
  fact("bathroom.fixture.heated_towel_rail.ownership", "b1", "Install only"),
  fact("bathroom.plumbing.level", "b1", "standard"),
  fact("bathroom.electrical.level", "b1", "standard"),
  fact("bathroom.electrical.light_count", "b1", 4),
  fact("bathroom.ventilation_included", "b1", true),
  fact("bathroom.stopping_included", "b1", true),
  fact("bathroom.painting_included", "b1", true),
];

console.log("=== WA-BATHROOM-07 ===\n");

console.log("--- Catalogue benchmarks ---\n");
check(
  "plywood $145",
  getCatalogueEntry(BATHROOM_FLOOR_SUBSTRATE_PLYWOOD_KEY)?.defaultCostRate === 145
);
check(
  "fibre cement $95",
  getCatalogueEntry("sheet.fibre_cement.18mm.2400x1200.each")?.defaultCostRate === 95
);
check(
  "H1.2 framing $6.20",
  getCatalogueEntry(BATHROOM_FRAMING_TIMBER_KEY)?.defaultCostRate === 6.2
);
check(
  "Aqualine catalogue present",
  getCatalogueEntry(BATHROOM_AQUALINE_SHEET_KEY) != null
);
check("tile PC $65", getCatalogueEntry(BATHROOM_TILE_MATERIAL_KEY)?.defaultCostRate === 65);
check("tiler $95", getCatalogueEntry(BATHROOM_TILE_INSTALL_KEY)?.defaultCostRate === 95);
check(
  "WP install $75",
  getCatalogueEntry(BATHROOM_WATERPROOFING_INSTALL_KEY)?.defaultCostRate === 75
);
check("toilet PC $650", getCatalogueEntry(BATHROOM_FIXTURE_PC_KEYS.toilet)?.defaultCostRate === 650);
check("vanity PC $1200", getCatalogueEntry(BATHROOM_FIXTURE_PC_KEYS.vanity)?.defaultCostRate === 1200);
check("basin PC $400", getCatalogueEntry(BATHROOM_FIXTURE_PC_KEYS.basin)?.defaultCostRate === 400);
check("shower PC $750", getCatalogueEntry(BATHROOM_FIXTURE_PC_KEYS.shower)?.defaultCostRate === 750);
check(
  "enclosure PC $1200",
  getCatalogueEntry(BATHROOM_FIXTURE_PC_KEYS.shower_enclosure)?.defaultCostRate === 1200
);
check("bath PC $1000", getCatalogueEntry(BATHROOM_FIXTURE_PC_KEYS.bath)?.defaultCostRate === 1000);
check("tapware PC $650", getCatalogueEntry(BATHROOM_FIXTURE_PC_KEYS.tapware)?.defaultCostRate === 650);
check("mirror PC $350", getCatalogueEntry(BATHROOM_FIXTURE_PC_KEYS.mirror)?.defaultCostRate === 350);
check(
  "heated rail PC $450",
  getCatalogueEntry(BATHROOM_FIXTURE_PC_KEYS.heated_towel_rail)?.defaultCostRate === 450
);
check(
  "extract fan PC $300",
  getCatalogueEntry(BATHROOM_FIXTURE_PC_KEYS.extract_fan)?.defaultCostRate === 300
);
check(
  "accessories PC $300",
  getCatalogueEntry(BATHROOM_FIXTURE_PC_KEYS.accessories)?.defaultCostRate === 300
);
check(
  "plumbing Standard $3500",
  getCatalogueEntry("bathroom.plumbing.standard.allowance")?.defaultCostRate === 3500
);
check(
  "electrical Standard $1750",
  getCatalogueEntry("bathroom.electrical.standard.allowance")?.defaultCostRate === 1750
);
check("stopping $28", getCatalogueEntry("bathroom.stopping.m2")?.defaultCostRate === 28);
check("painting $30", getCatalogueEntry("bathroom.painting.m2")?.defaultCostRate === 30);
check(
  "waste major $1000",
  getCatalogueEntry("bathroom.waste.major.allowance")?.defaultCostRate === 1000
);
check(
  "tile material ≠ tiler key",
  BATHROOM_TILE_MATERIAL_KEY !== BATHROOM_TILE_INSTALL_KEY &&
    BATHROOM_TILE_MATERIAL_BENCHMARK === 65 &&
    BATHROOM_TILER_BENCHMARK === 95
);

console.log("\n--- Legacy inventory still present for no-job_scope path ---\n");
check("$18k still in BATHROOM_BENCHMARKS", BATHROOM_BENCHMARKS.minimumPackage.cost === 18000);
check("$25k still in BATHROOM_BENCHMARKS", BATHROOM_BENCHMARKS.minimumPackage.sell === 25000);
check("scope.bathroom.m2 still catalogued", getCatalogueEntry("scope.bathroom.m2") != null);
check("mixed tiling key still catalogued", getCatalogueEntry("bathroom.tiling.m2") != null);
const calcSrc = read("lib/estimate/calculators/bathroom.ts");
check(
  "package block is LEGACY ONLY",
  calcSrc.includes("LEGACY ONLY — $18k / $25k package") &&
    calcSrc.includes("if (maturePath)") &&
    calcSrc.includes("BATHROOM_MATURE_FALLBACK_PROHIBITION_STATEMENT")
);
check(
  "coordination gated to legacy",
  calcSrc.includes("LEGACY ONLY — $800/$1,200 coordination")
);
check(
  "floor-prep lump gated to legacy",
  calcSrc.includes("LEGACY ONLY — $400 floor-prep lump")
);

console.log("\n--- Comprehensive mature fixture ---\n");
const full = bathroom(comprehensiveFacts);
const violations = findMatureBathroomLegacyViolations(full.lineItems);
check(
  "no mature legacy violations",
  violations.length === 0,
  violations.map((row) => `${row.reason}:${row.label}`).join("; ")
);
check(
  "prohibition assumption recorded",
  full.assumptions.includes(BATHROOM_MATURE_FALLBACK_PROHIBITION_STATEMENT)
);
check(
  "no $18k/$25k package line",
  !full.lineItems.some((item) => /materials\/finishes allowance/i.test(item.label)) &&
    !full.lineItems.some((item) => (item.recommendedCost ?? 0) === 18000) &&
    !full.lineItems.some((item) => (item.recommendedSell ?? 0) === 25000)
);
check(
  "no scope.bathroom.m2",
  !full.lineItems.some((item) => item.itemKey === "scope.bathroom.m2")
);
check(
  "no generic carpentry",
  !full.lineItems.some((item) => /carpentry\/prep/i.test(item.label))
);
check(
  "no mixed tiling",
  !full.lineItems.some(
    (item) => item.itemKey === "bathroom.tiling.m2" || /^tiling allowance$/i.test(item.label)
  )
);
check(
  "no fixture bundle / 8h install",
  !full.lineItems.some((item) => /fixtures allowance|fixture installation labour/i.test(item.label))
);
check(
  "no leftover floor-prep / coordination",
  !full.lineItems.some((item) =>
    /floor levelling|project coordination/i.test(item.label)
  )
);
check(
  "no duplicate fan / UFH lumps",
  full.lineItems.filter((item) => /extract fan|underfloor heating allowance/i.test(item.label))
    .length <= 1
);

const plywood = materials(full).find(
  (row) => row.componentKey === BATHROOM_FLOOR_SUBSTRATE_COMPONENT
);
const wallAq = materials(full).find((row) => row.componentKey === BATHROOM_WALL_LINING_COMPONENT);
const ceilAq = materials(full).find(
  (row) => row.componentKey === BATHROOM_CEILING_LINING_COMPONENT
);
const framing = materials(full).find((row) => row.componentKey === BATHROOM_FRAMING_COMPONENT);
const floorTile = materials(full).find(
  (row) => row.componentKey === BATHROOM_FLOOR_TILE_MATERIAL_COMPONENT
);
const wallTile = materials(full).find(
  (row) => row.componentKey === BATHROOM_WALL_TILE_MATERIAL_COMPONENT
);
const floorTiler = subcontracts(full).find(
  (row) => row.componentKey === BATHROOM_FLOOR_TILE_INSTALL_COMPONENT
);
const wallTiler = subcontracts(full).find(
  (row) => row.componentKey === BATHROOM_WALL_TILE_INSTALL_COMPONENT
);
const wp = subcontracts(full).find((row) => row.componentKey === BATHROOM_WATERPROOFING_COMPONENT);
const vanityPc = materials(full).find(
  (row) => row.componentKey === BATHROOM_FIXTURE_SUPPLY_COMPONENTS.vanity
);
const toiletPc = materials(full).find(
  (row) => row.componentKey === BATHROOM_FIXTURE_SUPPLY_COMPONENTS.toilet
);
const mirrorPc = materials(full).find(
  (row) => row.componentKey === BATHROOM_FIXTURE_SUPPLY_COMPONENTS.mirror
);
const plumbing = subcontracts(full).find((row) => row.componentKey === BATHROOM_PLUMBING_COMPONENT);
const electrical = subcontracts(full).find(
  (row) => row.componentKey === BATHROOM_ELECTRICAL_COMPONENT
);
const stopping = subcontracts(full).find((row) => row.componentKey === BATHROOM_STOPPING_COMPONENT);
const painting = subcontracts(full).find((row) => row.componentKey === BATHROOM_PAINTING_COMPONENT);
const wasteRow = waste(full).find((row) => row.componentKey === BATHROOM_WASTE_COMPONENT);
const floorLab = labour(full).find(
  (row) => row.componentKey === BATHROOM_FLOOR_SUBSTRATE_LABOUR_COMPONENT
);
const wallLab = labour(full).find(
  (row) => row.componentKey === BATHROOM_WALL_LINING_LABOUR_COMPONENT
);
const ceilLab = labour(full).find(
  (row) => row.componentKey === BATHROOM_CEILING_LINING_LABOUR_COMPONENT
);
const framingLab = labour(full).find(
  (row) => row.componentKey === BATHROOM_FRAMING_LABOUR_COMPONENT
);
const vanityLab = labour(full).find(
  (row) => row.componentKey === BATHROOM_FIXTURE_INSTALL_COMPONENTS.vanity
);
const demoFloor = labour(full).find(
  (row) => row.componentKey === BATHROOM_DEMOLITION_COMPONENTS.floor_finish
);

check("plywood 3 sheets × $145", plywood?.purchaseQuantity === 3 && near(plywood.totalCost, 435));
check("wall Aqualine 10 sheets", wallAq?.purchaseQuantity === 10);
check("ceiling Aqualine 3 sheets", ceilAq?.purchaseQuantity === 3);
check("wall+ceiling share Aqualine key", wallAq?.materialKey === BATHROOM_AQUALINE_SHEET_KEY && ceilAq?.materialKey === BATHROOM_AQUALINE_SHEET_KEY);
check("framing 12.96 lm × $6.20", near(framing?.purchaseQuantity, 12.96) && near(framing?.totalCost, 80.35));
check("floor tile purchase 7.92 × $65", near(floorTile?.purchaseQuantity, 7.92) && near(floorTile?.totalCost, 514.8));
check("wall tile purchase 14.256 × $65", near(wallTile?.purchaseQuantity, 14.256) && near(wallTile?.totalCost, 926.64));
check("floor tiler 7.2 × $95", near(floorTiler?.totalCost, 684));
check("wall tiler 12.96 × $95", near(wallTiler?.totalCost, 1231.2));
check("WP 7.2+3.78=10.98 × $75", near(wp?.totalCost, 823.5));
check("vanity PC $1200", near(vanityPc?.totalCost, 1200));
check("toilet PC $650", near(toiletPc?.totalCost, 650));
check("mirror PC $350", near(mirrorPc?.totalCost, 350));
check("plumbing Standard+toilet+vanity $4400", near(plumbing?.totalCost, 4400));
check("electrical Standard+4 lights+fan+rail $3170", near(electrical?.totalCost, 3170));
check("stopping 33.12 × $28", near(stopping?.totalCost, 927.36));
check("painting paintable 20.16 × $30", near(painting?.totalCost, 604.8));
check("waste major $1000", near(wasteRow?.totalCost, 1000));
check("floor labour 2.88 h × $60", near(floorLab?.adjustedHours, 2.88) && near(floorLab?.totalCost, 172.8));
check("wall labour 7.776 h", near(wallLab?.adjustedHours, 7.776));
check("ceiling labour 2.88 h", near(ceilLab?.adjustedHours, 2.88));
check("framing labour 2.592 h", near(framingLab?.adjustedHours, 2.592));
check("vanity install 2.5 h", near(vanityLab?.adjustedHours, 2.5));
check("demo floor 1.8 h × $60", near(demoFloor?.adjustedHours, 1.8) && near(demoFloor?.totalCost, 108));
check(
  "no tiled-surface paint (paintable < gross wall + ceiling)",
  (full.lineItems.find((item) => item.componentKey === BATHROOM_PAINTING_COMPONENT)?.quantity ?? 99) <
    25.92 + 7.2
);

const cost = totalCost(full);
const sell = totalSell(full);
console.log(`  comprehensive cost $${cost.toFixed(2)}  sell $${sell.toFixed(2)}`);
check("sell > cost (commercial engine)", sell > cost);
check(
  "Bathroom calculator does not own a margin formula",
  !calcSrc.includes("sell = cost /") && !calcSrc.includes("1 - gm")
);

const groups: Record<string, number> = {};
for (const item of full.lineItems) {
  const key = (item.componentKey ?? item.scopeKey ?? item.label).split(".").slice(0, 2).join(".");
  groups[key] = (groups[key] ?? 0) + (item.recommendedCost ?? 0);
}
console.log("  cost by group:");
for (const [key, amount] of Object.entries(groups).sort((a, b) => b[1] - a[1])) {
  console.log(`    ${key}: $${amount.toFixed(2)}`);
}

console.log("\n--- Requirement completeness ---\n");
const pricedLines = full.lineItems.filter((item) => (item.recommendedCost ?? 0) > 0);
const reqKeys = new Set((full.requirements ?? []).map((row) => row.componentKey));
const missingEnvelope = pricedLines.filter(
  (item) => item.componentKey && !reqKeys.has(item.componentKey)
);
check(
  "every priced mature line is in the requirement envelope",
  missingEnvelope.length === 0,
  missingEnvelope.map((item) => item.label).join(", ")
);
check(
  "envelope covers material/labour/subcontract/PC/waste",
  materials(full).length > 0 &&
    labour(full).length > 0 &&
    subcontracts(full).length > 0 &&
    waste(full).length === 1
);

console.log("\n--- Pricing Required (no package fallback) ---\n");
const gap = bathroom(comprehensiveFacts, {
  allowBenchmarkRates: false,
  rates: [orgRate("labour.carpenter.hour", 60, "labour")],
});
check(
  "gap path still has no $18k package",
  findMatureBathroomLegacyViolations(gap.lineItems).length === 0 &&
    !gap.lineItems.some((item) => /materials\/finishes allowance/i.test(item.label))
);
check(
  "plywood is Pricing Required when benchmarks off",
  materials(gap).find((row) => row.componentKey === BATHROOM_FLOOR_SUBSTRATE_COMPONENT)?.priced ===
    false
);
check(
  "Aqualine is Pricing Required when benchmarks off",
  materials(gap).find((row) => row.componentKey === BATHROOM_WALL_LINING_COMPONENT)?.priced === false
);
check(
  "gap lines chip Pricing required / Rate required",
  gap.lineItems.some(
    (item) =>
      item.itemKey === BATHROOM_FLOOR_SUBSTRATE_PLYWOOD_KEY &&
      /pricing required|rate required/i.test(item.rateSource ?? "")
  )
);

console.log("\n--- Company material override ---\n");
const aqCompany = bathroom(comprehensiveFacts, {
  rates: [orgRate(BATHROOM_AQUALINE_SHEET_KEY, 111)],
});
const wallCo = materials(aqCompany).find(
  (row) => row.componentKey === BATHROOM_WALL_LINING_COMPONENT
);
const ceilCo = materials(aqCompany).find(
  (row) => row.componentKey === BATHROOM_CEILING_LINING_COMPONENT
);
check("wall Aqualine uses company $111", near(wallCo?.unitCost, 111) && near(wallCo?.totalCost, 1110));
check("ceiling Aqualine uses same $111", near(ceilCo?.unitCost, 111) && near(ceilCo?.totalCost, 333));
check("single Aqualine identity", wallCo?.materialKey === ceilCo?.materialKey);
const h12Company = bathroom(comprehensiveFacts, {
  rates: [orgRate(BATHROOM_FRAMING_TIMBER_KEY, 9.5)],
});
check(
  "H1.2 company $9.50 consumed once",
  near(
    materials(h12Company).find((row) => row.componentKey === BATHROOM_FRAMING_COMPONENT)?.unitCost,
    9.5
  )
);

console.log("\n--- Company labour override ---\n");
const labourCo = bathroom(comprehensiveFacts, {
  rates: [orgRate("labour.carpenter.hour", 88, "labour")],
});
const labourCosts = labour(labourCo).map((row) => row.hourlyCost);
check(
  "all builder labour uses $88 carpenter",
  labourCosts.length > 4 && labourCosts.every((rate) => near(rate, 88))
);
check(
  "productivity remains task-specific",
  near(
    labour(labourCo).find((row) => row.componentKey === BATHROOM_FLOOR_SUBSTRATE_LABOUR_COMPONENT)
      ?.adjustedHours,
    2.88
  ) &&
    near(
      labour(labourCo).find((row) => row.componentKey === BATHROOM_WALL_LINING_LABOUR_COMPONENT)
        ?.adjustedHours,
      7.776
    ) &&
    near(
      labour(labourCo).find(
        (row) => row.componentKey === BATHROOM_FIXTURE_INSTALL_COMPONENTS.vanity
      )?.adjustedHours,
      2.5
    )
);
check(
  "demo hours × company carpenter",
  near(
    labour(labourCo).find(
      (row) => row.componentKey === BATHROOM_DEMOLITION_COMPONENTS.floor_finish
    )?.totalCost,
    1.8 * 88
  )
);

console.log("\n--- Company plumbing / electrical lumps ---\n");
const tradeCo = bathroom(comprehensiveFacts, {
  rates: [
    orgRate(BATHROOM_PLUMBING_ALLOWANCE_KEY, 9000, "allowance"),
    orgRate(BATHROOM_ELECTRICAL_ALLOWANCE_KEY, 5000, "allowance"),
  ],
});
check(
  "company plumbing replaces hybrid (not 4400+9000)",
  near(
    subcontracts(tradeCo).find((row) => row.componentKey === BATHROOM_PLUMBING_COMPONENT)?.totalCost,
    9000
  )
);
check(
  "company electrical replaces hybrid (not 3170+5000)",
  near(
    subcontracts(tradeCo).find((row) => row.componentKey === BATHROOM_ELECTRICAL_COMPONENT)
      ?.totalCost,
    5000
  )
);

console.log("\n--- Tile PC vs tiler isolation ---\n");
const tileCo = bathroom(comprehensiveFacts, {
  rates: [orgRate(BATHROOM_TILE_MATERIAL_KEY, 40)],
});
check(
  "company tile PC $40 does not change tiler $95",
  near(
    materials(tileCo).find((row) => row.componentKey === BATHROOM_FLOOR_TILE_MATERIAL_COMPONENT)
      ?.unitCost,
    40
  ) &&
    near(
      tileCo.lineItems.find(
        (item) => item.componentKey === BATHROOM_FLOOR_TILE_INSTALL_COMPONENT
      )?.costRate,
      95
    )
);
const tilerCo = bathroom(comprehensiveFacts, {
  rates: [orgRate(BATHROOM_TILE_INSTALL_KEY, 120, "subcontractor")],
});
check(
  "company tiler $120 does not change tile PC $65",
  near(
    materials(tilerCo).find((row) => row.componentKey === BATHROOM_FLOOR_TILE_MATERIAL_COMPONENT)
      ?.unitCost,
    65
  )
);

console.log("\n--- PC override rule ---\n");
console.log(`  ${BATHROOM_PC_OVERRIDE_RULE}`);
const pcCo = bathroom(comprehensiveFacts, {
  rates: [orgRate(BATHROOM_FIXTURE_PC_KEYS.vanity, 1500, "allowance")],
});
const vanityOverride = materials(pcCo).find(
  (row) => row.componentKey === BATHROOM_FIXTURE_SUPPLY_COMPONENTS.vanity
);
check("company vanity PC dollars $1500", near(vanityOverride?.totalCost, 1500));
const vanityLine = pcCo.lineItems.find(
  (item) => item.componentKey === BATHROOM_FIXTURE_SUPPLY_COMPONENTS.vanity
);
check(
  "vanity line still named PC allowance",
  /pc allowance/i.test(vanityLine?.label ?? "") || /pc allowance/i.test(vanityLine?.notes ?? "")
);
check(
  "company PC chip is Your company rate (single chip)",
  /company rate/i.test(vanityLine?.rateSource ?? "")
);

console.log("\n--- Finish-level factor ---\n");
const premium = bathroom(comprehensiveFacts, { qualityLevel: "premium" });
check(
  "premium does not change lining hours",
  near(
    labour(premium).find((row) => row.componentKey === BATHROOM_WALL_LINING_LABOUR_COMPONENT)
      ?.adjustedHours,
    wallLab?.adjustedHours ?? -1
  )
);
check("premium does not change vanity PC", near(materials(premium).find((row) => row.componentKey === BATHROOM_FIXTURE_SUPPLY_COMPONENTS.vanity)?.totalCost, 1200));
check("premium does not change plumbing", near(subcontracts(premium).find((row) => row.componentKey === BATHROOM_PLUMBING_COMPONENT)?.totalCost, 4400));
check(
  "mature envelopes hardcode qualityFactor 1",
  read("lib/estimate/bathroom-physical.ts").includes("qualityFactor: 1") &&
    read("lib/estimate/bathroom-finishes.ts").includes("qualityFactor: 1") &&
    read("lib/estimate/bathroom-fixtures.ts").includes("qualityFactor: 1") &&
    read("lib/estimate/bathroom-trades.ts").includes("qualityFactor: 1") &&
    read("lib/estimate/bathroom-demolition.ts").includes("qualityFactor: 1") &&
    read("lib/estimate/bathroom-finishing.ts").includes("qualityFactor: 1")
);

console.log("\n--- Partial scopes ---\n");
const vanityOnly = bathroom([
  fact("bathroom.job_scope", "b1", "vanity_only"),
  fact("bathroom.fixture.vanity.ownership", "b1", "Supply and install"),
  fact("bathroom.plumbing.level", "b1", "minor"),
]);
check(
  "vanity-only: PC + 2.5h + plumbing $1950",
  near(
    materials(vanityOnly).find((row) => row.componentKey === BATHROOM_FIXTURE_SUPPLY_COMPONENTS.vanity)
      ?.totalCost,
    1200
  ) &&
    near(
      labour(vanityOnly).find(
        (row) => row.componentKey === BATHROOM_FIXTURE_INSTALL_COMPONENTS.vanity
      )?.adjustedHours,
      2.5
    ) &&
    near(
      subcontracts(vanityOnly).find((row) => row.componentKey === BATHROOM_PLUMBING_COMPONENT)
        ?.totalCost,
      1950
    )
);
check(
  "vanity-only has no package / tile / lining / WP",
  findMatureBathroomLegacyViolations(vanityOnly.lineItems).length === 0 &&
    !materials(vanityOnly).some((row) => row.componentKey === BATHROOM_FLOOR_TILE_MATERIAL_COMPONENT) &&
    !materials(vanityOnly).some((row) => row.componentKey === BATHROOM_WALL_LINING_COMPONENT) &&
    !subcontracts(vanityOnly).some((row) => row.componentKey === BATHROOM_WATERPROOFING_COMPONENT)
);

const strip = bathroom([
  fact("bathroom.job_scope", "b1", "strip_out_only"),
  ...room,
  fact("bathroom.demolition.components", "b1", ["Floor finish", "Wall lining", "Vanity", "Toilet"]),
]);
check(
  "strip-out is demo+waste only",
  labour(strip).every((row) => String(row.componentKey).startsWith("bathroom.demolition")) &&
    waste(strip).length === 1 &&
    materials(strip).length === 0 &&
    findMatureBathroomLegacyViolations(strip.lineItems).length === 0
);
check(
  "strip-out has no package minimum",
  !strip.lineItems.some((item) => /materials\/finishes allowance/i.test(item.label))
);

const retile = bathroom([
  fact("bathroom.job_scope", "b1", "retile_floor"),
  fact("bathroom.length_m", "b1", 3),
  fact("bathroom.width_m", "b1", 2.4),
  fact("bathroom.floor_finish_system", "b1", "tile"),
]);
check(
  "retile_floor is tile+tiler without $18k",
  materials(retile).some((row) => row.componentKey === BATHROOM_FLOOR_TILE_MATERIAL_COMPONENT) &&
    subcontracts(retile).some((row) => row.componentKey === BATHROOM_FLOOR_TILE_INSTALL_COMPONENT) &&
    !materials(retile).some((row) => row.componentKey === BATHROOM_WALL_TILE_MATERIAL_COMPONENT) &&
    findMatureBathroomLegacyViolations(retile.lineItems).length === 0
);

const showerOnly = bathroom([
  fact("bathroom.job_scope", "b1", "shower_only"),
  fact("bathroom.tile_extent", "b1", "shower_only"),
  fact("bathroom.waterproofing_included", "b1", true),
  fact("bathroom.waterproofing_extent", "b1", "shower_only"),
  fact("bathroom.shower.width_m", "b1", 0.9),
  fact("bathroom.shower.depth_m", "b1", 0.9),
  fact("bathroom.shower.wall_height_m", "b1", 2.1),
]);
check(
  "shower_only is selected tile+WP, not whole-room package",
  materials(showerOnly).some((row) => row.componentKey === BATHROOM_WALL_TILE_MATERIAL_COMPONENT) &&
    subcontracts(showerOnly).some((row) => row.componentKey === BATHROOM_WATERPROOFING_COMPONENT) &&
    !materials(showerOnly).some((row) => row.componentKey === BATHROOM_FLOOR_TILE_MATERIAL_COMPONENT) &&
    findMatureBathroomLegacyViolations(showerOnly.lineItems).length === 0
);

console.log("\n--- Legacy path still prices without job_scope ---\n");
const legacy = bathroom([
  fact("bathroom.area_m2", "b1", 8),
  fact("bathroom.renovation_type", "b1", "Full strip-out and rebuild"),
]);
check(
  "legacy still emits carpentry/prep",
  legacy.lineItems.some((item) => /carpentry\/prep/i.test(item.label))
);
check("legacy has no mature envelope", (legacy.requirements ?? []).length === 0);

console.log("\n--- Builder Review provenance ---\n");
const review = reviewOf(full);
const reviewText = JSON.stringify(review);
const reviewCopy = visibleReviewCopy(review);
const chips = new Set(
  full.lineItems
    .filter((item) => (item.recommendedCost ?? 0) > 0)
    .map((item) => mapRateLabel(item.rateSource ?? ""))
);
check(
  "Review chips are coherent",
  [...chips].every((chip) =>
    /Company rate|Quotr benchmark|PC allowance|Quotr allowance|Rate required|Your company rate|Default allowance|Quotr productivity/i.test(
      chip
    )
  ),
  [...chips].join(", ")
);
check(
  "Review copy does not leak internal rate keys",
  !/bathroom\.tile\.material\.m2|bathroom\.plumbing\.standard\.allowance|labour\.carpenter\.hour/.test(
    reviewCopy
  )
);
check("Review labels PC allowance", /PC allowance/i.test(reviewText));
check("Review labels Quotr allowance on trades", /Quotr allowance/i.test(reviewText));
check("Review has no package line", !/materials\/finishes allowance/i.test(reviewText));

console.log("\n--- Rates page presentation ---\n");
const materialKeys = SPECIFIC_MATERIAL_RATE_GROUPS.flatMap((group) =>
  group.entries.map((entry) => entry.item_key)
);
check(
  "fixture PCs are not Materials groups",
  !materialKeys.includes(BATHROOM_FIXTURE_PC_KEYS.vanity) &&
    !materialKeys.includes(BATHROOM_FIXTURE_PC_KEYS.toilet)
);
check(
  "Aqualine appears once in Materials groups",
  materialKeys.filter((key) => key === BATHROOM_AQUALINE_SHEET_KEY).length === 1
);
check(
  "H1.2 appears once in Materials groups",
  materialKeys.filter((key) => key.includes("90x45.h1.2")).length === 1
);
check(
  "tile material and tiler both listed in finish catalogue",
  materialKeys.includes(BATHROOM_TILE_MATERIAL_KEY) &&
    materialKeys.includes(BATHROOM_TILE_INSTALL_KEY)
);

console.log("\n--- Stale / leftover key recommendations ---\n");
const leftover = [
  { key: "scope.bathroom.m2", rec: "HIDE FROM MODERN RATES UI / LEGACY" },
  { key: "bathroom.tiling.m2", rec: "KEEP LEGACY (mixed tiling leftover)" },
  { key: "bathroom.fixtures.allowance", rec: "KEEP LEGACY (fixture bundle leftover)" },
  { key: "bathroom.waterproofing.allowance", rec: "KEEP LEGACY (lump leftover vs install.m2)" },
  { key: "bathroom.framing.90x45.h1.2.lm", rec: "KEEP alias" },
];
for (const row of leftover) {
  console.log(`  ${row.key}: ${row.rec}`);
  check(`${row.key} still catalogued`, getCatalogueEntry(row.key) != null);
}

const bathroomish = FULL_RATE_CATALOGUE.filter(
  (entry) =>
    entry.item_key.startsWith("bathroom.") ||
    entry.item_key === "scope.bathroom.m2" ||
    entry.item_key === BATHROOM_AQUALINE_SHEET_KEY ||
    entry.item_key === BATHROOM_FLOOR_SUBSTRATE_PLYWOOD_KEY ||
    entry.item_key === BATHROOM_FRAMING_TIMBER_KEY ||
    entry.item_key === "labour.carpenter.hour"
);
console.log(`  bathroom-related catalogue rows: ${bathroomish.length}`);

console.log("\n--- Bathroom + Deck isolation ---\n");
const deckWa = wa("d1", "deck", "Deck");
const mixedFacts = [
  ...comprehensiveFacts,
  fact("deck.area_m2", "d1", 12),
  fact("deck.board_material", "d1", "Hardwood"),
];
const mixedCtx = ctx([wa("b1", "bathroom", "Bathroom"), deckWa], mixedFacts);
const bathMixed = calculateBathroom(mixedCtx, wa("b1", "bathroom", "Bathroom"));
const deckOnly = calculateDeck(
  ctx([deckWa], mixedFacts.filter((row) => row.work_area_id === "d1")),
  deckWa
);
const deckMixed = calculateDeck(mixedCtx, deckWa);
const deckJoistKey = defaultJoistIdentity()
  ? buildMaterialRateItemKey(defaultJoistIdentity()!, "lm")
  : "";
check(
  "Bathroom H1.2 is not Deck joist",
  BATHROOM_FRAMING_TIMBER_KEY !== deckJoistKey
);
check(
  "Deck snapshot unchanged beside Bathroom",
  JSON.stringify(deckOnly.lineItems.map((item) => [item.label, item.quantity, item.itemKey])) ===
    JSON.stringify(deckMixed.lineItems.map((item) => [item.label, item.quantity, item.itemKey]))
);
check(
  "Bathroom Aqualine did not become a Deck material",
  bathMixed.lineItems.some((item) => item.itemKey === BATHROOM_AQUALINE_SHEET_KEY) &&
    !deckMixed.lineItems.some((item) => item.itemKey === BATHROOM_AQUALINE_SHEET_KEY)
);
check(
  "requirement keys stay namespaced",
  (bathMixed.requirements ?? []).every((row) => row.componentKey.startsWith("bathroom."))
);

console.log("\n--- Files / migrations ---\n");
check("no migration 055", !numberedMigrations().some((name) => name.startsWith("055_")));
check(
  "07 authority module exists",
  existsSync(join(process.cwd(), "lib/estimate/bathroom-commercial-authority.ts"))
);
check(
  "07 files do not mention production supabase",
  !read("lib/estimate/bathroom-commercial-authority.ts").includes("kxz") &&
    !read("lib/estimate/calculators/bathroom.ts").includes("kxz")
);

if (failed > 0) {
  console.log(`\nWA-BATHROOM-07 verifier: ${passed} passed, ${failed} failed`);
  process.exit(1);
}
console.log(`\nWA-BATHROOM-07 verifier: ${passed} passed, ${failed} failed`);
