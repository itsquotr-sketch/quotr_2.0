/**
 * POLISH-03B — app shell, Dashboard composition, Company General spacing, favicon.
 *
 * Run: npx --yes tsx scripts/verify-polish-03b.ts
 *
 * Navigation placement / layout / presentation only. Does not change
 * estimating, billing economics, DNA, quote architecture, auth, or schema.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { QUOTR_ICON_SRC, QUOTR_WORDMARK_SRC } from "../lib/branding/assets";
import { roleAllowsPermission } from "../lib/team/permissions";

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

function read(path: string): string {
  return readFileSync(path, "utf8");
}

function latestMigration(): string | null {
  const dir = join(process.cwd(), "supabase/migrations");
  if (!existsSync(dir)) return null;
  const files = readdirSync(dir)
    .filter((name) => /^\d+_/.test(name) && name.endsWith(".sql"))
    .sort();
  return files.at(-1) ?? null;
}

console.log("=== POLISH-03B ===\n");

const sidebar = read("components/app-sidebar.tsx");
const accountMenu = read("components/layout/account-menu.tsx");
const mobileSheet = read("components/layout/mobile-menu-sheet.tsx");
const dash = read("app/(protected)/app/dashboard/page.tsx");
const projectList = read("components/projects/DashboardProjectList.tsx");
const kpi = read("components/projects/StatusCountRow.tsx");
const activity = read("components/dashboard/RecentActivityCard.tsx");
const prompt = read("components/setup/ImproveSetupCard.tsx");
const companyUi = read("components/settings/CompanySettingsContent.tsx");
const companyPage = read("app/(protected)/app/settings/company/page.tsx");
const rootLayout = read("app/layout.tsx");
const appShell = read("components/layout/app-shell.tsx");
const logo = read("components/layout/quotr-logo.tsx");

console.log("--- NAV ---\n");
check(
  "primary sidebar does not list Billing",
  !sidebar.includes("/app/settings/billing") &&
    !/label:\s*"Billing"/.test(sidebar)
);
check(
  "mobile sheet does not list Billing as primary nav",
  !mobileSheet.includes("/app/settings/billing")
);
check(
  "profile menu Billing remains",
  accountMenu.includes("data-account-menu-billing") &&
    accountMenu.includes("/app/settings/billing") &&
    accountMenu.includes("Billing")
);
check(
  "Billing route still exists",
  existsSync("app/(protected)/app/settings/billing/page.tsx")
);
check(
  "everyday sidebar items remain",
  sidebar.includes("/app/dashboard") &&
    sidebar.includes("/app/rates") &&
    sidebar.includes("/app/settings/company") &&
    sidebar.includes("/app/setup")
);
check(
  "billing permissions unchanged",
  roleAllowsPermission("owner", "billing.manage") &&
    !roleAllowsPermission("admin", "billing.manage") &&
    !roleAllowsPermission("estimator", "billing.manage") &&
    !roleAllowsPermission("viewer", "billing.manage") &&
    roleAllowsPermission("owner", "billing.view") &&
    roleAllowsPermission("admin", "billing.view") &&
    roleAllowsPermission("estimator", "billing.view") &&
    roleAllowsPermission("viewer", "billing.view")
);

console.log("\n--- BRAND ---\n");
check(
  "sidebar uses official wordmark in a light chip",
  sidebar.includes('variant="wordmark"') &&
    sidebar.includes("bg-white") &&
    /h-\[18px\]/.test(sidebar) &&
    !sidebar.includes("object-fill") &&
    /w-\[232px\]/.test(sidebar)
);
check(
  "wordmark sits with PREVIEW as one header unit",
  sidebar.includes("deploymentLabel") &&
    /gap-2\.5/.test(sidebar) &&
    /items-center/.test(sidebar)
);
check(
  "mobile header uses compact square icon",
  appShell.includes('variant="icon"') &&
    appShell.includes("QuotrLogo") &&
    !appShell.includes('variant="wordmark"')
);
check(
  "official assets referenced",
  logo.includes("QUOTR_WORDMARK_SRC") &&
    logo.includes("QUOTR_ICON_SRC") &&
    QUOTR_ICON_SRC === "/branding/quotr-icon-black.png" &&
    QUOTR_WORDMARK_SRC === "/branding/quotr-wordmark-black.png" &&
    existsSync("public/branding/quotr-icon-black.png") &&
    existsSync("public/branding/quotr-wordmark-black.png")
);
check(
  "favicon uses official icon convention",
  existsSync("app/icon.png") &&
    existsSync("app/apple-icon.png") &&
    existsSync("app/favicon.ico") &&
    rootLayout.includes("QUOTR_ICON_SRC") &&
    rootLayout.includes("/favicon.ico")
);
check(
  "no legacy public favicon precedence",
  !existsSync("public/favicon.ico") &&
    !existsSync("public/favicon.png") &&
    !existsSync("public/favicon.svg") &&
    !existsSync("public/quotr-logo.svg")
);
check(
  "no polish schema migration 054",
  !existsSync("supabase/migrations/054_recent_activity.sql") &&
    !existsSync("supabase/migrations/054_polish_03b.sql")
);
check(
  "054 DNA catalogue seed is data-only",
  (latestMigration() ?? "") === "054_company_dna_v2_catalogue_seed.sql"
);

console.log("\n--- DASHBOARD ---\n");
check(
  "desktop workspace is a 12-column grid",
  dash.includes("data-dashboard-workspace") &&
    dash.includes("lg:grid-cols-12")
);
check(
  "Projects is the dominant column",
  dash.includes("data-dashboard-projects") &&
    (dash.includes("lg:col-span-8") || dash.includes("lg:col-span-9"))
);
check(
  "Recent Activity is the supporting column",
  dash.includes("data-dashboard-activity") &&
    (dash.includes("lg:col-span-4") || dash.includes("lg:col-span-3"))
);
const projectsIdx = dash.indexOf("data-dashboard-projects");
const activityIdx = dash.indexOf("data-dashboard-activity");
check(
  "mobile stack order is Projects then Activity",
  projectsIdx >= 0 && activityIdx > projectsIdx
);
check(
  "KPI then workspace (no Activity beside KPI)",
  dash.includes("data-dashboard-kpis") &&
    dash.indexOf("data-dashboard-kpis") < dash.indexOf("data-dashboard-workspace") &&
    !/lg:grid-cols-\[minmax\(0,1fr\)_minmax\(16rem,20rem\)\]/.test(dash)
);
check(
  "KPI is 2-column on small screens and 6 on desktop",
  kpi.includes("grid-cols-2") && kpi.includes("lg:grid-cols-6")
);
check(
  "Projects workspace groups search, filters, and list",
  projectList.includes("rounded-xl") &&
    projectList.includes("Search projects") &&
    projectList.includes("DASHBOARD_FILTER_OPTIONS") &&
    projectList.includes('id="dashboard-status-filter"')
);
const filterOptions = read("lib/projects/status.ts");
check(
  "lifecycle chips retained",
  projectList.includes("DASHBOARD_FILTER_OPTIONS") &&
    projectList.includes("aria-pressed") &&
    filterOptions.includes('label: "All"') &&
    filterOptions.includes('label: "Active"') &&
    filterOptions.includes('label: "Won"') &&
    filterOptions.includes('label: "Lost"') &&
    filterOptions.includes('label: "Archived"')
);
check(
  "first-job logic unchanged",
  dash.includes("organisationHasProjects") &&
    dash.includes('data-first-job-empty="true"') &&
    dash.includes("Start your first job")
);
check(
  "New project remains prominent",
  dash.includes("<NewProjectDialog intent={isEmpty ? \"first-job\" : \"default\"} />") &&
    projectList.includes("New project")
);
check(
  "calibration prompt remains compact",
  prompt.includes("resolvePersonalisationNextStep") &&
    prompt.includes("data-dashboard-prompt") &&
    prompt.includes("sm:flex-row")
);
check(
  "activity is presentation-only with internal scroll",
  activity.includes("formatActivityWhen") &&
    activity.includes("max-h-[min(36rem,70vh)]") &&
    activity.includes("overflow-y-auto") &&
    activity.includes("aria-label") &&
    !activity.includes("listRecentActivity")
);
check(
  "no extra dashboard fetch for layout",
  dash.includes("listRecentActivity()") &&
    dash.split("listRecentActivity()").length === 2 &&
    dash.includes("Promise.all")
);
check(
  "dashboard keeps existing page max-width",
  dash.includes("<PageContainer") &&
    read("components/layout/page-containers.tsx").includes('page: "max-w-[1440px]"')
);

console.log("\n--- COMPANY ---\n");
const postcodeIdx = companyUi.indexOf('htmlFor="postcode"');
const timezoneIdx = companyUi.indexOf('id="company-timezone"');
check(
  "responsive form grid with paired fields",
  companyUi.includes("sm:grid-cols-2") &&
    companyUi.includes("space-y-1.5") &&
    companyUi.includes("data-company-identity") &&
    companyUi.includes("data-company-address")
);
check(
  "timezone follows postcode/country with helper separation",
  postcodeIdx >= 0 &&
    timezoneIdx > postcodeIdx &&
    companyUi.includes("data-timezone-helper") &&
    companyUi.includes("Used to show quote acceptance and send times")
);
check(
  "save action preserved in a tighter footer",
  companyUi.includes("Save company settings") &&
    companyUi.includes("Changes apply to new pricing and quotes.") &&
    companyUi.includes("data-company-save-footer") &&
    !companyUi.includes("sticky bottom-0")
);
check(
  "Company form uses a settings form max-width",
  companyPage.includes("FormContainer") ||
    companyPage.includes("max-w-[880px]")
);
check(
  "two-column pairs are sm+ only (mobile stacks)",
  companyUi.includes("sm:grid-cols-2") &&
    !/(?<!sm:)grid-cols-2/.test(companyUi)
);

console.log("\n=== RESULT ===");
console.log(`passed=${passed} failed=${failed}`);
if (failed > 0) {
  process.exit(1);
}
