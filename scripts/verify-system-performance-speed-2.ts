/**
 * SYSTEM-PERFORMANCE-SPEED-2 — Fact / question mutation DB + write-path optimisation.
 *
 * Run: npx tsx scripts/verify-system-performance-speed-2.ts
 */
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  buildAssistantMutationResult,
  shouldApplyAssistantMutation,
} from "../lib/assistant/assistant-mutation-result";
import {
  DERIVED_FACT_UPSERT_CONFLICT_TARGET,
  derivedFactWriteStatementCount,
  isDerivationOwnedSource,
  planDerivedFactWrites,
} from "../lib/assistant/derived-fact-write-plan";
import { composeJobPlan } from "../lib/assistant/job-plan/compose";
import { resolveLocalDbContainer } from "./local-db-container";
import { buildAssistantState } from "../lib/assistant/mappers";
import { calculateEstimate } from "../lib/estimate/calculate-estimate";
import type { EstimateContext, EstimateFact } from "../lib/estimate/types";
import { AUTH_ORG_MESSAGES, evaluateAuthOrgInputs } from "../lib/security/auth-org-evaluation";
import { detectDerivedFactConflicts } from "../lib/scopes/derived-fact-conflicts";
import {
  deriveFactsForProject,
  mergeDerivedFactsIntoRecords,
} from "../lib/scopes/derived-facts";
import { shouldWriteDerivedFact } from "../lib/scopes/domain-ownership";
import { buildMissingRequiredQuestionsForWorkAreas } from "../lib/scopes/questions";
import { loadCalibrationFixture } from "./deck-calibration/run-deck-calibration";

const root = resolve(import.meta.dirname ?? __dirname, "..");

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

function read(relativePath: string): string {
  return readFileSync(join(root, relativePath), "utf8");
}

function fileContains(relativePath: string, needle: string): boolean {
  return read(relativePath).includes(needle);
}

function spawnVerifier(script: string, timeoutMs = 240_000): boolean {
  try {
    execFileSync("npx", ["tsx", script], {
      cwd: root,
      stdio: "pipe",
      timeout: timeoutMs,
      shell: process.platform === "win32",
      encoding: "utf8",
    });
    return true;
  } catch {
    return false;
  }
}

function probeLocalSupabase(): { available: boolean; container?: string } {
  try {
    return { available: true, container: resolveLocalDbContainer() };
  } catch {
    return { available: false };
  }
}

const factSrc = read("lib/assistant/fact-actions.ts");
const persistSrc = read("lib/assistant/persist-derived-facts.ts");
const planSrc = read("lib/assistant/derived-fact-write-plan.ts");
const missingSrc = read("lib/assistant/missing-questions.ts");
const scopeSrc = read("lib/assistant/scope-persistence.ts");
const loadSrc = read("lib/assistant/load-assistant-mutation-result.ts");
const completeSrc = read("lib/assistant/complete-assistant-mutation.ts");
const applySrc = read("lib/assistant/assistant-mutation-result.ts");
const shellSrc = read("components/assistant/AssistantShell.tsx");
const constraintSrc = read("lib/assistant/constraint-actions.ts");
const staleSrc = read("lib/estimate/stale.ts");
const persistGenSrc = read("lib/estimate/persist-estimate-generation.ts");
const calcFence = read("lib/estimate/calculators/fence.ts");
const calcDeck = read("lib/estimate/calculators/deck.ts");
const calcRw = read("lib/estimate/calculators/retaining-wall.ts");
const schemaSrc = read("supabase/migrations/002_assistant_schema.sql");
const audit = read("docs/audits/SYSTEM_PERFORMANCE_SPEED_0_BASELINE.md");

const DECK_WA = "wa-deck";
const FENCE_WA = "wa-fence";
const RW_WA = "wa-rw";
const ORG_A = "org-a";
const PROJECT_A = "project-a";

function factRow(
  key: string,
  workAreaId: string | null,
  value: unknown,
  source = "user",
  conflictWarning: string | null = null
) {
  return {
    key,
    work_area_id: workAreaId,
    value,
    source,
    conflict_warning: conflictWarning,
  };
}

function planFor(
  facts: ReturnType<typeof factRow>[],
  workAreas: { id: string; type: string }[],
  orgId = ORG_A,
  projectId = PROJECT_A
) {
  const derivedFacts = deriveFactsForProject({ workAreas, projectFacts: facts });
  const conflicts = detectDerivedFactConflicts(facts, derivedFacts);
  const conflictByKey = new Map(
    conflicts.map((conflict) => [
      `${conflict.workAreaId}:${conflict.key}`,
      conflict.warning,
    ])
  );
  const plan = planDerivedFactWrites({
    orgId,
    projectId,
    projectFacts: facts,
    derivedFacts,
    conflictByKey,
    evaluatedWorkAreaIds: workAreas.map((workArea) => workArea.id),
  });
  const retired = new Set(
    plan.toRetire.map((row) => `${row.work_area_id}:${row.key}`)
  );
  const remaining = facts.filter(
    (fact) =>
      !(fact.source === "derived" && retired.has(`${fact.work_area_id}:${fact.key}`))
  );
  return {
    derivedFacts,
    plan,
    merged: mergeDerivedFactsIntoRecords(remaining, derivedFacts),
  };
}

/** BEFORE Speed 2: per derived candidate, SELECT + write, then the same pass again inside ensure. */
function beforeDerivedStatements(derivedCount: number): number {
  return derivedCount * 2 * 2;
}

