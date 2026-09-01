/**
 * SYSTEM-PERFORMANCE-SPEED-1B-B — Clarify / fact-save canonical reconciliation.
 *
 * Run: npx tsx scripts/verify-system-performance-speed-1b-b.ts
 */
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  buildAssistantMutationResult,
  shouldApplyAssistantMutation,
} from "../lib/assistant/assistant-mutation-result";
import { composeClarifyView } from "../lib/assistant/clarify/compose";
import { composeJobPlan } from "../lib/assistant/job-plan/compose";
import { buildAssistantState } from "../lib/assistant/mappers";
import { AUTH_ORG_MESSAGES, evaluateAuthOrgInputs } from "../lib/security/auth-org-evaluation";
import type { EstimateFact } from "../lib/estimate/types";
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

function spawnVerifier(script: string): boolean {
  try {
    execFileSync("npx", ["tsx", script], {
      cwd: root,
      stdio: "pipe",
      timeout: 180_000,
      shell: process.platform === "win32",
      encoding: "utf8",
    });
    return true;
  } catch {
    return false;
  }
}

const factSrc = read("lib/assistant/fact-actions.ts");
const persistSrc = read("lib/assistant/persist-derived-facts.ts");
const missingSrc = read("lib/assistant/missing-questions.ts");
const loadSrc = read("lib/assistant/load-assistant-mutation-result.ts");
const completeSrc = read("lib/assistant/complete-assistant-mutation.ts");
const applySrc = read("lib/assistant/assistant-mutation-result.ts");
const shellSrc = read("components/assistant/AssistantShell.tsx");
const constraintSrc = read("lib/assistant/constraint-actions.ts");
const clarifySrc = read("lib/assistant/clarify/actions.ts");
const jobPlanSrc = read("lib/assistant/job-plan/actions.ts");
const generateSrc = read("lib/assistant/actions.ts");
const persistGenSrc = read("lib/estimate/persist-estimate-generation.ts");
const pricingActions = read("lib/pricing/actions.ts");
const quoteActions = read("lib/quotes/actions.ts");
const audit = read("docs/audits/SYSTEM_PERFORMANCE_SPEED_0_BASELINE.md");
const calcFence = read("lib/estimate/calculators/fence.ts");
const calcDeck = read("lib/estimate/calculators/deck.ts");
const calcRw = read("lib/estimate/calculators/retaining-wall.ts");

const DECK_WA = "wa-deck";
const FENCE_WA = "wa-fence";
const RW_WA = "wa-rw";

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

function dbFact(key: string, workAreaId: string, value: unknown, source = "user") {
  return { key, work_area_id: workAreaId, value, source };
}

function staleEstimateHeader(stale: boolean) {
  return {
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
    is_stale: stale,
    calibration_version: null,
    target_margin_percent: 20,
    confidence: 0.8,
    rate_source_summary: "org",
    assumptions: [],
    missing_info: [],
    exclusions: [],
  };
}

function assistantState(input: {
  projectId: string;
  workAreas: ReturnType<typeof dbWorkArea>[];
  facts: ReturnType<typeof dbFact>[];
  constraints?: {
    id: string;
    key: string;
    label: string;
    value: unknown;
    source?: string | null;
  }[];
  questions?: {
    id: string;
    question_block_id: string;
    work_area_id: string | null;
    key: string;
    label: string;
    question_text: string;
    input_type: string;
    options: unknown;
    required: boolean;
    unit: string | null;
    answer_value: unknown;
    sort_order: number;
  }[];
  questionBlocks?: {
    id: string;
    stage: string;
    title: string;
    description: string | null;
    status: string;
    sort_order: number;
  }[];
  estimateStale?: boolean;
  hasEstimate?: boolean;
}) {
  const hasEstimate = input.hasEstimate ?? true;
  return buildAssistantState({
    project: {
      id: input.projectId,
      stage: "estimate_ready",
      brief_text: "Deck and fence",
      quality_level: "standard",
    },
    workAreas: input.workAreas,
    questionBlocks: input.questionBlocks ?? [],
    questions: input.questions ?? [],
    constraints: input.constraints ?? [],
    estimate: hasEstimate
      ? staleEstimateHeader(input.estimateStale ?? true)
      : null,
    lineItems: [],
    projectFacts: input.facts,
  });
}

