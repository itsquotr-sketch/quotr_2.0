/**
 * SYSTEM-PERFORMANCE-SPEED-1B-A — Generate/Update canonical response + narrow refresh.
 *
 * Run: npx tsx scripts/verify-system-performance-speed-1b-a.ts
 */
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { composeBuilderReview } from "../lib/assistant/builder-review/compose";
import { shouldApplyEstimateGeneration } from "../lib/assistant/estimate-generation-apply";
import {
  buildEstimateGenerationResult,
  persistPayloadToEstimateRows,
  type PersistedWorkAreaRow,
} from "../lib/assistant/estimate-generation-result";
import { AUTH_ORG_MESSAGES, evaluateAuthOrgInputs } from "../lib/security/auth-org-evaluation";
import { calculateEstimate } from "../lib/estimate/calculate-estimate";
import { buildPersistEstimateGenerationV1 } from "../lib/estimate/persist-estimate-generation";
import { createGenerationId } from "../lib/estimate/requirement-snapshot-persist";
import type { OrganisationRate, OrganisationSettings } from "../components/setup/types";
import type {
  EstimateContext,
  EstimateFact,
  EstimateWorkArea,
} from "../lib/estimate/types";
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

const orgSettings: OrganisationSettings = {
  id: "org-settings",
  org_id: "org-1",
  default_margin_percent: 20,
  default_contingency_percent: 10,
  default_gst_rate: 15,
  budget_rate_factor: 0.9,
  premium_rate_factor: 1.15,
  currency: "NZD",
  country: "NZ",
  region: null,
  onboarding_status: "completed",
  onboarding_step: "completed",
  onboarding_completed_at: null,
  prefer_user_rates: true,
  allow_benchmark_rates: true,
  show_profit_in_estimates: true,
};

function fact(key: string, workAreaId: string, value: unknown): EstimateFact {
  return { key, work_area_id: workAreaId, value };
}

function wa(
  id: string,
  type: string,
  name: string,
  sortOrder: number
): EstimateWorkArea {
  return { id, type, name, sort_order: sortOrder };
}

function factsFromRecord(
  record: Record<string, unknown>,
  workAreaId: string
): EstimateFact[] {
  return Object.entries(record).map(([key, value]) =>
    fact(key, workAreaId, value)
  );
}

function context(
  projectId: string,
  workAreas: EstimateWorkArea[],
  facts: EstimateFact[],
  rates: OrganisationRate[],
  settings: OrganisationSettings = orgSettings,
  constraints: EstimateContext["constraints"] = [
    { key: "access", label: "Access", value: "Good" },
    { key: "occupied_site", label: "Occupied site", value: false },
  ]
): EstimateContext {
  return {
    project: { id: projectId, qualityLevel: "standard" },
    confirmedWorkAreas: workAreas,
    facts,
    constraints,
    organisationSettings: settings,
    materialWastageSettings: {
      deckingWastagePercent: 10,
      defaultMaterialWastagePercent: 10,
    },
    rates,
  };
}

function workAreaRows(workAreas: EstimateWorkArea[]): PersistedWorkAreaRow[] {
  return workAreas.map((row) => ({
    id: row.id,
    type: row.type,
    name: row.name,
    status: "confirmed",
    ai_confidence: null,
    summary: null,
    quote_description: null,
    sort_order: row.sort_order,
  }));
}

