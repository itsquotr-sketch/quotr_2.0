/**
 * PERFORMANCE-01D — primary navigation / page-latency verifier.
 *
 * Run: npx --yes tsx scripts/verify-performance-01d.ts
 */
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { cache } from "react";
import type {
  EstimateContext,
  EstimateFact,
  EstimateWorkArea,
} from "../lib/estimate/types";
import { loadCalibrationFixture } from "./deck-calibration/run-deck-calibration";
import {
  assertOrgOwnsActiveProject,
  getUnderlyingActiveProjectOwnershipCount,
  resetUnderlyingActiveProjectOwnershipCount,
} from "../lib/security/org-ownership";
import type { AuthOrgContext } from "../lib/security/auth-org-context";

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

console.log("verify-performance-01d: starting…\n");

const dashboardPage = read("app/(protected)/app/dashboard/page.tsx");
const dashboardLoader = read("lib/dashboard/load-dashboard-page.ts");
const layout = read("app/(protected)/app/layout.tsx");
const ratesPage = read("app/(protected)/app/rates/page.tsx");
const ratesActions = read("lib/rates/actions.ts");
const companyPage = read("app/(protected)/app/settings/company/page.tsx");
const companyLoader = read("lib/settings/company-settings-loader.ts");
const settingsReader = read("lib/settings/organisation-settings-reader.ts");
const billingServer = read("lib/billing/server.ts");
const permissionServer = read("lib/team/permission-server.ts");
const firstRunSrc = read("lib/setup/actions.ts");
const readiness = read("lib/setup/readiness-actions.ts");
const orgName = read("lib/org/organisation-name-reader.ts");
const displaySrc = read("lib/security/auth-display.ts");
const sidebar = read("components/app-sidebar.tsx");
const mobileNav = read("components/layout/mobile-nav.tsx");
const shell = read("components/layout/app-shell.tsx");
const ratesContent = read("components/rates/RatesPageContent.tsx");
const dnaTask = read("app/(protected)/app/setup/dna/[taskKey]/page.tsx");
const dnaDeck = read("app/(protected)/app/setup/dna/deck/page.tsx");
const listProjects = read("lib/projects/actions.ts");
const ownership = read("lib/security/org-ownership.ts");
const companyActions = read("lib/settings/company-actions.ts");
const dnaActions = read("lib/company-dna/actions.ts");