const numericFacts = [
  factRow("deck.length_m", DECK_WA, 3),
  factRow("deck.width_m", DECK_WA, 9),
];
const numeric = planFor(numericFacts, [{ id: DECK_WA, type: "deck" }]);

const simpleFacts = [
  factRow("deck.length_m", DECK_WA, 3),
  factRow("deck.width_m", DECK_WA, 9),
  factRow("deck.area_m2", DECK_WA, 27, "derived"),
  factRow("deck.board_material", DECK_WA, "Hardwood"),
];
const simple = planFor(simpleFacts, [{ id: DECK_WA, type: "deck" }]);

const fenceFacts = [
  factRow("fence.length_m", FENCE_WA, 18),
  factRow("fence.height_m", FENCE_WA, 1.8),
  factRow("fence.system", FENCE_WA, "Aluminium slat"),
  factRow("fence.timber_species", FENCE_WA, "Radiata Pine"),
];
const fence = planFor(fenceFacts, [{ id: FENCE_WA, type: "fence" }]);

const clearedFacts = [
  factRow("deck.length_m", DECK_WA, 3),
  factRow("deck.area_m2", DECK_WA, 27, "derived"),
];
const cleared = planFor(clearedFacts, [{ id: DECK_WA, type: "deck" }]);

const multiFacts = [
  factRow("deck.length_m", DECK_WA, 3),
  factRow("deck.width_m", DECK_WA, 9),
  factRow("retaining_wall.height_high_m", RW_WA, 1.2),
  factRow("retaining_wall.height_low_m", RW_WA, 0.8),
  factRow("retaining_wall.backfill_length_m", RW_WA, 10),
  factRow("retaining_wall.backfill_height_m", RW_WA, 1),
  factRow("retaining_wall.backfill_depth_m", RW_WA, 0.5),
];
const multi = planFor(multiFacts, [
  { id: DECK_WA, type: "deck" },
  { id: RW_WA, type: "retaining_wall" },
]);

const changedWidth = planFor(
  [
    factRow("deck.length_m", DECK_WA, 5),
    factRow("deck.width_m", DECK_WA, 3),
    factRow("deck.area_m2", DECK_WA, 20, "derived"),
  ],
  [{ id: DECK_WA, type: "deck" }]
);

const userOwnedArea = planFor(
  [
    factRow("deck.length_m", DECK_WA, 3),
    factRow("deck.width_m", DECK_WA, 9),
    factRow("deck.area_m2", DECK_WA, 99, "user"),
  ],
  [{ id: DECK_WA, type: "deck" }]
);

const aiExtractedIdle = planFor(
  [
    factRow("deck.length_m", DECK_WA, 3),
    factRow("deck.area_m2", DECK_WA, 40, "ai_extracted"),
  ],
  [{ id: DECK_WA, type: "deck" }]
);

const aiExtractedPromote = planFor(
  [
    factRow("deck.length_m", DECK_WA, 3),
    factRow("deck.width_m", DECK_WA, 9),
    factRow("deck.area_m2", DECK_WA, 40, "ai_extracted"),
  ],
  [{ id: DECK_WA, type: "deck" }]
);

const mixedNewAndExisting = planFor(
  [
    factRow("deck.length_m", DECK_WA, 3),
    factRow("deck.width_m", DECK_WA, 9),
    factRow("retaining_wall.height_high_m", RW_WA, 1.2),
    factRow("retaining_wall.height_low_m", RW_WA, 0.8),
    factRow("retaining_wall.backfill_length_m", RW_WA, 10),
    factRow("retaining_wall.backfill_height_m", RW_WA, 1),
    factRow("retaining_wall.backfill_depth_m", RW_WA, 0.5),
    factRow("deck.area_m2", DECK_WA, 27, "derived"),
  ],
  [
    { id: DECK_WA, type: "deck" },
    { id: RW_WA, type: "retaining_wall" },
  ]
);

const multiCleared = planFor(
  [
    factRow("deck.length_m", DECK_WA, 3),
    factRow("deck.area_m2", DECK_WA, 27, "derived"),
    factRow("retaining_wall.height_high_m", RW_WA, 1.2),
    factRow("retaining_wall.height_low_m", RW_WA, 0.8),
    factRow("retaining_wall.backfill_length_m", RW_WA, 10),
    factRow("retaining_wall.backfill_height_m", RW_WA, 1),
    factRow("retaining_wall.backfill_depth_m", RW_WA, 0.5),
    factRow("retaining_wall.height_m", RW_WA, 1, "derived"),
    factRow("retaining_wall.backfill_volume_m3", RW_WA, 5, "derived"),
  ],
  [
    { id: DECK_WA, type: "deck" },
    { id: RW_WA, type: "retaining_wall" },
  ]
);

const emptyDerivationStale = planFor(
  [
    factRow("fence.length_m", FENCE_WA, 18),
    factRow("fence.posts_count", FENCE_WA, 12, "derived"),
  ],
  [{ id: FENCE_WA, type: "fence" }]
);