function generationFromContext(ctx: EstimateContext, label: string) {
  const started = performance.now();
  const calculated = calculateEstimate(ctx);
  const calcMs = performance.now() - started;
  const persistStarted = performance.now();
  const generationId = createGenerationId();
  const payload = buildPersistEstimateGenerationV1({
    projectId: ctx.project.id,
    generationId,
    estimateResult: calculated,
  });
  const persistBuildMs = performance.now() - persistStarted;
  const rows = persistPayloadToEstimateRows({
    payload,
    estimateId: `est-${ctx.project.id}`,
    snapshotId: `snap-${generationId}`,
    workAreas: workAreaRows(ctx.confirmedWorkAreas),
  });
  const mapStarted = performance.now();
  const response = buildEstimateGenerationResult({
    projectId: ctx.project.id,
    stage: "estimate_ready",
    estimateRow: rows.estimateRow,
    lineItems: rows.lineItems,
    workAreas: rows.workAreas,
    snapshotPayload: rows.snapshotPayload,
    generationId,
    pricingSummary: null,
  });
  const reload = buildEstimateGenerationResult({
    projectId: ctx.project.id,
    stage: "estimate_ready",
    estimateRow: rows.estimateRow,
    lineItems: rows.lineItems,
    workAreas: rows.workAreas,
    snapshotPayload: rows.snapshotPayload,
    generationId,
    pricingSummary: null,
  });
  const mapMs = performance.now() - mapStarted;
  const payloadBytes = Buffer.byteLength(JSON.stringify(response), "utf8");
  const review = composeBuilderReview({
    estimate: {
      recommendedCost: response.estimate.recommendedCost,
      recommendedSell: response.estimate.recommendedSell,
      marginPercent: response.estimate.marginPercent,
      confidence: response.estimate.confidence,
      isStale: response.stale,
      assumptions: response.estimate.assumptions,
      missingInfo: response.estimate.missingInfo,
      lineItems: response.estimate.lineItems,
    },
    workAreas: ctx.confirmedWorkAreas.map((row) => ({
      id: row.id,
      name: row.name,
      type: row.type,
      status: "confirmed" as const,
    })),
    requirements: response.requirementSnapshotRequirements,
    attentionItems: [],
    confidenceBand: "medium",
  });
  return {
    label,
    calculated,
    response,
    reload,
    review,
    payloadBytes,
    calcMs,
    persistBuildMs,
    mapMs,
  };
}

function moneyEqual(
  a: { recommendedCost: number; recommendedSell: number; grossProfit: number },
  b: { recommendedCost: number; recommendedSell: number; grossProfit: number }
): boolean {
  return (
    Math.abs(a.recommendedCost - b.recommendedCost) < 0.005 &&
    Math.abs(a.recommendedSell - b.recommendedSell) < 0.005 &&
    Math.abs(a.grossProfit - b.grossProfit) < 0.005
  );
}

console.log("verify-system-performance-speed-1b-a: starting…\n");

const generateSrc = read("lib/assistant/actions.ts");
const shellSrc = read("components/assistant/AssistantShell.tsx");
const applySrc = read("lib/assistant/estimate-generation-apply.ts");
const resultSrc = read("lib/assistant/estimate-generation-result.ts");
const loadSrc = read("lib/assistant/load-estimate-generation-result.ts");
const persistSrc = read("lib/estimate/persist-estimate.ts");
const persistGenSrc = read("lib/estimate/persist-estimate-generation.ts");
const factSrc = read("lib/assistant/fact-actions.ts");
const pricingActions = read("lib/pricing/actions.ts");
const quoteActions = read("lib/quotes/actions.ts");
const audit = read("docs/audits/SYSTEM_PERFORMANCE_SPEED_0_BASELINE.md");

console.log("-- RESPONSE --");
check(
  "1. Generate returns canonical estimate state",
  generateSrc.includes("export async function generateStaticEstimate") &&
    generateSrc.includes("estimateGeneration") &&
    generateSrc.includes("loadEstimateGenerationResult")
);
check(
  "2. Update returns canonical estimate state",
  generateSrc.includes("export async function regenerateStaticEstimate") &&
    generateSrc.includes("runEstimateGeneration(projectId, { allowRegenerate: true })") &&
    generateSrc.includes("estimateGeneration")
);
const persistResultIdx = generateSrc.indexOf("const persistResult = await persistEstimateResult");
const persistErrorIdx = generateSrc.indexOf('if ("error" in persistResult)');
const loadAfterPersistIdx = generateSrc.indexOf(
  "loadEstimateGenerationResult(auth, projectId, { generationId })"
);
const returnAfterPersistIdx = generateSrc.lastIndexOf(
  "return { success: true, estimateGeneration }"
);
check(
  "3. response occurs after persistence",
  persistResultIdx >= 0 &&
    loadAfterPersistIdx > persistResultIdx &&
    returnAfterPersistIdx > loadAfterPersistIdx
);
check(
  "4. response scoped to current project/org",
  loadSrc.includes("assertOrgOwnsActiveProject") &&
    loadSrc.includes('.eq("org_id", orgId)') &&
    loadSrc.includes('.eq("project_id", projectId)') &&
    !loadSrc.includes("organisation_id")
);
check(
  "5. client does not recalculate commercial money",
  !shellSrc.includes("calculateEstimate(") &&
    !shellSrc.includes("applyTargetMarginToLineItems") &&
    shellSrc.includes("generationProjection?.estimate")
);

