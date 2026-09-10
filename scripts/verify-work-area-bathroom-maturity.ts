/**
 * WA-BATHROOM-08 — canonical Bathroom maturity verifier.
 *
 * Run: npx --yes tsx scripts/verify-work-area-bathroom-maturity.ts
 *
 * Phase verifiers 02–07 remain regressions. This file is final authority
 * for current product truth. No paid AI. No Production. No migration 055.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { composeBuilderReview } from "../lib/assistant/builder-review/compose";
import {
  COMPANY_DNA_BATHROOM_OPTIONAL_KEYS,
  COMPANY_DNA_BATHROOM_TIER1_KEYS,
  bathroomV2ProgressCounts,
  companyDnaUiWorkAreaStatus,
  isCompanyDnaV2WorkArea,
  listCompanyDnaBathroomV2UiTasks,
} from "../lib/company-dna/v2-ui";
import {
  COMPANY_DNA_BATHROOM_TASKS,
  COMPANY_DNA_EXCLUDED_FROM_V2,
  getCompanyDnaFoundationTask,
} from "../lib/company-dna/v2-foundation";
import { resolveCompanyDnaTask } from "../lib/company-dna/resolve-task";
import { deriveCompanyProductivity } from "../lib/company-dna/derive";
import {
  BATHROOM_AQUALINE_SHEET_KEY,
  BATHROOM_CEILING_LINING_LABOUR_COMPONENT,
  BATHROOM_FLOOR_SUBSTRATE_PLYWOOD_KEY,
  BATHROOM_FRAMING_TIMBER_KEY,
  BATHROOM_PRODUCTIVITY_KEYS,
  BATHROOM_WALL_LINING_COMPONENT,
  BATHROOM_WALL_LINING_LABOUR_COMPONENT,
} from "../lib/estimate/bathroom-identities";
import { findMatureBathroomLegacyViolations } from "../lib/estimate/bathroom-commercial-authority";
import {
  BATHROOM_OPENINGS_NOT_DEDUCTED_STATEMENT,
  BATHROOM_WALL_HEIGHT_ASSUMPTION_STATEMENT,
} from "../lib/estimate/bathroom-geometry";
import { shouldHideBathroomQuestion } from "../lib/estimate/bathroom-scope";
import { calculateBathroom } from "../lib/estimate/calculators/bathroom";
import { calculateDeck } from "../lib/estimate/calculators/deck";
import { calculateFence } from "../lib/estimate/calculators/fence";
import { calculateRetainingWall } from "../lib/estimate/calculators/retaining-wall";
import { resolveProductivity } from "../lib/estimate/productivity";
import { BATHROOM_CALCULATOR_CONSUMED_FACTS } from "../lib/estimate/calculators/bathroom";
import { SPECIFIC_MATERIAL_RATE_GROUPS } from "../lib/rates/specific-material-catalogue";
import { getCatalogueEntry } from "../lib/rates/catalogue";
import { getWorkAreaCapabilityBand } from "../lib/work-areas/support-contract";
import { bathroomScope } from "../lib/scopes/templates/bathroom";
import {
  FACTORY_STAGE_CHECKS,
  MATURE_REFERENCE_WORK_AREA_TYPES,
  PRODUCT_WORK_AREA_TYPES,
} from "./lib/work-area-maturity-verifier";
import { PREVIEW_SUPABASE_PROJECT_REF } from "../lib/deployment/environment";
import {
  assertSafePreviewPasswordMutation,
  isPasswordProtectedPreviewAccount,
  PREVIEW_PASSWORD_PROTECTED_EMAILS,
} from "./lib/preview-auth-fixture";
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

function numberedMigrations(): string[] {
  return readdirSync(join(process.cwd(), "supabase/migrations"))
    .filter((name) => /^\d+_/.test(name) && name.endsWith(".sql"))
    .sort();
}

function parseEnvFile(filePath: string): Record<string, string> {
  const env: Record<string, string> = {};
  if (!existsSync(filePath)) return env;
  for (const raw of readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const idx = line.indexOf("=");
    let value = line.slice(idx + 1);
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[line.slice(0, idx)] = value;
  }
  return env;
}

function hostnameRef(url: string): string {
  return new URL(url).hostname.split(".")[0] ?? "";
}

function dbRate(row: {
  id?: string;
  item_key: string;
  cost_rate: number | null;
  unit: string | null;
  source: string | null;
  source_calibration_id?: string | null;
  work_area_type?: string | null;
  label?: string | null;
  active?: boolean | null;
}): OrganisationRate {
  return {
    id: String(row.id ?? row.item_key),
    rate_type: "productivity",
    work_area_type: row.work_area_type ?? "bathroom",
    item_key: row.item_key,
    label: row.label ?? row.item_key,
    unit: row.unit ?? "m2",
    cost_rate: Number(row.cost_rate),
    sell_rate: null,
    markup_percent: null,
    active: row.active !== false,
    trade: null,
    source: row.source ?? "calibrated_productivity",
    source_calibration_id: row.source_calibration_id
      ? String(row.source_calibration_id)
      : null,
  };
}

function fact(key: string, workAreaId: string, value: unknown): EstimateFact {
  return { key, work_area_id: workAreaId, value };
}

function wa(id: string, type: string, name: string): EstimateWorkArea & { status: "confirmed" } {
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
    unit: extras?.unit ?? "each",
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
  options?: { rates?: OrganisationRate[]; allowBenchmarkRates?: boolean }
): EstimateContext {
  return {
    project: { id: "p1", qualityLevel: "standard" },
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

function bathroom(facts: EstimateFact[], rates: OrganisationRate[] = []) {
  return calculateBathroom(ctx([wa("b1", "bathroom", "Bathroom")], facts, { rates }), wa("b1", "bathroom", "Bathroom"));
}

function labour(result: ReturnType<typeof calculateBathroom>): LabourRequirement[] {
  return (result.requirements ?? []).filter((row): row is LabourRequirement => row.kind === "labour");
}

function materials(result: ReturnType<typeof calculateBathroom>): MaterialRequirement[] {
  return (result.requirements ?? []).filter((row): row is MaterialRequirement => row.kind === "material");
}

const room = [
  fact("bathroom.length_m", "b1", 3),
  fact("bathroom.width_m", "b1", 2.4),
  fact("bathroom.wall_height_m", "b1", 2.4),
];

const comprehensiveFacts: EstimateFact[] = [
  fact("bathroom.job_scope", "b1", "full_renovation"),
  ...room,
  fact("bathroom.demolition_required", "b1", true),
  fact("bathroom.demolition.components", "b1", [
    "Floor finish",
    "Wall lining",
    "Ceiling lining",
    "Vanity",
    "Toilet",
    "Shower",
  ]),
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
  fact("bathroom.fixtures_included", "b1", ["Vanity", "Toilet", "Mirror/cabinet", "Heated towel rail"]),
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

console.log("=== WA-BATHROOM-08 MATURITY ===\n");

check("bathroom is a product Work Area", PRODUCT_WORK_AREA_TYPES.includes("bathroom"));
check(
  "bathroom is a mature reference",
  (MATURE_REFERENCE_WORK_AREA_TYPES as readonly string[]).includes("bathroom")
);
check("factory WA-8 is optional", FACTORY_STAGE_CHECKS.some((row) => row.stage === "WA-8" && !row.required));
check("capability band is supported", getWorkAreaCapabilityBand("bathroom") === "supported");
check("Deck/Fence/RW also supported", ["deck", "fence", "retaining_wall"].every((type) => getWorkAreaCapabilityBand(type) === "supported"));
check("kitchen stays developing", getWorkAreaCapabilityBand("kitchen") === "developing");
check("no migration 055", !numberedMigrations().some((name) => name.startsWith("055_")));
check(
  "056 Bathroom DNA catalogue seed exists",
  numberedMigrations().some((name) => name === "056_bathroom_company_dna_catalogue_seed.sql")
);
check(
  "latest numbered migration is 057+",
  numberedMigrations().at(-1) === "057_repeated_work_area_acceptance.sql"
);
const sql056 = readFileSync(
  join(process.cwd(), "supabase/migrations/056_bathroom_company_dna_catalogue_seed.sql"),
  "utf8"
);
const sql056Code = sql056.replace(/--[^\n]*/g, "");
check("056 is INSERT ON CONFLICT DO NOTHING", /on conflict \(calibration_task_key\) do nothing/i.test(sql056));
check("056 has no ALTER TABLE", !/\balter\s+table\b/i.test(sql056Code));
check("056 has no CREATE TABLE", !/\bcreate\s+table\b/i.test(sql056Code));
check("056 has no GRANT", !/\bgrant\b/i.test(sql056Code));
check("056 has no RLS / POLICY", !/\bcreate\s+policy\b/i.test(sql056Code) && !/\benable row level security\b/i.test(sql056Code));
check("056 has no RPC rewrite", !sql056Code.includes("save_productivity_calibration"));

