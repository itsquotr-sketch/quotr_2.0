/**
 * Dashboard and shell information architecture.
 *
 * Run: npx --yes tsx scripts/verify-ux-dashboard-shell.ts
 */
import { existsSync, readFileSync } from "node:fs";
import { deriveDashboardAttention } from "../lib/dashboard/attention";
import { isRequiredOnboardingAllowedPath } from "../lib/setup/first-run-stage";
import type { CompanySetupReadiness } from "../lib/setup/readiness";
import type { ProjectListItem } from "../lib/projects/types";

let passed = 0;
let failed = 0;

function check(name: string, ok: boolean): void {
  if (ok) {
    passed += 1;
    console.log(`PASS  ${name}`);
  } else {
    failed += 1;
    console.log(`FAIL  ${name}`);
  }
}

function read(path: string): string {
  return readFileSync(path, "utf8");
}

const sidebar = read("components/app-sidebar.tsx");
const mobileNav = read("components/layout/mobile-nav.tsx");
const menu = read("components/layout/mobile-menu-sheet.tsx");
const dash = read("app/(protected)/app/dashboard/page.tsx");
const loader = read("lib/dashboard/load-dashboard-page.ts");
const company = read("components/settings/CompanySettingsContent.tsx");
const team = read("components/team/TeamPageContent.tsx");
const onboarding = read("components/setup/OnboardingFrame.tsx");

console.log("=== Dashboard and shell IA ===\n");

check(
  "desktop primary order is Dashboard, Projects, Rates",
  sidebar.indexOf('href: "/app/dashboard"') < sidebar.indexOf('href: "/app/projects"') &&
    sidebar.indexOf('href: "/app/projects"') < sidebar.indexOf('href: "/app/rates"') &&
    sidebar.indexOf("Organisation") > sidebar.indexOf('href: "/app/rates"')
);
check(
  "organisation nav is Company then Team, and Setup is not a primary item",
  sidebar.includes('href: "/app/settings/company"') &&
    sidebar.includes('href: "/app/settings/team"') &&
    sidebar.includes("showTeamNav") &&
    !sidebar.includes('href: "/app/setup"')
);
check(
  "active navigation exposes aria-current and does not wrap labels",
  sidebar.includes('aria-current={isActive ? "page" : undefined}') &&
    sidebar.includes("whitespace-nowrap")
);
check(
  "bottom navigation stays Dashboard, Rates, and Menu",
  mobileNav.includes('href: "/app/dashboard"') &&
    mobileNav.includes('href: "/app/rates"') &&
    mobileNav.includes("MobileMenuSheet") &&
    !mobileNav.includes('href: "/app/projects"') &&
    mobileNav.includes('aria-current={isActive ? "page" : undefined}')
);
check(
  "mobile menu leads with Projects and closes after navigation",
  menu.indexOf('"/app/projects"') < menu.indexOf('"/app/settings/company"') &&
    menu.includes("SheetTitle") &&
    menu.includes(">Menu<") &&
    menu.includes("setOpen(false)") &&
    menu.includes("overflow-y-auto") &&
    menu.includes("safe-area-inset-bottom") &&
    menu.includes("min-h-11") &&
    menu.includes('aria-current={isActive ? "page" : undefined}')
);
check(
  "mobile menu keeps account destinations and hides work while setup is incomplete",
  menu.includes('"/app/settings/billing"') &&
    menu.includes('"/app/profile"') &&
    menu.includes("Sign out") &&
    menu.includes("Notifications") &&
    menu.includes("FeedbackLink") &&
    menu.includes("setupIncomplete ? null") &&
    menu.includes("showTeamNav")
);
check(
  "incomplete onboarding still uses the focused frame",
  onboarding.includes("No primary nav") &&
    !isRequiredOnboardingAllowedPath("/app/projects") &&
    !isRequiredOnboardingAllowedPath("/app/projects/new")
);
check(
  "projects index uses the dashboard loader",
  existsSync("app/(protected)/app/projects/page.tsx") &&
    read("app/(protected)/app/projects/page.tsx").includes("loadDashboardPageData")
);
check(
  "first-job state follows loader hasProjects",
  loader.includes("hasProjects = allProjects.length > 0") &&
    dash.includes("const isEmpty = !hasProjects") &&
    dash.includes('data-first-job-empty="true"') &&
    dash.includes("Start your first job") &&
    !dash.includes("organisationHasProjects(") &&
    dash.includes("Nothing needs attention") === false &&
    read("components/dashboard/DashboardAttention.tsx").includes("Nothing needs attention")
);
check(
  "dashboard recomposes attention, active work, counts, and existing activity",
  dash.includes("data-dashboard-attention") &&
    dash.includes("Active work") &&
    dash.includes("data-dashboard-kpis") &&
    dash.includes("data-dashboard-activity") &&
    dash.indexOf("data-dashboard-attention") < dash.indexOf("data-dashboard-projects") &&
    dash.indexOf("data-dashboard-projects") < dash.indexOf("data-dashboard-kpis") &&
    !dash.includes("<UserMenu")
);
check(
  "company overview is split and does not repeat the signed-in name",
  company.includes("data-company-overview") &&
    company.includes("Edit work types") &&
    company.includes("GST number") &&
    company.includes("Issued Quotes and") &&
    !company.includes("Signed in as")
);
check(
  "team invitation opens from the page and keeps seat disclosure",
  team.includes("Invite member") &&
    team.includes("SEAT_ADD_DISCLOSURE") &&
    team.includes("Send invitation") &&
    team.includes("SEAT_REMOVE_DISCLOSURE") &&
    team.includes("setInviteOpen") &&
    !team.includes("<CardTitle>Invite someone</CardTitle>")
);

const readiness = {
  missingQuoteSetup: [
    {
      id: "company_name",
      title: "Add a company name for quotes",
      reason: "Clients need to see who is issuing the quote.",
      href: "/app/settings/company?section=business",
      severity: "required",
      dimension: "quote",
    },
  ],
  missingPricingSetup: [],
  missingEstimateSetup: [
    {
      id: "labour_rate",
      title: "Add your labour rate",
      reason: "Recommended only.",
      href: "/app/rates?section=core",
      severity: "recommended",
      dimension: "estimate",
    },
  ],
} as unknown as CompanySetupReadiness;

const sent = {
  id: "p1",
  title: "Deck",
  client_name: "Ada",
  site_address: null,
  archived_at: null,
  has_estimate: true,
  estimate_is_stale: false,
  pricing_summary: null,
  quote_summary: { id: "q1", status: "sent" },
} as ProjectListItem;

const attention = deriveDashboardAttention({
  projects: [sent],
  readiness,
});

check(
  "attention keeps required setup and a sent quote, and skips recommended setup",
  attention.some((item) => item.state === "Add a company name for quotes") &&
    attention.some((item) => item.state === "Awaiting a client response") &&
    attention.some((item) => item.href === "/app/projects/p1/quotes/q1") &&
    !attention.some((item) => item.href.includes("section=core"))
);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