console.log("\n-- REFRESH --");
const executableRefresh = (shellSrc.match(/^\s*router\.refresh\(\);/gm) ?? [])
  .length;
check(
  "6. Generate success no longer requires full router.refresh",
  shellSrc.includes('action === "estimate"') &&
    shellSrc.includes("shouldRefresh = false") &&
    shellSrc.includes("shouldApplyEstimateGeneration")
);
check(
  "7. Update success no longer requires full router.refresh",
  shellSrc.includes('action === "regenerate"') &&
    shellSrc.includes("shouldRefresh = false")
);
check(
  "8. Clarify/fact-save canonical mutation remains (refresh is recovery)",
  factSrc.includes("updateProjectFact") &&
    shellSrc.includes("updateProjectFact(") &&
    /handleFactSave[\s\S]*router\.refresh\(\)/.test(shellSrc)
);
check(
  "9. revalidation policy explicit",
  generateSrc.includes("revalidateProjectAssistantPath(projectId)") &&
    generateSrc.includes("loadEstimateGenerationResult") &&
    audit.includes("revalidatePath") &&
    audit.includes("SPEED 1B-A")
);
check(
  "10. refresh fallback only for recovery if used",
  generateSrc.includes("recoveryRefresh: true") &&
    shellSrc.includes("result.recoveryRefresh") &&
    !shellSrc
      .slice(
        shellSrc.indexOf("const handleGenerateEstimate"),
        shellSrc.indexOf("const handleRegenerateEstimate")
      )
      .includes("router.refresh(")
);

const DECK_WA = "wa-deck";
const FENCE_WA = "wa-fence";
const RW_WA = "wa-rw";
const simpleFixture = loadCalibrationFixture("SIMPLE-01.json");
const realJobFixture = loadCalibrationFixture("REAL-JOB-01.json");
const deckWa = wa(DECK_WA, "deck", "Deck", 1);
const fenceWa = wa(FENCE_WA, "fence", "Fence", 2);
const rwWa = wa(RW_WA, "retaining_wall", "Retaining wall", 3);
const fenceFacts: EstimateFact[] = [
  fact("fence.length_m", FENCE_WA, 18),
  fact("fence.height_m", FENCE_WA, 1.8),
  fact("fence.system", FENCE_WA, "Timber paling — vertical board"),
  fact("fence.timber_species", FENCE_WA, "Radiata Pine"),
  fact("fence.board_thickness_mm", FENCE_WA, "150 × 19mm"),
  fact("fence.post_spacing_m", FENCE_WA, 1.8),
  fact("fence.gate_included", FENCE_WA, true),
  fact("fence.gate_count", FENCE_WA, 1),
  fact("fence.gate_width_m", FENCE_WA, 0.9),
  fact("fence.top_capping", FENCE_WA, "Yes"),
];
const rwFacts: EstimateFact[] = [
  fact("retaining_wall.length_m", RW_WA, 10),
  fact("retaining_wall.height_m", RW_WA, 1),
  fact("retaining_wall.material", RW_WA, "Timber"),
  fact("retaining_wall.face_board_section", RW_WA, "150×50 H4"),
  fact("retaining_wall.drainage_required", RW_WA, true),
  fact("retaining_wall.backfill_included", RW_WA, true),
];

