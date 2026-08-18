/**
 * Stage 3.1B.7E — Preview release hardening invariants (deterministic / local).
 * Run: npx tsx scripts/verify-stage-3-1b7e-preview-release-hardening.ts
 *
 * Does not call Preview, Anthropic, or Production. Does not enable Production.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  isScopeDiscoveryEnabled,
  SCOPE_DISCOVERY_ENABLED_ENV,
  getScopeDiscoveryAvailability,
} from "../lib/scope-discovery/configuration";
import {
  buildIdempotencyKey,
  decideIdempotencyAction,
  isProviderAuthorised,
  triggerFamily,
} from "../lib/scope-discovery/orchestration/idempotency";
import type {
  PriorRunSummary,
  ScopeDiscoveryRequest,
  ScopeDiscoverySourceSnapshot,
  ScopeDiscoveryRunResult,
} from "../lib/scope-discovery/orchestration/types";
import {
  presentAssistantError,
  isUnsafeErrorText,
} from "../lib/assistant/presentation";
import { ASSISTANT_ACTION_LABELS } from "../lib/assistant/presentation/action-labels";

let passed = 0;
let failed = 0;

function check(name: string, condition: boolean, detail?: string): void {
  if (condition) {
    console.log(`PASS  ${name}`);
    passed += 1;
  } else {
    console.log(`FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
    failed += 1;
  }
}

function read(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}

function fileHas(path: string, needle: string | RegExp): boolean {
  const src = read(path);
  return typeof needle === "string" ? src.includes(needle) : needle.test(src);
}

function minimalRequest(
  overrides: Partial<ScopeDiscoveryRequest> = {}
): ScopeDiscoveryRequest {
  return {
    projectId: "proj-1",
    orgId: "org-1",
    requestedRunId: "run-req-1",
    trigger: "USER_REQUESTED_RERUN",
    projectBrief: "Deck 5m by 3m",
    projectBriefRevision: "brief-1",
    selectedSiteNotes: [],
    acceptedWorkAreas: [],
    authoritativeFacts: [],
    authoritativeConstraints: [],
    priorSuggestions: [],
    priorDecisions: [],
    priorProposals: [],
    priorRejections: [],
    currentContractVersion: "cv",
    currentCatalogueVersion: "cat",
    currentPromptVersion: "pv",
    region: null,
    analysisObjective: "Discover missing related scopes.",
    providerEnabled: true,
    explicitUserInitiation: true,
    forceNewRun: false,
    requestedByUserId: "user-1",
    requestedAt: "2026-08-07T00:00:00.000Z",
    priorRunSummaries: [],
    ...overrides,
  };
}

function minimalSnapshot(): ScopeDiscoverySourceSnapshot {
  return {
    briefRevision: "brief-1",
    noteIdsAndRevisions: [],
    noteRevisionSet: "",
    factKeysAndRevisions: [],
    factRevisionSet: "",
    constraintKeysAndRevisions: [],
    constraintRevisionSet: "",
    workAreaIdsAndTypes: [],
    workAreaSet: "",
    combinedFingerprint: "fp1",
  };
}

console.log(
  "\n=== Stage 3.1B.7E — Preview Release Hardening Verification ===\n"
);

// —— Feature flag invariants ——
check(
  "flag defaults disabled when absent",
  isScopeDiscoveryEnabled({}) === false
);
check(
  "flag enables only on exact true",
  isScopeDiscoveryEnabled({ SCOPE_DISCOVERY_ENABLED: "true" }) === true
);
check(
  "flag rejects empty / TRUE / 1 / false",
  isScopeDiscoveryEnabled({ SCOPE_DISCOVERY_ENABLED: "" }) === false &&
    isScopeDiscoveryEnabled({ SCOPE_DISCOVERY_ENABLED: "TRUE" }) === false &&
    isScopeDiscoveryEnabled({ SCOPE_DISCOVERY_ENABLED: "1" }) === false &&
    isScopeDiscoveryEnabled({ SCOPE_DISCOVERY_ENABLED: "false" }) === false
);
check(
  "no NEXT_PUBLIC_SCOPE_DISCOVERY_ENABLED in feature flags",
  !fileHas(
    "lib/scope-discovery/configuration/feature-flags.ts",
    "NEXT_PUBLIC_SCOPE_DISCOVERY"
  )
);
check(
  "availability reports FEATURE_DISABLED when off",
  getScopeDiscoveryAvailability({}).disableReason === "FEATURE_DISABLED"
);
check(
  "example env documents Anthropic + optional scope discovery",
  fileHas(".env.local.example", "ANTHROPIC_API_KEY") &&
    fileHas(".env.local.example", "SCOPE_DISCOVERY_ENABLED")
);

// —— Provider / paid-call gating ——
check(
  "provider not authorised for source-change trigger alone",
  isProviderAuthorised(
    minimalRequest({
      trigger: "FACTS_CHANGED",
      explicitUserInitiation: true,
      providerEnabled: true,
    })
  ) === false
);
check(
  "provider authorised for explicit user rerun when enabled",
  isProviderAuthorised(minimalRequest()) === true
);
check(
  "triggerFamily maps USER_REQUESTED_RERUN to explicit_user",
  triggerFamily("USER_REQUESTED_RERUN") === "explicit_user"
);

const idemKey = buildIdempotencyKey({
  projectId: "proj-1",
  triggerFamily: "explicit_user",
  sourceFingerprint: "fp1",
  contractVersion: "cv",
  catalogueVersion: "cat",
  promptVersion: "pv",
  analysisObjective: "Discover missing related scopes.",
});
const idemKey2 = buildIdempotencyKey({
  projectId: "proj-1",
  triggerFamily: "explicit_user",
  sourceFingerprint: "fp1",
  contractVersion: "cv",
  catalogueVersion: "cat",
  promptVersion: "pv",
  analysisObjective: "Discover missing related scopes.",
});
check("idempotency key stable for identical inputs", idemKey === idemKey2);
check(
  "idempotency key changes when fingerprint changes",
  buildIdempotencyKey({
    projectId: "proj-1",
    triggerFamily: "explicit_user",
    sourceFingerprint: "fp2",
    contractVersion: "cv",
    catalogueVersion: "cat",
    promptVersion: "pv",
    analysisObjective: "Discover missing related scopes.",
  }) !== idemKey
);

const stubResult = {
  runId: "run-1",
  status: "COMPLETED",
} as ScopeDiscoveryRunResult;

const priorCompleted: PriorRunSummary = {
  runId: "run-1",
  projectId: "proj-1",
  status: "COMPLETED",
  idempotencyKey: idemKey,
  sourceFingerprint: "fp1",
  triggerFamily: "explicit_user",
  inFlight: false,
  completedSuccessfully: true,
  failed: false,
  result: stubResult,
};

const reuse = decideIdempotencyAction({
  request: minimalRequest({ priorRunSummaries: [priorCompleted] }),
  snapshot: minimalSnapshot(),
  sourceFingerprint: "fp1",
  idempotencyKey: idemKey,
  priorRuns: [priorCompleted],
});
check(
  "identical completed run prefers reuse",
  reuse.action === "REUSE_IDENTICAL_COMPLETED_RUN"
);

const forceNew = decideIdempotencyAction({
  request: minimalRequest({
    forceNewRun: true,
    trigger: "USER_REQUESTED_RERUN",
    priorRunSummaries: [priorCompleted],
  }),
  snapshot: minimalSnapshot(),
  sourceFingerprint: "fp1",
  idempotencyKey: idemKey,
  priorRuns: [priorCompleted],
});
check(
  "force new run bypasses reuse",
  forceNew.action === "EXECUTE_NEW_RUN"
);

const inFlightPrior: PriorRunSummary = {
  ...priorCompleted,
  runId: "run-inflight",
  inFlight: true,
  completedSuccessfully: false,
  result: undefined,
};
const rejectDup = decideIdempotencyAction({
  request: minimalRequest({ priorRunSummaries: [inFlightPrior] }),
  snapshot: minimalSnapshot(),
  sourceFingerprint: "fp1",
  idempotencyKey: idemKey,
  priorRuns: [inFlightPrior],
});
check(
  "in-flight identical request rejected",
  rejectDup.action === "REJECT_DUPLICATE_IN_FLIGHT"
);

// —— UI concurrency guards ——
check(
  "Scope Review blocks duplicate analyse via analysingLock",
  fileHas(
    "components/assistant/ScopeDiscoveryReviewBlock.tsx",
    "analysingLock"
  )
);
check(
  "batch confirm / decision services expose idempotentReuse",
  fileHas(
    "lib/scope-discovery/application/batch-confirm-scope.ts",
    "idempotentReuse"
  ) &&
    fileHas(
      "lib/scope-discovery/application/decision-services.ts",
      "idempotentReuse"
    )
);

// —— Error safety ——
check(
  "unsafe provider errors filtered from UI mapping",
  presentAssistantError("analyse_job", "Anthropic 401 sk-abc") ===
    presentAssistantError("analyse_job") &&
    isUnsafeErrorText("SQLSTATE 23505")
);
check(
  "provider partial failure copy remains user-safe",
  fileHas("lib/scope-discovery/ui/labels.ts", "providerPartialFailure") &&
    !fileHas("lib/scope-discovery/ui/labels.ts", "Anthropic")
);

// —— Commercial boundary ——
check(
  "client EstimatePanel does not import commercial-engine",
  !fileHas("components/assistant/EstimatePanel.tsx", "commercial-engine") &&
    !fileHas(
      "components/assistant/EstimatePanel.tsx",
      "calculateDocumentTotals"
    )
);
check(
  "Stage 2B.10 verify script still present",
  existsSync(
    join(process.cwd(), "scripts/verify-batch-2b10-final-commercial-authority.ts")
  )
);

// —— Terminology consistency ——
check(
  "approved action language includes Recalculate estimate",
  ASSISTANT_ACTION_LABELS.recalculateEstimate === "Recalculate estimate"
);
check(
  "Stepper uses Clarify",
  fileHas("components/assistant/StepperNav.tsx", 'label: "Clarify"')
);

// —— Docs / gates ——
check(
  "defect register exists",
  existsSync(
    join(process.cwd(), "docs/audits/STAGE_3_1B7E_PREVIEW_DEFECT_REGISTER.md")
  )
);
check(
  "completion doc exists",
  existsSync(
    join(
      process.cwd(),
      "docs/implementation/STAGE_3_1B7E_PREVIEW_RELEASE_HARDENING_COMPLETION.md"
    )
  )
);
check(
  "production enablement runbook exists",
  existsSync(
    join(
      process.cwd(),
      "docs/runbooks/STAGE_3_1B_PRODUCTION_ENABLEMENT_RUNBOOK.md"
    )
  )
);
check(
  "performance results doc exists",
  existsSync(
    join(
      process.cwd(),
      "docs/performance/STAGE_3_1B_PREVIEW_PERFORMANCE_RESULTS.md"
    )
  )
);
check(
  "production enablement runbook keeps Production disabled by default",
  existsSync(
    join(
      process.cwd(),
      "docs/runbooks/STAGE_3_1B_PRODUCTION_ENABLEMENT_RUNBOOK.md"
    )
  ) &&
    (fileHas(
      "docs/runbooks/STAGE_3_1B_PRODUCTION_ENABLEMENT_RUNBOOK.md",
      "Production remains disabled"
    ) ||
      fileHas(
        "docs/runbooks/STAGE_3_1B_PRODUCTION_ENABLEMENT_RUNBOOK.md",
        "Do not enable Production"
      ))
);
check(
  "env constant name is SCOPE_DISCOVERY_ENABLED",
  SCOPE_DISCOVERY_ENABLED_ENV === "SCOPE_DISCOVERY_ENABLED"
);

// —— No migration 030 ——
check(
  "no migration 030 introduced",
  !existsSync(
    join(process.cwd(), "supabase/migrations/030_scope_discovery.sql")
  )
);

// —— Boundaries ——
check(
  "computeConfidence still exported (engine frozen)",
  fileHas("lib/estimate/summary.ts", "export function computeConfidence")
);
check(
  "7E completion does not claim Production enabled",
  existsSync(
    join(
      process.cwd(),
      "docs/implementation/STAGE_3_1B7E_PREVIEW_RELEASE_HARDENING_COMPLETION.md"
    )
  ) &&
    !fileHas(
      "docs/implementation/STAGE_3_1B7E_PREVIEW_RELEASE_HARDENING_COMPLETION.md",
      "Production — Enabled"
    )
);

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
if (failed > 0) process.exit(1);
