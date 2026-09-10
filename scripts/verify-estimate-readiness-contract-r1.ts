/**
 * WORK-AREA-COORDINATION-01 — Ready / estimate permission contract.
 *
 * Run: npx --yes tsx scripts/verify-estimate-readiness-contract-r1.ts
 *
 * No paid AI. No Production. No migration.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { composeClarifyView } from "../lib/assistant/clarify/compose";
import {
  composeClarifyInputFromEstimateContext,
  evaluateClarifyEstimateReadiness,
  evaluateGenerateEstimatePermission,
} from "../lib/assistant/readiness/clarify-estimate";
import { composeEstimateReadiness } from "../lib/assistant/readiness/compose";
import { calculateInternalWalls } from "../lib/estimate/calculators/fitout";
import {
  applyExtractedInternalWallsToFacts,
  COORDINATION_ORIGINAL_BRIEF,
  extractInternalWallsTypesFromBrief,
} from "../lib/estimate/internal-walls-brief";
import {
  INTERNAL_WALLS_CORNICE_SIDES_KEY,
  INTERNAL_WALLS_ELECTRICAL_KEY,
  INTERNAL_WALLS_INSULATION_INCLUDED_KEY,
  INTERNAL_WALLS_PAINTING_SIDES_KEY,
  INTERNAL_WALLS_SKIRTING_SIDES_KEY,
  INTERNAL_WALLS_STOPPING_SIDE_A_KEY,
  INTERNAL_WALLS_STOPPING_SIDE_B_KEY,
} from "../lib/estimate/internal-walls-finish";
import {
  INTERNAL_WALLS_PAINTING_COMPONENT,
  INTERNAL_WALLS_STOPPING_COMPONENT,
  looksLikeDoorProductMoney,
} from "../lib/estimate/internal-walls-identities";
import { INTERNAL_WALLS_HAS_OPENINGS_KEY } from "../lib/estimate/internal-walls-openings";
import {
  applyInternalWallsFactWrite,
  resolveInternalWallsWallTypes,
} from "../lib/estimate/internal-walls-wall-types";
import type { EstimateContext, EstimateFact } from "../lib/estimate/types";

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

function ctx(facts: EstimateFact[]): EstimateContext {
  return {
    project: { id: "p1", qualityLevel: "standard" },
    confirmedWorkAreas: [
      { id: "w1", type: "internal_walls", name: "Internal walls", sort_order: 1 },
      {
        id: "d1",
        type: "demolition",
        name: "Demolition / strip-out",
        sort_order: 2,
      },
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

function seedFacts(): EstimateFact[] {
  const types = extractInternalWallsTypesFromBrief(COORDINATION_ORIGINAL_BRIEF);
  return applyExtractedInternalWallsToFacts({
    facts: [
      {
        key: "internal_walls.job_scope",
        work_area_id: "w1",
        value: "new_partition",
      },
    ],
    workAreaId: "w1",
    types,
  });
}

function completeOptional(facts: EstimateFact[]): EstimateFact[] {
  const resolved = resolveInternalWallsWallTypes({
    facts,
    workAreaId: "w1",
  });
  let next = facts;
  for (const type of resolved.types) {
    const writes: Array<{ key: string; value: unknown }> = [
      { key: INTERNAL_WALLS_HAS_OPENINGS_KEY, value: "No" },
      { key: INTERNAL_WALLS_INSULATION_INCLUDED_KEY, value: "No" },
      { key: INTERNAL_WALLS_SKIRTING_SIDES_KEY, value: "No" },
      { key: INTERNAL_WALLS_CORNICE_SIDES_KEY, value: "No" },
      { key: INTERNAL_WALLS_ELECTRICAL_KEY, value: "No" },
      { key: INTERNAL_WALLS_STOPPING_SIDE_A_KEY, value: "No" },
      { key: INTERNAL_WALLS_STOPPING_SIDE_B_KEY, value: "No" },
      { key: INTERNAL_WALLS_PAINTING_SIDES_KEY, value: "No" },
    ];
    for (const row of writes) {
      next = applyInternalWallsFactWrite({
        facts: next,
        workAreaId: "w1",
        wallTypeId: type.id,
        key: row.key,
        value: row.value,
      });
    }
  }
  return next;
}

const SITE_CONSTRAINTS = [
  { key: "site_access", value: "Easy" },
  { key: "material_carry_distance", value: "< 10m" },
  { key: "occupied_site", value: "No" },
  { key: "working_hours", value: "No" },
] as const;

function composeInput(
  facts: EstimateFact[],
  constraints: readonly { key: string; value: string }[] = [...SITE_CONSTRAINTS]
) {
  return composeClarifyInputFromEstimateContext({
    stage: "work_area_questions",
    briefText: COORDINATION_ORIGINAL_BRIEF,
    qualityLevel: "standard",
    workAreas: [
      {
        id: "w1",
        type: "internal_walls",
        name: "Internal walls",
        status: "confirmed",
      },
      {
        id: "d1",
        type: "demolition",
        name: "Demolition / strip-out",
        status: "confirmed",
      },
    ],
    facts,
    constraints: [...constraints],
  });
}

console.log("=== Single authority ===\n");
const actions = read("lib/assistant/actions.ts");
const shell = read("components/assistant/AssistantShell.tsx");
const panel = read("components/assistant/clarify/ClarifyPanel.tsx");
check(
  "generateEstimate uses evaluateGenerateEstimatePermission",
  actions.includes("evaluateGenerateEstimatePermission")
);
check(
  "Details Ready waits on pendingWrites",
  read("lib/assistant/readiness/compose.ts").includes("pendingWrites") &&
    shell.includes("pendingWrites: pendingReadinessWrites")
);
check(
  "pending-write authority covers every Clarify input type, not just number/text",
  shell.includes("setPendingReadinessWrites((n) => n + 1)") &&
    !shell.includes("if (isNumericOrText) setPendingReadinessWrites")
);
check(
  "Ready card requires readiness.enoughToEstimate",
  panel.includes("readiness.enoughToEstimate === true")
);
check(
  "CTA does not stay on Saving… during generate",
  read("components/assistant/clarify/ClarifyReadiness.tsx").includes(
    "ASSISTANT_LOADING_COPY.estimateGenerate"
  )
);

console.log("\n=== Carry distance before Ready ===\n");
const construction = seedFacts();
const missingCarry = composeInput(construction, [
  { key: "site_access", value: "Easy" },
]);
const missingCarryReady = evaluateClarifyEstimateReadiness(missingCarry);
check(
  "carry unresolved is not Ready",
  missingCarryReady.ready === false,
  missingCarryReady.builderCopy ?? "missing"
);
check(
  "unresolved copy is carry distance",
  Boolean(
    missingCarryReady.builderCopy &&
      /drop-off|carry|carting/i.test(missingCarryReady.builderCopy)
  ),
  missingCarryReady.builderCopy ?? "missing"
);

const withCarry = composeInput(construction);
const withCarryReady = evaluateClarifyEstimateReadiness(withCarry);
check(
  "extracted walls + carry is Ready without optional finish",
  withCarryReady.ready === true,
  withCarryReady.builderCopy ??
    JSON.stringify(withCarryReady.diagnostics.unresolved.map((row) => row.question).slice(0, 8))
);
check(
  "answering optional finish does not change Ready",
  evaluateClarifyEstimateReadiness(composeInput(completeOptional(construction))).ready ===
    withCarryReady.ready
);

const overlayReady = evaluateClarifyEstimateReadiness({
  ...withCarry,
  pendingWrites: 1,
});
check(
  "pending write cannot produce false Ready",
  overlayReady.ready === false &&
    Boolean(overlayReady.builderCopy?.toLowerCase().includes("saving")),
  overlayReady.builderCopy ?? "missing"
);
const detailsPending = composeEstimateReadiness({
  clarify: composeClarifyView(withCarry),
  jobPlan: withCarry.jobPlan,
  qualityLevel: "standard",
  constraints: [...SITE_CONSTRAINTS],
  pendingWrites: 1,
});
check(
  "Details Ready uses the same pending-write gate",
  detailsPending.enoughToEstimate === false
);

console.log("\n=== Completed construction ===\n");
const complete = construction;
const completeCompose = withCarry;
const clarifyReady = evaluateClarifyEstimateReadiness(completeCompose);
const generateReady = evaluateGenerateEstimatePermission({
  compose: completeCompose,
  workAreas: completeCompose.workAreas,
  facts: complete,
  unresolvedRequiredProjectConditionKeys: [],
});
check(
  "Clarify Ready after genuine answers",
  clarifyReady.ready === true,
  clarifyReady.builderCopy ??
    JSON.stringify(clarifyReady.diagnostics.unresolved.map((row) => row.question).slice(0, 8))
);
check(
  "generate permission matches Clarify Ready",
  generateReady.ready === clarifyReady.ready
);
check(
  "stale persisted snapshot still rejects",
  evaluateGenerateEstimatePermission({
    compose: missingCarry,
    workAreas: missingCarry.workAreas,
    facts: construction,
    unresolvedRequiredProjectConditionKeys: [],
  }).ready === false
);

console.log("\n=== Estimate / double-count ===\n");
const result = calculateInternalWalls(ctx(complete), {
  id: "w1",
  type: "internal_walls",
  name: "Internal walls",
  sort_order: 1,
});
const reqKeys = (result.requirements ?? []).map((row) => row.componentKey);
check(
  "estimate produces Internal Walls requirements",
  (result.requirements ?? []).length > 0 || result.lineItems.length > 0
);
check(
  "no duplicate demolition requirement on Internal Walls",
  !reqKeys.some((key) => /demolition/i.test(key))
);
check(
  "no stopping / painting money unless selected",
  !result.lineItems.some(
    (row) =>
      row.componentKey === INTERNAL_WALLS_STOPPING_COMPONENT ||
      row.componentKey === INTERNAL_WALLS_PAINTING_COMPONENT
  )
);
check(
  "no door product money",
  !result.lineItems.some((row) =>
    looksLikeDoorProductMoney({
      componentKey: row.componentKey,
      label: row.label,
    })
  )
);
const liningKeys = reqKeys.filter((key) => /lining/i.test(key));
check(
  "lining requirements exist once per face/type, not duplicated demolition",
  liningKeys.length > 0,
  reqKeys.slice(0, 20).join(" | ")
);

const resolved = resolveInternalWallsWallTypes({
  facts: complete,
  workAreaId: "w1",
});
check(
  "Builder-facing types remain 2 specs / 3 walls",
  resolved.types.length === 2 &&
    (resolved.types[0]?.wall_count ?? 0) + (resolved.types[1]?.wall_count ?? 0) ===
      3
);

if (failed > 0) {
  console.log(`\nFAILED ${failed}  passed ${passed}`);
  process.exit(1);
}
console.log(`\nOK  ${passed} checks`);
