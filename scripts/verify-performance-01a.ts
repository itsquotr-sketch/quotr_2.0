/**
 * PERFORMANCE-01A — structural + safety verifier.
 *
 * Run: npx --yes tsx scripts/verify-performance-01a.ts
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

console.log("verify-performance-01a: starting…\n");

const layout = read("app/(protected)/app/layout.tsx");
const projectPage = read("app/(protected)/app/projects/[projectId]/page.tsx");
const quoteLoaders = read("lib/quotes/quote-loaders.ts");
const pricingLoaders = read("lib/pricing/pricing-loaders.ts");
const estimateContext = read("lib/estimate/context.ts");
const companySettings = read("lib/settings/company-settings-loader.ts");
const projectLoaders = read("lib/projects/project-loaders.ts");
const queryUtils = read("lib/projects/query-utils.ts");
const timing = read("lib/perf/timing.ts");
const perf01a = read("lib/perf/perf-01a.ts");
const factActions = read("lib/assistant/fact-actions.ts");
const ownership = read("lib/security/org-ownership.ts");
const calculateSrc = read("lib/estimate/calculate-estimate.ts");

console.log("-- PROMISE.ALL / REUSE --");
check(
  "1. layout parallelises display + firstRun + billing after auth",
  layout.includes("getAuthDisplayProfile()") &&
    layout.includes("getFirstRunStage()") &&
    layout.includes("getOrgBillingState(auth.orgId)") &&
    layout.includes("await Promise.all([")
);
check(
  "2. project page tabContext shares in-flight pricing summary",
  projectPage.includes("pricingSummaryPromise") &&
    projectPage.includes("getProjectWorkspaceTabContextWithContext") &&
    projectPage.includes("await Promise.all([")
);
check(
  "3. quote ownership + schema probe are independent Promise.all",
  (quoteLoaders.includes("assertOrgOwnsActiveProject(auth, projectId)") ||
      quoteLoaders.includes("assertOrgOwnsActiveProjectForRead(auth, projectId)")) &&
    quoteLoaders.includes("assertOrgOwnsQuote(auth, quoteId, projectId)") &&
    quoteLoaders.includes("hasClientEmailColumn(supabase)") &&
    /const \[ownedProject, ownedQuote, clientEmailAvailable\] = await Promise\.all/.test(
      quoteLoaders
    )
);
check(
  "4. quote post-quote reads are one independent Promise.all",
  quoteLoaders.includes("quote_deliveries") &&
    quoteLoaders.includes("quote_acceptances") &&
    quoteLoaders.includes("quote_declines") &&
    quoteLoaders.includes("pricing_documents") &&
    quoteLoaders.indexOf("quote_deliveries") <
      quoteLoaders.indexOf("quote_events")
);
check(
  "5. pricing ownership checks are independent Promise.all",
  /const \[ownedProject, ownedDocument\] = await Promise\.all/.test(
    pricingLoaders
  ) && pricingLoaders.includes("assertOrgOwnsActiveProject")
);
check(
  "6. schema probes are parallelised",
  queryUtils.includes("probeProjectSchemaColumns") &&
    queryUtils.includes("Promise.all") &&
    projectLoaders.includes("probeProjectSchemaColumns")
);
check(
  "7. company settings happy path is one organisation_settings select",
  companySettings.includes("if (!error && row)") &&
    companySettings.includes("ensureCompanySettingsRow") &&
    companySettings.indexOf("COMPANY_SETTINGS_SELECT") <
      companySettings.indexOf("ensureCompanySettingsRow", 200)
);
check(
  "8. estimate context no longer sequential lifecycle/deleted_at re-read",
  !estimateContext.includes("hasLifecycleColumns") &&
    !estimateContext.includes('select("deleted_at")') &&
    (estimateContext.includes("assertOrgOwnsActiveProjectForRead") ||
      estimateContext.includes("assertOrgOwnsActiveProject")) &&
    estimateContext.includes('select("id, quality_level")')
);

console.log("\n-- AUTH / FROZEN SURFACES --");
check(
  "9. assertOrgOwnsActiveProject still used by loaders",
  (estimateContext.includes("assertOrgOwnsActiveProject") ||
      estimateContext.includes("assertOrgOwnsActiveProjectForRead")) &&
    (quoteLoaders.includes("assertOrgOwnsActiveProject") ||
      quoteLoaders.includes("assertOrgOwnsActiveProjectForRead")) &&
    (pricingLoaders.includes("assertOrgOwnsActiveProject") ||
      pricingLoaders.includes("assertOrgOwnsActiveProjectForRead")) &&
    ownership.includes("eq(\"org_id\", ctx.orgId)")
);
check(
  "10. no process-global organisation_settings cache",
  !companySettings.includes("from \"react\"") &&
    !estimateContext.includes("cache(")
);
check(
  "11. Clarify mutation chain not rewritten",
  factActions.includes("commitUserFactEdit") &&
    factActions.includes("persistDerivedFactsForProject") &&
    factActions.includes("markEstimateStaleWithContext")
);
check(
  "12. calculator file not edited by 01A shape",
  calculateSrc.includes("export function calculateEstimate")
);
check(
  "13. instrumentation is Preview/dev gated and labelled",
  perf01a.includes("PERFORMANCE-01A") &&
    perf01a.includes('VERCEL_ENV === "production"') &&
    perf01a.includes("[perf-01a]") &&
    timing.includes("isPerf01AInstrumentationEnabled")
);

console.log("\n-- ESTIMATOR FINGERPRINT --");
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
  "14. REAL-JOB-01 recommendedSell unchanged",
  realEstimate.recommendedSell === 12878.01,
  `got ${realEstimate.recommendedSell}`
);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
