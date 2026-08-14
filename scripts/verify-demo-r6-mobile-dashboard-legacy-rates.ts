/**
 * DEMO-R6 — Low-risk mobile Dashboard + Legacy Rates polish (static contracts).
 *
 * Presentation / navigation only. No commercial formula or rate-resolution changes.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { DASHBOARD_FILTER_OPTIONS } from "../lib/projects/status";
import { SCOPE_RATE_CATALOGUE } from "../lib/rates/catalogue";

const root = process.cwd();
let passed = 0;
let failed = 0;

function read(rel: string): string {
  return readFileSync(join(root, rel), "utf8");
}

function check(name: string, ok: boolean) {
  if (ok) {
    console.log(`PASS  ${name}`);
    passed += 1;
  } else {
    console.error(`FAIL  ${name}`);
    failed += 1;
  }
}

const statusRow = read("components/projects/StatusCountRow.tsx");
const projectList = read("components/projects/DashboardProjectList.tsx");
const ratesPage = read("components/rates/RatesPageContent.tsx");
const costFirstHelper = read("lib/rates/cost-first-presentation.ts");
const ratesResolve = read("lib/estimate/rates.ts");
const costAuthority = read("lib/commercial-engine/core/cost-first-authority.ts");
const destinations = read("lib/setup/recommendation-destinations.ts");
const envExample = read(".env.local.example");

// Extract primary RATES_SECTIONS array body for nav assertions
const primaryNavMatch = ratesPage.match(
  /\/\*\* Primary Rates navigation[\s\S]*?const RATES_SECTIONS = \[([\s\S]*?)\] as const;/
);
const primaryNavBody = primaryNavMatch?.[1] ?? "";

check(
  "1 KPI remains 2-col on mobile",
  /grid-cols-2/.test(statusRow) && /gap-1\.5/.test(statusRow)
);
check(
  "1b KPI compact mobile padding",
  /py-1\.5/.test(statusRow) && /min-h-11/.test(statusRow)
);
check(
  "1c KPI count size responsive",
  /text-lg/.test(statusRow) && /sm:text-xl/.test(statusRow)
);
check(
  "1d KPI filter links retained",
  statusRow.includes('filter: "active"') &&
    statusRow.includes('filter: "estimating"') &&
    statusRow.includes("buildFilterHref")
);

check(
  "2 mobile status select present",
  projectList.includes('id="dashboard-status-filter"') &&
    projectList.includes("md:hidden") &&
    projectList.includes("<select")
);
check(
  "2b Status label for select",
  /htmlFor="dashboard-status-filter"/.test(projectList) &&
    projectList.includes("Status")
);
check(
  "2c select uses DASHBOARD_FILTER_OPTIONS",
  projectList.includes("DASHBOARD_FILTER_OPTIONS") &&
    projectList.includes("updateParams")
);

check(
  "3 desktop pills shown md+",
  projectList.includes("hidden md:-mx-0 md:block") ||
    projectList.includes("hidden md:block")
);
check(
  "3b desktop rounded-full filter pills",
  /rounded-full border px-3 py-1\.5/.test(projectList)
);

const filterValues = DASHBOARD_FILTER_OPTIONS.map((o) => o.value);
check(
  "4 canonical filter set size",
  filterValues.length === 10 && filterValues.includes("active")
);
check(
  "4b select options sourced from same array as pills",
  (projectList.match(/DASHBOARD_FILTER_OPTIONS\.map/g) ?? []).length >= 2
);

check(
  "5 filter URL updateParams retained",
  projectList.includes('params.set("filter"') &&
    projectList.includes('params.delete("filter")') &&
    projectList.includes("/app/dashboard")
);

check(
  "6 primary nav omits legacy tab",
  primaryNavBody.length > 0 &&
    !primaryNavBody.includes('"legacy"') &&
    primaryNavBody.includes('"core"') &&
    primaryNavBody.includes('"defaults"')
);
check(
  "6b Advanced / Legacy package rates retained",
  ratesPage.includes("Advanced") &&
    ratesPage.includes("Legacy package rates") &&
    ratesPage.includes('activeSection === "legacy"') &&
    ratesPage.includes("SCOPE_RATE_CATALOGUE")
);
check(
  "6c scope catalogue still present (no data deletion)",
  SCOPE_RATE_CATALOGUE.some((e) => e.item_key === "scope.deck.m2") &&
    SCOPE_RATE_CATALOGUE.every((e) => e.calculatorSupport === "planned")
);
check(
  "6d ?section=legacy still parseable",
  destinations.includes('"legacy"')
);

check(
  "7 cost-first presentation helper unchanged import surface",
  costFirstHelper.includes("deriveSellFromGrossMargin")
);
check(
  "8 no DEMO-R6 migration file",
  !existsSync(join(root, "supabase/migrations/035_demo_r6_legacy_rates.sql"))
);
check(
  "9 resolveRate file still present (not rewritten for demo)",
  ratesResolve.includes("export function resolveRate") &&
    costAuthority.includes("deriveSellFromGrossMargin")
);
check(
  "10 SCOPE_DISCOVERY not force-enabled",
  !/^[^#\n]*SCOPE_DISCOVERY_ENABLED\s*=\s*true/m.test(envExample)
);

console.log(`\n=== DEMO-R6 Results: ${passed} passed, ${failed} failed ===`);
process.exit(failed > 0 ? 1 : 0);
