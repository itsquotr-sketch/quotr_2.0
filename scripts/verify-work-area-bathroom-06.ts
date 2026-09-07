/**
 * WA-BATHROOM-06 — demolition / waste / nested finishing / Review close.
 *
 * Run: npx --yes tsx scripts/verify-work-area-bathroom-06.ts
 *
 * No paid AI. No Production. No migration 055.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { composeBuilderReview } from "../lib/assistant/builder-review/compose";
import { composeClarifyView } from "../lib/assistant/clarify/compose";
import { composeJobPlan } from "../lib/assistant/job-plan/compose";
import { composeRefineView } from "../lib/assistant/refine/compose";
import {
  BATHROOM_AQUALINE_SHEET_KEY,
  BATHROOM_DEMOLITION_COMPONENTS,
  BATHROOM_DEMOLITION_PRODUCTIVITY_BENCHMARKS,
  BATHROOM_DEMOLITION_PRODUCTIVITY_KEYS,
  BATHROOM_ELECTRICAL_COMPONENT,
  BATHROOM_FIXTURE_SUPPLY_COMPONENTS,
  BATHROOM_FLOOR_SUBSTRATE_COMPONENT,
  BATHROOM_FLOOR_TILE_MATERIAL_COMPONENT,
  BATHROOM_HAZMAT_PRICING_REQUIRED,
  BATHROOM_PAINTING_BENCHMARK,
  BATHROOM_PAINTING_COMPONENT,
  BATHROOM_PAINTING_KEY,
  BATHROOM_PLUMBING_COMPONENT,
  BATHROOM_QUOTR_ALLOWANCE_LABEL,
  BATHROOM_STOPPING_BENCHMARK,
  BATHROOM_STOPPING_COMPONENT,
  BATHROOM_STOPPING_KEY,
  BATHROOM_STOPPING_UNDER_TILE_STATEMENT,
  BATHROOM_WALL_LINING_COMPONENT,
  BATHROOM_WATERPROOFING_COMPONENT,
  BATHROOM_WASTE_ALLOWANCE_KEY,
  BATHROOM_WASTE_COMPONENT,
  BATHROOM_WASTE_LEVEL_BENCHMARKS,
  BATHROOM_WASTE_LEVEL_KEYS,
} from "../lib/estimate/bathroom-identities";
import {
  bathroomDemolitionImpliedByScope,
  bathroomGeometryNeed as scopeGeometryNeed,
  parseBathroomDemolitionComponents,
} from "../lib/estimate/bathroom-scope";
import { inferBathroomWasteLevel } from "../lib/estimate/bathroom-demolition";
import {
  bathroomPaintableWallAreaM2,
  bathroomTiledWallAreaM2,
} from "../lib/estimate/bathroom-finishing";
import { resolveBathroomGeometry } from "../lib/estimate/bathroom-geometry";
import { calculateBathroom } from "../lib/estimate/calculators/bathroom";
import { calculateDeck } from "../lib/estimate/calculators/deck";
import { getCatalogueEntry } from "../lib/rates/catalogue";
import { SPECIFIC_MATERIAL_RATE_GROUPS } from "../lib/rates/specific-material-catalogue";
import type { OrganisationRate } from "../components/setup/types";
import type { EstimateLineItem } from "../components/assistant/types";
import type {
  EstimateConstraint,
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

function near(actual: number | null | undefined, expected: number, tol = 0.02): boolean {
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

function orgRate(itemKey: string, cost: number, rateType = "material"): OrganisationRate {
  return {
    id: `rate-${itemKey}`,
    rate_type: rateType,
    trade: null,
    work_area_type: null,
    item_key: itemKey,
    label: itemKey,
    unit: "each",
    cost_rate: cost,
    sell_rate: cost * 1.5,
    markup_percent: null,
    active: true,
  };
}

function ctx(
  workAreas: EstimateWorkArea[],
  facts: EstimateFact[],
  options?: {
    qualityLevel?: "standard" | "premium";
    rates?: OrganisationRate[];
    constraints?: EstimateConstraint[];
  }
): EstimateContext {
  return {
    project: { id: "p1", qualityLevel: options?.qualityLevel ?? "standard" },
    confirmedWorkAreas: workAreas,
    facts,
    constraints: options?.constraints ?? [],
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
    rates: options?.rates ?? [],
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

function bathroom(
  facts: EstimateFact[],
  options?: {
    qualityLevel?: "standard" | "premium";
    rates?: OrganisationRate[];
    constraints?: EstimateConstraint[];
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

const room = [
  fact("bathroom.length_m", "b1", 3),
  fact("bathroom.width_m", "b1", 2.4),
  fact("bathroom.wall_height_m", "b1", 2.4),
];

const stripComponents = [
  "Floor finish",
  "Wall lining",
  "Vanity",
  "Toilet",
];
const fullDemoComponents = [
  "Floor finish",
  "Wall lining",
  "Ceiling lining",
  "Vanity",
  "Toilet",
  "Shower / enclosure",
];

console.log("\n--- Identities / catalogue ---\n");
check(
  "floor finish removal identity",
  BATHROOM_DEMOLITION_COMPONENTS.floor_finish === "bathroom.demolition.floor_finish"
);
check(
  "waste requirement identity",
  BATHROOM_WASTE_COMPONENT === "bathroom.waste.disposal"
);
check("stopping requirement identity", BATHROOM_STOPPING_COMPONENT === "bathroom.stopping");
check("painting requirement identity", BATHROOM_PAINTING_COMPONENT === "bathroom.painting");
check(
  "floor productivity 0.25 h/m²",
  BATHROOM_DEMOLITION_PRODUCTIVITY_BENCHMARKS.floor_finish === 0.25 &&
    getCatalogueEntry(BATHROOM_DEMOLITION_PRODUCTIVITY_KEYS.floor_finish)?.defaultCostRate ===
      0.25
);
check(
  "wall lining productivity 0.20 h/m²",
  BATHROOM_DEMOLITION_PRODUCTIVITY_BENCHMARKS.wall_lining === 0.2
);
check(
  "ceiling productivity 0.25 h/m²",
  BATHROOM_DEMOLITION_PRODUCTIVITY_BENCHMARKS.ceiling === 0.25
);
check("vanity removal 1.0 h", BATHROOM_DEMOLITION_PRODUCTIVITY_BENCHMARKS.vanity === 1);
check("toilet removal 0.75 h", BATHROOM_DEMOLITION_PRODUCTIVITY_BENCHMARKS.toilet === 0.75);
check("shower removal 1.5 h", BATHROOM_DEMOLITION_PRODUCTIVITY_BENCHMARKS.shower === 1.5);
check("bath removal 1.5 h", BATHROOM_DEMOLITION_PRODUCTIVITY_BENCHMARKS.bath === 1.5);
check("generic fixture 0.75 h", BATHROOM_DEMOLITION_PRODUCTIVITY_BENCHMARKS.fixture === 0.75);
check("waste minor $350", BATHROOM_WASTE_LEVEL_BENCHMARKS.minor === 350);
check("waste standard $650", BATHROOM_WASTE_LEVEL_BENCHMARKS.standard === 650);
check("waste major $1000", BATHROOM_WASTE_LEVEL_BENCHMARKS.major === 1000);
check(
  "catalogue waste standard $650",
  getCatalogueEntry(BATHROOM_WASTE_LEVEL_KEYS.standard)?.defaultCostRate === 650
);
check("stopping $28/m²", BATHROOM_STOPPING_BENCHMARK === 28);
check(
  "catalogue stopping $28",
  getCatalogueEntry(BATHROOM_STOPPING_KEY)?.defaultCostRate === 28
);
check("painting $30/m²", BATHROOM_PAINTING_BENCHMARK === 30);
check(
  "catalogue painting $30",
  getCatalogueEntry(BATHROOM_PAINTING_KEY)?.defaultCostRate === 30
);
const materialGroupKeys = SPECIFIC_MATERIAL_RATE_GROUPS.flatMap((group) =>
  group.entries.map((entry) => entry.item_key)
);
check(
  "waste/stopping/painting are not Materials-page physical rows",
  !materialGroupKeys.includes(BATHROOM_WASTE_ALLOWANCE_KEY) &&
    !materialGroupKeys.includes(BATHROOM_STOPPING_KEY) &&
    !materialGroupKeys.includes(BATHROOM_PAINTING_KEY)
);
check(
  "no bathroom-specific paint tin / GIB duplicate",
  !materialGroupKeys.includes("bathroom.painting.m2") &&
    !materialGroupKeys.some((key) => key === "bathroom.aqualine")
);
check(
  "strip_out_only implies demolition",
  bathroomDemolitionImpliedByScope("strip_out_only") === true
);
check(
  "full_renovation does not imply demolition",
  bathroomDemolitionImpliedByScope("full_renovation") === false
);
check(
  "waste inference strip fixture 31 is standard",
  inferBathroomWasteLevel(["floor_finish", "wall_lining", "vanity", "toilet"]) ===
    "standard"
);
check(
  "waste inference full-reno demo is major",
  inferBathroomWasteLevel([
    "floor_finish",
    "wall_lining",
    "ceiling",
    "vanity",
    "toilet",
    "shower",
  ]) === "major"
);
check(
  "strip_out_only + wall lining labels need full geometry",
  scopeGeometryNeed("strip_out_only", {
    demolitionComponents: ["Floor finish", "Wall lining"],
  }) === "full"
);
check(
  "vanity_only stays none without demo/finish flags",
  scopeGeometryNeed("vanity_only") === "none"
);

console.log("\n--- 31 strip_out_only ---\n");
const stripFacts = [
  fact("bathroom.job_scope", "b1", "strip_out_only"),
  ...room,
  fact("bathroom.demolition.components", "b1", stripComponents),
];
const strip = bathroom(stripFacts);
const stripFloor = labour(strip).find(
  (row) => row.componentKey === BATHROOM_DEMOLITION_COMPONENTS.floor_finish
);
const stripWall = labour(strip).find(
  (row) => row.componentKey === BATHROOM_DEMOLITION_COMPONENTS.wall_lining
);
const stripVanity = labour(strip).find(
  (row) => row.componentKey === BATHROOM_DEMOLITION_COMPONENTS.vanity
);
const stripToilet = labour(strip).find(
  (row) => row.componentKey === BATHROOM_DEMOLITION_COMPONENTS.toilet
);
const stripWaste = waste(strip).find((row) => row.componentKey === BATHROOM_WASTE_COMPONENT);
check("31 floor 7.2 m² → 1.8 h", near(stripFloor?.adjustedHours, 1.8));
check("31 wall 25.92 m² → 5.184 h", near(stripWall?.adjustedHours, 5.184));
check("31 vanity 1.0 h", near(stripVanity?.adjustedHours, 1));
check("31 toilet 0.75 h", near(stripToilet?.adjustedHours, 0.75));
check("31 waste $650", near(stripWaste?.totalCost, 650));
check(
  "31 no generic demolition package",
  !strip.lineItems.some((item) =>
    /demolition_hours_allowance|generic bathroom demolition/i.test(
      `${item.itemKey ?? ""} ${item.label}`
    )
  ) &&
    !labour(strip).some((row) => row.componentKey === "bathroom.demolition")
);
check(
  "31 no new substrate / lining / tile / WP / fixture / trades",
  !materials(strip).some((row) => row.componentKey === BATHROOM_FLOOR_SUBSTRATE_COMPONENT) &&
    !materials(strip).some((row) => row.componentKey === BATHROOM_WALL_LINING_COMPONENT) &&
    !materials(strip).some((row) => row.itemKey === BATHROOM_AQUALINE_SHEET_KEY) &&
    !materials(strip).some((row) => row.componentKey === BATHROOM_FLOOR_TILE_MATERIAL_COMPONENT) &&
    !subcontracts(strip).some((row) => row.componentKey === BATHROOM_WATERPROOFING_COMPONENT) &&
    !materials(strip).some((row) =>
      Object.values(BATHROOM_FIXTURE_SUPPLY_COMPONENTS).includes(
        row.componentKey as (typeof BATHROOM_FIXTURE_SUPPLY_COMPONENTS)[keyof typeof BATHROOM_FIXTURE_SUPPLY_COMPONENTS]
      )
    ) &&
    !subcontracts(strip).some((row) => row.componentKey === BATHROOM_PLUMBING_COMPONENT) &&
    !subcontracts(strip).some((row) => row.componentKey === BATHROOM_ELECTRICAL_COMPONENT)
);
check(
  "31 demolition labour is priced and visible",
  Boolean(stripFloor?.priced) &&
    strip.lineItems.some((item) => item.componentKey === BATHROOM_DEMOLITION_COMPONENTS.floor_finish)
);

console.log("\n--- Demolition selected only / vanity-only ---\n");
const vanityOnly = bathroom([fact("bathroom.job_scope", "b1", "vanity_only")]);
check(
  "vanity-only has no demolition or waste unless selected",
  !labour(vanityOnly).some((row) =>
    String(row.componentKey).startsWith("bathroom.demolition.")
  ) && waste(vanityOnly).length === 0
);
const vanityDemoOff = bathroom([
  fact("bathroom.job_scope", "b1", "vanity_only"),
  fact("bathroom.demolition_required", "b1", false),
  fact("bathroom.demolition.components", "b1", stripComponents),
]);
check(
  "explicit demolition false suppresses implied-off vanity path",
  !labour(vanityDemoOff).some((row) =>
    String(row.componentKey).startsWith("bathroom.demolition.")
  )
);
const vanityDemoOn = bathroom([
  fact("bathroom.job_scope", "b1", "vanity_only"),
  ...room,
  fact("bathroom.demolition_required", "b1", true),
  fact("bathroom.demolition.components", "b1", ["Floor finish"]),
]);
check(
  "vanity-only demolition only when selected",
  near(
    labour(vanityDemoOn).find(
      (row) => row.componentKey === BATHROOM_DEMOLITION_COMPONENTS.floor_finish
    )?.adjustedHours,
    1.8
  ) && near(waste(vanityDemoOn)[0]?.totalCost, 350)
);

console.log("\n--- 32 full-reno demo ---\n");
const fullDemoFacts = [
  fact("bathroom.job_scope", "b1", "full_renovation"),
  ...room,
  fact("bathroom.demolition_required", "b1", true),
  fact("bathroom.demolition.components", "b1", fullDemoComponents),
  fact("bathroom.plumbing.level", "b1", "none"),
  fact("bathroom.electrical.level", "b1", "none"),
];
const fullDemo = bathroom(fullDemoFacts);
const demoKeys = labour(fullDemo)
  .filter((row) => String(row.componentKey).startsWith("bathroom.demolition."))
  .map((row) => row.componentKey);
check(
  "32 no duplicate removal lines",
  new Set(demoKeys).size === demoKeys.length &&
    demoKeys.includes(BATHROOM_DEMOLITION_COMPONENTS.floor_finish) &&
    demoKeys.includes(BATHROOM_DEMOLITION_COMPONENTS.wall_lining) &&
    demoKeys.includes(BATHROOM_DEMOLITION_COMPONENTS.ceiling) &&
    demoKeys.includes(BATHROOM_DEMOLITION_COMPONENTS.vanity) &&
    demoKeys.includes(BATHROOM_DEMOLITION_COMPONENTS.toilet) &&
    demoKeys.includes(BATHROOM_DEMOLITION_COMPONENTS.shower) &&
    !demoKeys.includes(BATHROOM_DEMOLITION_COMPONENTS.fixture)
);
check(
  "32 ceiling 7.2 m² → 1.8 h",
  near(
    labour(fullDemo).find(
      (row) => row.componentKey === BATHROOM_DEMOLITION_COMPONENTS.ceiling
    )?.adjustedHours,
    1.8
  )
);
check(
  "32 shower 1.5 h",
  near(
    labour(fullDemo).find(
      (row) => row.componentKey === BATHROOM_DEMOLITION_COMPONENTS.shower
    )?.adjustedHours,
    1.5
  )
);
check("32 waste $1000", near(waste(fullDemo)[0]?.totalCost, 1000));
check(
  "32 no 10h legacy lump on mature path",
  !fullDemo.lineItems.some((item) => item.itemKey === "bathroom.demolition_hours_allowance")
);

console.log("\n--- 33/34 paint XOR ---\n");
const paintHalfFacts = [
  fact("bathroom.job_scope", "b1", "full_renovation"),
  ...room,
  fact("bathroom.tile_extent", "b1", "half_height"),
  fact("bathroom.painting_included", "b1", true),
  fact("bathroom.plumbing.level", "b1", "none"),
  fact("bathroom.electrical.level", "b1", "none"),
];
const paintHalf = bathroom(paintHalfFacts);
const paintHalfGeo = resolveBathroomGeometry({
  facts: paintHalfFacts as never,
  workAreaId: "b1",
});
check("33 gross wall 25.92", near(paintHalfGeo.grossWallAreaM2, 25.92));
check(
  "33 tiled wall 12.96",
  near(
    bathroomTiledWallAreaM2({
      context: ctx([wa("b1", "bathroom", "Bathroom")], paintHalfFacts),
      workAreaId: "b1",
      geometry: paintHalfGeo,
    }),
    12.96
  )
);
check(
  "33 paintable wall 12.96",
  near(
    bathroomPaintableWallAreaM2({
      context: ctx([wa("b1", "bathroom", "Bathroom")], paintHalfFacts),
      workAreaId: "b1",
      geometry: paintHalfGeo,
    }),
    12.96
  )
);
const paintHalfReq = subcontracts(paintHalf).find(
  (row) => row.componentKey === BATHROOM_PAINTING_COMPONENT
);
check(
  "33 painting area 20.16 (walls 12.96 + ceiling 7.2)",
  near(paintHalf.lineItems.find((item) => item.componentKey === BATHROOM_PAINTING_COMPONENT)?.quantity, 20.16)
);
check(
  "33 painting cost 20.16 × $30",
  near(paintHalfReq?.totalCost, 20.16 * 30)
);

const paintFullFacts = [
  fact("bathroom.job_scope", "b1", "full_renovation"),
  ...room,
  fact("bathroom.tile_extent", "b1", "full_height"),
  fact("bathroom.painting_included", "b1", true),
  fact("bathroom.plumbing.level", "b1", "none"),
  fact("bathroom.electrical.level", "b1", "none"),
];
const paintFull = bathroom(paintFullFacts);
const paintFullLine = paintFull.lineItems.find(
  (item) => item.componentKey === BATHROOM_PAINTING_COMPONENT
);
check(
  "34 painted wall 0; ceiling 7.2 still paints",
  near(paintFullLine?.quantity, 7.2) &&
    /walls 0\.0 m²/i.test(paintFullLine?.identitySummary ?? "")
);
check(
  "34 painting $216",
  near(
    subcontracts(paintFull).find((row) => row.componentKey === BATHROOM_PAINTING_COMPONENT)
      ?.totalCost,
    7.2 * 30
  )
);
check(
  "paint not on by default",
  !subcontracts(
    bathroom([
      fact("bathroom.job_scope", "b1", "full_renovation"),
      ...room,
      fact("bathroom.plumbing.level", "b1", "none"),
      fact("bathroom.electrical.level", "b1", "none"),
    ])
  ).some((row) => row.componentKey === BATHROOM_PAINTING_COMPONENT)
);

console.log("\n--- 35 stopping ---\n");
const stoppingFacts = [
  fact("bathroom.job_scope", "b1", "full_renovation"),
  ...room,
  fact("bathroom.wall_lining_included", "b1", true),
  fact("bathroom.ceiling_lining_included", "b1", true),
  fact("bathroom.wall_lining_system", "b1", "aqualine"),
  fact("bathroom.tile_extent", "b1", "full_height"),
  fact("bathroom.stopping_included", "b1", true),
  fact("bathroom.plumbing.level", "b1", "none"),
  fact("bathroom.electrical.level", "b1", "none"),
];
const stopping = bathroom(stoppingFacts);
const stoppingLine = stopping.lineItems.find(
  (item) => item.componentKey === BATHROOM_STOPPING_COMPONENT
);
check("35 stopping area 33.12 m²", near(stoppingLine?.quantity, 33.12));
check("35 stopping $28/m² → $927.36", near(stoppingLine?.recommendedCost, 33.12 * 28));
check(
  "35 tiles not deducted from stopping",
  stopping.assumptions.some((row) => row.includes("tiled area is not deducted")) &&
    BATHROOM_STOPPING_UNDER_TILE_STATEMENT.includes("not deducted")
);
check(
  "no stopping without lining",
  !subcontracts(
    bathroom([
      fact("bathroom.job_scope", "b1", "full_renovation"),
      ...room,
      fact("bathroom.wall_lining_included", "b1", false),
      fact("bathroom.ceiling_lining_included", "b1", false),
      fact("bathroom.stopping_included", "b1", true),
      fact("bathroom.plumbing.level", "b1", "none"),
      fact("bathroom.electrical.level", "b1", "none"),
    ])
  ).some((row) => row.componentKey === BATHROOM_STOPPING_COMPONENT)
);

console.log("\n--- Overlap / conditions / hazmat ---\n");
const sibling = bathroom(stripFacts, {
  extras: [wa("d1", "demolition", "Demolition")],
});
check(
  "sibling Demolition WA still emits Bathroom strip-out + assumption",
  labour(sibling).some(
    (row) => row.componentKey === BATHROOM_DEMOLITION_COMPONENTS.floor_finish
  ) &&
    sibling.assumptions.some((row) => /standalone Demolition Work Area is present/i.test(row))
);
const paintingSibling = bathroom(paintHalfFacts, {
  extras: [wa("p1", "painting", "Painting")],
});
check(
  "sibling Painting WA suppresses nested bathroom paint",
  !subcontracts(paintingSibling).some((row) => row.componentKey === BATHROOM_PAINTING_COMPONENT)
);
const plasterSibling = bathroom(stoppingFacts, {
  extras: [wa("pl1", "plastering", "Plastering")],
});
check(
  "sibling Plastering WA suppresses nested stopping",
  !subcontracts(plasterSibling).some((row) => row.componentKey === BATHROOM_STOPPING_COMPONENT)
);
const occupied = bathroom(stripFacts, {
  constraints: [{ key: "occupied_site", label: "Occupied site", value: "yes" }],
});
check(
  "occupied site increases demolition hours",
  (labour(occupied).find(
    (row) => row.componentKey === BATHROOM_DEMOLITION_COMPONENTS.floor_finish
  )?.adjustedHours ?? 0) > 1.8 + 0.01
);
const premium = bathroom(stripFacts, { qualityLevel: "premium" });
check(
  "finish level does not multiply demolition hours",
  near(
    labour(premium).find(
      (row) => row.componentKey === BATHROOM_DEMOLITION_COMPONENTS.floor_finish
    )?.adjustedHours,
    1.8
  )
);
const hazmat = bathroom(stripFacts, {
  constraints: [
    { key: "hazardous_materials_risk", label: "Hazmat", value: "suspected" },
  ],
});
check(
  "hazmat does not price ordinary demolition",
  labour(hazmat)
    .filter((row) => String(row.componentKey).startsWith("bathroom.demolition."))
    .every((row) => row.priced === false && row.totalCost == null) &&
    waste(hazmat).every((row) => row.priced === false) &&
    hazmat.missingInfo.some((row) => row.includes(BATHROOM_HAZMAT_PRICING_REQUIRED))
);
check(
  "company waste lump overrides derived allowance",
  near(
    waste(
      bathroom(stripFacts, {
        rates: [orgRate(BATHROOM_WASTE_ALLOWANCE_KEY, 800, "allowance")],
      })
    )[0]?.totalCost,
    800
  )
);

console.log("\n--- 03/04/05 coexistence ---\n");
const coexist = bathroom([
  fact("bathroom.job_scope", "b1", "full_renovation"),
  ...room,
  fact("bathroom.demolition_required", "b1", true),
  fact("bathroom.demolition.components", "b1", ["Floor finish"]),
  fact("bathroom.floor_finish_system", "b1", "tile"),
  fact("bathroom.wall_lining_included", "b1", true),
  fact("bathroom.wall_lining_system", "b1", "aqualine"),
  fact("bathroom.fixtures_included", "b1", ["Vanity"]),
  fact("bathroom.plumbing.level", "b1", "minor"),
  fact("bathroom.electrical.level", "b1", "none"),
  fact("bathroom.stopping_included", "b1", true),
]);
check(
  "04 tile still present with 06 demo",
  materials(coexist).some((row) => row.componentKey === BATHROOM_FLOOR_TILE_MATERIAL_COMPONENT)
);
check(
  "03 lining still present with 06 demo",
  materials(coexist).some((row) => row.componentKey === BATHROOM_WALL_LINING_COMPONENT)
);
check(
  "05 vanity still present with 06 demo",
  materials(coexist).some((row) => row.componentKey === BATHROOM_FIXTURE_SUPPLY_COMPONENTS.vanity)
);
check(
  "06 floor removal still present with 03/04/05",
  labour(coexist).some(
    (row) => row.componentKey === BATHROOM_DEMOLITION_COMPONENTS.floor_finish
  )
);

console.log("\n--- Legacy ---\n");
const legacy = calculateBathroom(
  ctx(
    [wa("b1", "bathroom", "Bathroom")],
    [
      fact("bathroom.area_m2", "b1", 6),
      fact("bathroom.demolition_required", "b1", true),
    ]
  ),
  wa("b1", "bathroom", "Bathroom")
);
check(
  "legacy no-job_scope still uses demolition hours allowance",
  legacy.lineItems.some((item) => /demolition/i.test(item.label)) &&
    !labour(legacy).some(
      (row) => row.componentKey === BATHROOM_DEMOLITION_COMPONENTS.floor_finish
    )
);

console.log("\n--- Deck isolation ---\n");
const deckWa = wa("dk1", "deck", "Deck");
const mixedCtx = ctx(
  [wa("b1", "bathroom", "Bathroom"), deckWa],
  [
    ...stripFacts,
    fact("deck.area_m2", "dk1", 12),
    fact("deck.board_material", "dk1", "Hardwood"),
  ]
);
const deckOnly = calculateDeck(
  ctx(
    [deckWa],
    [fact("deck.area_m2", "dk1", 12), fact("deck.board_material", "dk1", "Hardwood")]
  ),
  deckWa
);
const deckMixed = calculateDeck(mixedCtx, deckWa);
check(
  "Deck line-item snapshot unchanged beside Bathroom 06",
  JSON.stringify(deckOnly.lineItems.map((item) => [item.label, item.quantity, item.itemKey])) ===
    JSON.stringify(deckMixed.lineItems.map((item) => [item.label, item.quantity, item.itemKey]))
);

console.log("\n--- Review polish ---\n");
const reviewFacts = [
  fact("bathroom.job_scope", "b1", "full_renovation"),
  ...room,
  fact("bathroom.demolition_required", "b1", true),
  fact("bathroom.demolition.components", "b1", fullDemoComponents),
  fact("bathroom.fixtures_included", "b1", ["Vanity", "Toilet", "Mirror/cabinet"]),
  fact("bathroom.plumbing.level", "b1", "standard"),
  fact("bathroom.electrical.level", "b1", "standard"),
  fact("bathroom.plumbing.scope_text", "b1", "Relocate WC approximately 600 mm."),
  fact("bathroom.electrical.scope_text", "b1", "Install four downlights and extract fan."),
  fact("bathroom.stopping_included", "b1", true),
  fact("bathroom.painting_included", "b1", true),
  fact("bathroom.wall_lining_included", "b1", true),
  fact("bathroom.ceiling_lining_included", "b1", true),
  fact("bathroom.wall_lining_system", "b1", "aqualine"),
];
const reviewed = bathroom(reviewFacts);
const review = reviewOf(reviewed);
const reviewText = JSON.stringify(review);
const vanitySupply = reviewed.lineItems.find(
  (item) => item.componentKey === BATHROOM_FIXTURE_SUPPLY_COMPONENTS.vanity
);
const toiletSupply = reviewed.lineItems.find(
  (item) => item.componentKey === BATHROOM_FIXTURE_SUPPLY_COMPONENTS.toilet
);
const mirrorSupply = reviewed.lineItems.find(
  (item) => item.componentKey === BATHROOM_FIXTURE_SUPPLY_COMPONENTS.mirror
);
check(
  "fixture pairing names each PC",
  /Vanity — PC allowance \$1200/.test(vanitySupply?.identitySummary ?? "") &&
    /Toilet — PC allowance \$650/.test(toiletSupply?.identitySummary ?? "") &&
    /Mirror — PC allowance \$350/.test(mirrorSupply?.identitySummary ?? "")
);
const plumbingLine = reviewed.lineItems.find(
  (item) => item.componentKey === BATHROOM_PLUMBING_COMPONENT
);
const electricalLine = reviewed.lineItems.find(
  (item) => item.componentKey === BATHROOM_ELECTRICAL_COMPONENT
);
check(
  "plumbing Quotr allowance wording",
  /Quotr allowance: \$4400/.test(plumbingLine?.identitySummary ?? "") &&
    plumbingLine?.rateSource === BATHROOM_QUOTR_ALLOWANCE_LABEL &&
    !/quoted subcontract/i.test(plumbingLine?.identitySummary ?? "")
);
check(
  "electrical Quotr allowance wording",
  /Quotr allowance:/i.test(electricalLine?.identitySummary ?? "") &&
    electricalLine?.rateSource === BATHROOM_QUOTR_ALLOWANCE_LABEL
);
check("Review Demolition group", /"label":"Demolition"/.test(reviewText));
check("Review Waste / disposal group", /"label":"Waste \/ disposal"/.test(reviewText));
check("Review Finishing group", /"label":"Finishing"/.test(reviewText));
check("Review Plumbing group", /"label":"Plumbing"/.test(reviewText));
check("Review Electrical group", /"label":"Electrical"/.test(reviewText));
check(
  "PC allowance line does not also chip Quotr benchmark",
  !review.workAreas.some((area) =>
    area.categories.some((cat) =>
      [...cat.lines, ...cat.lineGroups.flatMap((group) => group.children)].some(
        (line) =>
          line.rateLabel === "PC allowance" &&
          /quotr benchmark/i.test(`${line.supporting ?? ""} ${line.specification ?? ""}`)
      )
    )
  )
);
check(
  "no Request Pricing CTA",
  !read("lib/estimate/bathroom-trades.ts").includes("Request Pricing") &&
    !read("lib/assistant/builder-review/compose.ts").includes("Request Pricing")
);

console.log("\n--- Questions / Refine ---\n");
const stripClarify = composeBathroomClarify([
  fact("bathroom.job_scope", "b1", "strip_out_only"),
]);
const stripClarifyKeys = [
  ...stripClarify.candidates.map((c) => c.factKey),
  ...stripClarify.deferred.map((c) => c.factKey),
];
check(
  "strip_out_only hides demolition_required",
  !stripClarify.candidates.some((c) => c.factKey === "bathroom.demolition_required")
);
check(
  "strip_out_only asks demolition components when missing",
  stripClarifyKeys.includes("bathroom.demolition.components") ||
    stripClarify.candidates.some((c) => c.factKey === "bathroom.demolition.components")
);
check(
  "waste.level not asked in Quick Estimate",
  !stripClarify.candidates.some((c) => c.factKey === "bathroom.waste.level")
);
check(
  "stopping/painting not front-loaded",
  !stripClarify.candidates.some(
    (c) =>
      c.factKey === "bathroom.stopping_included" ||
      c.factKey === "bathroom.painting_included"
  )
);
const refine = composeRefineView({
  briefText: null,
  workAreas: [{ id: "b1", type: "bathroom", name: "Bathroom", status: "confirmed" }],
  facts: [
    fact("bathroom.job_scope", "b1", "full_renovation"),
    ...room,
    fact("bathroom.demolition_required", "b1", true),
  ],
  constraints: [],
  jobPlan: composeJobPlan({
    workAreas: [{ id: "b1", type: "bathroom", name: "Bathroom", status: "confirmed" }],
    facts: [
      fact("bathroom.job_scope", "b1", "full_renovation"),
      ...room,
      fact("bathroom.demolition_required", "b1", true),
    ],
  }),
});
const refineKeys = [...refine.highValue, ...refine.advanced].map((row) => row.factKey);
check("Refine asks demolition components", refineKeys.includes("bathroom.demolition.components"));
check("Refine can select stopping", refineKeys.includes("bathroom.stopping_included"));
check("Refine can select painting", refineKeys.includes("bathroom.painting_included"));

console.log("\n--- Files / migrations ---\n");
check(
  "no migration 055",
  !numberedMigrations().some((name) => name.startsWith("055_"))
);
check(
  "06 modules exist",
  existsSync(join(process.cwd(), "lib/estimate/bathroom-demolition.ts")) &&
    existsSync(join(process.cwd(), "lib/estimate/bathroom-finishing.ts"))
);
check(
  "06 files do not mention production supabase",
  !read("lib/estimate/bathroom-demolition.ts").includes("kxz") &&
    !read("lib/estimate/bathroom-finishing.ts").includes("kxz")
);
check(
  "parse demolition component labels",
  parseBathroomDemolitionComponents({
    facts: [
      {
        key: "bathroom.demolition.components",
        work_area_id: "b1",
        value: ["Floor finish", "Wall lining"],
      },
    ],
    workAreaId: "b1",
  }).join(",") === "floor_finish,wall_lining"
);

if (failed > 0) {
  console.log(`\nWA-BATHROOM-06 verifier: ${passed} passed, ${failed} failed`);
  process.exit(1);
}
console.log(`\nWA-BATHROOM-06 verifier: ${passed} passed, ${failed} failed`);