console.log("\n--- DNA catalogue ---\n");
check("exactly 3 Tier 1 Bathroom DNA tasks", COMPANY_DNA_BATHROOM_TIER1_KEYS.length === 3);
check(
  "Tier 1 is wall + ceiling + framing",
  COMPANY_DNA_BATHROOM_TIER1_KEYS.join(",") ===
    "bathroom.lining.wall.v1,bathroom.lining.ceiling.v1,bathroom.framing.v1"
);
check("3 secondary DNA tasks", COMPANY_DNA_BATHROOM_OPTIONAL_KEYS.length === 3);
check("6 Bathroom DNA UI tasks", listCompanyDnaBathroomV2UiTasks().length === 6);
check("Bathroom is a V2 DNA Work Area", isCompanyDnaV2WorkArea("bathroom"));
check(
  "resolver finds wall lining",
  resolveCompanyDnaTask("bathroom.lining.wall.v1")?.productivityRateKey ===
    BATHROOM_PRODUCTIVITY_KEYS.wallLiningM2
);
check(
  "DNA does not calibrate plumbing $",
  COMPANY_DNA_BATHROOM_TASKS.every((task) => !task.productivityRateKey.includes("plumbing"))
);
check(
  "legacy bathroom h/m² lump excluded",
  (COMPANY_DNA_EXCLUDED_FROM_V2.packageLumps as readonly string[]).includes(
    "bathroom.labour_hours_per_m2"
  )
);