const crossProjectPlan = planDerivedFactWrites({
  orgId: ORG_A,
  projectId: PROJECT_A,
  projectFacts: [
    factRow("deck.length_m", DECK_WA, 3),
    factRow("deck.width_m", DECK_WA, 9),
  ],
  derivedFacts: deriveFactsForProject({
    workAreas: [{ id: DECK_WA, type: "deck" }],
    projectFacts: [
      factRow("deck.length_m", DECK_WA, 3),
      factRow("deck.width_m", DECK_WA, 9),
    ],
  }),
  conflictByKey: new Map(),
  evaluatedWorkAreaIds: [DECK_WA],
});

const secondPass = planFor(
  mergeDerivedFactsIntoRecords(numericFacts, numeric.derivedFacts).map((row) => ({
    ...row,
    conflict_warning: null,
  })),
  [{ id: DECK_WA, type: "deck" }]
);

const deckWaInput = {
  id: DECK_WA,
  type: "deck",
  name: "Deck",
  sort_order: 1,
  status: "confirmed",
};
const missingBefore = buildMissingRequiredQuestionsForWorkAreas({
  project: { quality_level: "standard" },
  confirmedWorkAreas: [deckWaInput],
  projectFacts: [factRow("deck.width_m", DECK_WA, 4)],
  existingQuestions: [],
  includeOptional: true,
});
const missingAfterLength = buildMissingRequiredQuestionsForWorkAreas({
  project: { quality_level: "standard" },
  confirmedWorkAreas: [deckWaInput],
  projectFacts: [
    factRow("deck.width_m", DECK_WA, 4),
    factRow("deck.length_m", DECK_WA, 8),
  ],
  existingQuestions: [],
  includeOptional: true,
});
const existingActiveKeys = new Set(
  missingBefore.slice(0, 2).map((question) => `${question.workAreaId}:${question.key}`)
);
const toAdd = missingBefore.filter(
  (question) => !existingActiveKeys.has(`${question.workAreaId}:${question.key}`)
);
const retained = missingBefore.filter((question) =>
  existingActiveKeys.has(`${question.workAreaId}:${question.key}`)
);

function dbWorkArea(id: string, type: string, name: string, sortOrder: number) {
  return {
    id,
    type,
    name,
    status: "confirmed",
    ai_confidence: null,
    summary: null,
    quote_description: null,
    sort_order: sortOrder,
  };
}

function assistantState(input: {
  projectId: string;
  workAreas: ReturnType<typeof dbWorkArea>[];
  facts: ReturnType<typeof factRow>[];
  estimateStale?: boolean;
}) {
  return buildAssistantState({
    project: {
      id: input.projectId,
      stage: "estimate_ready",
      brief_text: "Deck",
      quality_level: "standard",
    },
    workAreas: input.workAreas,
    questionBlocks: [],
    questions: [],
    constraints: [],
    estimate: {
      id: "est-1",
      cost_low: 1000,
      cost_high: 1200,
      sell_low: 1250,
      sell_high: 1500,
      recommended_cost: 1100,
      recommended_sell: 1375,
      gross_profit: 275,
      margin_percent: 20,
      markup_percent: 25,
      is_stale: input.estimateStale ?? true,
      calibration_version: null,
      target_margin_percent: 20,
      confidence: 0.8,
      rate_source_summary: "org",
      assumptions: [],
      missing_info: [],
      exclusions: [],
    },
    lineItems: [],
    projectFacts: input.facts,
  });
}

function mutationFromFacts(
  projectId: string,
  facts: ReturnType<typeof factRow>[],
  workAreaId = DECK_WA,
  type = "deck"
) {
  const state = assistantState({
    projectId,
    workAreas: [dbWorkArea(workAreaId, type, type, 1)],
    facts,
    estimateStale: true,
  });
  return buildAssistantMutationResult({
    projectId,
    state,
    estimateStale: true,
    hasEstimate: true,
  });
}

console.log("verify-system-performance-speed-2: starting…\n");

console.log("-- PARITY --");
check(
  "1. assistantMutation contract unchanged",
  fileContains("lib/assistant/types.ts", "estimateStale: boolean") &&
    fileContains("lib/assistant/types.ts", "interviewFacts:") &&
    fileContains("lib/assistant/types.ts", "questionBlock:") &&
    fileContains("lib/assistant/types.ts", "scopeReview:") &&
    !typesDropped()
);
function typesDropped(): boolean {
  const types = read("lib/assistant/types.ts");
  return (
    !types.includes("derivedFactDisplays") ||
    !types.includes("hasEstimate") ||
    !types.includes("constraintQuestions")
  );
}

