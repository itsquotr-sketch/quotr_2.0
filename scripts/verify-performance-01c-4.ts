/**
 * PERFORMANCE-01C-4 — selective mutation-result reload consolidation.
 *
 * Run: npx --yes tsx scripts/verify-performance-01c-4.ts
 */
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { detailsReadyCardVisible } from "../lib/assistant/clarify/interaction";
import { buildAssistantMutationResult } from "../lib/assistant/assistant-mutation-result";
import {
  planAssistantMutationResultReloads,
  scalarFactWorkAreaReuse,
} from "../lib/assistant/assistant-mutation-result-reload";
import { buildAssistantState } from "../lib/assistant/mappers";
import {
  commitUserFactEdit,
  resolveCommittedFactWrite,
} from "../lib/assistant/scope-persistence";
import { calculateEstimate } from "../lib/estimate/calculate-estimate";
import { INTERNAL_WALLS_WALL_TYPES_FACT_KEY } from "../lib/estimate/internal-walls-wall-types";
import type {
  EstimateContext,
  EstimateFact,
  EstimateWorkArea,
} from "../lib/estimate/types";
import {
  assertOrgOwnsActiveProject,
  getUnderlyingActiveProjectOwnershipCount,
  resetUnderlyingActiveProjectOwnershipCount,
} from "../lib/security/org-ownership";
import type { AuthOrgContext } from "../lib/security/auth-org-context";
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
  const path = join(root, relativePath);
  if (!existsSync(path)) {
    check(`${relativePath} exists`, false, path);
    return "";
  }
  return readFileSync(path, "utf8");
}

function makeProjectCtx(options: {
  orgId: string;
  projectId: string;
  deleted?: boolean;
  foreign?: boolean;
}): AuthOrgContext & { projectSelects: () => number } {
  let projectSelects = 0;
  const chain = {
    select() {
      projectSelects += 1;
      return this;
    },
    eq() {
      return this;
    },
    is() {
      return this;
    },
    async maybeSingle() {
      if (options.deleted || options.foreign) {
        return { data: null, error: null };
      }
      return { data: { id: options.projectId }, error: null };
    },
  };
  return {
    orgId: options.orgId,
    user: { id: "user-1" },
    supabase: {
      from() {
        return chain;
      },
    },
    projectSelects: () => projectSelects,
  } as AuthOrgContext & { projectSelects: () => number };
}

function dbWorkArea() {
  return {
    id: "wa-1",
    type: "deck",
    name: "Deck",
    status: "confirmed",
    ai_confidence: null,
    summary: null,
    quote_description: null,
    sort_order: 1,
  };
}

function mutationFromFacts(input: {
  facts: { key: string; work_area_id: string | null; value: unknown; source: string | null }[];
  estimateStale: boolean;
}) {
  const state = buildAssistantState({
    project: {
      id: "proj-1",
      stage: "quality",
      brief_text: "Deck",
      quality_level: "standard",
    },
    workAreas: [dbWorkArea()],
    questionBlocks: [],
    questions: [],
    constraints: [],
    estimate: {
      id: "est-1",
      cost_low: null,
      cost_high: null,
      sell_low: null,
      sell_high: null,
      recommended_cost: null,
      recommended_sell: null,
      gross_profit: null,
      margin_percent: null,
      markup_percent: null,
      is_stale: input.estimateStale,
      confidence: null,
      rate_source_summary: null,
      assumptions: [],
      missing_info: [],
      exclusions: [],
    },
    lineItems: [],
    projectFacts: input.facts,
    defaultMarginPercent: 20,
    defaultGstRate: 15,
  });
  return buildAssistantMutationResult({
    projectId: "proj-1",
    state,
    estimateStale: input.estimateStale,
    hasEstimate: true,
  });
}

console.log("verify-performance-01c-4: starting…\n");

const loadSrc = read("lib/assistant/load-assistant-mutation-result.ts");
const completeSrc = read("lib/assistant/complete-assistant-mutation.ts");
const factActions = read("lib/assistant/fact-actions.ts");
const workAreaActions = read("lib/assistant/work-area-actions.ts");
const constraintSrc = read("lib/assistant/constraint-actions.ts");
const interviewSrc = read("lib/assistant/builder-interview-actions.ts");
const assistantActions = read("lib/assistant/actions.ts");
const persistSrc = read("lib/assistant/scope-persistence.ts");
const staleSrc = read("lib/estimate/stale.ts");
const settingsReader = read("lib/settings/organisation-settings-reader.ts");
const resultShape = read("lib/assistant/assistant-mutation-result.ts");
const reloadSrc = read("lib/assistant/assistant-mutation-result-reload.ts");