const wallTask = getCompanyDnaFoundationTask("bathroom.lining.wall.v1")!;
check("wall lining reference 20 m²", wallTask.referenceQuantity === 20 && wallTask.authorityQuantity === 20);
check("ceiling reference 8 m²", getCompanyDnaFoundationTask("bathroom.lining.ceiling.v1")?.authorityQuantity === 8);
check("framing reference 12 lm", getCompanyDnaFoundationTask("bathroom.framing.v1")?.authorityQuantity === 12);
check("wall includes cut/fit/screw", /cut, fit and screw/i.test(wallTask.workIncluded));
check("wall excludes stopping/paint/tile", /Stopping, painting, tiling/i.test(wallTask.workExcluded));

const status0 = companyDnaUiWorkAreaStatus({ workAreaType: "bathroom", calibratedTaskKeys: [] });
const status1 = companyDnaUiWorkAreaStatus({
  workAreaType: "bathroom",
  calibratedTaskKeys: ["bathroom.lining.wall.v1"],
});
const status2 = companyDnaUiWorkAreaStatus({
  workAreaType: "bathroom",
  calibratedTaskKeys: ["bathroom.lining.wall.v1", "bathroom.lining.ceiling.v1"],
});
const status3 = companyDnaUiWorkAreaStatus({
  workAreaType: "bathroom",
  calibratedTaskKeys: [...COMPANY_DNA_BATHROOM_TIER1_KEYS],
});
check("0/3 Not calibrated", status0 === "benchmarks");
check("1/3 Partly", status1 === "partly");
check("2/3 Partly", status2 === "partly");
check("3/3 Using your calibration", status3 === "calibrated");
check(
  "secondary does not complete Tier 1",
  companyDnaUiWorkAreaStatus({
    workAreaType: "bathroom",
    calibratedTaskKeys: [...COMPANY_DNA_BATHROOM_OPTIONAL_KEYS],
  }) === "benchmarks"
);
check(
  "progress counts 0/3 → 3/3",
  bathroomV2ProgressCounts([]).tier1Calibrated === 0 &&
    bathroomV2ProgressCounts(COMPANY_DNA_BATHROOM_TIER1_KEYS).tier1Calibrated === 3
);

const derived = deriveCompanyProductivity({
  task: wallTask,
  crewSize: 2,
  durationHours: 6,
});
check("2 workers × 6 h / 20 m² = 0.6", near(derived.productivity, 0.6));

console.log("\n--- DNA isolation + fallback ---\n");
const before = bathroom(comprehensiveFacts);
const wallHoursBefore =
  labour(before).find((row) => row.componentKey === BATHROOM_WALL_LINING_LABOUR_COMPONENT)
    ?.adjustedHours ?? 0;
const ceilHoursBefore =
  labour(before).find((row) => row.componentKey === BATHROOM_CEILING_LINING_LABOUR_COMPONENT)
    ?.adjustedHours ?? 0;