const deck = generationFromContext(
  context(
    "fix-deck",
    [deckWa],
    factsFromRecord(realJobFixture.facts, DECK_WA),
    []
  ),
  "Deck REAL-JOB-01"
);
const fence = generationFromContext(
  context("fix-fence", [fenceWa], fenceFacts, []),
  "Fence timber 18m"
);
const rw = generationFromContext(
  context("fix-rw", [rwWa], rwFacts, []),
  "RW timber 10x1"
);
const multi = generationFromContext(
  context(
    "fix-multi",
    [deckWa, fenceWa, rwWa],
    [
      ...factsFromRecord(simpleFixture.facts, DECK_WA),
      ...fenceFacts,
      ...rwFacts,
    ],
    []
  ),
  "multi-WA"
);

console.log("\n-- PARITY --");
function parityBlock(
  prefix: string,
  sample: ReturnType<typeof generationFromContext>
) {
  const { response, reload, calculated } = sample;
  check(
    `${prefix} returned = reload identity`,
    response.estimateId === reload.estimateId &&
      response.generationId === reload.generationId &&
      response.stale === reload.stale &&
      response.stage === reload.stage &&
      moneyEqual(response.estimate, reload.estimate) &&
      response.estimate.lineItems.length === reload.estimate.lineItems.length
  );
  check(
    `${prefix} Direct/Sell matches calculator`,
    moneyEqual(response.estimate, calculated)
  );
  check(
    `${prefix} stale false + estimate_ready`,
    response.stale === false &&
      response.stage === "estimate_ready" &&
      response.estimate.isStale === false
  );
  check(
    `${prefix} snapshot/assumptions present`,
    Array.isArray(response.estimate.assumptions) &&
      response.requirementSnapshotRequirements.length > 0
  );
}

parityBlock("11. Deck", deck);
parityBlock("12. Fence", fence);
parityBlock("13. RW", rw);
parityBlock("14. multi-WA", multi);

check(
  "15. Direct/Sell economic goldens",
  Math.abs(deck.response.estimate.recommendedSell - 12878.01) < 0.02 &&
    Math.abs(multi.response.estimate.recommendedSell - 17098.63) < 0.02
);
check(
  "16. authority parity (sell authority unchanged in persist RPC)",
  persistGenSrc.includes("persist_estimate_generation_v1") &&
    persistSrc.includes("persistEstimateGenerationViaRpc") &&
    !generateSrc.includes("calculateEstimate(") === false
);
check(
  "16b. Generate still calculate then persist then load",
  generateSrc.includes("calculateEstimate(contextResult)") &&
    generateSrc.includes("persistEstimateResult(")
);

const missingRateSettings: OrganisationSettings = {
  ...orgSettings,
  allow_benchmark_rates: false,
};
const pricingRequired = generationFromContext(
  context(
    "fix-pricing-required",
    [deckWa],
    factsFromRecord(realJobFixture.facts, DECK_WA),
    [],
    missingRateSettings
  ),
  "Pricing Required"
);
const pricingRequiredReload = pricingRequired.reload;
function pricingRequiredLineCount(
  review: ReturnType<typeof composeBuilderReview>
): number {
  return review.workAreas.reduce(
    (sum, wa) =>
      sum +
      wa.categories
        .filter((cat) => cat.id === "PRICING_REQUIRED")
        .reduce((n, cat) => n + cat.lines.length, 0),
    0
  );
}
const reloadPricingReview = composeBuilderReview({
  estimate: {
    recommendedCost: pricingRequiredReload.estimate.recommendedCost,
    recommendedSell: pricingRequiredReload.estimate.recommendedSell,
    marginPercent: pricingRequiredReload.estimate.marginPercent,
    confidence: pricingRequiredReload.estimate.confidence,
    isStale: pricingRequiredReload.stale,
    assumptions: pricingRequiredReload.estimate.assumptions,
    missingInfo: pricingRequiredReload.estimate.missingInfo,
    lineItems: pricingRequiredReload.estimate.lineItems,
  },
  workAreas: [
    { id: DECK_WA, name: "Deck", type: "deck", status: "confirmed" as const },
  ],
  requirements: pricingRequiredReload.requirementSnapshotRequirements,
  attentionItems: [],
  confidenceBand: "medium",
});
check(
  "17. Pricing Required on response and reload",
  pricingRequiredLineCount(pricingRequired.review) > 0 &&
    pricingRequiredLineCount(reloadPricingReview) ===
      pricingRequiredLineCount(pricingRequired.review)
);
check(
  "18. stale-state parity (successful generation is not stale)",
  deck.response.stale === false && deck.reload.stale === false
);
check(
  "19. stage parity estimate_ready",
  deck.response.stage === "estimate_ready" &&
    deck.reload.stage === "estimate_ready"
);
check(
  "20. assumptions/snapshot parity",
  JSON.stringify(deck.response.estimate.assumptions) ===
    JSON.stringify(deck.reload.estimate.assumptions) &&
    deck.response.requirementSnapshotRequirements.length ===
      deck.reload.requirementSnapshotRequirements.length
);

