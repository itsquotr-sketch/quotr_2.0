/**
 * PERFORMANCE-01C-2 — flat fact mutation read consolidation.
 *
 * Run: npx --yes tsx scripts/verify-performance-01c-2.ts
 */
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { calculateEstimate } from "../lib/estimate/calculate-estimate";
import type {
  EstimateContext,
  EstimateFact,
  EstimateWorkArea,
} from "../lib/estimate/types";
import { loadCalibrationFixture } from "./deck-calibration/run-deck-calibration";
import {
  assertOrgOwnsActiveProject,
  assertOrgOwnsActiveProjectWithStage,
  resetUnderlyingActiveProjectOwnershipCount,
  getUnderlyingActiveProjectOwnershipCount,
} from "../lib/security/org-ownership";
import type { AuthOrgContext } from "../lib/security/auth-org-context";
import {
  commitUserFactEdit,
  resolveCommittedFactWrite,
  upsertScopedFact,
} from "../lib/assistant/scope-persistence";
import { detailsReadyCardVisible } from "../lib/assistant/clarify/interaction";

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
  stage?: string;
  quality_level?: string | null;
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
      return {
        data: {
          id: options.projectId,
          stage: options.stage ?? "clarify",
          quality_level: options.quality_level ?? "standard",
        },
        error: null,
      };
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