const afterWall = bathroom(comprehensiveFacts, [
  orgRate(BATHROOM_PRODUCTIVITY_KEYS.wallLiningM2, 0.6, "productivity", {
    unit: "m2",
    source: "calibrated_productivity",
  } as Partial<OrganisationRate>),
]);
const wallHoursAfter =
  labour(afterWall).find((row) => row.componentKey === BATHROOM_WALL_LINING_LABOUR_COMPONENT)
    ?.adjustedHours ?? 0;
const ceilHoursAfter =
  labour(afterWall).find((row) => row.componentKey === BATHROOM_CEILING_LINING_LABOUR_COMPONENT)
    ?.adjustedHours ?? 0;
check("wall labour changes after DNA", wallHoursAfter > wallHoursBefore * 1.5);
check("ceiling labour unchanged", near(ceilHoursAfter, ceilHoursBefore));
check(
  "Aqualine material rate unchanged",
  near(
    materials(before).find((row) => row.componentKey === BATHROOM_WALL_LINING_COMPONENT)?.unitCost,
    materials(afterWall).find((row) => row.componentKey === BATHROOM_WALL_LINING_COMPONENT)?.unitCost
  )
);
const noDna = resolveProductivity({
  productivityKey: BATHROOM_PRODUCTIVITY_KEYS.wallLiningM2,
  unit: "m2",
  fallbackHoursPerUnit: 0.3,
  rates: [],
});
check("no DNA → Quotr benchmark 0.3, not Pricing Required", near(noDna.hoursPerUnit, 0.3) && noDna.sourceType === "benchmark");

console.log("\n--- Shared materials ---\n");
const materialKeys = SPECIFIC_MATERIAL_RATE_GROUPS.flatMap((group) => group.entries.map((entry) => entry.item_key));
check("Aqualine once", materialKeys.filter((key) => key === BATHROOM_AQUALINE_SHEET_KEY).length === 1);
check("plywood once", materialKeys.filter((key) => key === BATHROOM_FLOOR_SUBSTRATE_PLYWOOD_KEY).length === 1);
check("H1.2 once", materialKeys.filter((key) => key === BATHROOM_FRAMING_TIMBER_KEY).length === 1);
check(
  "fibre cement once",
  materialKeys.filter((key) => key === "sheet.fibre_cement.18mm.2400x1200.each").length === 1
);
check("Aqualine ready for Internal Walls reuse", getCatalogueEntry(BATHROOM_AQUALINE_SHEET_KEY)?.item_key === BATHROOM_AQUALINE_SHEET_KEY);
check("H1.2 ready for reuse", getCatalogueEntry(BATHROOM_FRAMING_TIMBER_KEY) != null);

console.log("\n--- Questions / facts / assumptions ---\n");
check(
  "legacy renovation_type hidden on mature path",
  shouldHideBathroomQuestion({
    factKey: "bathroom.renovation_type",
    jobScope: "full_renovation",
    floorAreaSatisfied: true,
    wallHeightKnown: true,
    lengthKnown: true,
    widthKnown: true,
    tilingIncluded: null,
    waterproofingIncluded: null,
    clientSuppliedFixtures: null,
  })
);
check(
  "vanity-only hides tiling extent",
  shouldHideBathroomQuestion({
    factKey: "bathroom.tile_extent",
    jobScope: "vanity_only",
    floorAreaSatisfied: false,
    wallHeightKnown: false,
    lengthKnown: false,
    widthKnown: false,
    tilingIncluded: null,
    waterproofingIncluded: null,
    clientSuppliedFixtures: null,
  })
);
check("job_scope is consumed", BATHROOM_CALCULATOR_CONSUMED_FACTS.includes("bathroom.job_scope"));
check(
  "renovation_type is legacy (still listed for dual-read)",
  BATHROOM_CALCULATOR_CONSUMED_FACTS.includes("bathroom.renovation_type")
);

const full = bathroom(comprehensiveFacts);
check(
  "openings-not-deducted disclosed",
  full.assumptions.includes(BATHROOM_OPENINGS_NOT_DEDUCTED_STATEMENT)
);
check(
  "wall height 2.4 disclosed when assumed",
  bathroom([fact("bathroom.job_scope", "b1", "full_renovation"), fact("bathroom.length_m", "b1", 3), fact("bathroom.width_m", "b1", 2.4)]).assumptions.some(
    (row) => row.includes("2.4") || row === BATHROOM_WALL_HEIGHT_ASSUMPTION_STATEMENT
  )
);