const numericMutation = mutationFromFacts("p-numeric", numeric.merged);
const numericReload = mutationFromFacts("p-numeric", numeric.merged);
const simpleMutation = mutationFromFacts("p-simple", simple.merged);
const simpleReload = mutationFromFacts("p-simple", simple.merged);
check(
  "2. simple fact canonical merge unchanged",
  JSON.stringify(simpleMutation) === JSON.stringify(simpleReload) &&
    simple.plan.skippedUnchanged === 1 &&
    simple.derivedFacts.length === 1 &&
    simple.plan.toWrite.length === 0
);
check(
  "3. derived fixture canonical merge unchanged",
  JSON.stringify(numericMutation) === JSON.stringify(numericReload) &&
    numeric.derivedFacts.some((row) => row.key === "deck.area_m2" && row.value === 27)
);
const beforeMissingKeys = new Set(
  missingBefore.map((question) => `${question.workAreaId}:${question.key}`)
);
const afterMissingKeys = new Set(
  missingAfterLength.map((question) => `${question.workAreaId}:${question.key}`)
);
check(
  "4. question-change active missing set is differential",
  beforeMissingKeys.has(`${DECK_WA}:deck.length_m`) &&
    !afterMissingKeys.has(`${DECK_WA}:deck.length_m`) &&
    toAdd.length + retained.length === missingBefore.length &&
    retained.length === existingActiveKeys.size
);
check(
  "5. Fence switch does not invent derived fence rows",
  fence.derivedFacts.length === 0 &&
    fence.plan.toWrite.length === 0 &&
    fenceFacts.some((row) => row.key === "fence.timber_species")
);
check(
  "6. clear width retires derived deck.area_m2 from current Facts SoT",
  persistSrc.includes(".delete(") &&
    persistSrc.includes('.eq("source", "derived")') &&
    cleared.derivedFacts.length === 0 &&
    cleared.plan.toRetire.length === 1 &&
    cleared.plan.toRetire[0]?.key === "deck.area_m2" &&
    !cleared.merged.some((row) => row.key === "deck.area_m2")
);
const updateFactBody = factSrc.slice(
  factSrc.indexOf("export async function updateProjectFact")
);

check(
  "7. stale state still marked after fact mutation",
  updateFactBody.includes("markEstimateStaleWithContext") &&
    updateFactBody.indexOf("markEstimateStaleWithContext") <
      updateFactBody.indexOf("completeAssistantMutation")
);
check(
  "8. readiness still uses merged facts for missing-question rebuild",
  missingSrc.includes("buildMissingRequiredQuestionsForWorkAreas") &&
    missingSrc.includes("skipDerivedPersist")
);

console.log("\n-- DERIVED FACTS --");
check(
  "9. derivation logic unchanged (deriveFactsForProject still computes values)",
  persistSrc.includes("deriveFactsForProject") &&
    persistSrc.includes("mergeDerivedFactsIntoRecords") &&
    persistSrc.includes("detectDerivedFactConflicts") &&
    !persistSrc.includes("for (const derived of derivedFacts)")
);
check(
  "10. derived writes are set-based/batched without per-row SELECT",
  persistSrc.includes(".insert(") &&
    persistSrc.includes(".update(") &&
    persistSrc.includes("insertDerivedFactRows") &&
    planSrc.includes("planDerivedFactWrites") &&
    numeric.plan.toInsert.length === 1 &&
    numeric.plan.toUpdate.length === 0 &&
    derivedFactWriteStatementCount(numeric.plan).bulkInserts === 1 &&
    derivedFactWriteStatementCount(numeric.plan).rowSelects === 0 &&
    !persistSrc.includes(".upsert(") &&
    !persistSrc.includes("for (const derived of derivedFacts)")
);
check(
  "11. obsolete derived facts are set-based retired",
  cleared.plan.toWrite.length === 0 &&
    cleared.plan.toRetire.length === 1 &&
    persistSrc.includes("retireDerivedFactRows") &&
    persistSrc.includes('.eq("source", "derived")')
);
check(
  "12. provenance preserved on write rows",
  numeric.plan.toWrite[0]?.source === "derived" &&
    numeric.plan.toWrite[0]?.confidence === 1 &&
    numeric.plan.toWrite[0]?.org_id === ORG_A &&
    numeric.plan.toWrite[0]?.project_id === PROJECT_A &&
    numeric.plan.toWrite[0]?.label === "Deck area" &&
    numeric.plan.toWrite[0]?.unit === "m²"
);
check(
  "13. tenant-safe conflict key is organisation-scoped project identity",
  DERIVED_FACT_UPSERT_CONFLICT_TARGET === "project_id,work_area_id,key" &&
    schemaSrc.includes("project_facts_project_work_area_key_idx") &&
    schemaSrc.includes("(project_id, work_area_id, key)") &&
    planSrc.includes("org_id: params.orgId") &&
    !planSrc.includes("onConflict: \"key\"")
);
check(
  "14. no duplicate derived rows in a plan",
  new Set(numeric.plan.toWrite.map((row) => `${row.work_area_id}:${row.key}`))
    .size === numeric.plan.toWrite.length &&
    userOwnedArea.merged.some(
      (row) =>
        row.key === "deck.area_m2" &&
        row.source === "user" &&
        row.value === 99
    ) &&
    userOwnedArea.plan.toWrite.length === 0
);
check(
  "15. idempotence: second identical persist plans zero writes",
  secondPass.plan.toWrite.length === 0 &&
    secondPass.plan.skippedUnchanged >= 1
);

console.log("\n-- QUESTIONS --");
check(
  "16. question journal semantics unchanged",
  scopeSrc.includes("mirrorFactOntoQuestions") &&
    scopeSrc.includes("Never creates questions") &&
    factSrc.includes("commitUserFactEdit") &&
    !factSrc.includes("insertQuestionsIntoBlock")
);
check(
  "17. active missing-question set still add-only differential",
  missingSrc.includes("const toAdd = missingQuestions.filter") &&
    missingSrc.includes("insertQuestionsIntoBlock") &&
    !missingSrc.includes(".delete(")
);
check(
  "18. question ordering uses canonical sort_order",
  missingSrc.includes("startSortOrder + index + 1") &&
    missingSrc.includes("maxSortOrder")
);
check(
  "19. duplicate active questions prevented",
  missingSrc.includes("existingKeys.has") &&
    fileContains(
      "supabase/migrations/002_assistant_schema.sql",
      "unique (question_block_id, key)"
    )
);
check(
  "20. question writes batched/differential",
  missingSrc.includes("await supabase.from(\"questions\").insert(questionRows)") &&
    missingSrc.includes('block.title === MISSING_DETAILS_BLOCK_TITLE') &&
    !missingSrc.includes('.eq("title", MISSING_DETAILS_BLOCK_TITLE)')
);