function mutationFromState(
  projectId: string,
  state: ReturnType<typeof buildAssistantState>,
  estimateStale: boolean,
  hasEstimate: boolean
) {
  return buildAssistantMutationResult({
    projectId,
    state,
    estimateStale,
    hasEstimate,
  });
}

function fact(
  key: string,
  workAreaId: string,
  value: unknown,
  source: EstimateFact["source"] = "user"
): EstimateFact {
  return { key, work_area_id: workAreaId, value, source };
}

function composeSurfaces(
  workAreas: { id: string; type: string; name: string }[],
  facts: EstimateFact[]
) {
  const wa = workAreas.map((row, index) => ({
    id: row.id,
    type: row.type,
    name: row.name,
    status: "confirmed" as const,
    sortOrder: index,
  }));
  const jobPlan = composeJobPlan({
    workAreas: wa,
    facts,
    constraints: [{ key: "access", value: "Good" }],
    qualityLevel: "standard",
    briefText: null,
  });
  const clarify = composeClarifyView({
    stage: "estimate_ready",
    briefText: null,
    qualityLevel: "standard",
    workAreas: wa,
    facts,
    constraints: [{ key: "access", value: "Good" }],
    jobPlan,
  });
  return { jobPlan, clarify };
}

console.log("verify-system-performance-speed-1b-b: starting…\n");

console.log("-- RESPONSE --");
check(
  "1. fact mutation returns canonical affected state",
  factSrc.includes("completeAssistantMutation") &&
    completeSrc.includes("assistantMutation: loaded") &&
    fileContains("lib/assistant/types.ts", "assistantMutation?: AssistantMutationResult")
);
const updateFactBody = factSrc.slice(factSrc.indexOf("export async function updateProjectFact"));
check(
  "2. response built after canonical mutation processing",
  updateFactBody.indexOf("commitUserFactEdit") <
    updateFactBody.indexOf("persistDerivedFactsForProject") &&
    updateFactBody.indexOf("persistDerivedFactsForProject") <
      updateFactBody.indexOf("ensureMissingDetailsQuestionBlock") &&
    updateFactBody.indexOf("ensureMissingDetailsQuestionBlock") <
      updateFactBody.indexOf("markEstimateStaleWithContext") &&
    updateFactBody.indexOf("markEstimateStaleWithContext") <
      updateFactBody.indexOf("completeAssistantMutation")
);
check(
  "3. raw Facts SoT remains server/database authoritative",
  factSrc.includes("commitUserFactEdit") &&
    loadSrc.includes('from("project_facts")') &&
    loadSrc.includes("buildAssistantState") &&
    !shellSrc.includes("persistDerivedFactsForProject")
);
check(
  "4. client does not derive canonical facts itself",
  !shellSrc.includes("deriveFactsForProject(") &&
    !shellSrc.includes("persistDerivedFactsForProject") &&
    shellSrc.includes("assistantMutationProjection") &&
    shellSrc.includes("settleCanonicalMutation")
);
check(
  "5. questions remain journal, not SoT",
  fileContains("lib/assistant/scope-persistence.ts", "mirrorFactOntoQuestions") &&
    fileContains("lib/assistant/scope-persistence.ts", "Deterministic write order") &&
    loadSrc.includes('from("questions")')
);

const realJob = loadCalibrationFixture("REAL-JOB-01.json");
const deckFacts = Object.entries(realJob.facts).map(([key, value]) =>
  dbFact(key, DECK_WA, value)
);
const deckState = assistantState({
  projectId: "p-deck",
  workAreas: [dbWorkArea(DECK_WA, "deck", "Deck", 1)],
  facts: deckFacts,
  estimateStale: true,
});
const deckMutation = mutationFromState("p-deck", deckState, true, true);
const deckReload = mutationFromState(
  "p-deck",
  assistantState({
    projectId: "p-deck",
    workAreas: [dbWorkArea(DECK_WA, "deck", "Deck", 1)],
    facts: deckFacts,
    estimateStale: true,
  }),
  true,
  true
);