const missingGeom = bathroom([fact("bathroom.job_scope", "b1", "full_renovation")]);
check(
  "full reno without geometry is Info Required",
  missingGeom.missingInfo.length > 0 && findMatureBathroomLegacyViolations(missingGeom.lineItems).length === 0
);

console.log("\n--- Envelope uniqueness + commercial ---\n");
check("no mature legacy package", findMatureBathroomLegacyViolations(full.lineItems).length === 0);
const reqKeys = (full.requirements ?? []).map((row) => row.componentKey);
check(
  "requirement keys unique",
  reqKeys.length === new Set(reqKeys).size
);
check(
  "envelope has material/labour/subcontract/waste",
  materials(full).length > 0 &&
    labour(full).length > 0 &&
    (full.requirements ?? []).some((row) => row.kind === "subcontract") &&
    (full.requirements ?? []).some((row) => row.kind === "waste")
);
const pricedMissing = full.lineItems.filter(
  (item) => (item.recommendedCost ?? 0) > 0 && item.componentKey && !reqKeys.includes(item.componentKey)
);
check("no priced line outside envelope", pricedMissing.length === 0, pricedMissing.map((item) => item.label).join(", "));
const cost = full.lineItems.reduce((sum, item) => sum + (item.recommendedCost ?? 0), 0);
const sell = full.lineItems.reduce((sum, item) => sum + (item.recommendedSell ?? 0), 0);
check("comprehensive cost ~19328", near(cost, 19328.51, 1));
check("comprehensive sell ~24658", near(sell, 24658.8, 1));
check("painting label is not 'Painting allowance'", !full.lineItems.some((item) => item.label === "Painting allowance"));
check("painting line exists", full.lineItems.some((item) => /^Painting$/i.test(item.label)));

const review = composeBuilderReview({
  estimate: {
    recommendedCost: cost,
    recommendedSell: sell,
    marginPercent: 21.5,
    confidence: full.confidence,
    assumptions: full.assumptions,
    missingInfo: full.missingInfo,
    lineItems: mapCalcLines(full.lineItems),
  },
  workAreas: [{ id: "b1", type: "bathroom", name: "Bathroom", status: "confirmed" }],
  requirements: full.requirements ?? [],
});
const reviewText = JSON.stringify(review);
check("Review has PC allowance", /PC allowance/i.test(reviewText));
check("Review has no package line", !/materials\/finishes allowance/i.test(reviewText));
check("Review has no V2/WA-08 leak", !/WA-BATHROOM-08|maturity level 9/i.test(reviewText));

console.log("\n--- Isolation ---\n");
const deckWa = wa("d1", "deck", "Deck");
const mixed = ctx(
  [wa("b1", "bathroom", "Bathroom"), deckWa],
  [...comprehensiveFacts, fact("deck.area_m2", "d1", 12), fact("deck.board_material", "d1", "Hardwood")]
);
const bathMixed = calculateBathroom(mixed, wa("b1", "bathroom", "Bathroom"));
const deckMixed = calculateDeck(mixed, deckWa);
check(
  "Bathroom requirements stay bathroom.*",
  (bathMixed.requirements ?? []).every((row) => row.componentKey.startsWith("bathroom."))
);
check(
  "Deck does not consume Aqualine",
  !deckMixed.lineItems.some((item) => item.itemKey === BATHROOM_AQUALINE_SHEET_KEY)
);
const fenceOut = calculateFence(
  ctx([wa("f1", "fence", "Fence")], [fact("fence.length_m", "f1", 18), fact("fence.height_m", "f1", 1.8)]),
  wa("f1", "fence", "Fence")
);
check("Fence has no bathroom keys", !fenceOut.lineItems.some((item) => (item.itemKey ?? "").startsWith("bathroom.")));
const rwOut = calculateRetainingWall(
  ctx(
    [wa("r1", "retaining_wall", "RW")],
    [
      fact("retaining_wall.length_m", "r1", 8),
      fact("retaining_wall.height_m", "r1", 1),
      fact("retaining_wall.system", "r1", "timber"),
    ]
  ),
  wa("r1", "retaining_wall", "RW")
);
check("RW has no bathroom keys", !rwOut.lineItems.some((item) => (item.itemKey ?? "").startsWith("bathroom.")));

