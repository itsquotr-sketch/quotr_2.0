/**
 * Unknown bathroom substrate must not price a full replacement.
 * Confirmed replacement still prices plywood and a separate underlay task.
 *
 * Run: npx tsx scripts/verify-bathroom-substrate-repair.ts
 */
import { calculateBathroom } from "../lib/estimate/calculators/bathroom";
import {
  BATHROOM_FLOOR_SUBSTRATE_PLYWOOD_KEY,
  BATHROOM_PRODUCTIVITY_BENCHMARKS,
  BATHROOM_PRODUCTIVITY_KEYS,
  BATHROOM_SUBSTRATE_PARTIAL_COVERAGE,
  BATHROOM_SUBSTRATE_UNKNOWN_COVERAGE,
  BATHROOM_TILE_UNDERLAY_6MM_KEY,
} from "../lib/estimate/bathroom-identities";
import { classifyBathroomFloorSubstrateAnswer } from "../lib/estimate/bathroom-scope";
import type {
  EstimateContext,
  EstimateFact,
  EstimateWorkArea,
} from "../lib/estimate/types";

let failed = 0;

function check(name: string, ok: boolean, detail = ""): void {
  if (ok) console.log(`ok    ${name}`);
  else {
    failed += 1;
    console.log(`FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

function fact(key: string, value: unknown): EstimateFact {
  return { key, work_area_id: "b1", value };
}

function includedCost(result: ReturnType<typeof calculateBathroom>): number {
  return Math.round(
    result.lineItems
      .filter((row) => row.includedInTotal !== false)
      .reduce((sum, row) => sum + (row.recommendedCost ?? 0), 0) * 100
  ) / 100;
}

function run(substrate: string) {
  const facts: EstimateFact[] = [
    fact("bathroom.job_scope", "custom"),
    fact("bathroom.renovation_type", "Full strip-out and rebuild"),
    fact("bathroom.length_m", 2.4),
    fact("bathroom.width_m", 2.1),
    fact("bathroom.wall_height_m", 2.4),
    fact("bathroom.floor_finish_system", "tile"),
    fact("bathroom.tile_extent", "none"),
    fact("bathroom.painting_included", true),
    fact("bathroom.demolition_required", true),
    fact("bathroom.demolition.components", ["vanity", "shower", "toilet", "floor_finish"]),
    fact("bathroom.fixtures_included", ["Vanity", "Shower", "Toilet"]),
    fact("bathroom.fixture.vanity.ownership", "Install only"),
    fact("bathroom.fixture.toilet.ownership", "Supply and install"),
    fact("bathroom.fixture.shower.ownership", "Supply and install"),
    fact("bathroom.plumbing.level", "none"),
    fact("bathroom.electrical.level", "none"),
    fact("bathroom.coverage_note", "Customer-supplied: vanity, tiles. Excluded trades: plumbing, electrical."),
    fact("bathroom.floor_substrate_system", substrate),
  ];
  const workArea = {
    id: "b1",
    type: "bathroom",
    name: "Bathroom",
    sort_order: 1,
  } as EstimateWorkArea;
  const context = {
    project: { id: "p1", qualityLevel: "standard" },
    confirmedWorkAreas: [workArea],
    facts,
    constraints: [],
    organisationSettings: {
      allow_benchmark_rates: true,
      default_margin_percent: 20,
    },
    materialWastageSettings: { sheet_material: 10, flooring: 10, paint: 10, default: 5 },
    rates: [],
  } as unknown as EstimateContext;
  return calculateBathroom(context, workArea);
}

function hasMaterial(result: ReturnType<typeof calculateBathroom>, key: string): boolean {
  return (result.requirements ?? []).some(
    (row) => row.kind === "material" && row.materialKey === key
  );
}

const unknown = run("Not sure");
const retained = run("Keep existing floor");
const partial = run("Partial repair");
const replacement = run("19 mm treated plywood");

check(
  "unknown classifies as unknown",
  classifyBathroomFloorSubstrateAnswer("Not sure").kind === "unknown"
);
check(
  "retained classifies as retained",
  classifyBathroomFloorSubstrateAnswer("Keep existing floor").kind === "retained"
);
check(
  "partial classifies as unmeasured repair",
  classifyBathroomFloorSubstrateAnswer("Partial repair").kind === "partial_unmeasured"
);
check(
  "plywood classifies as replacement",
  classifyBathroomFloorSubstrateAnswer("19 mm treated plywood").kind === "replacement"
);

for (const [name, result, sentence] of [
  ["unknown", unknown, BATHROOM_SUBSTRATE_UNKNOWN_COVERAGE],
  ["partial", partial, BATHROOM_SUBSTRATE_PARTIAL_COVERAGE],
] as const) {
  check(`${name} has no plywood`, !hasMaterial(result, BATHROOM_FLOOR_SUBSTRATE_PLYWOOD_KEY));
  check(`${name} has no underlay`, !hasMaterial(result, BATHROOM_TILE_UNDERLAY_6MM_KEY));
  check(
    `${name} gap stays out of the total`,
    result.missingInfo.includes(sentence) &&
      result.lineItems.some(
        (row) =>
          row.label === "Floor substrate" &&
          row.includedInTotal === false &&
          row.notes === sentence
      )
  );
}

check(
  "retained substrate adds no replacement",
  !hasMaterial(retained, BATHROOM_FLOOR_SUBSTRATE_PLYWOOD_KEY) &&
    !hasMaterial(retained, BATHROOM_TILE_UNDERLAY_6MM_KEY) &&
    !retained.lineItems.some((row) => row.label === "Floor substrate")
);
check(
  "unknown and retained totals match",
  includedCost(unknown) === includedCost(retained) && includedCost(unknown) > 0,
  `${includedCost(unknown)} vs ${includedCost(retained)}`
);
check(
  "partial total matches unknown",
  includedCost(partial) === includedCost(unknown)
);

check(
  "confirmed plywood is priced",
  hasMaterial(replacement, BATHROOM_FLOOR_SUBSTRATE_PLYWOOD_KEY)
);
check(
  "confirmed plywood plus tile prices underlay",
  hasMaterial(replacement, BATHROOM_TILE_UNDERLAY_6MM_KEY)
);
const substrateLabour = replacement.lineItems.find((row) => row.label === "Floor substrate labour");
const underlayLabour = replacement.lineItems.find((row) => row.label === "Tile underlay labour");
check("substrate labour is present", substrateLabour != null);
check("underlay labour is present", underlayLabour != null);
check(
  "the two labour lines are separate tasks",
  substrateLabour?.componentKey === "bathroom.floor_substrate.install" &&
    underlayLabour?.componentKey === "bathroom.floor_tile_underlay.install" &&
    substrateLabour.itemKey === BATHROOM_PRODUCTIVITY_KEYS.floorSubstrateM2 &&
    underlayLabour?.itemKey === BATHROOM_PRODUCTIVITY_KEYS.tileUnderlayM2
);
check(
  "equal hours come from the same benchmark and area",
  substrateLabour?.labourHours === underlayLabour?.labourHours &&
    BATHROOM_PRODUCTIVITY_BENCHMARKS.floorSubstrateM2 ===
      BATHROOM_PRODUCTIVITY_BENCHMARKS.tileUnderlayM2 &&
    replacement.assumptions.some((line) =>
      line.includes("not one allowance counted twice")
    )
);
check(
  "replacement costs more than unknown",
  includedCost(replacement) > includedCost(unknown),
  `${includedCost(replacement)} vs ${includedCost(unknown)}`
);

check(
  "scope wording follows the selected components",
  unknown.assumptions.some((line) =>
    line.startsWith("Selected bathroom scope: remove vanity, shower, toilet, floor finish; floor tiling; painting; Vanity, Shower, Toilet.")
  ) && unknown.assumptions.every((line) => !line.includes("Full strip-out and rebuild — component trade allowances applied."))
);

check(
  "customer tile supply stays out of the total",
  unknown.lineItems.some(
    (row) => /tile supply/i.test(row.label) && row.includedInTotal === false
  )
);
check(
  "vanity installation stays priced",
  unknown.lineItems.some((row) => row.label === "Vanity installation" && row.includedInTotal !== false)
);
check(
  "plumbing and electrical charges are excluded",
  unknown.exclusions.includes("Plumbing charges") &&
    unknown.exclusions.includes("Electrical charges") &&
    !unknown.lineItems.some((row) => /plumbing charges|electrical charges/i.test(row.label) && (row.recommendedCost ?? 0) > 0)
);
check(
  "floor tiling stays priced without a substrate",
  unknown.lineItems.some((row) => row.label === "Floor tiler installation" && (row.recommendedCost ?? 0) > 0)
);

console.log(
  `costs unknown ${includedCost(unknown)} retained ${includedCost(retained)} partial ${includedCost(partial)} replacement ${includedCost(replacement)}`
);

if (failed > 0) {
  console.log(`bathroom substrate repair failed: ${failed}`);
  process.exit(1);
}
console.log("bathroom substrate repair passed");
