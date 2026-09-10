/**
 * WA-INTERNAL-WALLS-01 — architecture / current-state gap audit.
 *
 * Run: npx --yes tsx scripts/verify-work-area-internal-walls-01.ts
 *
 * Current-state claims only. Not a mature calculator proof.
 * No paid AI. No Production. Do not create migration 055.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { getRefineAdapter } from "../lib/assistant/refine/adapters/registry";
import { getJobPlanAdapter } from "../lib/assistant/job-plan/adapters/registry";
import { FITOUT_BENCHMARKS } from "../lib/estimate/benchmark-rates";
import { calculateInternalWalls } from "../lib/estimate/calculators/fitout";
import {
  hasCalculatorConsumedFactContract,
  isCalculatorConsumedFact,
} from "../lib/estimate/consumed-facts";
import { calculateSheetCount } from "../lib/estimate/material-buildups";
import { getCatalogueEntry } from "../lib/rates/catalogue";
import { SCOPE_CATALOGUE } from "../lib/scopes/catalogue";
import { DERIVED_FACT_KEYS } from "../lib/scopes/fact-keys";
import { getScopeQuestions } from "../lib/scopes/registry";
import { resolveMaterialWastage } from "../lib/settings/material-wastage";
import { getWorkAreaSupportEntry } from "../lib/work-areas/support-contract";
import type {
  EstimateContext,
  EstimateFact,
  EstimateWorkArea,
} from "../lib/estimate/types";

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

function ctx(facts: EstimateFact[]): EstimateContext {
  return {
    project: { id: "p1", qualityLevel: "standard" },
    confirmedWorkAreas: [],
    facts,
    constraints: [],
    organisationSettings: { allow_benchmark_rates: true, default_margin_percent: 20 },
    materialWastageSettings: {
      sheetMaterialWastagePercent: 10,
      defaultMaterialWastagePercent: 10,
    },
    rates: [],
  } as unknown as EstimateContext;
}

const fitoutSrc = read("lib/estimate/calculators/fitout.ts");
const calcFn = fitoutSrc.slice(
  fitoutSrc.indexOf("export function calculateInternalWalls"),
  fitoutSrc.indexOf("export function calculateCeilings")
);
const templateSrc = read("lib/scopes/templates/internal-walls.ts");
const arch = read("docs/architecture/QUOTR_INTERNAL_WALLS_ESTIMATING_ARCHITECTURE.md");
const catalogueSrc = read("lib/rates/specific-material-catalogue.ts");
const questions = getScopeQuestions("internal_walls");
const questionKeys = questions.map((row) => row.factKey ?? row.key);

console.log("=== WA-INTERNAL-WALLS-01 ===\n");

check(
  "architecture doc exists and records 01 audit",
  arch.includes("WA-INTERNAL-WALLS-01") &&
    arch.includes("architecture / gap audit")
);

const catalogue = SCOPE_CATALOGUE.find((row) => row.type === "internal_walls");
check("catalogue type internal_walls", catalogue?.type === "internal_walls");
check("builder-facing name Internal walls", catalogue?.label === "Internal walls");
check("estimateSupport calculator (package path)", catalogue?.estimateSupport === "calculator");

const support = getWorkAreaSupportEntry("internal_walls");
check("UI band is component not supported/mature", support?.band === "component");

check(
  "legacy length template still exists",
  questionKeys.includes("internal_walls.length_lm")
);
check(
  "02 job_scope template exists",
  questionKeys.includes("internal_walls.job_scope")
);

const expectedKeys = [
  "internal_walls.length_lm",
  "internal_walls.height_m",
  "internal_walls.framing_type",
  "internal_walls.wall_lining_type",
  "internal_walls.plasterboard_type",
  "internal_walls.lining_sides",
  "internal_walls.fire_or_acoustic",
  "internal_walls.skirtings_included",
  "internal_walls.skirting_length_lm",
  "internal_walls.demolition_included",
  "internal_walls.stopping_included",
  "internal_walls.painting_included",
  "internal_walls.insulation_included",
];
for (const key of expectedKeys) {
  check(`template has ${key}`, questionKeys.includes(key));
}

check(
  "job_scope template exists",
  questionKeys.includes("internal_walls.job_scope")
);
check(
  "06 added opening facts to templates",
  questionKeys.some((key) => key === "internal_walls.opening.width_m") &&
    questionKeys.some((key) => key === "internal_walls.wall_type.has_openings")
);
check(
  "07 added finish facts to templates",
  questionKeys.includes("internal_walls.wall_type.skirting") &&
    questionKeys.includes("internal_walls.wall_type.insulation") &&
    questionKeys.includes("internal_walls.wall_type.electrical")
);
check(
  "mature templates have estimatePriorityClass on job_scope",
  questions.some((row) => row.factKey === "internal_walls.job_scope" && row.estimatePriorityClass === "P0")
);

check(
  "derived area key registered",
  DERIVED_FACT_KEYS.has("internal_walls.area_m2")
);

check(
  "02 consumed-fact contract now exists",
  hasCalculatorConsumedFactContract("internal_walls") === true
);
check(
  "length is contracted on mature path",
  isCalculatorConsumedFact("internal_walls", "internal_walls.length_lm") === true
);

check("Refine adapter registered in 02", getRefineAdapter("internal_walls") != null);
const jobPlan = getJobPlanAdapter("internal_walls");
check(
  "Job Plan has Internal Walls adapter",
  jobPlan.workAreaType === "internal_walls" &&
    read("lib/assistant/job-plan/adapters/registry.ts").includes(
      "internalWallsJobPlanAdapter"
    )
);

check(
  "calculator dispatched from calculate-estimate",
  read("lib/estimate/calculate-estimate.ts").includes("internal_walls: calculateInternalWalls")
);
check(
  "framing_type is not read by calculator",
  calcFn.includes("calculateInternalWalls") &&
    !calcFn.includes("internal_walls.framing_type")
);
check(
  "fire_or_acoustic is not read by calculator",
  !calcFn.includes("internal_walls.fire_or_acoustic")
);
check(
  "silent 20 m² default remains current-state",
  fitoutSrc.includes("assumedValue: 20") &&
    fitoutSrc.includes("Using assumed internal wall area of 20 m²")
);
check(
  "package $/m² uses FITOUT_BENCHMARKS.internalWallsPerM2",
  fitoutSrc.includes("FITOUT_BENCHMARKS.internalWallsPerM2") &&
    FITOUT_BENCHMARKS.internalWallsPerM2.cost === 95 &&
    FITOUT_BENCHMARKS.internalWallsPerM2.sell === 145
);
check(
  "lining productivity fallback 1.4 and key not in productivity table",
  calcFn.includes('productivityKey: "internal_walls.labour_hours_per_m2"') &&
    calcFn.includes("fallbackHoursPerUnit: 1.4") &&
    !read("lib/estimate/productivity.ts").includes(
      '"internal_walls.labour_hours_per_m2"'
    )
);
check("hardcoded framing 0.8 h/lm", fitoutSrc.includes("productivityHoursPerUnit: 0.8"));

const walls = wa("w1", "internal_walls", "Walls");
const empty = calculateInternalWalls(ctx([]), walls);
check("no requirement envelope on empty facts", empty.requirements == null);
check(
  "silent 20 m² prices when geometry missing",
  empty.assumptions.some((row) => /assumed internal wall area of 20/.test(row)) &&
    empty.lineItems.some(
      (row) =>
        /materials allowance/i.test(row.label) && Number(row.quantity) === 20
    )
);
check(
  "framing + lining labour always emit",
  empty.lineItems.some((row) => /framing labour/i.test(row.label)) &&
    empty.lineItems.some((row) => /lining labour/i.test(row.label))
);

const timber = calculateInternalWalls(
  ctx([
    fact("internal_walls.length_lm", "w1", 3),
    fact("internal_walls.height_m", "w1", 2.4),
    fact("internal_walls.lining_sides", "w1", "Both sides"),
    fact("internal_walls.framing_type", "w1", "Timber"),
  ]),
  walls
);
const steel = calculateInternalWalls(
  ctx([
    fact("internal_walls.length_lm", "w1", 3),
    fact("internal_walls.height_m", "w1", 2.4),
    fact("internal_walls.lining_sides", "w1", "Both sides"),
    fact("internal_walls.framing_type", "w1", "Steel stud"),
  ]),
  walls
);
const timberMat = timber.lineItems.find((row) => /materials allowance/i.test(row.label));
const steelMat = steel.lineItems.find((row) => /materials allowance/i.test(row.label));
check(
  "timber vs steel does not change package money",
  timberMat != null &&
    steelMat != null &&
    timberMat.recommendedCost === steelMat.recommendedCost &&
    Number(timberMat.quantity) === 14.4
);
check("no requirements on detailed facts either", timber.requirements == null);

const sheet = calculateSheetCount({ areaM2: 14.4, wastagePercent: 10 });
check(
  "default sheet helper is 2.4 × 1.2 = 2.88 m²",
  sheet?.sheetAreaM2 === 2.88 && sheet.totalSheetCount === 6
);

const timberRow = getCatalogueEntry("timber.framing.90x45.h1.2.lm");
const standardGib = getCatalogueEntry("sheet.plasterboard.standard.each");
const aqualine = getCatalogueEntry("sheet.plasterboard.aqualine.each");
check("shared 90×45 H1.2 identity exists", timberRow?.item_key === "timber.framing.90x45.h1.2.lm");
check(
  "standard GIB identity exists and describes 2.4 × 1.2",
  standardGib?.item_key === "sheet.plasterboard.standard.each" &&
    /2\.4\s*×\s*1\.2/.test(catalogueSrc)
);
check("Aqualine shared identity exists", aqualine?.item_key === "sheet.plasterboard.aqualine.each");
check(
  "no duplicate internal_walls.90x45 physical key",
  getCatalogueEntry("internal_walls.90x45.h1.2.lm") == null &&
    !catalogueSrc.includes("internal_walls.90x45")
);
check(
  "no internal_walls.standard_gib physical key",
  getCatalogueEntry("internal_walls.standard_gib") == null
);
check(
  "sheet_material waste fallback is 10%",
  resolveMaterialWastage(null, "sheet_material") === 10
);

check(
  "bathroom framing comments partitions belong to internal_walls",
  read("lib/estimate/bathroom-framing.ts").includes("Full new walls belong to internal_walls")
);
check(
  "ISD partitions alias to internal_walls",
  read("lib/scopes/registry.ts").includes('partitions: "internal_walls"')
);

check(
  "no Internal Walls DNA catalogue in v2 foundation",
  !read("lib/company-dna/v2-foundation.ts").includes("internal_walls") &&
    !read("lib/company-dna/catalogue.ts").includes("internal_walls")
);

const migrations = numberedMigrations();
check("no migration 055", !migrations.some((name) => name.startsWith("055_")));
check(
  "latest numbered migration is 056+",
  migrations[migrations.length - 1]?.startsWith("056_") === true
);
check(
  "architecture forbids creating 055",
  arch.includes("Do not create **055**") || arch.includes("Do not create 055")
);
check("Production DO NOT TOUCH recorded", arch.includes("DO NOT TOUCH"));
check(
  "owner decisions listed before 02",
  arch.includes("Owner decisions required BEFORE WA-INTERNAL-WALLS-02")
);

check(
  "template still asks unused fire_or_acoustic",
  templateSrc.includes("internal_walls.fire_or_acoustic")
);

console.log(`\nWA-INTERNAL-WALLS-01: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