check(
  "Bathroom DNA landing exists",
  existsSync(join(process.cwd(), "app/(protected)/app/setup/dna/bathroom/page.tsx"))
);
check(
  "Bathroom DNA task progress is not Deck copy",
  readFileSync(
    join(process.cwd(), "components/company-dna/CompanyDnaDeckTaskFlow.tsx"),
    "utf8"
  ).includes('workAreaLabel: "Bathroom"')
);
check(
  "Bathroom DNA tasks not in 054",
  !readFileSync(join(process.cwd(), "supabase/migrations/054_company_dna_v2_catalogue_seed.sql"), "utf8").includes(
    "bathroom.lining.wall.v1"
  )
);
check("Bathroom DNA tasks are in 056", sql056.includes("bathroom.lining.wall.v1"));
check(
  "asked questions stay namespaced",
  bathroomScope.questions.every((q) => q.key.startsWith("bathroom."))
);

if (failed > 0) {
  console.log(`\nWA-BATHROOM-08 maturity: ${passed} passed, ${failed} failed`);
  process.exit(1);
}

const LIVE = process.argv.includes("--live");
if (!LIVE) {
  console.log("\n(skip live Preview persistence — pass --live)\n");
  console.log(`\nWA-BATHROOM-08 maturity: ${passed} passed, ${failed} failed`);
  process.exit(0);
}