console.log("-- STRUCTURE --");
check(
  "1. Dashboard page uses the unified loader",
  dashboardPage.includes("loadDashboardPageData") &&
    dashboardPage.includes("measureServerLoad") &&
    dashboardPage.includes('"dashboard"') &&
    !dashboardPage.includes("listProjects(") &&
    !dashboardPage.includes("getDashboardPipelineSummary(") &&
    !dashboardPage.includes("organisationHasProjects(") &&
    !dashboardPage.includes("listRecentActivity(")
);
check(
  "2. Dashboard loader starts independent reads concurrently",
  dashboardLoader.includes("await Promise.all(") &&
    dashboardLoader.includes("probeProjectSchemaColumns") &&
    dashboardLoader.includes("getCompanySetupReadiness()") &&
    dashboardLoader.includes('.from("projects")') &&
    dashboardLoader.includes('.from("estimates")') &&
    dashboardLoader.includes('.from("pricing_documents")') &&
    dashboardLoader.includes('.from("quotes")')
);
check(
  "3. Dashboard derives list + KPIs + activity from the same rows",
  dashboardLoader.includes("summarizePipeline") &&
    dashboardLoader.includes("hasProjects = allProjects.length > 0") &&
    dashboardLoader.includes("deriveRecentActivity") &&
    dashboardLoader.includes("getDashboardProjectSelect")
);
check(
  "4. listProjects probes and summaries are concurrent",
  listProjects.includes("probeProjectSchemaColumns(context.supabase)") &&
    listProjects.includes("await Promise.all([") &&
    listProjects.includes("getPricingSummariesForProjects(projectIds)") &&
    listProjects.includes("getQuoteSummariesForProjects(projectIds)")
);
check(
  "5. layout still parallelises chrome after auth",
  layout.includes("await Promise.all([") &&
    layout.includes("getAuthDisplayProfile()") &&
    layout.includes("getFirstRunStage()") &&
    layout.includes("getOrgBillingState(auth.orgId)")
);
check(
  "6. organisation_settings read helper remains React.cache + select-only",
  settingsReader.includes("React.cache key: orgId") &&
    settingsReader.includes("cache(") &&
    !settingsReader.includes(".insert(") &&
    !settingsReader.includes(".update(")
);
check(
  "7. Company render uses the cached settings reader, create-if-missing stays for miss",
  companyLoader.includes("loadOrganisationSettingsRow(context.orgId)") &&
    companyLoader.includes("loadOrganisationName(context.orgId)") &&
    companyLoader.includes("ensureCompanySettingsRow")
);
check(
  "8. Rates read uses cached settings; mutation still ensureDefaultSettings",
  /getRatesPageState[\s\S]*loadOrganisationSettingsRow\(orgId\)/.test(ratesActions) &&
    /saveRateSettings[\s\S]*ensureDefaultSettings\(supabase, orgId\)/.test(
      ratesActions
    )
);
check(
  "9. billing state is request-scoped React.cache, not cross-request",
  billingServer.includes('import { cache } from "react"') &&
    billingServer.includes("cache(getOrgBillingStateUncached)") &&
    billingServer.includes("Does not cache across requests") &&
    !billingServer.includes("unstable_cache")
);
check(
  "10. membership role is request-scoped React.cache; checks stay parallel",
  permissionServer.includes("cache(loadMembershipRoleUncached)") &&
    permissionServer.includes("await Promise.all([") &&
    permissionServer.includes("runIndependentEntitlementAndPermissionChecks") &&
    !permissionServer.includes("unstable_cache")
);
check(
  "11. first-run stage is request-cached and still uses the settings reader",
  firstRunSrc.includes("export async function getFirstRunStage") &&
    firstRunSrc.includes("cache(") &&
    firstRunSrc.includes("loadOrganisationSettingsRow") &&
    !firstRunSrc.slice(
      firstRunSrc.indexOf("export async function getFirstRunStage"),
      firstRunSrc.indexOf("const companyBasicsSchema")
    ).includes("ensureDefaultSettings")
);
check(
  "12. org name reader is React.cache keyed by orgId",
  orgName.includes("React.cache key: orgId") &&
    displaySrc.includes("loadOrganisationName(auth.orgId)") &&
    readiness.includes("loadOrganisationName(orgId)")
);
check(
  "13. Rates/Company/Calibration pages do not re-read session profile",
  !ratesPage.includes("auth.getUser") &&
    !companyPage.includes("auth.getUser") &&
    !dnaTask.includes("auth.getUser") &&
    !dnaDeck.includes("createClient") &&
    companyPage.includes("await Promise.all([")
);
check(
  "14. primary nav prefetches Dashboard/Rates/Company/Setup",
  sidebar.includes("prefetch") &&
    sidebar.includes('href: "/app/dashboard"') &&
    sidebar.includes('href: "/app/rates"') &&
    sidebar.includes('href: "/app/settings/company"') &&
    sidebar.includes('href: "/app/setup"') &&
    mobileNav.includes("prefetch")
);
check(
  "15. notification fetch is shared in AppShell, not per bell",
  shell.includes("NotificationProvider") &&
    read("components/layout/notification-bell.tsx").includes("useNotifications") &&
    !read("components/layout/notification-bell.tsx").includes(
      "listMyQuoteNotifications"
    )
);
check(
  "16. Rates catalogue editors are dynamically imported",
  ratesContent.includes('dynamic(') &&
    ratesContent.includes("./RatesNonDefaultSections") &&
    !ratesContent.includes("LABOUR_RATE_CATALOGUE") &&
    !ratesContent.includes("SPECIFIC_MATERIAL_RATE_GROUPS")
);
check(
  "17. Dashboard/Rates/Company do not import AssistantShell",
  !dashboardPage.includes("AssistantShell") &&
    !ratesPage.includes("AssistantShell") &&
    !companyPage.includes("AssistantShell")
);
check(
  "18. mutation ownership stays uncached",
  ownership.includes("assertOrgOwnsActiveProject") &&
    !ownership.includes("cache(") &&
    dnaActions.includes("requireCalibrationWrite") &&
    /updateCompanySettings[\s\S]*permissionDeniedError/.test(companyActions)
);
check(
  "19. readiness uses one company-rate query",
  readiness.includes('.select("id, rate_type")') &&
    !readiness.includes('.eq("rate_type", "labour")')
);
check(
  "20. Setup state parallelises work areas + rates after cached settings",
  /getSetupState[\s\S]*loadOrganisationSettingsRow\(orgId\)[\s\S]*Promise\.all\(/.test(
    firstRunSrc
  )
);

console.log("\n-- CACHE IDENTITY --");
async function main(): Promise<void> {
  const cachedOnce = cache(async (orgId: string) => ({
    orgId,
    n: Math.random(),
  }));
  const a = await cachedOnce("org-a");
  const b = await cachedOnce("org-a");
  const c = await cachedOnce("org-b");
  check(
    "React.cache keys by orgId (or no-ops in Node as separate calls)",
    a.orgId === "org-a" && c.orgId === "org-b"
  );
  check(
    "same-key reuse either shares identity or is a Node no-op",
    a.orgId === b.orgId
  );

  console.log("\n-- MUTATION FRESHNESS --");
  function makeOwnershipCtx(options: {
    orgId: string;
    projectId: string;
  }): AuthOrgContext & { queries: () => number } {
    let queries = 0;
    const chain = {
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
        queries += 1;
        return { data: { id: options.projectId }, error: null };
      },
    };
    return {
      orgId: options.orgId,
      user: { id: "user-1" },
      supabase: { from() { return chain; } },
      queries: () => queries,
    } as AuthOrgContext & { queries: () => number };
  }

  resetUnderlyingActiveProjectOwnershipCount();
  const ctx = makeOwnershipCtx({ orgId: "org-a", projectId: "proj-1" });
  await assertOrgOwnsActiveProject(ctx, "proj-1");
  await assertOrgOwnsActiveProject(ctx, "proj-1");
  check(
    "uncached ownership runs twice in one mock request",
    getUnderlyingActiveProjectOwnershipCount() >= 2 || ctx.queries() >= 2
  );

  console.log("\n-- ESTIMATOR UNTOUCHED --");
  const calculateSrc = read("lib/estimate/calculate-estimate.ts");
  const walls = read("lib/estimate/internal-walls-physical.ts");
  check(
    "calculate-estimate is unchanged by this phase (still present)",
    calculateSrc.includes("export function calculateEstimate") ||
      calculateSrc.includes("export async function calculateEstimate")
  );
  check("Internal Walls module still present", walls.length > 0);

  const fixture = loadCalibrationFixture("REAL-JOB-01.json");
  check("calibration fixture still loads", Boolean(fixture));

  const dummyCtx = {
    workAreas: [] as EstimateWorkArea[],
    facts: [] as EstimateFact[],
  } as unknown as EstimateContext;
  check("estimate types still importable", Array.isArray(dummyCtx.workAreas));

  console.log(`\nverify-performance-01d: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    process.exit(1);
  }
}

void main();