console.log("-- STRUCTURE --");
check(
  "A. post-write ownership stays uncached assertOrgOwnsActiveProject",
  loadSrc.includes("assertOrgOwnsActiveProject(auth, projectId)") &&
    !loadSrc.includes("ForRead") &&
    !loadSrc.includes("WithStage") &&
    staleSrc.includes("assertOrgOwnsActiveProject(context, projectId)")
);
check(
  "B. project_facts are always freshly selected after writes",
  loadSrc.includes('.from("project_facts")') &&
    loadSrc.includes('.select("key, work_area_id, value, source")') &&
    !/projectFacts\?:/.test(reloadSrc) &&
    !/reuse\?\.projectFacts/.test(loadSrc)
);
const updateFactBody = factActions.slice(
  factActions.indexOf("export async function updateProjectFact")
);
check(
  "C. estimates / is_stale stay a fresh post-stale select",
  loadSrc.includes('.from("estimates")') &&
    loadSrc.includes("ASSISTANT_ESTIMATE_COLUMNS") &&
    loadSrc.includes("estimateStale: Boolean(estimate?.is_stale)") &&
    updateFactBody.includes("markEstimateStaleWithContext(context, projectId)") &&
    updateFactBody.indexOf("markEstimateStaleWithContext") <
      updateFactBody.indexOf("completeAssistantMutation")
);
check(
  "D. organisation_settings uses the 01B request-scoped reader",
  loadSrc.includes("loadOrganisationSettingsRow(orgId)") &&
    !loadSrc.includes('.from("organisation_settings")') &&
    settingsReader.includes("React.cache key: orgId") &&
    !settingsReader.includes(".insert(") &&
    !settingsReader.includes("ensureCompanySettingsRow")
);
check(
  "E. work_areas reuse is scalar-only via planner",
  factActions.includes("scalarFactWorkAreaReuse") &&
    factActions.includes("ASSISTANT_WORK_AREA_COLUMNS") &&
    completeSrc.includes("reuse?: AssistantMutationResultReuse") &&
    reloadSrc.includes('workAreas: Array.isArray(reuse?.workAreas) ? "reuse" : "fresh"')
);
check(
  "F. work-area / Analyse / interview / constraints do not pass reuse",
  !workAreaActions.includes("completeAssistantMutation") &&
    /completeAssistantMutation\(context, projectId\)/.test(constraintSrc) &&
    /completeAssistantMutation\(auth, projectId\)/.test(interviewSrc) &&
    /completeAssistantMutation\(auth, projectId\)/.test(assistantActions) &&
    !constraintSrc.includes("scalarFactWorkAreaReuse") &&
    !interviewSrc.includes("scalarFactWorkAreaReuse") &&
    !assistantActions.includes("scalarFactWorkAreaReuse") &&
    !workAreaActions.includes("scalarFactWorkAreaReuse")
);
check(
  "G. Internal Walls CAS path is unchanged",
  persistSrc.includes("persistInternalWallsCollectionWrite") &&
    persistSrc.includes("INTERNAL_WALLS_COLLECTION_WRITE_MAX_ATTEMPTS") &&
    persistSrc.includes('"value->>v"') &&
    persistSrc.includes("isInternalWallsWallTypeWriteKey(params.key)")
);
check(
  "H. Project Conditions path unchanged",
  constraintSrc.includes("upsertProjectConstraintRecord") &&
    constraintSrc.includes("completeAssistantMutation(context, projectId)") &&
    !constraintSrc.includes("workAreas")
);
check(
  "AssistantMutationResult field list is unchanged",
  resultShape.includes("stage: state.project.stage") &&
    resultShape.includes("workAreas: state.workAreas") &&
    resultShape.includes("interviewFacts: state.interviewFacts") &&
    resultShape.includes("derivedFactDisplays: state.derivedFactDisplays") &&
    resultShape.includes("scopeReview: state.scopeReview") &&
    resultShape.includes("questionBlock: state.questionBlock") &&
    resultShape.includes("constraintQuestions: state.constraintQuestions") &&
    resultShape.includes("estimateStale: input.estimateStale") &&
    resultShape.includes("hasEstimate: input.hasEstimate")
);
check(
  "01C-2 merged pre-write project read remains",
  factActions.includes("assertOrgOwnsActiveProjectWithStage(context, projectId)")
);
check(
  "revalidatePath is unchanged",
  factActions.includes("revalidatePath(`/app/projects/${projectId}`)")
);