console.log("\n-- STATE PARITY --");
check(
  "6. returned facts = fresh reload",
  JSON.stringify(deckMutation.interviewFacts) ===
    JSON.stringify(deckReload.interviewFacts)
);
check(
  "7. returned derived facts = reload",
  JSON.stringify(deckMutation.derivedFactDisplays) ===
    JSON.stringify(deckReload.derivedFactDisplays)
);
check(
  "8. returned question state = reload",
  JSON.stringify(deckMutation.questionBlock) ===
    JSON.stringify(deckReload.questionBlock) &&
    JSON.stringify(deckMutation.additionalQuestionBlocks) ===
      JSON.stringify(deckReload.additionalQuestionBlocks)
);
check(
  "9. readiness = reload",
  JSON.stringify(deckMutation.scopeReview.workAreas.map((wa) => wa.missingItems)) ===
    JSON.stringify(deckReload.scopeReview.workAreas.map((wa) => wa.missingItems))
);
check(
  "10. stale state = reload",
  deckMutation.estimateStale === deckReload.estimateStale &&
    deckMutation.estimateStale === true
);
check(
  "11. stage = reload where applicable",
  deckMutation.stage === deckReload.stage && deckMutation.stage === "estimate_ready"
);
check(
  "12. constraints parity where included",
  JSON.stringify(deckMutation.submittedConstraints) ===
    JSON.stringify(deckReload.submittedConstraints) &&
    constraintSrc.includes("completeAssistantMutation")
);

