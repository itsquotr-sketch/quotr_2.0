/**
 * WA-BATHROOM-04 — floor finish XOR, tiling, waterproofing.
 *
 * Run: npx --yes tsx scripts/verify-work-area-bathroom-04.ts
 *
 * No paid AI. No Production. No migration 055.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { composeBuilderReview } from "../lib/assistant/builder-review/compose";
import { composeClarifyView } from "../lib/assistant/clarify/compose";
import { composeJobPlan } from "../lib/assistant/job-plan/compose";
import {
  BATHROOM_FIBRE_CEMENT_SHEET_BENCHMARK,
  BATHROOM_FLOOR_SUBSTRATE_COMPONENT,
  BATHROOM_FLOOR_SUBSTRATE_PLYWOOD_KEY,
  BATHROOM_FLOOR_TILE_INSTALL_COMPONENT,
  BATHROOM_FLOOR_TILE_MATERIAL_COMPONENT,
  BATHROOM_FRAMING_H12_BENCHMARK,
  BATHROOM_PLYWOOD_SHEET_BENCHMARK,
  BATHROOM_SHEET_VINYL_INSTALL_COMPONENT,
  BATHROOM_SHEET_VINYL_MATERIAL_COMPONENT,
  BATHROOM_SHOWER_ASSUMPTION_STATEMENT,
  BATHROOM_TILE_INSTALL_KEY,
  BATHROOM_TILE_MATERIAL_KEY,
  BATHROOM_TILE_WASTE_FACTOR,
  BATHROOM_VINYL_PLANK_INSTALL_COMPONENT,
  BATHROOM_VINYL_PLANK_MATERIAL_COMPONENT,
  BATHROOM_WALL_LINING_COMPONENT,
  BATHROOM_WALL_TILE_INSTALL_COMPONENT,
  BATHROOM_WALL_TILE_MATERIAL_COMPONENT,
  BATHROOM_WATERPROOFING_COMPONENT,
  BATHROOM_WATERPROOFING_INSTALL_KEY,
} from "../lib/estimate/bathroom-identities";
import {
  BATHROOM_SHOWER_DISCLOSED_AREA_M2,
  bathroomHalfHeightWallAreaM2,
  bathroomPurchaseAreaM2,
  bathroomShowerWallAreaM2,
} from "../lib/estimate/bathroom-finishes";
import {
  isMatureBathroomPath,
  parseBathroomFloorFinish,
  parseBathroomWallTileExtent,
  parseBathroomWaterproofingExtent,
} from "../lib/estimate/bathroom-scope";
import { calculateBathroom } from "../lib/estimate/calculators/bathroom";
import { calculateDeck } from "../lib/estimate/calculators/deck";
import { getCatalogueEntry } from "../lib/rates/catalogue";
import type { EstimateLineItem } from "../components/assistant/types";
import type {
  EstimateContext,
  EstimateFact,
  EstimateLineItemInput,
  EstimateWorkArea,
} from "../lib/estimate/types";
import type {
  MaterialRequirement,
  SubcontractRequirement,
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
  facts: EstimateFact[],
  qualityLevel: "standard" | "premium" = "standard"
): EstimateContext {
  return {
    project: { id: "p1", qualityLevel },
    confirmedWorkAreas: workAreas,
    facts,
    constraints: [],
    organisationSettings: {
      allow_benchmark_rates: true,
      default_margin_percent: 20,
      premium_rate_factor: 1.15,
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

function composeBathroomClarify(facts: EstimateFact[], workAreaId = "b1") {
  const workAreas = [wa(workAreaId, "bathroom", "Bathroom")];
  const plan = composeJobPlan({
    workAreas: workAreas.map((row) => ({
      id: row.id,
      type: row.type,
      name: row.name,
      status: "confirmed" as const,
    })),
    facts,
  });
  return composeClarifyView({
    stage: "quality",
    briefText: null,
    qualityLevel: "standard",
    workAreas,
    facts,
    constraints: [],
    jobPlan: plan,
  });
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
  id = "b1",
  qualityLevel: "standard" | "premium" = "standard"
): ReturnType<typeof calculateBathroom> {
  return calculateBathroom(
    ctx([wa(id, "bathroom", "Bathroom")], facts, qualityLevel),
    wa(id, "bathroom", "Bathroom")
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

const room = [
  fact("bathroom.job_scope", "b1", "full_renovation"),
  fact("bathroom.length_m", "b1", 3),
  fact("bathroom.width_m", "b1", 2.4),
  fact("bathroom.wall_height_m", "b1", 2.4),
];

console.log("=== WA-BATHROOM-04 ===\n");

console.log("--- Catalogue / identities ---\n");
check("tile material key", BATHROOM_TILE_MATERIAL_KEY === "bathroom.tile.material.m2");
check("tile install key", BATHROOM_TILE_INSTALL_KEY === "bathroom.tile.install.m2");
check(
  "WP install key distinct from mixed lump",
  BATHROOM_WATERPROOFING_INSTALL_KEY === "bathroom.waterproofing.install.m2" &&
    BATHROOM_WATERPROOFING_INSTALL_KEY !== "bathroom.waterproofing.allowance"
);
check("tile PC $65", getCatalogueEntry(BATHROOM_TILE_MATERIAL_KEY)?.defaultCostRate === 65);
check("tiler $95", getCatalogueEntry(BATHROOM_TILE_INSTALL_KEY)?.defaultCostRate === 95);
check(
  "WP $75",
  getCatalogueEntry(BATHROOM_WATERPROOFING_INSTALL_KEY)?.defaultCostRate === 75
);
check(
  "03 plywood $145 accepted without migration",
  getCatalogueEntry(BATHROOM_FLOOR_SUBSTRATE_PLYWOOD_KEY)?.defaultCostRate ===
    BATHROOM_PLYWOOD_SHEET_BENCHMARK
);
check(
  "03 fibre cement $95",
  getCatalogueEntry("sheet.fibre_cement.18mm.2400x1200.each")?.defaultCostRate ===
    BATHROOM_FIBRE_CEMENT_SHEET_BENCHMARK
);
check(
  "03 H1.2 $6.20",
  getCatalogueEntry("timber.framing.90x45.h1.2.lm")?.defaultCostRate ===
    BATHROOM_FRAMING_H12_BENCHMARK &&
    getCatalogueEntry("bathroom.framing.90x45.h1.2.lm")?.item_key ===
      "timber.framing.90x45.h1.2.lm"
);
check("tile waste 10%", near(BATHROOM_TILE_WASTE_FACTOR, 0.1));
check("purchase 7.92 from 7.2", near(bathroomPurchaseAreaM2(7.2), 7.92));
check("half-height 12.96", near(bathroomHalfHeightWallAreaM2(10.8), 12.96));
check(
  "shower disclosed 3.78",
  near(BATHROOM_SHOWER_DISCLOSED_AREA_M2, 3.78) &&
    near(
      bathroomShowerWallAreaM2({ widthM: 0.9, depthM: 0.9, wallHeightM: 2.1 }),
      3.78
    )
);
check("floor fact is bathroom.floor_finish_system", parseBathroomFloorFinish("Tile") === "tile");
check(
  "wall extent dual-read half height",
  parseBathroomWallTileExtent("Half height (1.2 m)") === "half_height"
);
check(
  "WP extent floor_and_shower",
  parseBathroomWaterproofingExtent("Floor and shower") === "floor_and_shower"
);
check(
  "legacy Floor and walls WP → floor_and_shower",
  parseBathroomWaterproofingExtent("Floor and walls") === "floor_and_shower"
);

console.log("\n--- Questions ---\n");
const finishClarify = composeBathroomClarify([
  fact("bathroom.job_scope", "b1", "full_renovation"),
  fact("bathroom.length_m", "b1", 3),
  fact("bathroom.width_m", "b1", 2.4),
  fact("bathroom.wall_height_m", "b1", 2.4),
  fact("bathroom.demolition_required", "b1", false),
]);
check(
  "unanswered floor finish keeps Details from saying enough to estimate",
  finishClarify.enoughToEstimate === false &&
    finishClarify.candidates.some((c) => c.factKey === "bathroom.floor_finish_system")
);
check(
  "Clarify asks wall tile extent",
  finishClarify.candidates.some((c) => c.factKey === "bathroom.tile_extent") ||
    finishClarify.deferred.some((c) => c.factKey === "bathroom.tile_extent")
);
check(
  "Clarify does not ask mixed tiling on mature path",
  !finishClarify.candidates.some((c) => c.factKey === "bathroom.tiling_included") &&
    !finishClarify.deferred.some((c) => c.factKey === "bathroom.tiling_included")
);
const tileFormatClarify = composeBathroomClarify([
  fact("bathroom.job_scope", "b1", "full_renovation"),
  fact("bathroom.length_m", "b1", 3),
  fact("bathroom.width_m", "b1", 2.4),
  fact("bathroom.floor_finish_system", "b1", "tile"),
  fact("bathroom.demolition_required", "b1", false),
]);
check(
  "Tile format asked only after tile selected",
  tileFormatClarify.candidates.some((c) => c.factKey === "bathroom.tile_format") ||
    tileFormatClarify.deferred.some((c) => c.factKey === "bathroom.tile_format")
);
const vinylNoTileFormat = composeBathroomClarify([
  fact("bathroom.job_scope", "b1", "full_renovation"),
  fact("bathroom.length_m", "b1", 3),
  fact("bathroom.width_m", "b1", 2.4),
  fact("bathroom.floor_finish_system", "b1", "sheet_vinyl"),
  fact("bathroom.demolition_required", "b1", false),
]);
check(
  "Sheet vinyl does not ask tile format",
  !vinylNoTileFormat.candidates.some((c) => c.factKey === "bathroom.tile_format") &&
    !vinylNoTileFormat.deferred.some((c) => c.factKey === "bathroom.tile_format")
);
const wpExtentClarify = composeBathroomClarify([
  fact("bathroom.job_scope", "b1", "full_renovation"),
  fact("bathroom.length_m", "b1", 3),
  fact("bathroom.width_m", "b1", 2.4),
  fact("bathroom.demolition_required", "b1", false),
  fact("bathroom.waterproofing_included", "b1", true),
]);
check(
  "WP extent asked after waterproofing included",
  wpExtentClarify.candidates.some(
    (c) => c.factKey === "bathroom.waterproofing_extent"
  ) ||
    wpExtentClarify.deferred.some(
      (c) => c.factKey === "bathroom.waterproofing_extent"
    )
);
const vanityClarify = composeBathroomClarify([
  fact("bathroom.job_scope", "b1", "vanity_only"),
]);
check(
  "Vanity-only does not ask floor finish or wall tile",
  !vanityClarify.candidates.some(
    (c) =>
      c.factKey === "bathroom.floor_finish_system" ||
      c.factKey === "bathroom.tile_extent"
  ) &&
    !vanityClarify.deferred.some(
      (c) =>
        c.factKey === "bathroom.floor_finish_system" ||
        c.factKey === "bathroom.tile_extent"
    )
);
check(
  "mature Job Plan hides mixed tiling toggle",
  read("lib/assistant/job-plan/adapters/bathroom.ts").includes(
    "!isMatureBathroomPath(jobScope)"
  )
);

console.log("\n--- Fixture A floor tile ---\n");
const a = bathroom([
  ...room,
  fact("bathroom.floor_finish_system", "b1", "tile"),
]);
const aMat = materials(a).find(
  (row) => row.componentKey === BATHROOM_FLOOR_TILE_MATERIAL_COMPONENT
);
const aInst = subcontracts(a).find(
  (row) => row.componentKey === BATHROOM_FLOOR_TILE_INSTALL_COMPONENT
);
check("mature path", isMatureBathroomPath("full_renovation"));
check("A net 7.2", near(aMat?.baseQuantity, 7.2));
check("A purchase 7.92", near(aMat?.purchaseQuantity, 7.92));
check("A waste once", near(aMat?.wasteFactor, 0.1));
check("A material $514.80", near(aMat?.totalCost, 514.8));
check("A tiler net 7.2 × $95 = $684", near(aInst?.totalCost, 684));
check(
  "A no wall tile",
  !materials(a).some((row) => row.componentKey === BATHROOM_WALL_TILE_MATERIAL_COMPONENT)
);
check(
  "A no mixed tiling lump",
  !a.lineItems.some((item) => /tiling allowance/i.test(item.label))
);
check(
  "A no $2200 tiling minimum",
  !a.lineItems.some((item) => (item.recommendedCost ?? 0) === 2200)
);

console.log("\n--- Fixture B full-height walls ---\n");
const b = bathroom([
  ...room,
  fact("bathroom.tile_extent", "b1", "full_height"),
]);
const bMat = materials(b).find(
  (row) => row.componentKey === BATHROOM_WALL_TILE_MATERIAL_COMPONENT
);
const bInst = subcontracts(b).find(
  (row) => row.componentKey === BATHROOM_WALL_TILE_INSTALL_COMPONENT
);
check("B net 25.92", near(bMat?.baseQuantity, 25.92));
check("B purchase 28.512", near(bMat?.purchaseQuantity, 28.512));
check("B tiler 25.92", near(bInst?.totalCost, roundMoney(25.92 * 95)));
check(
  "B openings disclosure",
  b.assumptions.some((line) => /openings are not currently deducted/i.test(line))
);

console.log("\n--- Fixture C half-height ---\n");
const c = bathroom([
  ...room,
  fact("bathroom.tile_extent", "b1", "half_height"),
]);
const cMat = materials(c).find(
  (row) => row.componentKey === BATHROOM_WALL_TILE_MATERIAL_COMPONENT
);
const cInst = subcontracts(c).find(
  (row) => row.componentKey === BATHROOM_WALL_TILE_INSTALL_COMPONENT
);
check("C net 12.96", near(cMat?.baseQuantity, 12.96));
check("C purchase 14.256", near(cMat?.purchaseQuantity, 14.256));
check("C tiler 12.96", near(cInst?.totalCost, roundMoney(12.96 * 95)));
check(
  "C does not silently use full wall height",
  !near(cMat?.baseQuantity, 25.92)
);

console.log("\n--- Fixture D shower ---\n");
const dKnown = bathroom([
  fact("bathroom.job_scope", "b1", "shower_only"),
  fact("bathroom.tile_extent", "b1", "shower_only"),
  fact("bathroom.shower.width_m", "b1", 0.9),
  fact("bathroom.shower.depth_m", "b1", 0.9),
  fact("bathroom.shower.wall_height_m", "b1", 2.1),
]);
const dMat = materials(dKnown).find(
  (row) => row.componentKey === BATHROOM_WALL_TILE_MATERIAL_COMPONENT
);
check("D known 3.78", near(dMat?.baseQuantity, 3.78));
check("D purchase 4.158", near(dMat?.purchaseQuantity, 4.158));
const dAssumed = bathroom([
  fact("bathroom.job_scope", "b1", "shower_only"),
  fact("bathroom.tile_extent", "b1", "shower_only"),
  fact("bathroom.shower.width_m", "b1", "Not sure"),
  fact("bathroom.shower.depth_m", "b1", "Not sure"),
  fact("bathroom.shower.wall_height_m", "b1", "Not sure"),
]);
const dAssumedMat = materials(dAssumed).find(
  (row) => row.componentKey === BATHROOM_WALL_TILE_MATERIAL_COMPONENT
);
check("D disclosed 3.78", near(dAssumedMat?.baseQuantity, 3.78));
check(
  "D assumption disclosed",
  dAssumed.assumptions.some((line) => line === BATHROOM_SHOWER_ASSUMPTION_STATEMENT)
);
const dMissing = bathroom([
  fact("bathroom.job_scope", "b1", "shower_only"),
  fact("bathroom.tile_extent", "b1", "shower_only"),
]);
check(
  "D unanswered shower geometry is INFO_REQUIRED",
  dMissing.missingInfo.some((line) => /shower width, depth/i.test(line)) &&
    !materials(dMissing).some(
      (row) => row.componentKey === BATHROOM_WALL_TILE_MATERIAL_COMPONENT
    )
);
check(
  "D does not proxy shower tiles to floor area",
  !near(dMat?.baseQuantity, 7.2)
);

console.log("\n--- Fixture E waterproofing ---\n");
const e = bathroom([
  ...room,
  fact("bathroom.waterproofing_included", "b1", true),
  fact("bathroom.waterproofing_extent", "b1", "floor_and_shower"),
  fact("bathroom.shower.width_m", "b1", 0.9),
  fact("bathroom.shower.depth_m", "b1", 0.9),
  fact("bathroom.shower.wall_height_m", "b1", 2.1),
]);
const eWp = subcontracts(e).find(
  (row) => row.componentKey === BATHROOM_WATERPROOFING_COMPONENT
);
const eWpLine = e.lineItems.find(
  (item) => item.componentKey === BATHROOM_WATERPROOFING_COMPONENT
);
check("E area 10.98", near(eWpLine?.quantity, 10.98));
check("E subcontract $823.50", near(eWp?.totalCost, 823.5));
check(
  "E is not tiling-area proxy",
  !e.lineItems.some((item) => /tiling area proxy/i.test(item.notes ?? ""))
);
check(
  "E no mixed WP $1200 minimum",
  !e.lineItems.some((item) => /waterproofing allowance/i.test(item.label))
);

console.log("\n--- Fixture F sheet vinyl ---\n");
const f = bathroom([
  ...room,
  fact("bathroom.floor_finish_system", "b1", "sheet_vinyl"),
]);
const fMat = materials(f).find(
  (row) => row.componentKey === BATHROOM_SHEET_VINYL_MATERIAL_COMPONENT
);
const fInst = subcontracts(f).find(
  (row) => row.componentKey === BATHROOM_SHEET_VINYL_INSTALL_COMPONENT
);
check("F purchase 7.92", near(fMat?.purchaseQuantity, 7.92));
check("F material $435.60", near(fMat?.totalCost, 435.6));
check("F install $324", near(fInst?.totalCost, 324));
check(
  "F no tile lines",
  !materials(f).some((row) => row.componentKey === BATHROOM_FLOOR_TILE_MATERIAL_COMPONENT)
);

console.log("\n--- Fixture G vinyl plank ---\n");
const g = bathroom([
  ...room,
  fact("bathroom.floor_finish_system", "b1", "vinyl_plank"),
]);
const gMat = materials(g).find(
  (row) => row.componentKey === BATHROOM_VINYL_PLANK_MATERIAL_COMPONENT
);
const gInst = subcontracts(g).find(
  (row) => row.componentKey === BATHROOM_VINYL_PLANK_INSTALL_COMPONENT
);
check("G purchase 7.92", near(gMat?.purchaseQuantity, 7.92));
check("G material $514.80", near(gMat?.totalCost, 514.8));
check("G install $360", near(gInst?.totalCost, 360));
check(
  "G specification may include plank count, not packs",
  /plank/i.test(`${gMat?.description ?? ""} ${gMat?.specification ?? ""}`) &&
    !/\bpacks?\b/i.test(gMat?.specification ?? "")
);

console.log("\n--- Floor XOR ---\n");
const xorTile = bathroom([...room, fact("bathroom.floor_finish_system", "b1", "tile")]);
const xorVinyl = bathroom([
  ...room,
  fact("bathroom.floor_finish_system", "b1", "sheet_vinyl"),
]);
check(
  "tile XOR vinyl",
  materials(xorTile).some(
    (row) => row.componentKey === BATHROOM_FLOOR_TILE_MATERIAL_COMPONENT
  ) &&
    !materials(xorTile).some(
      (row) => row.componentKey === BATHROOM_SHEET_VINYL_MATERIAL_COMPONENT
    ) &&
    materials(xorVinyl).some(
      (row) => row.componentKey === BATHROOM_SHEET_VINYL_MATERIAL_COMPONENT
    ) &&
    !materials(xorVinyl).some(
      (row) => row.componentKey === BATHROOM_FLOOR_TILE_MATERIAL_COMPONENT
    )
);
const xorPlank = bathroom([
  ...room,
  fact("bathroom.floor_finish_system", "b1", "vinyl_plank"),
]);
check(
  "vinyl plank XOR tile",
  materials(xorPlank).some(
    (row) => row.componentKey === BATHROOM_VINYL_PLANK_MATERIAL_COMPONENT
  ) &&
    !materials(xorPlank).some(
      (row) => row.componentKey === BATHROOM_FLOOR_TILE_MATERIAL_COMPONENT
    )
);

console.log("\n--- Partial scopes ---\n");
const retile = bathroom([
  fact("bathroom.job_scope", "b1", "retile_floor"),
  fact("bathroom.length_m", "b1", 3),
  fact("bathroom.width_m", "b1", 2.4),
  fact("bathroom.floor_finish_system", "b1", "tile"),
]);
check(
  "RETILE FLOOR is floor tile only",
  materials(retile).some(
    (row) => row.componentKey === BATHROOM_FLOOR_TILE_MATERIAL_COMPONENT
  ) &&
    !materials(retile).some(
      (row) => row.componentKey === BATHROOM_WALL_TILE_MATERIAL_COMPONENT
    ) &&
    !retile.missingInfo.some((line) => /wall height/i.test(line))
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
  "SHOWER ONLY tile + WP without room flooring",
  materials(showerOnly).some(
    (row) => row.componentKey === BATHROOM_WALL_TILE_MATERIAL_COMPONENT
  ) &&
    subcontracts(showerOnly).some(
      (row) => row.componentKey === BATHROOM_WATERPROOFING_COMPONENT
    ) &&
    !materials(showerOnly).some(
      (row) => row.componentKey === BATHROOM_FLOOR_TILE_MATERIAL_COMPONENT
    )
);
const vanity = bathroom([fact("bathroom.job_scope", "b1", "vanity_only")]);
check(
  "VANITY ONLY emits none of these",
  !materials(vanity).some((row) =>
    [
      BATHROOM_FLOOR_TILE_MATERIAL_COMPONENT,
      BATHROOM_WALL_TILE_MATERIAL_COMPONENT,
      BATHROOM_SHEET_VINYL_MATERIAL_COMPONENT,
    ].includes(row.componentKey as typeof BATHROOM_FLOOR_TILE_MATERIAL_COMPONENT)
  ) &&
    !subcontracts(vanity).some(
      (row) => row.componentKey === BATHROOM_WATERPROOFING_COMPONENT
    )
);
const customWall = bathroom([
  fact("bathroom.job_scope", "b1", "custom"),
  fact("bathroom.tile_extent", "b1", "custom"),
  fact("bathroom.wall_tiling_area_m2", "b1", 4.2),
]);
const customMat = materials(customWall).find(
  (row) => row.componentKey === BATHROOM_WALL_TILE_MATERIAL_COMPONENT
);
check("custom wall area 4.2 authority", near(customMat?.baseQuantity, 4.2));

console.log("\n--- Independence / finish level ---\n");
const vinylShower = bathroom([
  ...room,
  fact("bathroom.floor_finish_system", "b1", "sheet_vinyl"),
  fact("bathroom.tile_extent", "b1", "shower_only"),
  fact("bathroom.shower.width_m", "b1", 0.9),
  fact("bathroom.shower.depth_m", "b1", 0.9),
  fact("bathroom.shower.wall_height_m", "b1", 2.1),
]);
check(
  "vinyl floor + tiled shower walls",
  materials(vinylShower).some(
    (row) => row.componentKey === BATHROOM_SHEET_VINYL_MATERIAL_COMPONENT
  ) &&
    materials(vinylShower).some(
      (row) => row.componentKey === BATHROOM_WALL_TILE_MATERIAL_COMPONENT
    )
);
const premium = bathroom(
  [...room, fact("bathroom.floor_finish_system", "b1", "tile")],
  "b1",
  "premium"
);
const premMat = materials(premium).find(
  (row) => row.componentKey === BATHROOM_FLOOR_TILE_MATERIAL_COMPONENT
);
check(
  "finish level does not change tile m²",
  near(premMat?.baseQuantity, 7.2) && near(premMat?.purchaseQuantity, 7.92)
);
check(
  "Not sure floor finish does not silent-tile",
  !materials(
    bathroom([...room, fact("bathroom.floor_finish_system", "b1", "Not sure")])
  ).some((row) => row.componentKey === BATHROOM_FLOOR_TILE_MATERIAL_COMPONENT)
);

console.log("\n--- 03 coexistence ---\n");
const coexist = bathroom([
  ...room,
  fact("bathroom.floor_finish_system", "b1", "tile"),
  fact("bathroom.floor_substrate_system", "b1", "treated_plywood"),
  fact("bathroom.wall_lining_included", "b1", true),
  fact("bathroom.ceiling_lining_included", "b1", true),
  fact("bathroom.framing_level", "b1", "standard"),
]);
check(
  "tiled floor can still have plywood substrate",
  materials(coexist).some(
    (row) => row.componentKey === BATHROOM_FLOOR_SUBSTRATE_COMPONENT
  ) &&
    materials(coexist).some(
      (row) => row.componentKey === BATHROOM_FLOOR_TILE_MATERIAL_COMPONENT
    )
);
check(
  "03 wall lining still present",
  materials(coexist).some((row) => row.componentKey === BATHROOM_WALL_LINING_COMPONENT)
);

console.log("\n--- Legacy ---\n");
const legacy = bathroom([
  fact("bathroom.area_m2", "b1", 8),
  fact("bathroom.renovation_type", "b1", "Full strip-out and rebuild"),
  fact("bathroom.tiling_included", "b1", true),
]);
check("legacy without job_scope is not mature", !isMatureBathroomPath(null));
check(
  "legacy still emits mixed tiling allowance",
  legacy.lineItems.some((item) => /tiling allowance/i.test(item.label))
);
check(
  "legacy does not emit 04 identities",
  !materials(legacy).some(
    (row) => row.componentKey === BATHROOM_FLOOR_TILE_MATERIAL_COMPONENT
  )
);

console.log("\n--- Bathroom + Deck ---\n");
const deckWa = wa("d1", "deck", "Deck");
const mixedCtx = ctx(
  [wa("b1", "bathroom", "Bathroom"), deckWa],
  [
    ...room,
    fact("bathroom.floor_finish_system", "b1", "tile"),
    fact("deck.area_m2", "d1", 12),
    fact("deck.board_material", "d1", "Hardwood"),
  ]
);
const deckOnly = calculateDeck(
  ctx(
    [deckWa],
    [
      fact("deck.area_m2", "d1", 12),
      fact("deck.board_material", "d1", "Hardwood"),
    ]
  ),
  deckWa
);
const deckMixed = calculateDeck(mixedCtx, deckWa);
check(
  "Deck line-item snapshot unchanged beside Bathroom",
  JSON.stringify(deckOnly.lineItems.map((item) => [item.label, item.quantity, item.itemKey])) ===
    JSON.stringify(deckMixed.lineItems.map((item) => [item.label, item.quantity, item.itemKey]))
);
check(
  "bathroom tile keys do not appear on deck",
  !deckMixed.lineItems.some((item) => String(item.itemKey ?? "").startsWith("bathroom."))
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
  "Review shows floor finish purchase and tiler",
  /7\.92/.test(reviewText) &&
    /7\.2/.test(reviewText) &&
    /PC allowance|Tile supply/i.test(reviewText)
);
check(
  "Review rate labels include PC allowance or Quotr benchmark",
  /PC allowance|Quotr benchmark|Company rate|Rate required/.test(reviewText)
);

console.log("\n--- Migrations / production ---\n");
const migrations = numberedMigrations();
check(
  "no migration 055",
  !migrations.some((name) => name.startsWith("055_"))
);
check(
  "04 files do not mention production supabase",
  !read("lib/estimate/bathroom-finishes.ts").includes("production") &&
    !read("lib/estimate/bathroom-finishes.ts").includes("kxz")
);
check(
  "mixed tiling leftover remains in catalogue for legacy",
  getCatalogueEntry("bathroom.tiling.m2") != null
);

if (!existsSync(join(process.cwd(), "lib/estimate/bathroom-finishes.ts"))) {
  check("finishes module exists", false);
}

console.log(`\n=== WA-BATHROOM-04 Results: ${passed} passed, ${failed} failed ===`);
process.exit(failed > 0 ? 1 : 0);

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}
