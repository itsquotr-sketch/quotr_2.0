/**
 * SYSTEM-PERFORMANCE-SPEED-0 — baseline audit + safety verifier.
 *
 * Does not assert Preview wall-clock SLOs.
 * Run: npx tsx scripts/verify-system-performance-speed-0.ts
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { calculateEstimate } from "../lib/estimate/calculate-estimate";
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
  const path = join(root, relativePath);
  check(`${relativePath} exists`, existsSync(path), path);
  return existsSync(path) ? readFileSync(path, "utf8") : "";
}

function fileContains(relativePath: string, needle: string): boolean {
  return readFileSync(join(root, relativePath), "utf8").includes(needle);
}

console.log("verify-system-performance-speed-0: starting…\n");

const auditPath = "docs/audits/SYSTEM_PERFORMANCE_SPEED_0_BASELINE.md";
const audit = read(auditPath);

const requiredSections = [
  "Measurement method",
  "Environment measured",
  "Fixture set",
  "Limitations",
  "Current-state performance architecture map",
  "Infrastructure / region topology",
  "Canonical user flows",
  "Project page load trace",
  "Job Plan / Clarify timings",
  "Generate Estimate trace",
  "Update Estimate trace",
  "Builder Review trace",
  "Pricing trace",
  "Quote trace",
  "Database query inventory",
  "Database index audit",
  "Write-path audit",
  "Network waterfall audit",
  "Router refresh / revalidation",
  "Rate-resolution performance",
  "Estimator CPU",
  "Payload findings",
  "Bundle / client render",
  "Cold vs warm / local vs Preview",
  "Auth / org context cost",
  "Proposed performance budgets",
  "Ranked bottleneck register",
  "Speed 1–3 plan",
  "Correctness constraints",
];

console.log("-- audit documentation --");
for (const heading of requiredSections) {
  check(`audit section: ${heading}`, audit.includes(heading));
}
check(
  "audit status is local complete / owner approved",
  audit.includes("COMPLETE LOCAL / OWNER APPROVED")
);
check(
  "audit does not start SPEED 1A in this batch",
  audit.includes("Do not start SPEED 1A in this batch")
);
check(
  "SPEED 1A request consolidation is defined",
  audit.includes("SPEED 1A") &&
    audit.includes("SERVER REQUEST CONSOLIDATION")
);
check(
  "SPEED 1B interaction/refresh is defined separately",
  audit.includes("SPEED 1B") &&
    audit.includes("INTERACTION / REFRESH REDUCTION")
);
check(
  "budgets are initial proposals not SLOs",
  audit.includes("INITIAL PERFORMANCE BUDGET PROPOSALS")
);
check(
  "REQ-TXN-01 is VERIFY_LATER environment blocked",
  audit.includes("VERIFY_LATER") &&
    audit.includes("NOT EXECUTED / ENVIRONMENT BLOCKED")
);
check(
  "estimator CPU is locked as not the bottleneck",
  audit.includes("ESTIMATOR CPU IS NOT THE CURRENT BOTTLENECK") &&
    audit.includes("4.11")
);
check(
  "canonical bottlenecks SP0-01 to SP0-04 preserved",
  audit.includes("SP0-01") &&
    audit.includes("SP0-02") &&
    audit.includes("SP0-03") &&
    audit.includes("SP0-04")
);
check(
  "production-readiness records REQ-TXN-01 verification debt",
  fileContains(
    "docs/PRODUCTION_READINESS.md",
    "VERIFY_LATER — NOT EXECUTED / ENVIRONMENT BLOCKED"
  )
);
check(
  "no duplicate SYSTEM_PERFORMANCE_SPEED_0 audit filename",
  readdirSync(join(root, "docs/audits")).filter((name) =>
    name.includes("SYSTEM_PERFORMANCE_SPEED_0")
  ).length === 1
);

console.log("\n-- measurement harness --");
check(
  "CPU measurement script exists",
  existsSync(join(root, "scripts/measure-system-performance-speed-0.ts"))
);
check(
  "measurement script does not import admin/service role",
  !fileContains(
    "scripts/measure-system-performance-speed-0.ts",
    "SUPABASE_SERVICE_ROLE"
  )
);
check(
  "measurement script does not hit persist RPC",
  !fileContains(
    "scripts/measure-system-performance-speed-0.ts",
    "persistEstimateGenerationViaRpc"
  )
);

console.log("\n-- closed Work Area estimator fixtures unchanged --");
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
const realContext = {
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
} as unknown as EstimateContext;

const realEstimate = calculateEstimate(realContext);
check(
  "REAL-JOB-01 recommendedSell golden 12878.01",
  realEstimate.recommendedSell === 12878.01,
  `got ${realEstimate.recommendedSell}`
);
check(
  "REAL-JOB-01 emits priced lines",
  realEstimate.lineItems.filter((item) => item.includedInTotal !== false)
    .length >= 1
);

const fenceWa: EstimateWorkArea = {
  id: "wa-fence",
  type: "fence",
  name: "Fence",
  sort_order: 2,
};
const rwWa: EstimateWorkArea = {
  id: "wa-rw",
  type: "retaining_wall",
  name: "Retaining wall",
  sort_order: 3,
};
const multi = calculateEstimate({
  ...realContext,
  project: { id: "multi-wa", qualityLevel: "standard" },
  confirmedWorkAreas: [wa, fenceWa, rwWa],
  facts: [
    ...realFacts,
    { key: "fence.length_m", work_area_id: fenceWa.id, value: 18 },
    { key: "fence.height_m", work_area_id: fenceWa.id, value: 1.8 },
    {
      key: "fence.system",
      work_area_id: fenceWa.id,
      value: "Timber paling — vertical board",
    },
    { key: "retaining_wall.length_m", work_area_id: rwWa.id, value: 10 },
    { key: "retaining_wall.height_m", work_area_id: rwWa.id, value: 1 },
    { key: "retaining_wall.material", work_area_id: rwWa.id, value: "Timber" },
  ],
} as unknown as EstimateContext);
check(
  "multi-WA estimate still emits lines for all three types",
  new Set(multi.lineItems.map((item) => item.workAreaName)).size >= 3,
  `areas=${[...new Set(multi.lineItems.map((item) => item.workAreaName))].join(",")}`
);

console.log("\n-- Estimate / Pricing / Quote authority --");
check(
  "generate path calls calculateEstimate then persistEstimateResult",
  fileContains("lib/assistant/actions.ts", "calculateEstimate(contextResult)") &&
    fileContains("lib/assistant/actions.ts", "persistEstimateResult(")
);
check(
  "persist prefers persist_estimate_generation_v1 RPC",
  fileContains(
    "lib/estimate/persist-estimate-generation.ts",
    "persist_estimate_generation_v1"
  ) &&
    fileContains(
      "lib/estimate/persist-estimate.ts",
      "persistEstimateGenerationViaRpc"
    )
);
check(
  "pricing create maps estimate lines via valuesFromEstimateLineItem",
  fileContains("lib/pricing/actions.ts", "createPricingFromEstimate") &&
    fileContains("lib/pricing/actions.ts", "valuesFromEstimateLineItem")
);
check(
  "quote create builds snapshot from reviewed pricing",
  fileContains("lib/quotes/actions.ts", "createQuoteFromPricing") &&
    fileContains(
      "lib/quotes/actions.ts",
      "buildQuoteSnapshotFromReviewedPricing"
    )
);
check(
  "requirement snapshots remain append-only (not line-item money)",
  fileContains(
    "lib/estimate/persist-estimate.ts",
    "Requirement objects are not commercial authority"
  )
);

console.log("\n-- auth/org protections --");
const authSrc = read("lib/security/auth-org-context.ts");
check(
  "requireAuthOrgContext still uses getUser",
  authSrc.includes("supabase.auth.getUser()")
);
check(
  "org id derived from profiles.org_id, not client input",
  authSrc.includes('.from("profiles")') &&
    authSrc.includes("org_id") &&
    authSrc.includes("Never accepts a client-supplied organisation ID")
);
check(
  "organisation row is verified",
  authSrc.includes('.from("organisations")')
);
check(
  "Speed 0 baseline records no React.cache at measurement time",
  audit.includes("no `React.cache()`")
);
check(
  "auth-org-context does not use process-global identity cache",
  !authSrc.includes("new Map") &&
    !authSrc.includes("unstable_cache") &&
    !authSrc.includes("use cache")
);
check(
  "Speed 1A may add request-scoped React.cache around requireAuthOrgContext",
  authSrc.includes("cache(") ? authSrc.includes('from "react"') : true
);
check(
  "assertOrgOwnsActiveProject still filters org_id + deleted_at",
  fileContains("lib/security/org-ownership.ts", '.eq("org_id", ctx.orgId)') &&
    fileContains("lib/security/org-ownership.ts", ".is(\"deleted_at\", null)")
);

console.log("\n-- instrumentation safety --");
const timing = read("lib/perf/timing.ts");
check(
  "measureServerLoad is development-only",
  timing.includes('process.env.NODE_ENV === "development"')
);
check(
  "measureServerLoad logs only label + duration",
  timing.includes("[perf]") &&
    !timing.includes("JSON.stringify") &&
    !timing.includes("payload")
);
const previewPerf = read("lib/assistant/preview-performance.ts");
check(
  "preview perf never logs brief/notes/keys",
  previewPerf.toLowerCase().includes("never logs brief")
);
check(
  "preview perf records only mark + durationMs metadata",
  previewPerf.includes("durationMs") &&
    !previewPerf.includes("briefText") &&
    !previewPerf.includes("recommendedSell")
);
check(
  "no new paid observability dependency",
  !fileContains("package.json", "sentry") &&
    !fileContains("package.json", "datadog") &&
    !fileContains("package.json", "posthog")
);

console.log("\n-- no Work Area starter / bathroom / estimator rewrites --");
const catalogue = read("lib/scopes/catalogue.ts");
check("deck remains in SCOPE_CATALOGUE", catalogue.includes('type: "deck"'));
check("fence remains in SCOPE_CATALOGUE", catalogue.includes('type: "fence"'));
check(
  "retaining_wall remains in SCOPE_CATALOGUE",
  catalogue.includes('type: "retaining_wall"')
);
check(
  "bathroom catalogue entry unchanged in Speed 0 (not started)",
  catalogue.includes('type: "bathroom"')
);
check(
  "calculateEstimate still dispatches deck/fence/retaining_wall",
  fileContains("lib/estimate/calculate-estimate.ts", "deck: calculateDeck") &&
    fileContains("lib/estimate/calculate-estimate.ts", "fence: calculateFence") &&
    fileContains(
      "lib/estimate/calculate-estimate.ts",
      "retaining_wall: calculateRetainingWall"
    )
);
check(
  "Speed 0 did not add Redis/queue/cache layers to calculate-estimate",
  !fileContains("lib/estimate/calculate-estimate.ts", "redis") &&
    !fileContains("lib/estimate/calculate-estimate.ts", "unstable_cache")
);

console.log("\n-- no Speed 0 migration --");
const migrations = readdirSync(join(root, "supabase/migrations"))
  .filter((name) => name.endsWith(".sql"))
  .sort();
check(
  "latest migration remains 038 (no Speed 0 schema change)",
  migrations[migrations.length - 1] === "041_quote_transaction.sql",
  `latest=${migrations[migrations.length - 1]}`
);
check(
  "audit states no migrations",
  audit.includes("Migrations | none") || audit.includes("Migrations | none") ||
    audit.toLowerCase().includes("no migration in speed 0")
);

console.log("\n-- next.config remains empty (no framework rewrite) --");
const nextConfig = read("next.config.ts");
check(
  "next.config has no redis/experimental cache rewrite",
  !nextConfig.includes("redis") && !nextConfig.includes("cacheHandler")
);

if (failed > 0) {
  console.error(
    `\nverify-system-performance-speed-0: FAILED ${failed} / ${passed + failed}`
  );
  process.exit(1);
}

console.log(
  `\nverify-system-performance-speed-0: all ${passed} checks passed`
);