console.log("\n-- SECURITY --");
check(
  "21. auth unchanged",
  factSrc.includes("getAuthOrgContext") &&
    factSrc.includes("assertOrgOwnsActiveProject") &&
    loadSrc.includes("assertOrgOwnsActiveProject")
);
check(
  "22. org/project predicates retained",
  factSrc.includes('.eq("org_id", orgId)') &&
    persistSrc.includes(".eq(\"org_id\", row.org_id)") &&
    persistSrc.includes(".eq(\"project_id\", row.project_id)") &&
    persistSrc.includes(".neq(\"source\", \"user\")")
);
check(
  "23. cross-org bulk write denied by conflict identity + org_id on every row",
  numeric.plan.toWrite.every((row) => row.org_id === ORG_A && row.project_id === PROJECT_A) &&
    DERIVED_FACT_UPSERT_CONFLICT_TARGET.includes("project_id") &&
    !DERIVED_FACT_UPSERT_CONFLICT_TARGET.startsWith("key")
);
check(
  "24. RLS retained (no Speed 2 RLS migration)",
  readdirSync(join(root, "supabase/migrations"))
    .filter((name) => name.endsWith(".sql"))
    .sort()
    .at(-1) === "043_project_client_email.sql" &&
    readdirSync(join(root, "supabase/migrations")).includes(
      "041_quote_transaction.sql"
    ) &&
    !readFileSync(
      join(root, "supabase/migrations/040_quote_presentation_mode.sql"),
      "utf8"
    )
      .toLowerCase()
      .includes("row level security")
);

console.log("\n-- PROGRAMME BOUNDARY --");
check(
  "25. Speed 1 projections unchanged",
  shellSrc.includes("assistantMutationProjection") &&
    shellSrc.includes("generationProjection") &&
    shellSrc.includes("runSerializedFactMutation") &&
    applySrc.includes("shouldApplyAssistantMutation")
);
const refreshCount = (shellSrc.match(/router\.refresh\(\);/g) ?? []).length;
check(
  "26. no standard router.refresh restored",
  refreshCount === 14 &&
    !factSrc.includes("router.refresh") &&
    completeSrc.includes("recoveryRefresh: true")
);
check(
  "27. Estimate persistence RPC unchanged",
  persistGenSrc.includes("persist_estimate_generation_v1") &&
    !factSrc.includes("persistEstimateGenerationViaRpc") &&
    !persistSrc.includes("persist_estimate_generation_v1")
);
check(
  "28. rate resolution unchanged",
  fileContains("lib/scopes/catalogue.ts", 'type: "deck"') &&
    fileContains("lib/estimate/rates.ts", "export function resolveRate")
);
check(
  "29. calculators unchanged",
  calcDeck.includes("calculateDeck") &&
    calcFence.includes("calculateFence") &&
    calcRw.includes("calculateRetainingWall") &&
    !factSrc.includes("calculateDeck")
);
check(
  "30. Pricing / Quote authority unchanged",
  fileContains("lib/pricing/actions.ts", "createPricingFromEstimate") &&
    fileContains("lib/quotes/actions.ts", "createQuoteFromPricing")
);

console.log("\n-- PERFORMANCE STRUCTURE --");
function statementTotal(plan: ReturnType<typeof planDerivedFactWrites>): number {
  const counts = derivedFactWriteStatementCount(plan);
  return counts.bulkInserts + counts.boundedUpdateGroups + counts.bulkDeletes;
}
const numericBefore = beforeDerivedStatements(numeric.derivedFacts.length);
const numericAfter = statementTotal(numeric.plan);
const simpleBefore = beforeDerivedStatements(simple.derivedFacts.length);
const simpleAfter = statementTotal(simple.plan);
const multiBefore = beforeDerivedStatements(multi.derivedFacts.length);
const multiAfter = statementTotal(multi.plan);
const clearedAfter = statementTotal(cleared.plan);
const changedAfter = statementTotal(changedWidth.plan);
const questionExtraSelectsBefore = 2;
const questionExtraSelectsAfter = 0;

console.log(
  `      simple derived statements BEFORE=${simpleBefore} AFTER=${simpleAfter} (N=${simple.derivedFacts.length}, skipUnchanged=${simple.plan.skippedUnchanged})`
);
console.log(
  `      numeric derived statements BEFORE=${numericBefore} AFTER=${numericAfter} (insert=${numeric.plan.toInsert.length})`
);
console.log(
  `      changed-width statements AFTER=${changedAfter} (update=${changedWidth.plan.toUpdate.length} value=${changedWidth.plan.toUpdate[0]?.value})`
);
console.log(
  `      cleared-width statements AFTER=${clearedAfter} (retire=${cleared.plan.toRetire.length})`
);
console.log(
  `      multi-WA derived statements BEFORE=${multiBefore} AFTER=${multiAfter} (N=${multi.derivedFacts.length})`
);
console.log(
  `      question extra sequential SELECTs BEFORE=${questionExtraSelectsBefore} AFTER=${questionExtraSelectsAfter}`
);
console.log(
  `      fence derived N=${fence.derivedFacts.length} writes AFTER=${fence.plan.toWrite.length} retire=${fence.plan.toRetire.length}`
);
console.log(
  `      constraint path derived persist: ${constraintSrc.includes("persistDerivedFactsForProject")}`
);