function makeFactClient(options: {
  existing?: { id: string; source: string } | null;
}): {
  supabase: Parameters<typeof upsertScopedFact>[0];
  factSelects: () => number;
  lastWrite: () => { kind: "update" | "insert" | null; payload: Record<string, unknown> | null };
} {
  let factSelects = 0;
  let lastWrite: { kind: "update" | "insert" | null; payload: Record<string, unknown> | null } =
    { kind: null, payload: null };

  const factChain = {
    select() {
      factSelects += 1;
      return this;
    },
    eq() {
      return this;
    },
    is() {
      return this;
    },
    async maybeSingle() {
      return { data: options.existing ?? null, error: null };
    },
    update(payload: Record<string, unknown>) {
      lastWrite = { kind: "update", payload };
      return this;
    },
    insert(payload: Record<string, unknown>) {
      lastWrite = { kind: "insert", payload };
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

  return {
    supabase: supabase as Parameters<typeof upsertScopedFact>[0],
    factSelects: () => factSelects,
    lastWrite: () => lastWrite,
  };
}

console.log("verify-performance-01c-2: starting…\n");

const ownershipSrc = read("lib/security/org-ownership.ts");
const factActions = read("lib/assistant/fact-actions.ts");
const persistSrc = read("lib/assistant/scope-persistence.ts");
const staleSrc = read("lib/estimate/stale.ts");
const mutationResult = read("lib/assistant/load-assistant-mutation-result.ts");
const interviewSrc = read("lib/assistant/builder-interview-actions.ts");
const derivedSrc = read("lib/assistant/persist-derived-facts.ts");

console.log("-- STRUCTURE --");
check(
  "A. merged pre-write project read selects id+stage+quality with deleted_at",
  ownershipSrc.includes("assertOrgOwnsActiveProjectWithStage") &&
    ownershipSrc.includes('.select("id, stage, quality_level")') &&
    ownershipSrc.includes('.is("deleted_at", null)') &&
    factActions.includes("assertOrgOwnsActiveProjectWithStage(context, projectId)") &&
    !factActions.includes('.select("id, stage, quality_level")')
);
check(
  "D. post-write ownership stays uncached assertOrgOwnsActiveProject",
  staleSrc.includes("assertOrgOwnsActiveProject(context, projectId)") &&
    !staleSrc.includes("WithStage") &&
    !staleSrc.includes("ForRead") &&
    mutationResult.includes("assertOrgOwnsActiveProject(auth, projectId)") &&
    !mutationResult.includes("ForRead") &&
    !mutationResult.includes("WithStage")
);
check(
  "E. scalar commit threads existingTarget into upsertScopedFact",
  persistSrc.includes("existingTarget: existingFact") &&
    persistSrc.includes('if ("existingTarget" in input)')
);
check(
  "K. Internal Walls CAS path is unchanged",
  persistSrc.includes("persistInternalWallsCollectionWrite") &&
    persistSrc.includes("INTERNAL_WALLS_COLLECTION_WRITE_MAX_ATTEMPTS") &&
    persistSrc.includes('"value->>v"') &&
    persistSrc.includes("isInternalWallsWallTypeWriteKey(params.key)")
);
check(
  "Project Conditions / derived writers not rewritten",
  interviewSrc.includes("assertOrgOwnsActiveProject") &&
    derivedSrc.includes("insertDerivedFactRows") &&
    derivedSrc.includes("updateDerivedFactRows") &&
    derivedSrc.includes("retireDerivedFactRows")
);

async function main(): Promise<void> {
console.log("\n-- OWNERSHIP BEHAVIOUR --");
resetUnderlyingActiveProjectOwnershipCount();
const owned = makeProjectCtx({
  orgId: "org-a",
  projectId: "proj-1",
  stage: "clarify",
  quality_level: "standard",
});
const merged = await assertOrgOwnsActiveProjectWithStage(owned, "proj-1");
check(
  "A. one merged ownership+stage query",
  !("error" in merged) &&
    merged.stage === "clarify" &&
    merged.quality_level === "standard" &&
    owned.projectSelects() === 1 &&
    getUnderlyingActiveProjectOwnershipCount() === 1
);

const foreign = await assertOrgOwnsActiveProjectWithStage(
  makeProjectCtx({ orgId: "org-a", projectId: "proj-b", foreign: true }),
  "proj-b"
);
check(
  "B. foreign-org project is not-found",
  "error" in foreign && foreign.error === "Project not found."
);

const deleted = await assertOrgOwnsActiveProjectWithStage(
  makeProjectCtx({ orgId: "org-a", projectId: "proj-del", deleted: true }),
  "proj-del"
);
check(
  "C. soft-deleted project is not-found",
  "error" in deleted && deleted.error === "Project not found."
);

resetUnderlyingActiveProjectOwnershipCount();
const post = makeProjectCtx({ orgId: "org-a", projectId: "proj-1" });
const postCheck = await assertOrgOwnsActiveProject(post, "proj-1");
check(
  "D. uncached post-write helper still hits the DB",
  !("error" in postCheck) && getUnderlyingActiveProjectOwnershipCount() === 1
);

console.log("\n-- SCALAR FACT READ / WRITE --");
const existingClient = makeFactClient({
  existing: { id: "fact-1", source: "user" },
});
const updateResult = await upsertScopedFact(existingClient.supabase, {
  orgId: "org-a",
  projectId: "proj-1",
  workAreaId: "wa-1",
  key: "deck.height_m",
  label: "Height",
  value: 0.6,
  source: "user",
  existingTarget: { id: "fact-1", source: "user" },
});
check(
  "E. preloaded target skips the second project_facts SELECT",
  updateResult.ok === true && existingClient.factSelects() === 0
);
check(
  "F. existing fact updates same value/source",
  existingClient.lastWrite().kind === "update" &&
    existingClient.lastWrite().payload?.value === 0.6 &&
    existingClient.lastWrite().payload?.source === "user"
);

const insertClient = makeFactClient({ existing: null });
const insertResult = await upsertScopedFact(insertClient.supabase, {
  orgId: "org-a",
  projectId: "proj-1",
  workAreaId: "wa-1",
  key: "deck.height_m",
  label: "Height",
  value: 0.6,
  source: "user",
  existingTarget: null,
});
check(
  "G. missing row inserts once without a target SELECT",
  insertResult.ok === true &&
    insertClient.factSelects() === 0 &&
    insertClient.lastWrite().kind === "insert" &&
    insertClient.lastWrite().payload?.value === 0.6 &&
    insertClient.lastWrite().payload?.source === "user"
);

const lookupClient = makeFactClient({
  existing: { id: "fact-2", source: "ai_extracted" },
});
await upsertScopedFact(lookupClient.supabase, {
  orgId: "org-a",
  projectId: "proj-1",
  workAreaId: "wa-1",
  key: "deck.height_m",
  label: "Height",
  value: 0.8,
  source: "user",
});
check(
  "callers without existingTarget still SELECT once",
  lookupClient.factSelects() === 1
);

const commitClient = makeFactClient({
  existing: { id: "fact-1", source: "user" },
});
const committed = await commitUserFactEdit(commitClient.supabase, {
  orgId: "org-a",
  projectId: "proj-1",
  workAreaId: "wa-1",
  key: "deck.height_m",
  label: "Height",
  value: 0.6,
  valueType: "number",
});
check(
  "E. commitUserFactEdit selects the target row once",
  committed.ok === true && commitClient.factSelects() === 1,
  `selects=${commitClient.factSelects()}`
);

console.log("\n-- ASSUMPTIONS --");
const notSure = resolveCommittedFactWrite({
  key: "deck.height_m",
  value: "Not sure",
  valueType: "number",
});
check(
  "H. deck.height_m Not sure → 0.6 / assumption",
  notSure.value === 0.6 && notSure.source === "assumption"
);
check(
  "H. other Not sure values unchanged",
  resolveCommittedFactWrite({
    key: "deck.ground_clearance_m",
    value: "Not sure",
    valueType: "number",
  }).value === 0.02 &&
    resolveCommittedFactWrite({
      key: "deck.step_width_m",
      value: "Not sure",
      valueType: "number",
    }).value === 1 &&
    resolveCommittedFactWrite({
      key: "deck.step_going_m",
      value: "Not sure",
      valueType: "number",
    }).value === 0.28 &&
    resolveCommittedFactWrite({
      key: "bathroom.wall_height_m",
      value: "Not sure",
      valueType: "number",
    }).value === 2.4
);
const explicit = resolveCommittedFactWrite({
  key: "deck.height_m",
  value: 0.6,
  valueType: "number",
});
check(
  "I. explicit numeric stays source=user",
  explicit.value === 0.6 && explicit.source === "user"
);

const assumeClient = makeFactClient({ existing: null });
const assumed = await commitUserFactEdit(assumeClient.supabase, {
  orgId: "org-a",
  projectId: "proj-1",
  workAreaId: "wa-1",
  key: "deck.height_m",
  label: "Height",
  value: "Not sure",
  valueType: "number",
});
check(
  "H. commit persists assumed value + source",
  assumed.ok === true &&
    assumeClient.lastWrite().payload?.value === 0.6 &&
    assumeClient.lastWrite().payload?.source === "assumption"
);

console.log("\n-- READINESS / ESTIMATOR --");
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

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
}

void main();