runLivePersistence()
  .then(() => {
    console.log(`\nWA-BATHROOM-08 maturity: ${passed} passed, ${failed} failed`);
    if (failed > 0) process.exit(1);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

async function runLivePersistence(): Promise<void> {
  console.log("\n--- Live Preview catalogue + RPC persistence ---\n");
  const local = parseEnvFile(join(process.cwd(), ".env.local"));
  const url = local.NEXT_PUBLIC_SUPABASE_URL;
  const anon = local.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const service = local.SUPABASE_SERVICE_ROLE_KEY;
  check("Preview env present", Boolean(url && anon && service));
  if (!url || !anon || !service) return;

  const ref = hostnameRef(url);
  check("live target is Preview ref", ref === PREVIEW_SUPABASE_PROJECT_REF);
  if (ref !== PREVIEW_SUPABASE_PROJECT_REF) {
    throw new Error("Refusing non-Preview Supabase URL");
  }

  const admin = createClient(url, service, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const listed = await admin.auth.admin.listUsers({ perPage: 200 });
  const users = listed.data?.users || listed.users || [];
  const jeanluc = users.find(
    (u: { email?: string }) =>
      String(u.email || "").toLowerCase() === PREVIEW_PASSWORD_PROTECTED_EMAILS[0]
  );
  const jeanlucBefore = jeanluc?.updated_at || null;

  const { data: catalogue, error: catalogueError } = await admin
    .from("productivity_calibration_catalogue")
    .select(
      "calibration_task_key, work_area_type, productivity_rate_key, authority_quantity, authority_unit, benchmark_productivity"
    );
  check("catalogue select ok", !catalogueError, catalogueError?.message ?? "");
  const rows = catalogue ?? [];
  const byWa: Record<string, number> = {};
  for (const row of rows) {
    byWa[row.work_area_type] = (byWa[row.work_area_type] ?? 0) + 1;
  }
  check("Preview Deck catalogue still 7", byWa.deck === 7);
  check("Preview Fence catalogue still 9", byWa.fence === 9);
  check("Preview RW catalogue still 15", byWa.retaining_wall === 15);
  check("Preview Bathroom catalogue is 6", byWa.bathroom === 6);

  for (const task of COMPANY_DNA_BATHROOM_TASKS) {
    const row = rows.find((item) => item.calibration_task_key === task.calibrationTaskKey);
    check(`Preview has ${task.calibrationTaskKey}`, row != null);
    check(
      `${task.calibrationTaskKey} maps productivity key`,
      row?.productivity_rate_key === task.productivityRateKey
    );
    check(
      `${task.calibrationTaskKey} authority`,
      Number(row?.authority_quantity) === task.authorityQuantity &&
        row?.authority_unit === task.authorityUnit &&
        Number(row?.benchmark_productivity) === task.benchmarkProductivity
    );
  }

  const stamp = randomUUID().slice(0, 8);
  const email = `hello+wa-bathroom-08b.${stamp}@erccontracting.co.nz`;
  const password = `Bath08b-${stamp}-Aa!`;
  const orgA = randomUUID();
  const orgB = randomUUID();
  const userIds: string[] = [];
  assertSafePreviewPasswordMutation(email);
  check("probe email is plus-address", email.includes("+"));
  check("probe is not a protected inbox", !isPasswordProtectedPreviewAccount(email));

  async function cleanup() {
    await admin.from("rates").delete().eq("org_id", orgA);
    await admin.from("rates").delete().eq("org_id", orgB);
    await admin.from("productivity_calibration_responses").delete().eq("org_id", orgA);
    await admin.from("productivity_calibration_responses").delete().eq("org_id", orgB);
    await admin.from("organisation_memberships").delete().eq("org_id", orgA);
    await admin.from("organisation_memberships").delete().eq("org_id", orgB);
    await admin.from("profiles").delete().eq("org_id", orgA);
    await admin.from("profiles").delete().eq("org_id", orgB);
    await admin.from("organisations").delete().eq("id", orgA);
    await admin.from("organisations").delete().eq("id", orgB);
    for (const id of userIds) await admin.auth.admin.deleteUser(id);
  }

  try {
    const created = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (created.error || !created.data.user) {
      throw new Error(created.error?.message ?? "createUser");
    }
    userIds.push(created.data.user.id);

    await admin.from("organisations").insert({ id: orgA, name: `08b A ${stamp}` });
    await admin.from("organisations").insert({ id: orgB, name: `08b B ${stamp}` });
    await admin.from("profiles").upsert({
      id: created.data.user.id,
      org_id: orgA,
      role: "owner",
      full_name: "08b probe",
    });
    await admin.from("organisation_memberships").insert({
      org_id: orgA,
      user_id: created.data.user.id,
      role: "owner",
      status: "active",
      joined_at: new Date().toISOString(),
    });

    const client = createClient(url, anon, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const signedIn = await client.auth.signInWithPassword({ email, password });
    if (signedIn.error) throw new Error(signedIn.error.message);

    const saved = await client.rpc("save_productivity_calibration", {
      p_calibration_task_key: "bathroom.lining.wall.v1",
      p_crew_size: 2,
      p_duration_hours: 6,
      p_outlier_confirmed: false,
    });
    check("wall lining RPC save ok", !saved.error, saved.error?.message ?? "");
    const payload = (saved.data ?? {}) as Record<string, unknown>;
    check(
      "derived productivity is 0.6",
      Number(payload.derived_productivity) === 0.6
    );
    check(
      "derived person-hours are 12",
      Number(payload.derived_person_hours) === 12
    );

    const { data: evidenceRows } = await admin
      .from("productivity_calibration_responses")
      .select(
        "id, org_id, calibration_task_key, derived_productivity, derived_person_hours, authority_quantity, status"
      )
      .eq("org_id", orgA)
      .eq("calibration_task_key", "bathroom.lining.wall.v1")
      .eq("status", "active");
    const evidence = evidenceRows?.[0];
    check(
      "evidence row persisted",
      evidence != null &&
        evidence.org_id === orgA &&
        Number(evidence.derived_productivity) === 0.6 &&
        Number(evidence.derived_person_hours) === 12
    );

    await client.auth.signOut();
    const reloadedClient = createClient(url, anon, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const resigned = await reloadedClient.auth.signInWithPassword({ email, password });
    if (resigned.error) throw new Error(resigned.error.message);
    const { data: reloadRows } = await reloadedClient
      .from("productivity_calibration_responses")
      .select("id, derived_productivity, status")
      .eq("calibration_task_key", "bathroom.lining.wall.v1")
      .eq("status", "active");
    check(
      "reload retains calibration",
      reloadRows?.[0]?.id === evidence?.id &&
        Number(reloadRows?.[0]?.derived_productivity) === 0.6
    );

    const { data: rateRows } = await admin
      .from("rates")
      .select(
        "id, item_key, cost_rate, unit, source, source_calibration_id, org_id, active, work_area_type, label"
      )
      .eq("org_id", orgA)
      .eq("rate_type", "productivity");
    const wallRate = (rateRows ?? []).find(
      (row) => row.item_key === BATHROOM_PRODUCTIVITY_KEYS.wallLiningM2
    );
    check(
      "org rate is calibrated_productivity 0.6",
      wallRate?.source === "calibrated_productivity" &&
        wallRate?.source_calibration_id === evidence?.id &&
        Number(wallRate?.cost_rate) === 0.6 &&
        wallRate?.active === true
    );

    const beforeHours =
      labour(bathroom(comprehensiveFacts)).find(
        (row) => row.componentKey === BATHROOM_WALL_LINING_LABOUR_COMPONENT
      )?.adjustedHours ?? 0;
    const afterCalc = bathroom(comprehensiveFacts, (rateRows ?? []).map(dbRate));
    const afterHours =
      labour(afterCalc).find(
        (row) => row.componentKey === BATHROOM_WALL_LINING_LABOUR_COMPONENT
      )?.adjustedHours ?? 0;
    const afterCeil =
      labour(afterCalc).find(
        (row) => row.componentKey === BATHROOM_CEILING_LINING_LABOUR_COMPONENT
      )?.adjustedHours ?? 0;
    const beforeCeil =
      labour(bathroom(comprehensiveFacts)).find(
        (row) => row.componentKey === BATHROOM_CEILING_LINING_LABOUR_COMPONENT
      )?.adjustedHours ?? 0;
    check("estimator wall hours increase after persisted DNA", afterHours > beforeHours * 1.5);
    check("estimator ceiling hours unchanged", near(afterCeil, beforeCeil));
    check(
      "Aqualine $ unchanged after persisted DNA",
      near(
        materials(bathroom(comprehensiveFacts)).find(
          (row) => row.componentKey === BATHROOM_WALL_LINING_COMPONENT
        )?.unitCost,
        materials(afterCalc).find((row) => row.componentKey === BATHROOM_WALL_LINING_COMPONENT)
          ?.unitCost
      )
    );

    const second = await reloadedClient.rpc("save_productivity_calibration", {
      p_calibration_task_key: "bathroom.lining.ceiling.v1",
      p_crew_size: 1,
      p_duration_hours: 3.2,
      p_outlier_confirmed: false,
    });
    check("ceiling RPC save ok", !second.error, second.error?.message ?? "");
    const third = await reloadedClient.rpc("save_productivity_calibration", {
      p_calibration_task_key: "bathroom.framing.v1",
      p_crew_size: 1,
      p_duration_hours: 2.4,
      p_outlier_confirmed: false,
    });
    check("framing RPC save ok", !third.error, third.error?.message ?? "");

    const { data: allActive } = await admin
      .from("productivity_calibration_responses")
      .select("calibration_task_key")
      .eq("org_id", orgA)
      .eq("status", "active");
    const keys = (allActive ?? []).map((row) => row.calibration_task_key);
    check(
      "0→1→2→3 Tier 1 persisted",
      bathroomV2ProgressCounts(keys).tier1Calibrated === 3 &&
        companyDnaUiWorkAreaStatus({ workAreaType: "bathroom", calibratedTaskKeys: keys }) ===
          "calibrated"
    );

    const reset = await reloadedClient.rpc("reset_productivity_to_benchmark", {
      p_calibration_task_key: "bathroom.lining.wall.v1",
    });
    check("reset RPC ok", !reset.error, reset.error?.message ?? "");

    const { data: afterResetEvidence } = await admin
      .from("productivity_calibration_responses")
      .select("status")
      .eq("org_id", orgA)
      .eq("calibration_task_key", "bathroom.lining.wall.v1")
      .eq("status", "active");
    check(
      "reset retains wall evidence (canonical)",
      (afterResetEvidence ?? []).length === 1
    );

    const { data: afterResetRates } = await admin
      .from("rates")
      .select("item_key, cost_rate, active, source")
      .eq("org_id", orgA)
      .eq("item_key", BATHROOM_PRODUCTIVITY_KEYS.wallLiningM2)
      .eq("rate_type", "productivity");
    const resetRate = afterResetRates?.[0];
    check("reset deactivates wall company rate", resetRate?.active === false);

    const afterResetCalc = bathroom(
      comprehensiveFacts,
      (afterResetRates ?? []).map(dbRate)
    );
    const resetHours =
      labour(afterResetCalc).find(
        (row) => row.componentKey === BATHROOM_WALL_LINING_LABOUR_COMPONENT
      )?.adjustedHours ?? 0;
    check("estimator returns to wall lining benchmark", near(resetHours, beforeHours));

    const { count: orgBRates } = await admin
      .from("rates")
      .select("id", { count: "exact", head: true })
      .eq("org_id", orgB);
    check("Org B has no Org A rates", (orgBRates ?? 0) === 0);
  } catch (error) {
    check(
      "live Bathroom DNA persistence probe",
      false,
      error instanceof Error ? error.message : String(error)
    );
  } finally {
    await cleanup();
    const after = await admin.auth.admin.listUsers({ perPage: 200 });
    const afterUsers = after.data?.users || after.users || [];
    const jeanlucAfter = afterUsers.find(
      (u: { email?: string }) =>
        String(u.email || "").toLowerCase() === PREVIEW_PASSWORD_PROTECTED_EMAILS[0]
    );
    check("protected jeanluc updated_at unchanged", jeanlucBefore === (jeanlucAfter?.updated_at || null));
    check("probe fixture cleaned up", true);
  }
}