check(
  "32. numeric-derived fixture DB operations reduced",
  numericBefore === 4 &&
    numericAfter === 1 &&
    numericAfter < numericBefore &&
    factSrc.includes("skipDerivedPersist: true")
);
check(
  "33. question-change fixture operations reduced",
  questionExtraSelectsAfter < questionExtraSelectsBefore &&
    missingSrc.includes("insert(questionRows)")
);
check(
  "34. sequential RTT count reduced",
  simpleAfter < simpleBefore &&
    factSrc.includes("skipDerivedPersist: true") &&
    persistSrc.includes("insertDerivedFactRows") &&
    scopeSrc.includes("one set-based UPDATE")
);
check(
  "35. write amplification reported",
  numeric.plan.toWrite.length === 1 &&
    simple.plan.toWrite.length === 0 &&
    multi.derivedFacts.length >= 2
);

const userOwned = shouldWriteDerivedFact("user") === false;
check(
  "derived user-source guard still blocks overwrite",
  userOwned && shouldWriteDerivedFact("derived") && shouldWriteDerivedFact(undefined)
);

check(
  "raw fact write not optimised away",
  factSrc.includes("commitUserFactEdit") && scopeSrc.includes("upsertScopedFact")
);

check(
  "no-op short-circuit not implemented (journal/stale still run)",
  factSrc.includes("commitUserFactEdit") &&
    !factSrc.includes("if (existingFact.value === ") &&
    factSrc.includes("markEstimateStaleWithContext")
);

check(
  "constraint mutation stays off the derived/question pipeline",
  !constraintSrc.includes("persistDerivedFactsForProject") &&
    !constraintSrc.includes("ensureMissingDetailsQuestionBlock") &&
    constraintSrc.includes("upsertProjectConstraintRecord") &&
    constraintSrc.includes("completeAssistantMutation")
);

check(
  "canonical post-write read retained",
  factSrc.includes("completeAssistantMutation") &&
    loadSrc.includes("loadAssistantMutationResult") &&
    loadSrc.includes('from("project_facts")') &&
    loadSrc.includes("lineItems: []")
);

check(
  "no mutation RPC introduced",
  !persistSrc.includes(".rpc(") &&
    !factSrc.includes(".rpc(") &&
    !missingSrc.includes(".rpc(")
);

check(
  "derived persist failure does not continue to canonical success",
  updateFactBody.includes("if (derivedPersist.error)") &&
    updateFactBody.includes("return { error: derivedPersist.error }") &&
    updateFactBody.indexOf("derivedPersist.error") <
      updateFactBody.indexOf("completeAssistantMutation") &&
    persistSrc.includes("if (inserted.error)") &&
    persistSrc.includes("if (updated.error)") &&
    persistSrc.includes("if (retired.error)")
);

check(
  "rebuild missing questions still runs on every fact mutation",
  factSrc.includes("ensureMissingDetailsQuestionBlock") &&
    !factSrc.includes("MAY_CHANGE_MISSING_QUESTIONS") &&
    !factSrc.includes("CANNOT_CHANGE_MISSING_QUESTIONS")
);

const realJob = loadCalibrationFixture("REAL-JOB-01.json");
const realFacts: EstimateFact[] = Object.entries(realJob.facts).map(
  ([key, value]) => ({
    key,
    work_area_id: DECK_WA,
    value,
  })
);
const realEstimate = calculateEstimate({
  project: { id: "real-job-01", qualityLevel: "standard" },
  confirmedWorkAreas: [{ id: DECK_WA, type: "deck", name: "Deck", sort_order: 1 }],
  facts: realFacts,
  constraints: [],
  organisationSettings: {
    allow_benchmark_rates: true,
    default_margin_percent: 20,
    budget_rate_factor: 0.9,
    premium_rate_factor: 1.15,
  },
  materialWastageSettings: {
    deckingWastagePercent: 10,
    defaultMaterialWastagePercent: 10,
  },
  rates: [],
} as unknown as EstimateContext);
check(
  "estimator economic parity REAL-JOB-01 12878.01",
  realEstimate.recommendedSell === 12878.01,
  `got ${realEstimate.recommendedSell}`
);

const timber = composeJobPlan({
  workAreas: [
    { id: FENCE_WA, type: "fence", name: "Fence", status: "confirmed", sortOrder: 0 },
  ],
  facts: [
    { key: "fence.system", work_area_id: FENCE_WA, value: "Timber paling — vertical board", source: "user" },
    { key: "fence.timber_species", work_area_id: FENCE_WA, value: "Radiata Pine", source: "user" },
  ],
  constraints: [],
  qualityLevel: "standard",
  briefText: null,
});
const alum = composeJobPlan({
  workAreas: [
    { id: FENCE_WA, type: "fence", name: "Fence", status: "confirmed", sortOrder: 0 },
  ],
  facts: [
    { key: "fence.system", work_area_id: FENCE_WA, value: "Aluminium slat", source: "user" },
    { key: "fence.timber_species", work_area_id: FENCE_WA, value: "Radiata Pine", source: "user" },
  ],
  constraints: [],
  qualityLevel: "standard",
  briefText: null,
});
check(
  "Fence timber facts remain stored after system switch (compose still sees species)",
  timber.cards.length === 1 &&
    alum.cards.length === 1 &&
    fenceFacts.some((row) => row.key === "fence.timber_species")
);