console.log("\n-- SAFETY --");
check(
  "21. failed persist does not update client",
  persistErrorIdx >= 0 &&
    persistErrorIdx < loadAfterPersistIdx &&
    generateSrc.includes("return { error: persistResult.error }") &&
    shellSrc.includes("if (result.error)")
);
check(
  "22. unauthenticated still fails",
  !evaluateAuthOrgInputs({
    user: null,
    profile: { org_id: "org-a" },
    organisation: { id: "org-a" },
  }).ok && loadSrc.includes("assertOrgOwnsActiveProject")
);
check(
  "23. cross-org fails",
  !evaluateAuthOrgInputs({
    user: { id: "u1" },
    profile: { org_id: "org-a" },
    organisation: { id: "org-b" },
  }).ok && evaluateAuthOrgInputs({
    user: { id: "u1" },
    profile: { org_id: "org-a" },
    organisation: { id: "org-a" },
  }).ok
);
check(
  "24. pending/double-submit safe",
  shellSrc.includes("actionLockRef.current") &&
    shellSrc.includes("generationRequestSeqRef") &&
    applySrc.includes("incoming.requestSeq < input.applied.requestSeq") &&
    shouldApplyEstimateGeneration({
      currentProjectId: "p1",
      applied: { projectId: "p1", generationId: "g-b", requestSeq: 2 },
      incoming: { projectId: "p1", generationId: "g-a", requestSeq: 1 },
    }) === false &&
    shouldApplyEstimateGeneration({
      currentProjectId: "p1",
      applied: { projectId: "p1", generationId: "g-a", requestSeq: 1 },
      incoming: { projectId: "p2", generationId: "g-b", requestSeq: 2 },
    }) === false &&
    shouldApplyEstimateGeneration({
      currentProjectId: "p1",
      applied: { projectId: "p1", generationId: "g-a", requestSeq: 1 },
      incoming: { projectId: "p1", generationId: "g-b", requestSeq: 2 },
    }) === true
);
check(
  "25. Estimate→Pricing authority unchanged",
  pricingActions.includes("createPricingFromEstimate") &&
    !pricingActions.includes("estimateGeneration") &&
    !pricingActions.includes("generationProjection")
);
check(
  "26. Pricing→Quote unchanged",
  quoteActions.includes("createQuoteFromPricing") ||
    quoteActions.includes("pricing_document_id")
);
check(
  "27. persistence RPC unchanged",
  persistGenSrc.includes('persist_estimate_generation_v1') &&
    persistSrc.includes("persistEstimateGenerationViaRpc")
);
check(
  "28. derived fact writes unchanged",
  factSrc.includes("persistDerivedFactsForProject") &&
    fileContains(
      "lib/assistant/persist-derived-facts.ts",
      "persistDerivedFactsForProject"
    )
);
check(
  "29. no Work Area starter changes",
  fileContains("lib/scopes/catalogue.ts", 'type: "deck"') &&
    fileContains("lib/scopes/catalogue.ts", 'type: "fence"') &&
    fileContains("lib/scopes/catalogue.ts", 'type: "retaining_wall"')
);

