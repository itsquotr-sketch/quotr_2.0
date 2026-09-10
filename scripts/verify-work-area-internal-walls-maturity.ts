/**
 * Internal Walls maturity — IW-01 → IW-08 contract.
 *
 * Direct assertions. Does not spawn prior verifiers.
 * Run: npx --yes tsx scripts/verify-work-area-internal-walls-maturity.ts
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { calculateInternalWalls } from "../lib/estimate/calculators/fitout";
import {
  INTERNAL_WALLS_JOB_SCOPE_FACT_KEY,
  INTERNAL_WALLS_STRUCTURAL_FACT_KEY,
  isMatureInternalWallsPath,
} from "../lib/estimate/internal-walls-scope";
import {
  INTERNAL_WALLS_ADD_WALL_TYPE_KEY,
  INTERNAL_WALLS_STRUCTURAL_SPECIALIST_MESSAGE,
  applyInternalWallsFactWrite,
  resolveInternalWallsWallTypes,
} from "../lib/estimate/internal-walls-wall-types";
import { INTERNAL_WALLS_HAS_OPENINGS_KEY } from "../lib/estimate/internal-walls-openings";
import {
  INTERNAL_WALLS_CORNICE_SIDES_KEY,
  INTERNAL_WALLS_ELECTRICAL_KEY,
  INTERNAL_WALLS_INSULATION_INCLUDED_KEY,
  INTERNAL_WALLS_INSULATION_TYPE_KEY,
  INTERNAL_WALLS_PAINTING_SIDES_KEY,
  INTERNAL_WALLS_SKIRTING_SIDES_KEY,
  INTERNAL_WALLS_STOPPING_SIDE_A_KEY,
  INTERNAL_WALLS_STOPPING_SIDE_B_KEY,
} from "../lib/estimate/internal-walls-finish";
import {
  INTERNAL_WALLS_FRAMING_90_MATERIAL_COMPONENT,
  INTERNAL_WALLS_PAINTING_COMPONENT,
  INTERNAL_WALLS_STOPPING_COMPONENT,
  looksLikeDoorProductMoney,
} from "../lib/estimate/internal-walls-identities";
import { internalWallsStudCount } from "../lib/estimate/internal-walls-framing";
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

function near(actual: number | null | undefined, expected: number, tol = 1e-6): boolean {
  return actual != null && Number.isFinite(actual) && Math.abs(actual - expected) <= tol;
}

function read(rel: string): string {
  return readFileSync(join(process.cwd(), rel), "utf8");
}

function fact(key: string, workAreaId: string, value: unknown): EstimateFact {
  return { key, work_area_id: workAreaId, value };
}

function ctx(facts: EstimateFact[]): EstimateContext {
  return {
    project: { id: "p1", qualityLevel: "standard" },
    confirmedWorkAreas: [
      { id: "w1", type: "internal_walls", name: "Internal walls", sort_order: 1 },
    ],
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

function write(writes: Array<{ key: string; value: unknown; openingId?: string }>): EstimateFact[] {
  let facts: EstimateFact[] = [];
  for (const row of writes) {
    facts = applyInternalWallsFactWrite({
      facts,
      workAreaId: "w1",
      key: row.key,
      value: row.value,
      openingId: row.openingId,
    });
  }
  return facts;
}

const walls: EstimateWorkArea = {
  id: "w1",
  type: "internal_walls",
  name: "Internal walls",
  sort_order: 1,
};

console.log("=== Internal Walls maturity (IW-01 → IW-08) ===\n");

check(
  "legacy 20 m² fallback only on immature calculator",
  read("lib/estimate/calculators/fitout.ts").includes("isMatureInternalWallsPath") &&
    read("lib/estimate/calculators/fitout.ts").includes("Using assumed area of 20 m²")
);
check(
  "legacy package still gated off mature path",
  read("lib/estimate/calculators/fitout.ts").includes("isMatureInternalWallsPath")
);

let facts = write([
  { key: INTERNAL_WALLS_ADD_WALL_TYPE_KEY, value: true },
  { key: "internal_walls.wall_type.frame_system", value: "Timber framing" },
  { key: "internal_walls.wall_type.frame_size", value: "90 mm timber framing — 90×45" },
  { key: "internal_walls.wall_type.length_lm", value: 12 },
  { key: "internal_walls.wall_type.height_m", value: 2.4 },
  { key: "internal_walls.wall_type.stud_centres_mm", value: "600 mm" },
  { key: "internal_walls.wall_type.side_a_product", value: "Standard GIB" },
  { key: "internal_walls.wall_type.same_lining_both_sides", value: true },
  { key: INTERNAL_WALLS_HAS_OPENINGS_KEY, value: "Yes" },
]);
const type = resolveInternalWallsWallTypes({ facts, workAreaId: "w1" }).types[0]!;
facts = applyInternalWallsFactWrite({
  facts,
  workAreaId: "w1",
  key: "internal_walls.opening.width_m",
  value: 0.81,
  wallTypeId: type.id,
  openingId: type.openings[0]!.id,
});
facts = applyInternalWallsFactWrite({
  facts,
  workAreaId: "w1",
  key: "internal_walls.opening.height_m",
  value: 1.98,
  wallTypeId: type.id,
  openingId: type.openings[0]!.id,
});
for (const row of [
  { key: INTERNAL_WALLS_INSULATION_INCLUDED_KEY, value: "Yes" },
  { key: INTERNAL_WALLS_INSULATION_TYPE_KEY, value: "Acoustic" },
  { key: INTERNAL_WALLS_SKIRTING_SIDES_KEY, value: "Both sides" },
  { key: INTERNAL_WALLS_CORNICE_SIDES_KEY, value: "Both sides" },
  { key: INTERNAL_WALLS_ELECTRICAL_KEY, value: "Standard" },
  { key: INTERNAL_WALLS_STOPPING_SIDE_A_KEY, value: "Level 4" },
  { key: INTERNAL_WALLS_STOPPING_SIDE_B_KEY, value: "Level 4" },
  { key: INTERNAL_WALLS_PAINTING_SIDES_KEY, value: "Both sides" },
]) {
  facts = applyInternalWallsFactWrite({
    facts,
    workAreaId: "w1",
    key: row.key,
    value: row.value,
    wallTypeId: type.id,
  });
}
facts = [
  fact(INTERNAL_WALLS_JOB_SCOPE_FACT_KEY, "w1", "new_partition"),
  ...facts.filter((row) => row.key !== INTERNAL_WALLS_JOB_SCOPE_FACT_KEY),
];

check("mature path", isMatureInternalWallsPath({ facts, workAreaId: "w1" }));

check("IW-03 stud count 21", internalWallsStudCount(12, 0.6) === 21);

const calc = calculateInternalWalls(ctx(facts), walls);
check("no 20 m² package line", !calc.lineItems.some((row) => row.quantity === 20 && /internal wall/i.test(row.label)));
check("has timber framing", calc.lineItems.some((row) => row.componentKey === INTERNAL_WALLS_FRAMING_90_MATERIAL_COMPONENT));
check("has stopping", calc.lineItems.some((row) => row.componentKey === INTERNAL_WALLS_STOPPING_COMPONENT));
check("has painting", calc.lineItems.some((row) => row.componentKey === INTERNAL_WALLS_PAINTING_COMPONENT));
check(
  "stopping 54.3924 total",
  near(
    calc.lineItems
      .filter((row) => row.componentKey === INTERNAL_WALLS_STOPPING_COMPONENT)
      .reduce((sum, row) => sum + (row.quantity ?? 0), 0),
    54.3924
  )
);
check(
  "no door product money",
  !calc.lineItems.some((row) => looksLikeDoorProductMoney(row))
);
check(
  "Pricing Required not silent priced $0",
  calc.lineItems
    .filter((row) => row.rateSourceType === "missing")
    .every((row) => /Pricing Required|Rate required|pricing required/i.test(`${row.notes ?? ""} ${row.rateSource ?? ""}`))
);
check("no INFO_REQUIRED on complete new partition", calc.missingInfo.length === 0);

const blocked = calculateInternalWalls(
  ctx([
    fact(INTERNAL_WALLS_JOB_SCOPE_FACT_KEY, "w1", "form_opening"),
    fact(INTERNAL_WALLS_STRUCTURAL_FACT_KEY, "w1", "Not sure"),
  ]),
  walls
);
check(
  "structural Not sure blocks estimate",
  blocked.missingInfo.includes(INTERNAL_WALLS_STRUCTURAL_SPECIALIST_MESSAGE) &&
    blocked.lineItems.length === 0
);

const migrations = readdirSync(join(process.cwd(), "supabase/migrations"))
  .filter((name) => /^\d+_/.test(name) && name.endsWith(".sql"))
  .sort();
check("no 055", !migrations.some((name) => name.startsWith("055_")));
check("056 present", migrations.some((name) => name.startsWith("056_")));
check(
  "architecture IW-08 recorded",
  read("docs/architecture/QUOTR_INTERNAL_WALLS_ESTIMATING_ARCHITECTURE.md").includes(
    "WA-INTERNAL-WALLS-08"
  )
);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