console.log("\n-- RELOAD PLAN --");
const freshPlan = planAssistantMutationResultReloads();
check(
  "default callers keep work_areas fresh",
  freshPlan.workAreas === "fresh" &&
    freshPlan.ownership === "fresh" &&
    freshPlan.projectFacts === "fresh" &&
    freshPlan.estimates === "fresh" &&
    freshPlan.organisationSettings === "request_scoped_reader"
);
const reusedPlan = planAssistantMutationResultReloads({
  workAreas: [dbWorkArea()],
});
check("scalar reuse plan skips work_areas select", reusedPlan.workAreas === "reuse");
check(
  "empty work_areas array is still explicit reuse",
  planAssistantMutationResultReloads({ workAreas: [] }).workAreas === "reuse"
);

const scalarReuse = scalarFactWorkAreaReuse({
  key: "deck.height_m",
  workAreas: [dbWorkArea()],
  error: null,
});
check(
  "E. deck.height_m may reuse post-commit work_areas",
  Array.isArray(scalarReuse?.workAreas) && scalarReuse?.workAreas.length === 1
);
check(
  "F/G. Internal Walls collection keys do not reuse work_areas",
  scalarFactWorkAreaReuse({
    key: INTERNAL_WALLS_WALL_TYPES_FACT_KEY,
    workAreas: [dbWorkArea()],
    error: null,
  }) === undefined &&
    scalarFactWorkAreaReuse({
      key: "internal_walls.wall_type.height_m",
      workAreas: [dbWorkArea()],
      error: null,
    }) === undefined
);
check(
  "failed work_areas select is not reused",
  scalarFactWorkAreaReuse({
    key: "deck.height_m",
    workAreas: [dbWorkArea()],
    error: { message: "failed" },
  }) === undefined
);

console.log("\n-- OWNERSHIP / DELETED / FOREIGN --");
async function ownershipChecks(): Promise<void> {
  resetUnderlyingActiveProjectOwnershipCount();
  const owned = makeProjectCtx({ orgId: "org-a", projectId: "proj-1" });
  const ok = await assertOrgOwnsActiveProject(owned, "proj-1");
  check(
    "A. uncached post-write ownership hits the DB",
    !("error" in ok) &&
      owned.projectSelects() === 1 &&
      getUnderlyingActiveProjectOwnershipCount() === 1
  );

  const foreign = await assertOrgOwnsActiveProject(
    makeProjectCtx({ orgId: "org-a", projectId: "proj-b", foreign: true }),
    "proj-b"
  );
  check(
    "K. foreign-org project is not-found",
    "error" in foreign && foreign.error === "Project not found."
  );

  const deleted = await assertOrgOwnsActiveProject(
    makeProjectCtx({ orgId: "org-a", projectId: "proj-del", deleted: true }),
    "proj-del"
  );
  check(
    "K. soft-deleted project is not-found",
    "error" in deleted && deleted.error === "Project not found."
  );
}

console.log("\n-- ASSISTANTMUTATIONRESULT PARITY --");
const existing = mutationFromFacts({
  facts: [{ key: "deck.height_m", work_area_id: "wa-1", value: 0.6, source: "user" }],
  estimateStale: true,
});
const inserted = mutationFromFacts({
  facts: [{ key: "deck.height_m", work_area_id: "wa-1", value: 0.8, source: "user" }],
  estimateStale: true,
});
const assumed = mutationFromFacts({
  facts: [{ key: "deck.height_m", work_area_id: "wa-1", value: 0.6, source: "assumption" }],
  estimateStale: true,
});
const selected = mutationFromFacts({
  facts: [
    {
      key: "deck.board_material",
      work_area_id: "wa-1",
      value: "Hardwood",
      source: "user",
    },
  ],
  estimateStale: true,
});
const flagged = mutationFromFacts({
  facts: [
    {
      key: "deck.steps_included",
      work_area_id: "wa-1",
      value: true,
      source: "user",
    },
  ],
  estimateStale: true,
});

