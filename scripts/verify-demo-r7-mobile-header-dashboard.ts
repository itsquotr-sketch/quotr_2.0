/**
 * DEMO-R7 — Final mobile header + Dashboard density (static contracts).
 *
 * Presentation / navigation / safe Dashboard data-flow only.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

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

const appShell = read("components/layout/app-shell.tsx");
const pageHeader = read("components/layout/page-header.tsx");
const dashboard = read("app/(protected)/app/dashboard/page.tsx");
const projectList = read("components/projects/DashboardProjectList.tsx");
const statusRow = read("components/projects/StatusCountRow.tsx");
const ratesPage = read("app/(protected)/app/rates/page.tsx");
const envExample = read(".env.local.example");

check(
  "1 mobile Dashboard marketing subtitle not rendered on mobile chrome",
  dashboard.includes("compactOnMobile") &&
    pageHeader.includes("compactOnMobile") &&
    pageHeader.includes("max-md:hidden")
);
check(
  "2 large mobile Dashboard hero heading de-emphasised (sr-only + chrome hidden)",
  pageHeader.includes('className="sr-only md:hidden"') &&
    dashboard.includes('title="Dashboard"')
);
check(
  "3 profile/avatar in shared mobile top header",
  appShell.includes("AccountMenu") &&
    appShell.includes("md:hidden") &&
    /QuotrLogo[\s\S]*AccountMenu|AccountMenu[\s\S]*QuotrLogo/.test(appShell)
);
check(
  "4 no duplicate mobile Dashboard profile in page header chrome",
  dashboard.includes("compactOnMobile") &&
    !/createClient/.test(dashboard)
);
check(
  "5 KPI grid remains compact 2-column",
  /grid-cols-2/.test(statusRow) && /gap-1\.5/.test(statusRow)
);
check(
  "6 Status dropdown remains canonical mobile filter",
  projectList.includes('id="dashboard-status-filter"') &&
    projectList.includes("DASHBOARD_FILTER_OPTIONS") &&
    projectList.includes("md:hidden")
);
check(
  "7 desktop pills remain",
  /rounded-full border px-3 py-1\.5/.test(projectList) &&
    (projectList.includes("hidden md:block") ||
      projectList.includes("hidden md:-mx-0 md:block"))
);
check(
  "8 New project CTA remains (mobile list + desktop header)",
  projectList.includes("New project") &&
    dashboard.includes("NewProjectDialog")
);
check(
  "9 project list remains reachable",
  dashboard.includes("DashboardProjectList") &&
    projectList.includes("ProjectMobileCard")
);
check(
  "10 no commercial/rate resolver rewrite in DEMO-R7 surfaces",
  !dashboard.includes("deriveSellFromGrossMargin") &&
    !appShell.includes("resolveRate")
);
check(
  "11 no DEMO-R7 migration",
  !existsSync(join(root, "supabase/migrations/036_demo_r7.sql"))
);
check(
  "12 no Stage 3.2.3 work-area interview lib",
  !existsSync(join(root, "lib/builder-interview/work-area-interview.ts"))
);
check(
  "13 Production SD untouched / not force-enabled",
  !/^[^#\n]*SCOPE_DISCOVERY_ENABLED\s*=\s*true/m.test(envExample)
);
check(
  "14 Dashboard dropped duplicate auth+profile fetch (context-backed menu)",
  !dashboard.includes("createClient") &&
    !dashboard.includes("from(\"profiles\")") &&
    dashboard.includes("<UserMenu")
);
check(
  "14b Rates hides page-header UserMenu on mobile (AppShell avatar)",
  ratesPage.includes('className="hidden md:inline-flex"')
);
check(
  "14c Dashboard mobile content density tightened",
  dashboard.includes("max-md:py-3") &&
    dashboard.includes("space-y-4 md:space-y-6")
);

console.log(`\n=== DEMO-R7 Results: ${passed} passed, ${failed} failed ===`);
process.exit(failed > 0 ? 1 : 0);