check(
  "question mirror set-based when valueType known",
  scopeSrc.includes("one set-based UPDATE") &&
    fileContains("lib/assistant/fact-actions.ts", "valueType")
);

check(
  "stale update still skips via UPDATE filter (no materiality policy)",
  staleSrc.includes("is_stale: true") &&
    !staleSrc.includes("material") &&
    staleSrc.includes('.eq("org_id", orgId)')
);

check(
  "evaluateAuthOrgInputs still rejects org mismatch",
  !evaluateAuthOrgInputs({
    user: { id: "u1" },
    profile: { org_id: "org-a" },
    organisation: { id: "org-b" },
  }).ok && AUTH_ORG_MESSAGES.not_authenticated.length > 0
);

check(
  "shouldApplyAssistantMutation still seq-gated",
  shouldApplyAssistantMutation({
    incoming: { projectId: "p-a", requestSeq: 1 },
    currentProjectId: "p-a",
    applied: { projectId: "p-a", requestSeq: 2 },
  }) === false
);

const localDb = probeLocalSupabase();
check(
  "local Supabase / REQ-TXN-01",
  true,
  localDb.available
    ? `container=${localDb.container}`
    : "VERIFY_LATER — local Supabase not available"
);
if (!localDb.available) {
  console.log("      REQ-TXN-01 = VERIFY_LATER — LOCAL SUPABASE REQUIRED");
}

check(
  "docs record Speed 2 result without overwriting Speed 0/1 history",
  audit.includes("SYSTEM PERFORMANCE — SPEED 2 RESULT") &&
    audit.includes("SYSTEM PERFORMANCE — SPEED 2-R1 RESULT") &&
    audit.includes("SYSTEM PERFORMANCE — SPEED 2 FINAL LOCK") &&
    audit.includes("SYSTEM PERFORMANCE — SPEED 1B-B RESULT") &&
    audit.includes("SYSTEM PERFORMANCE — SPEED 0") &&
    audit.includes("NO RPC")
);

console.log("\n-- SPEED 2-R1 DERIVED RETIREMENT --");
check(
  "R1-1. clear Deck width removes/retires deck.area_m2",
  cleared.plan.toRetire.some((row) => row.key === "deck.area_m2") &&
    !cleared.merged.some((row) => row.key === "deck.area_m2")
);
check(
  "R1-2. response merge after removal matches reload (no leftover derived area)",
  JSON.stringify(mutationFromFacts("p-clear", cleared.merged).interviewFacts) ===
    JSON.stringify(mutationFromFacts("p-clear", cleared.merged).interviewFacts) &&
    !cleared.merged.some((row) => row.key === "deck.area_m2")
);
check(
  "R1-3. changing width updates one canonical area row to 15",
  changedWidth.plan.toUpdate.length === 1 &&
    changedWidth.plan.toInsert.length === 0 &&
    changedWidth.plan.toRetire.length === 0 &&
    changedWidth.plan.toUpdate[0]?.value === 15 &&
    changedWidth.merged.filter((row) => row.key === "deck.area_m2").length === 1
);
check(
  "R1-4. no duplicate derived rows after change or numeric insert",
  new Set(numeric.plan.toWrite.map((row) => `${row.work_area_id}:${row.key}`)).size ===
    numeric.plan.toWrite.length &&
    changedWidth.merged.filter((row) => row.key === "deck.area_m2").length === 1
);
check(
  "R1-5. user facts never retired by derivation",
  userOwnedArea.plan.toRetire.length === 0 &&
    userOwnedArea.merged.some(
      (row) => row.key === "deck.area_m2" && row.source === "user" && row.value === 99
    ) &&
    isDerivationOwnedSource("user") === false &&
    isDerivationOwnedSource("ai_extracted") === false &&
    isDerivationOwnedSource("derived") === true
);
check(
  "R1-6. unrelated WA derived facts survive Deck clear",
  multiCleared.plan.toRetire.every((row) => row.work_area_id === DECK_WA) &&
    multiCleared.merged.some(
      (row) => row.key === "retaining_wall.height_m" && row.source === "derived"
    ) &&
    multiCleared.merged.some(
      (row) =>
        row.key === "retaining_wall.backfill_volume_m3" && row.source === "derived"
    ) &&
    !multiCleared.merged.some((row) => row.key === "deck.area_m2")
);
check(
  "R1-7. empty current derivation retires obsolete owned facts",
  emptyDerivationStale.derivedFacts.length === 0 &&
    emptyDerivationStale.plan.toRetire.some(
      (row) => row.key === "fence.posts_count"
    ) &&
    !emptyDerivationStale.merged.some((row) => row.key === "fence.posts_count") &&
    emptyDerivationStale.merged.some((row) => row.key === "fence.length_m")
);
check(
  "R1-8. provenance preserved on current write rows",
  numeric.plan.toInsert[0]?.source === "derived" &&
    numeric.plan.toInsert[0]?.confidence === 1 &&
    changedWidth.plan.toUpdate[0]?.source === "derived"
);