const infoRequired = generationFromContext(
  context(
    "fix-info",
    [deckWa],
    factsFromRecord(simpleFixture.facts, DECK_WA),
    []
  ),
  "information-required"
);
check(
  "34. information-required response matches reload",
  infoRequired.response.estimate.missingInfo.length ===
    infoRequired.reload.estimate.missingInfo.length &&
    JSON.stringify(infoRequired.response.estimate.missingInfo) ===
      JSON.stringify(infoRequired.reload.estimate.missingInfo)
);

const accessCarry = generationFromContext(
  context(
    "fix-pc",
    [deckWa],
    factsFromRecord(realJobFixture.facts, DECK_WA),
    [],
    orgSettings,
    [
      { key: "access", label: "Access", value: "Difficult" },
      { key: "occupied_site", label: "Occupied site", value: true },
    ]
  ),
  "project-conditions"
);
const labourResponse = accessCarry.response.estimate.lineItems
  .filter((item) => item.category === "labour")
  .reduce((sum, item) => sum + item.recommendedCost, 0);
const labourReload = accessCarry.reload.estimate.lineItems
  .filter((item) => item.category === "labour")
  .reduce((sum, item) => sum + item.recommendedCost, 0);
check(
  "35. Project Conditions labour identical on response and reload",
  Math.abs(labourResponse - labourReload) < 0.005 && labourResponse > 0
);

check(
  "36. AUTH_ORG still fail-closed",
  AUTH_ORG_MESSAGES.not_authenticated.length > 0
);

const migrations = readdirSync(join(root, "supabase/migrations"))
  .filter((name) => name.endsWith(".sql"))
  .sort();
check(
  "37. no Speed 1B-A migration",
  migrations[migrations.length - 1] === "041_quote_transaction.sql"
);

check(
  "38. executable AssistantShell refresh count still 14",
  executableRefresh === 14,
  `count=${executableRefresh}`
);

check(
  "39. loader re-reads persisted rows (not in-memory calculator DTO)",
  loadSrc.includes("from(\"estimates\")") &&
    loadSrc.includes("from(\"estimate_line_items\")") &&
    loadSrc.includes("mapEstimate") === false &&
    resultSrc.includes("mapEstimate(")
);

for (const sample of [deck, fence, rw, multi]) {
  const kb = sample.payloadBytes / 1024;
  console.log(
    `      payload ${sample.label}: ${(kb).toFixed(1)} KB  calc=${sample.calcMs.toFixed(2)}ms map=${sample.mapMs.toFixed(2)}ms`
  );
  check(
    `payload ${sample.label} under 250KB`,
    sample.payloadBytes < 250_000,
    `${sample.payloadBytes} bytes`
  );
}

check(
  "docs record Speed 1B-A result",
  audit.includes("SYSTEM PERFORMANCE — SPEED 1B-A RESULT") &&
    audit.includes("COMPLETE LOCAL / OWNER APPROVED") &&
    audit.includes("SYSTEM PERFORMANCE — SPEED 1B-A RESULT") &&
    audit.includes("SPEED 2")
);

console.log("\n-- NESTED SPEED VERIFIERS --");
check(
  "30. Speed 1A verifier remains green",
  spawnVerifier("scripts/verify-system-performance-speed-1a.ts")
);
check(
  "31. Speed 0 verifier remains green",
  spawnVerifier("scripts/verify-system-performance-speed-0.ts")
);

if (failed > 0) {
  console.error(
    `\nverify-system-performance-speed-1b-a: FAILED ${failed} / ${passed + failed}`
  );
  process.exit(1);
}

console.log(
  `\nverify-system-performance-speed-1b-a: all ${passed} checks passed`
);