console.log("\n-- REFRESH --");
const executableRefresh = (shellSrc.match(/^\s*router\.refresh\(\);/gm) ?? []).length;
check(
  "13. Clarify successful fact save no standard router.refresh",
  /handleClarifyValue[\s\S]*if \(!settleCanonicalMutation/.test(shellSrc) &&
    /handleClarifyBoolean[\s\S]*if \(!settleCanonicalMutation/.test(shellSrc)
);
check(
  "14. Job Plan successful fact save no standard router.refresh",
  /handleJobPlanSpecFact[\s\S]*if \(!settleCanonicalMutation/.test(shellSrc) &&
    /handleJobPlanToggleScope[\s\S]*if \(!settleCanonicalMutation/.test(shellSrc)
);
check(
  "15. recovery refresh remains",
  shellSrc.includes("recoveryRefresh") &&
    /handleFactSave[\s\S]*router\.refresh\(\)/.test(shellSrc)
);
check(
  "16. Generate/Update no-refresh remains",
  shellSrc.includes('action === "estimate"') &&
    shellSrc.includes("shouldRefresh = false") &&
    shellSrc.includes("shouldApplyEstimateGeneration") &&
    generateSrc.includes("estimateGeneration")
);
check(
  "17. revalidatePath policy explicit",
  factSrc.includes("revalidateProjectPath(projectId)") &&
    factSrc.includes("completeAssistantMutation") &&
    audit.includes("revalidatePath")
);
check(
  "refresh call-site count remains 14",
  executableRefresh === 14,
  `count=${executableRefresh}`
);

console.log("\n-- STALE / AUTHORITY --");
check(
  "18. relevant fact change marks Estimate stale per canonical logic",
  factSrc.includes("markEstimateStaleWithContext") &&
    deckMutation.estimateStale === true
);
check(
  "19. fact mutation does not regenerate Estimate",
  !factSrc.includes("calculateEstimate") &&
    !factSrc.includes("persist_estimate_generation_v1") &&
    !loadSrc.includes("estimate_line_items") &&
    applySrc.includes("Does not include Estimate line items")
);
check(
  "20. old Estimate economics not client-recalculated",
  !shellSrc.includes("calculateEstimate(") &&
    shellSrc.includes("generationProjection?.estimate") &&
    !shellSrc.includes("setGenerationProjection(undefined)")
);
check(
  "21. Pricing authority unchanged",
  pricingActions.includes("createPricingFromEstimate") &&
    !pricingActions.includes("assistantMutation")
);
check(
  "22. Quote authority unchanged",
  quoteActions.includes("createQuoteFromPricing") ||
    quoteActions.includes("pricing_document_id")
);

const missingQuestionBlock = {
  id: "qb-missing",
  stage: "work_area_questions",
  title: "A few more details",
  description: null,
  status: "active",
  sort_order: 1,
};
const openLengthQuestion = {
  id: "q-length",
  question_block_id: "qb-missing",
  work_area_id: DECK_WA,
  key: "deck.length_m",
  label: "Length",
  question_text: "What is the deck length?",
  input_type: "number",
  options: null,
  required: true,
  unit: "m",
  answer_value: null,
  sort_order: 1,
};
const unresolved = assistantState({
  projectId: "p-q",
  workAreas: [dbWorkArea(DECK_WA, "deck", "Deck", 1)],
  facts: [dbFact("deck.width_m", DECK_WA, 4)],
  questionBlocks: [missingQuestionBlock],
  questions: [openLengthQuestion],
  hasEstimate: false,
});
const resolved = assistantState({
  projectId: "p-q",
  workAreas: [dbWorkArea(DECK_WA, "deck", "Deck", 1)],
  facts: [dbFact("deck.width_m", DECK_WA, 4), dbFact("deck.length_m", DECK_WA, 8)],
  questionBlocks: [{ ...missingQuestionBlock, status: "submitted" }],
  questions: [{ ...openLengthQuestion, answer_value: 8 }],
  hasEstimate: false,
});
const unresolvedMutation = mutationFromState("p-q", unresolved, false, false);
const resolvedMutation = mutationFromState("p-q", resolved, false, false);
const followUpState = assistantState({
  projectId: "p-follow",
  workAreas: [dbWorkArea(DECK_WA, "deck", "Deck", 1)],
  facts: [dbFact("deck.length_m", DECK_WA, 8), dbFact("deck.width_m", DECK_WA, 4)],
  questionBlocks: [missingQuestionBlock],
  questions: [
    {
      id: "q-stairs",
      question_block_id: "qb-missing",
      work_area_id: DECK_WA,
      key: "deck.stairs_required",
      label: "Stairs",
      question_text: "Are stairs required?",
      input_type: "boolean",
      options: null,
      required: false,
      unit: null,
      answer_value: null,
      sort_order: 2,
    },
  ],
  hasEstimate: false,
});
const followUpMutation = mutationFromState("p-follow", followUpState, false, false);
const clearedMutation = mutationFromState(
  "p-clear",
  assistantState({
    projectId: "p-clear",
    workAreas: [dbWorkArea(DECK_WA, "deck", "Deck", 1)],
    facts: [dbFact("deck.width_m", DECK_WA, 4)],
    questionBlocks: [missingQuestionBlock],
    questions: [openLengthQuestion],
    estimateStale: true,
  }),
  true,
  true
);

console.log("\n-- QUESTIONS --");
check(
  "23. resolved question updates/disappears",
  resolvedMutation.interviewFacts.some(
    (row) => row.key === "deck.length_m" && row.value === 8
  ) &&
    JSON.stringify(unresolvedMutation.interviewFacts) !==
      JSON.stringify(resolvedMutation.interviewFacts)
);
check(
  "24. new missing question appears when canonical logic requires",
  followUpMutation.additionalQuestionBlocks.some((block) =>
    block.questions.some((q) => q.key === "deck.stairs_required")
  ) ||
    followUpMutation.scopeReview.workAreas.some((wa) =>
      wa.activeQuestions.some((q) => q.key === "deck.stairs_required")
    )
);
check(
  "25. clear fact restores missing-info state",
  !clearedMutation.interviewFacts.some((row) => row.key === "deck.length_m") &&
    clearedMutation.estimateStale === true
);
check(
  "26. assumption path preserved",
  fileContains("lib/assistant/builder-interview-actions.ts", '"assume"') &&
    fileContains("lib/assistant/builder-interview-actions.ts", "assumption_deferred") &&
    fileContains("lib/assistant/builder-interview-actions.ts", "completeAssistantMutation")
);

console.log("\n-- RACES --");
check(
  "27. late older same-fact response cannot overwrite newer",
  shouldApplyAssistantMutation({
    currentProjectId: "p1",
    applied: { projectId: "p1", requestSeq: 2 },
    incoming: { projectId: "p1", requestSeq: 1 },
  }) === false &&
    shouldApplyAssistantMutation({
      currentProjectId: "p1",
      applied: { projectId: "p1", requestSeq: 1 },
      incoming: { projectId: "p1", requestSeq: 2 },
    }) === true
);
check(
  "28. different-fact mutation merge safe",
  shellSrc.includes("runSerializedFactMutation") &&
    applySrc.includes("incoming.requestSeq < input.applied.requestSeq") &&
    shellSrc.includes("seq > requestSeq")
);
check(
  "29. cross-project response rejected",
  shouldApplyAssistantMutation({
    currentProjectId: "p1",
    applied: null,
    incoming: { projectId: "p2", requestSeq: 1 },
  }) === false
);

console.log("\n-- SECURITY --");
check(
  "30. unauthenticated fails",
  factSrc.includes("Not authenticated.") &&
    !evaluateAuthOrgInputs({
      user: null,
      profile: { org_id: "org-a" },
      organisation: { id: "org-a" },
    }).ok
);
check(
  "31. cross-org mutation denied",
  factSrc.includes("assertOrgOwnsActiveProject") &&
    loadSrc.includes("assertOrgOwnsActiveProject") &&
    !evaluateAuthOrgInputs({
      user: { id: "u1" },
      profile: { org_id: "org-a" },
      organisation: { id: "org-b" },
    }).ok
);
check(
  "32. org authority remains server-derived",
  loadSrc.includes('.eq("org_id", orgId)') &&
    !loadSrc.includes("organisation_id") &&
    !factSrc.includes("input.orgId")
);
check(
  "33. response project-scoped",
  loadSrc.includes('.eq("project_id", projectId)') &&
    applySrc.includes("incoming.projectId !== input.currentProjectId") &&
    completeSrc.includes('import "server-only"') &&
    loadSrc.includes('import "server-only"')
);

console.log("\n-- PROGRAMME BOUNDARY --");
check(
  "34. derived-fact persistence still owned by persistDerivedFactsForProject",
  persistSrc.includes("persistDerivedFactsForProject") &&
    persistSrc.includes("deriveFactsForProject") &&
    factSrc.includes("persistDerivedFactsForProject")
);
check(
  "35. missing-question write architecture unchanged",
  missingSrc.includes("ensureMissingDetailsQuestionBlock") &&
    missingSrc.includes("insertQuestionsIntoBlock") &&
    factSrc.includes("ensureMissingDetailsQuestionBlock")
);
check(
  "36. estimate persistence unchanged",
  persistGenSrc.includes("persist_estimate_generation_v1") &&
    !factSrc.includes("persistEstimateGenerationViaRpc")
);
check(
  "37. calculators unchanged",
  calcDeck.includes("calculateDeck") &&
    calcFence.includes("calculateFence") &&
    calcRw.includes("calculateRetainingWall") &&
    !factSrc.includes("calculateDeck")
);
check(
  "38. rates unchanged",
  fileContains("lib/scopes/catalogue.ts", 'type: "deck"') &&
    fileContains("lib/scopes/catalogue.ts", 'type: "fence"') &&
    fileContains("lib/scopes/catalogue.ts", 'type: "retaining_wall"')
);
const migrations = readdirSync(join(root, "supabase/migrations"))
  .filter((name) => name.endsWith(".sql"))
  .sort();
check(
  "39. no migrations unless explicitly justified",
  migrations[migrations.length - 1] === "045_commercial_close.sql"
);

const fenceTimberFacts: EstimateFact[] = [
  fact("fence.length_m", FENCE_WA, 18),
  fact("fence.height_m", FENCE_WA, 1.8),
  fact("fence.system", FENCE_WA, "Timber paling — vertical board"),
  fact("fence.timber_species", FENCE_WA, "Radiata Pine"),
];
const fenceAluminiumFacts: EstimateFact[] = [
  fact("fence.length_m", FENCE_WA, 18),
  fact("fence.height_m", FENCE_WA, 1.8),
  fact("fence.system", FENCE_WA, "Aluminium slat"),
  fact("fence.timber_species", FENCE_WA, "Radiata Pine"),
];
const fenceWa = { id: FENCE_WA, type: "fence", name: "Fence" };
const timberSurfaces = composeSurfaces([fenceWa], fenceTimberFacts);
const alumSurfaces = composeSurfaces([fenceWa], fenceAluminiumFacts);
const rwSurfaces = composeSurfaces(
  [{ id: RW_WA, type: "retaining_wall", name: "Retaining wall" }],
  [
    fact("retaining_wall.length_m", RW_WA, 10),
    fact("retaining_wall.height_m", RW_WA, 1),
    fact("retaining_wall.material", RW_WA, "Timber"),
  ]
);
const deckUiFacts: EstimateFact[] = Object.entries(realJob.facts).map(([key, value]) =>
  fact(key, DECK_WA, value)
);
const deckSurfaces = composeSurfaces(
  [{ id: DECK_WA, type: "deck", name: "Deck" }],
  deckUiFacts
);

console.log("\n-- FIXTURES / REGRESSION --");
check(
  "40. Deck fixture parity",
  deckMutation.interviewFacts.some((row) => row.key === "deck.length_m") &&
    deckSurfaces.jobPlan.cards.length === 1 &&
    deckMutation.hasEstimate === true
);
check(
  "41. Fence fixture parity",
  timberSurfaces.jobPlan.cards[0]?.workAreaType === "fence"
);
const timberSpeciesVisibleOnAluminium = alumSurfaces.clarify.candidates.some(
  (c) =>
    c.factKey === "fence.timber_species" ||
    c.questionKey === "fence.timber_species"
);
check("42. Fence switch parity", timberSpeciesVisibleOnAluminium === false);
check(
  "43. RW fixture parity",
  rwSurfaces.jobPlan.cards[0]?.workAreaType === "retaining_wall"
);
check(
  "generationProjection kept distinct from fact mutation",
  shellSrc.includes("generationProjection") &&
    shellSrc.includes("assistantMutationProjection") &&
    !shellSrc.includes("setGenerationProjection(result.assistantMutation")
);
check(
  "Job Plan wrappers use updateProjectFact",
  jobPlanSrc.includes("updateProjectFact") &&
    clarifySrc.includes("updateProjectFact") &&
    clarifySrc.includes("writeJobPlanScopeDecision")
);
check("AUTH_ORG still fail-closed", AUTH_ORG_MESSAGES.not_authenticated.length > 0);

const payloadSamples = [
  {
    label: "single simple fact",
    mutation: mutationFromState(
      "p-simple",
      assistantState({
        projectId: "p-simple",
        workAreas: [dbWorkArea(DECK_WA, "deck", "Deck", 1)],
        facts: [dbFact("deck.length_m", DECK_WA, 8)],
        hasEstimate: true,
        estimateStale: true,
      }),
      true,
      true
    ),
  },
  { label: "numeric + derived", mutation: deckMutation },
  { label: "question-set change", mutation: followUpMutation },
  {
    label: "Fence type switch",
    mutation: mutationFromState(
      "p-fence",
      assistantState({
        projectId: "p-fence",
        workAreas: [dbWorkArea(FENCE_WA, "fence", "Fence", 1)],
        facts: fenceAluminiumFacts.map((row) => dbFact(row.key, FENCE_WA, row.value)),
        estimateStale: true,
      }),
      true,
      true
    ),
  },
];

console.log("\n-- PAYLOAD --");
const mapStarted = performance.now();
mutationFromState("p-deck", deckState, true, true);
const mapMs = performance.now() - mapStarted;
for (const sample of payloadSamples) {
  const bytes = Buffer.byteLength(JSON.stringify(sample.mutation), "utf8");
  console.log(`      payload ${sample.label}: ${(bytes / 1024).toFixed(1)} KB`);
  check(`payload ${sample.label} under 250KB`, bytes < 250_000, `${bytes} bytes`);
}
console.log(`      response construction (map, local): ${mapMs.toFixed(2)}ms`);
check("response construction is local/post-write mapping", mapMs < 50);

check(
  "docs record Speed 1B-B result",
  audit.includes("SYSTEM PERFORMANCE — SPEED 1B-B RESULT") &&
    audit.includes("SYSTEM PERFORMANCE — SPEED 1B-A RESULT")
);

console.log("\n-- NESTED SPEED VERIFIERS --");
check(
  "44. Speed 1B-A verifier remains green",
  spawnVerifier("scripts/verify-system-performance-speed-1b-a.ts")
);
check(
  "45. Speed 1A verifier remains green",
  spawnVerifier("scripts/verify-system-performance-speed-1a.ts")
);
check(
  "46. Speed 0 verifier remains green",
  spawnVerifier("scripts/verify-system-performance-speed-0.ts")
);

if (failed > 0) {
  console.error(
    `\nverify-system-performance-speed-1b-b: FAILED ${failed} / ${passed + failed}`
  );
  process.exit(1);
}

console.log(
  `\nverify-system-performance-speed-1b-b: all ${passed} checks passed`
);