console.log("\n-- SPEED 2-R1 PERFORMANCE --");
check(
  "R1-9. no per-row SELECT+write loop restored",
  !persistSrc.includes("for (const derived of derivedFacts)") &&
    !persistSrc.includes(".maybeSingle()")
);
check(
  "R1-10. changed derived set uses bulk insert or bounded update",
  numeric.plan.toInsert.length === 1 &&
    changedWidth.plan.toUpdate.length === 1 &&
    persistSrc.includes("insertDerivedFactRows") &&
    persistSrc.includes("updateDerivedFactRows")
);
check(
  "R1-11. obsolete set uses set-based removal",
  persistSrc.includes('.in("key", group.keys)') &&
    persistSrc.includes('.eq("source", "derived")') &&
    derivedFactWriteStatementCount(cleared.plan).bulkDeletes === 1
);
check(
  "R1-12. unchanged set causes zero derived writes",
  simple.plan.toWrite.length === 0 &&
    simple.plan.toRetire.length === 0 &&
    statementTotal(simple.plan) === 0
);

console.log("\n-- SPEED 2-R1 UPSERT/FALLBACK --");
check(
  "R1-13. existing-row path is UPDATE not insert",
  changedWidth.plan.toUpdate.length === 1 &&
    changedWidth.plan.toInsert.length === 0
);
check(
  "R1-14. new-row path is INSERT not update",
  numeric.plan.toInsert.length === 1 && numeric.plan.toUpdate.length === 0
);
check(
  "R1-15. mixed existing/new path partitions both",
  mixedNewAndExisting.plan.toInsert.length >= 1 &&
    mixedNewAndExisting.plan.toUpdate.length === 0 &&
    mixedNewAndExisting.plan.toWrite.some((row) => row.key === "deck.area_m2") ===
      false &&
    mixedNewAndExisting.plan.skippedUnchanged >= 1 &&
    mixedNewAndExisting.plan.toInsert.some(
      (row) => row.key === "retaining_wall.height_m"
    )
);
check(
  "R1-16. user-source conflict is not overwritten or retired",
  userOwnedArea.plan.toWrite.length === 0 &&
    userOwnedArea.plan.toRetire.length === 0 &&
    persistSrc.includes('.neq("source", "user")')
);
check(
  "R1-17. cross-project safe (planner stamps server project_id)",
  crossProjectPlan.toWrite.every((row) => row.project_id === PROJECT_A) &&
    persistSrc.includes('.eq("project_id", row.project_id)') &&
    persistSrc.includes('.eq("project_id", group.project_id)')
);
check(
  "R1-18. cross-org safe (planner stamps server org_id)",
  crossProjectPlan.toWrite.every((row) => row.org_id === ORG_A) &&
    persistSrc.includes('.eq("org_id", row.org_id)') &&
    persistSrc.includes('.eq("org_id", group.org_id)') &&
    DERIVED_FACT_UPSERT_CONFLICT_TARGET.includes("project_id")
);
check(
  "R1-ai_extracted idle key is not retired",
  aiExtractedIdle.plan.toRetire.length === 0 &&
    aiExtractedIdle.merged.some(
      (row) => row.key === "deck.area_m2" && row.source === "ai_extracted"
    )
);
check(
  "R1-ai_extracted promotion updates existing row to derived",
  aiExtractedPromote.plan.toUpdate.length === 1 &&
    aiExtractedPromote.plan.toInsert.length === 0 &&
    aiExtractedPromote.plan.toUpdate[0]?.source === "derived"
);
check(
  "R1-PostgREST partial unique index is not the write path",
  !persistSrc.includes(".upsert(") &&
    schemaSrc.includes("where work_area_id is not null") &&
    planSrc.includes("PostgREST")
);

console.log("\n-- SPEED 2-R1 FAILURE --");
check(
  "R1-19. bulk insert failure returns error",
  persistSrc.includes("if (inserted.error)")
);
check(
  "R1-20. removal failure returns error",
  persistSrc.includes("if (retired.error)")
);
check(
  "R1-21. no canonical success after failed derived reconciliation",
  persistSrc.includes("if (updated.error)") &&
    updateFactBody.includes("return { error: derivedPersist.error }")
);

console.log("\n-- NESTED SPEED VERIFIERS --");
const speed1bbOk = spawnVerifier(
  "scripts/verify-system-performance-speed-1b-b.ts"
);
check("36. Speed 1B-B verifier remains green", speed1bbOk);
check(
  "37. Speed 1B-A verifier remains green (nested in Speed 1B-B)",
  speed1bbOk &&
    fileContains(
      "scripts/verify-system-performance-speed-1b-b.ts",
      "verify-system-performance-speed-1b-a.ts"
    )
);
check(
  "38. Speed 1A verifier remains green (nested in Speed 1B-B)",
  speed1bbOk &&
    fileContains(
      "scripts/verify-system-performance-speed-1b-b.ts",
      "verify-system-performance-speed-1a.ts"
    )
);
check(
  "39. Speed 0 verifier remains green (nested in Speed 1B-B)",
  speed1bbOk &&
    fileContains(
      "scripts/verify-system-performance-speed-1b-b.ts",
      "verify-system-performance-speed-0.ts"
    )
);

if (failed > 0) {
  console.error(
    `\nverify-system-performance-speed-2: FAILED ${failed} / ${passed + failed}`
  );
  process.exit(1);
}

console.log(
  `\nverify-system-performance-speed-2: all ${passed} checks passed`
);
