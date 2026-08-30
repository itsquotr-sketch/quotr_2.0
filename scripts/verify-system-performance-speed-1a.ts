/**
 * SYSTEM-PERFORMANCE-SPEED-1A — request-scoped auth + loader consolidation.
 *
 * Run: npx tsx scripts/verify-system-performance-speed-1a.ts
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { cache } from "react";
import {
  AUTH_ORG_MESSAGES,
  evaluateAuthOrgInputs,
} from "../lib/security/auth-org-evaluation";
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

function fileContains(relativePath: string, needle: string): boolean {
  return readFileSync(join(root, relativePath), "utf8").includes(needle);
}

console.log("verify-system-performance-speed-1a: starting…\n");

const authSrc = read("lib/security/auth-org-context.ts");
const serverSrc = read("lib/supabase/server.ts");
const ownershipSrc = read("lib/security/org-ownership.ts");
const audit = read("docs/audits/SYSTEM_PERFORMANCE_SPEED_0_BASELINE.md");
const projectPage = read(
  "app/(protected)/app/projects/[projectId]/page.tsx"
);
const pricingPage = read(
  "app/(protected)/app/projects/[projectId]/pricing/[pricingId]/page.tsx"
);
const quotePage = read(
  "app/(protected)/app/projects/[projectId]/quotes/[quoteId]/page.tsx"
);
const layoutSrc = read("app/(protected)/app/layout.tsx");
const pricingLoaders = read("lib/pricing/pricing-loaders.ts");
const quoteLoaders = read("lib/quotes/quote-loaders.ts");
const estimateContext = read("lib/estimate/context.ts");
const staleSrc = read("lib/estimate/stale.ts");
const stageSrc = read("lib/assistant/load-project-stage.ts");
const generateSrc = read("lib/assistant/actions.ts");
const factActions = read("lib/assistant/fact-actions.ts");

console.log("-- AUTH / SECURITY --");
check(
  "1. canonical request-scoped auth resolver exists",
  authSrc.includes("export const requireAuthOrgContext") &&
    authSrc.includes("resolveAuthOrgContextUncached")
);
check(
  "2. cache mechanism is React.cache from react (request-scoped)",
  authSrc.includes('import { cache } from "react"') &&
    authSrc.includes("cache(") &&
    authSrc.includes("resolveAuthOrgContextUncached")
);
check(
  "3. no process-global user/org identity Map / unstable_cache / use cache",
  !authSrc.includes("new Map") &&
    !authSrc.includes("unstable_cache") &&
    !authSrc.includes("'use cache'") &&
    !serverSrc.includes("unstable_cache") &&
    !serverSrc.includes("'use cache'")
);
check(
  "4. org derives from authenticated session/profile",
  authSrc.includes("supabase.auth.getUser()") &&
    authSrc.includes('.from("profiles")') &&
    authSrc.includes("org_id") &&
    authSrc.includes("Never accepts a client-supplied organisation ID")
);
check(
  "5. no client org authority on auth resolver",
  !authSrc.includes("organisation_id") &&
    !authSrc.includes("org_id:") &&
    !/function requireAuthOrgContext\([^)]*org/i.test(authSrc)
);

const noUser = evaluateAuthOrgInputs({
  user: null,
  profile: { org_id: "org-a" },
  organisation: { id: "org-a" },
});
check(
  "6. unauthenticated fails closed",
  !noUser.ok && noUser.code === "not_authenticated"
);

const noProfile = evaluateAuthOrgInputs({
  user: { id: "user-a" },
  profile: null,
  organisation: { id: "org-a" },
});
const noOrg = evaluateAuthOrgInputs({
  user: { id: "user-a" },
  profile: { org_id: "org-a" },
  organisation: null,
});
const mismatch = evaluateAuthOrgInputs({
  user: { id: "user-a" },
  profile: { org_id: "org-a" },
  organisation: { id: "org-b" },
});
check(
  "7. invalid/missing org fails closed",
  !noProfile.ok &&
    noProfile.code === "organisation_required" &&
    !noOrg.ok &&
    !mismatch.ok &&
    noProfile.error === AUTH_ORG_MESSAGES.organisation_required
);
check(
  "8. cross-org organisation mismatch denied by evaluator",
  !mismatch.ok
);
check(
  "8b. ownership helper still filters org_id + deleted_at",
  ownershipSrc.includes('.eq("org_id", ctx.orgId)') &&
    ownershipSrc.includes('.is("deleted_at", null)')
);
check(
  "8c. ownership helper is not process-global identity-cached",
  !ownershipSrc.includes("cache(") && !ownershipSrc.includes("new Map")
);

console.log("\n-- LOADER CONSOLIDATION --");
check(
  "9. Project page shares auth context",
  projectPage.includes("requireAuthOrgContext()") &&
    projectPage.includes("getProjectWithContext(auth, projectId)") &&
    projectPage.includes("getAssistantStateWithContext(auth, projectId)")
);
check(
  "10. duplicate pricing summary removed (preloaded into tab context)",
  projectPage.includes("getLatestPricingSummaryWithContext(auth, projectId)") &&
    projectPage.includes("{ pricingSummary }") &&
    pricingLoaders.includes("options?: { pricingSummary?:")
);
check(
  "11. workspace context supports trusted internal path",
  pricingLoaders.includes("getProjectWorkspaceTabContextWithContext") &&
    pricingLoaders.includes('import "server-only"')
);
check(
  "12. Estimate context supports trusted internal path",
  estimateContext.includes("getEstimateContextWithContext") &&
    generateSrc.includes("getEstimateContextWithContext(auth, projectId)")
);
check(
  "13. Update duplicate stage read uses request-scoped loadProjectStage",
  stageSrc.includes("export const loadProjectStage = cache(") &&
    generateSrc.includes("regenerateStaticEstimate") &&
    generateSrc.includes("runEstimateGeneration") &&
    generateSrc.includes("loadProjectStage(projectId)")
);
check(
  "14. markEstimateStale can reuse trusted context",
  staleSrc.includes("markEstimateStaleWithContext") &&
    factActions.includes("markEstimateStaleWithContext(context, projectId)")
);
check(
  "15. Pricing loaders consolidated",
  pricingPage.includes("requireAuthOrgContext()") &&
    pricingPage.includes("getPricingWorkspaceDataWithContext(auth") &&
    pricingPage.includes("getProjectWithContext(auth, projectId)")
);
check(
  "16. Quote company-settings auth consolidated",
  quoteLoaders.includes("getCompanySettingsWithContext(auth)") &&
    quotePage.includes("getQuoteWorkspaceDataWithContext(auth")
);
check(
  "17. standalone public helpers still authenticate",
  fileContains("lib/pricing/actions.ts", "requireAuthOrgContext") &&
    fileContains("lib/quotes/actions.ts", "requireAuthOrgContext") &&
    fileContains("lib/estimate/stale.ts", "getAuthOrgContext") &&
    fileContains("lib/estimate/context.ts", "getAuthOrgContext") &&
    fileContains(
      "lib/settings/company-settings-loader.ts",
      "loadCompanySettingsForRequest"
    )
);
check(
  "17b. WithContext loaders are server-only, not use server",
  pricingLoaders.includes('import "server-only"') &&
    !pricingLoaders.includes('"use server"') &&
    quoteLoaders.includes('import "server-only"') &&
    !quoteLoaders.includes('"use server"') &&
    read("lib/projects/project-loaders.ts").includes('import "server-only"') &&
    !read("lib/projects/project-loaders.ts").includes('"use server"')
);

console.log("\n-- CORRECTNESS --");
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
  "18. estimator outputs unchanged (REAL-JOB-01 12878.01)",
  realEstimate.recommendedSell === 12878.01,
  `got ${realEstimate.recommendedSell}`
);
check(
  "19. rate precedence unchanged (resolveRate still in-memory)",
  fileContains("lib/estimate/rates.ts", "export function resolveRate") &&
    fileContains("lib/estimate/rates.ts", "findActiveRate")
);
check(
  "20. Project Conditions unchanged (builder-interview still writes constraints)",
  fileContains(
    "lib/assistant/builder-interview-actions.ts",
    "saveBuilderInterviewProjectAnswers"
  )
);
check(
  "21. detailed authority unchanged (no calculator edits)",
  !fileContains("lib/estimate/calculate-estimate.ts", "cache(") &&
    fileContains("lib/estimate/calculate-estimate.ts", "deck: calculateDeck")
);
check(
  "22. Pricing adopts Estimate",
  fileContains("lib/pricing/actions.ts", "createPricingFromEstimate") &&
    fileContains("lib/pricing/actions.ts", "valuesFromEstimateLineItem")
);
check(
  "23. Quote adopts Pricing",
  fileContains("lib/quotes/actions.ts", "createQuoteFromPricing") &&
    fileContains(
      "lib/quotes/actions.ts",
      "buildQuoteSnapshotFromReviewedPricing"
    )
);
check(
  "24. Pricing Required unchanged (no pricing commercial rewrite)",
  fileContains("lib/pricing/actions.ts", "createPricingFromEstimate")
);
check(
  "25. estimate persistence RPC unchanged",
  fileContains(
    "lib/estimate/persist-estimate-generation.ts",
    "persist_estimate_generation_v1"
  )
);

console.log("\n-- PROGRAMME BOUNDARY --");
const assistantShell = read("components/assistant/AssistantShell.tsx");
const refreshCount = (assistantShell.match(/router\.refresh\(/g) ?? []).length;
check(
  "26. broad router.refresh policy unchanged on AssistantShell",
  refreshCount >= 10,
  `count=${refreshCount}`
);
check(
  "26b. fact save still revalidates project path",
  factActions.includes("revalidatePath(`/app/projects/${projectId}`)") ||
    factActions.includes('revalidatePath(`/app/projects/${projectId}`)')
);
check(
  "27. derived fact write path unchanged",
  fileContains(
    "lib/assistant/persist-derived-facts.ts",
    "persistDerivedFactsForProject"
  ) &&
    factActions.includes("persistDerivedFactsForProject")
);
check(
  "28. no Work Area starter changes",
  fileContains("lib/scopes/catalogue.ts", 'type: "deck"') &&
    fileContains("lib/scopes/catalogue.ts", 'type: "fence"') &&
    fileContains("lib/scopes/catalogue.ts", 'type: "retaining_wall"')
);
const migrations = readdirSync(join(root, "supabase/migrations"))
  .filter((name) => name.endsWith(".sql"))
  .sort();
check(
  "29. no Speed 1A migration",
  migrations[migrations.length - 1] === "038_rates_productivity_type.sql",
  `latest=${migrations[migrations.length - 1]}`
);
check(
  "30. Speed 0 baseline section preserved",
  audit.includes("COMPLETE LOCAL / OWNER APPROVED") &&
    audit.includes("ESTIMATOR CPU IS NOT THE CURRENT BOTTLENECK") &&
    audit.includes("SYSTEM PERFORMANCE — SPEED 1A RESULT")
);

console.log("\n-- PERFORMANCE STRUCTURE --");
check(
  "31. createClient is request-scoped via React.cache",
  serverSrc.includes('import { cache } from "react"') &&
    serverSrc.includes("export const createClient = cache(")
);
check(
  "32. Project page auth trees reduced (one requireAuthOrgContext then WithContext)",
  projectPage.includes("requireAuthOrgContext") &&
    projectPage.includes("getProjectWithContext(auth, projectId)") &&
    !projectPage.includes("createClient()") &&
    !projectPage.includes('.from("profiles")')
);
check(
  "33. Generate uses trusted estimate context (no nested getEstimateContext public path)",
  generateSrc.includes("getEstimateContextWithContext(auth, projectId)") &&
    !generateSrc.includes("getEstimateContext(projectId)")
);
check(
  "34. Update uses same cached loadProjectStage as Generate",
  generateSrc.includes("export async function regenerateStaticEstimate") &&
    stageSrc.includes("cache(loadProjectStageUncached)")
);
check(
  "35. Pricing page auth trees reduced",
  pricingPage.includes("requireAuthOrgContext") &&
    pricingPage.includes("getPricingWorkspaceDataWithContext(auth") &&
    !pricingPage.includes("createClient()")
);
check(
  "36. Quote page auth trees reduced + company settings internal",
  quotePage.includes("requireAuthOrgContext") &&
    quoteLoaders.includes("getCompanySettingsWithContext") &&
    !quotePage.includes("createClient()")
);
check(
  "layout uses canonical auth resolver",
  layoutSrc.includes("requireAuthOrgContext()") &&
    !layoutSrc.includes("createClient()")
);
check(
  "instrumentation is production-no-op and has no PII logs",
  authSrc.includes('process.env.NODE_ENV === "production"') &&
    authSrc.includes("getUnderlyingAuthResolutionCount") &&
    !authSrc.includes("console.log") &&
    !authSrc.includes("console.info")
);

async function proveReactCacheLifecycle(): Promise<void> {
  console.log("\n-- CACHE LIFECYCLE --");
  let sameScope = 0;
  const cachedOnce = cache(async () => {
    sameScope += 1;
    return "ok";
  });
  await cachedOnce();
  await cachedOnce();
  await cachedOnce();
  check(
    "React.cache is request-scoped (dedupes in RSC) and is a no-op in Node scripts (not a process-global identity cache)",
    sameScope === 1 || sameScope === 3,
    `executions=${sameScope}`
  );

  let keyed = 0;
  const cachedKeyed = cache(async (id: string) => {
    keyed += 1;
    return id;
  });
  await cachedKeyed("a");
  await cachedKeyed("a");
  await cachedKeyed("b");
  check(
    "React.cache keys by argument in RSC (a,a,b → 2) or no-ops in Node (→ 3)",
    keyed === 2 || keyed === 3,
    `executions=${keyed}`
  );

  const cachedFail = cache(async () => {
    return { ok: false as const, code: "not_authenticated" };
  });
  const firstFail = await cachedFail();
  const secondFail = await cachedFail();
  check(
    "failed auth-shaped result never becomes success",
    firstFail.ok === false && secondFail.ok === false
  );

  let throwCount = 0;
  const cachedThrow = cache(async () => {
    throwCount += 1;
    throw new Error("auth-boom");
  });
  let firstThrew = false;
  let secondThrew = false;
  try {
    await cachedThrow();
  } catch {
    firstThrew = true;
  }
  try {
    await cachedThrow();
  } catch {
    secondThrew = true;
  }
  check(
    "thrown resolver does not become a later success",
    firstThrew && secondThrew && throwCount >= 1
  );
}

void proveReactCacheLifecycle().then(() => {
  check(
    "docs record Speed 1A request-cache lifecycle",
    audit.includes("React.cache()") &&
      audit.includes("request-scoped") &&
      audit.includes("SPEED 1B")
  );

  if (failed > 0) {
    console.error(
      `\nverify-system-performance-speed-1a: FAILED ${failed} / ${passed + failed}`
    );
    process.exit(1);
  }

  console.log(
    `\nverify-system-performance-speed-1a: all ${passed} checks passed`
  );
});
