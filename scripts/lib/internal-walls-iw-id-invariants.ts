/**
 * Deterministic Internal Walls calculator snapshots for EF02-IW-ID-A.
 * Does not change calculator code. Used to prove identity work is numerically inert.
 */
import { calculateInternalWalls } from "../../lib/estimate/calculators/fitout";
import {
  applyExtractedInternalWallsToFacts,
  extractInternalWallsTypesFromBrief,
  COORDINATION_ORIGINAL_BRIEF,
} from "../../lib/estimate/internal-walls-brief";
import { INTERNAL_WALLS_JOB_SCOPE_FACT_KEY } from "../../lib/estimate/internal-walls-scope";
import {
  applyInternalWallsFactWrite,
  resolveInternalWallsWallTypes,
} from "../../lib/estimate/internal-walls-wall-types";
import type { EstimateContext, EstimateFact, EstimateWorkArea } from "../../lib/estimate/types";

const WA: EstimateWorkArea = {
  id: "w1",
  type: "internal_walls",
  name: "Internal walls",
  sort_order: 1,
};

function ctx(facts: EstimateFact[]): EstimateContext {
  return {
    project: { id: "p1", qualityLevel: "standard" },
    confirmedWorkAreas: [WA],
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

function writeWall(
  writes: Array<{ key: string; value: unknown; wallTypeId?: string }>
): EstimateFact[] {
  let facts: EstimateFact[] = [];
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

function snapshot(name: string, facts: EstimateFact[]) {
  const resolved = resolveInternalWallsWallTypes({
    facts,
    workAreaId: "w1",
  });
  const calc = calculateInternalWalls(ctx(facts), WA);
  const labourHours = (calc.requirements ?? [])
    .filter((row) => row.kind === "labour")
    .reduce((sum, row) => sum + Number(row.adjustedHours ?? 0), 0);
  const reqQty = (calc.requirements ?? [])
    .map((row) => {
      const qty =
        row.kind === "labour"
          ? Number(row.adjustedHours)
          : row.kind === "material"
            ? Number(row.purchaseQuantity)
            : "quantity" in row
              ? Number((row as { quantity?: number }).quantity ?? 0)
              : 0;
      return {
        kind: row.kind,
        componentKey: row.componentKey,
        quantity: Number.isFinite(qty) ? Number(qty.toFixed(6)) : 0,
      };
    })
    .sort((a, b) =>
      `${a.kind}:${a.componentKey}`.localeCompare(`${b.kind}:${b.componentKey}`)
    );
  const requirementsStable = Object.values(
    reqQty.reduce<Record<string, { kind: string; componentKey: string; quantity: number }>>(
      (acc, row) => {
        const key = `${row.kind}:${row.componentKey}`;
        const existing = acc[key];
        acc[key] = {
          kind: row.kind,
          componentKey: row.componentKey,
          quantity: Number(((existing?.quantity ?? 0) + row.quantity).toFixed(6)),
        };
        return acc;
      },
      {}
    )
  ).sort((a, b) =>
    `${a.kind}:${a.componentKey}`.localeCompare(`${b.kind}:${b.componentKey}`)
  );
  const physical = resolved.types
    .map((type) => ({
      wall_count: type.wall_count,
      length_lm: type.length_lm,
      height_m: type.height_m,
      frame_system: type.frame_system,
      frame_size: type.frame_size,
      stud_centres_mm: type.stud_centres_mm,
      opening_count: type.openings.length,
      insulation_included: type.insulation_included,
      skirting: type.skirting,
      cornice: type.cornice,
      stopping_side_a: type.stopping_side_a,
      stopping_side_b: type.stopping_side_b,
      painting: type.painting,
      side_a: type.side_a.product,
      side_b: type.side_b.product,
    }))
    .sort((a, b) =>
      `${a.length_lm}:${a.height_m}:${a.side_a}:${a.side_b}`.localeCompare(
        `${b.length_lm}:${b.height_m}:${b.side_a}:${b.side_b}`
      )
    );
  const commercial = {
    recommendedCost: Number(
      calc.lineItems
        .reduce((sum, row) => sum + row.recommendedCost, 0)
        .toFixed(4)
    ),
    recommendedSell: Number(
      calc.lineItems
        .reduce((sum, row) => sum + row.recommendedSell, 0)
        .toFixed(4)
    ),
    lineCount: calc.lineItems.length,
  };
  return {
    name,
    physical,
    labourHours: Number(labourHours.toFixed(6)),
    requirements: requirementsStable,
    requirementsFingerprint: requirementsStable
      .map((row) => `${row.kind}:${row.componentKey}=${row.quantity}`)
      .join("|"),
    commercial,
  };
}

export function internalWallsIdentityInvariantFixtures() {
  const a = writeWall([
    { key: INTERNAL_WALLS_JOB_SCOPE_FACT_KEY, value: "new_partition" },
    { key: "internal_walls.add_wall_type", value: true },
    { key: "internal_walls.wall_type.frame_system", value: "Timber framing" },
    {
      key: "internal_walls.wall_type.frame_size",
      value: "90 mm timber framing — 90×45",
    },
    { key: "internal_walls.wall_type.length_lm", value: 12 },
    { key: "internal_walls.wall_type.height_m", value: 2.4 },
    { key: "internal_walls.wall_type.stud_centres_mm", value: "600 mm" },
    { key: "internal_walls.wall_type.side_a_product", value: "Standard GIB" },
    { key: "internal_walls.wall_type.same_lining_both_sides", value: true },
  ]);
  const b = writeWall([
    { key: INTERNAL_WALLS_JOB_SCOPE_FACT_KEY, value: "new_partition" },
    { key: "internal_walls.add_wall_type", value: true },
    { key: "internal_walls.wall_type.frame_system", value: "Timber framing" },
    {
      key: "internal_walls.wall_type.frame_size",
      value: "90 mm timber framing — 90×45",
    },
    { key: "internal_walls.wall_type.length_lm", value: 8 },
    { key: "internal_walls.wall_type.height_m", value: 3.0 },
    { key: "internal_walls.wall_type.stud_centres_mm", value: "400 mm" },
    { key: "internal_walls.wall_type.side_a_product", value: "Standard GIB" },
    { key: "internal_walls.wall_type.same_lining_both_sides", value: true },
  ]);
  const c = writeWall([
    { key: INTERNAL_WALLS_JOB_SCOPE_FACT_KEY, value: "new_partition" },
    { key: "internal_walls.add_wall_type", value: true },
    { key: "internal_walls.wall_type.frame_system", value: "Timber framing" },
    {
      key: "internal_walls.wall_type.frame_size",
      value: "140 mm timber framing — 140×45",
    },
    { key: "internal_walls.wall_type.length_lm", value: 5 },
    { key: "internal_walls.wall_type.height_m", value: 2.7 },
    { key: "internal_walls.wall_type.side_a_product", value: "Standard GIB" },
    { key: "internal_walls.wall_type.same_lining_both_sides", value: true },
  ]);
  const extracted = extractInternalWallsTypesFromBrief(COORDINATION_ORIGINAL_BRIEF);
  const d = applyExtractedInternalWallsToFacts({
    facts: [
      {
        key: INTERNAL_WALLS_JOB_SCOPE_FACT_KEY,
        work_area_id: "w1",
        value: "new_partition",
      },
    ],
    workAreaId: "w1",
    types: extracted,
  });
  return {
    A: snapshot("A 12m×2.4m 90×45 600", a),
    B: snapshot("B 8m×3.0m 90×45 400", b),
    C: snapshot("C 5m×2.7m 140×45", c),
    D: snapshot("D live two Wall Types", d),
  };
}