check(
  "I. existing numeric update keeps height 0.6 / source=user",
  existing.interviewFacts[0]?.value === 0.6 &&
    existing.interviewFacts[0]?.source === "user" &&
    existing.estimateStale === true &&
    existing.hasEstimate === true &&
    existing.stage === "quality"
);
check(
  "I. insert path still returns the written fact",
  inserted.interviewFacts[0]?.value === 0.8 && inserted.workAreas[0]?.id === "wa-1"
);
check(
  "I. assumption source is preserved on the DTO",
  assumed.interviewFacts[0]?.source === "assumption" &&
    assumed.interviewFacts[0]?.value === 0.6
);
check(
  "I. select value is preserved",
  selected.interviewFacts[0]?.value === "Hardwood"
);
check(
  "I. boolean value is preserved",
  flagged.interviewFacts[0]?.value === true
);

const notSure = resolveCommittedFactWrite({
  key: "deck.height_m",
  value: "Not sure",
  valueType: "number",
});
check(
  "assumption write resolver unchanged",
  notSure.value === 0.6 && notSure.source === "assumption"
);

check(
  "J. persistError still hides Ready",
  detailsReadyCardVisible({
    visibleGroupCount: 0,
    remaining: 0,
    viewEnoughToEstimate: true,
    readinessEnoughToEstimate: true,
    persistError: "Could not save",
  }) === false
);
check(
  "J. Ready still appears after a clean persist",
  detailsReadyCardVisible({
    visibleGroupCount: 0,
    remaining: 0,
    viewEnoughToEstimate: true,
    readinessEnoughToEstimate: true,
    persistError: null,
  }) === true
);

async function factWriteChecks(): Promise<void> {
  let lastWrite: { kind: string; payload: Record<string, unknown> | null } = {
    kind: "",
    payload: null,
  };
  const factChain = {
    select() {
      return this;
    },
    eq() {
      return this;
    },
    is() {
      return this;
    },
    async maybeSingle() {
      return { data: null, error: null };
    },
    insert(payload: Record<string, unknown>) {
      lastWrite = { kind: "insert", payload };
      return this;
    },
    update() {
      return this;
    },
    then(resolve: (value: { error: null }) => unknown) {
      return Promise.resolve({ error: null }).then(resolve);
    },
  };
  const questionChain = {
    update() {
      return this;
    },
    eq() {
      return this;
    },
    then(resolve: (value: { error: null }) => unknown) {
      return Promise.resolve({ error: null }).then(resolve);
    },
  };
  const supabase = {
    from(table: string) {
      if (table === "project_facts") return factChain;
      if (table === "questions") return questionChain;
      throw new Error(`unexpected table ${table}`);
    },
  };
  const assumedWrite = await commitUserFactEdit(
    supabase as Parameters<typeof commitUserFactEdit>[0],
    {
      orgId: "org-a",
      projectId: "proj-1",
      workAreaId: "wa-1",
      key: "deck.height_m",
      label: "Height",
      value: "Not sure",
      valueType: "number",
    }
  );
  check(
    "I. commit still persists assumed 0.6",
    assumedWrite.ok === true &&
      lastWrite.kind === "insert" &&
      lastWrite.payload?.value === 0.6 &&
      lastWrite.payload?.source === "assumption"
  );
}

const realJob = loadCalibrationFixture("REAL-JOB-01.json");
const wa: EstimateWorkArea = {
  id: "wa-deck-1",
  type: "deck",
  name: "Deck",
  sort_order: 1,
};
const realFacts: EstimateFact[] = Object.entries(realJob.facts).map(
  ([key, value]) => ({
    key,
    work_area_id: wa.id,
    value,
  })
);
const realEstimate = calculateEstimate({
  project: { id: "real-job-01", qualityLevel: "standard" },
  confirmedWorkAreas: [wa],
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
  "REAL-JOB-01 recommendedSell unchanged",
  realEstimate.recommendedSell === 12878.01,
  `got ${realEstimate.recommendedSell}`
);

async function main(): Promise<void> {
  await ownershipChecks();
  await factWriteChecks();
  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

void main();
