/**
 * Dashboard and shell information architecture.
 *
 * Run: npx --yes tsx scripts/verify-ux-dashboard-shell.ts
 */
import { existsSync, readFileSync } from "node:fs";
import { deriveDashboardAttention } from "../lib/dashboard/attention";
import { selectDashboardActiveProjects } from "../lib/dashboard/select-active-projects";
import { WORK_OVERVIEW_MEASURES } from "../lib/dashboard/work-overview";
import { isRequiredOnboardingAllowedPath } from "../lib/setup/first-run-stage";
import type { CompanySetupReadiness } from "../lib/setup/readiness";
import type { ProjectListItem } from "../lib/projects/types";
import { getProjectNextAction } from "../lib/projects/next-action";

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
  "sidebar matches the prototype width, black surface, and labelled sections",
  sidebar.includes("w-56") &&
    sidebar.includes("bg-[#141311]") &&
    sidebar.includes('label="Work"') &&
    sidebar.includes('label="Organisation"') &&
    sidebar.includes("whitespace-nowrap") &&
    sidebar.includes('variant="wordmark"') &&
    sidebar.includes("bg-white") &&
    sidebar.includes("Notifications") &&
    sidebar.includes("FeedbackLink") &&
    sidebar.includes("SidebarAccount")
);
check(
  "dashboard recomposes a four-measure overview, then a 2/3 and 1/3 working area",
  dash.includes("data-dashboard-kpis") &&
    dash.includes("data-dashboard-grid") &&
    dash.includes("lg:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]") &&
    dash.indexOf("data-dashboard-kpis") < dash.indexOf("data-dashboard-grid") &&
    dash.includes("order-2") &&
    dash.includes("order-1") &&
    dash.includes("order-3") &&
    !dash.includes("<UserMenu") &&
    !dash.includes("DashboardProjectList")
);
check(
  "phone stack is attention, then active projects, then activity",
  dash.indexOf("order-1") < dash.indexOf("order-2") &&
    dash.indexOf("order-2") < dash.indexOf("order-3") &&
    dash.includes("activity.length > 0") &&
    read("components/dashboard/RecentActivityCard.tsx").includes(
      "if (visible.length === 0) return null"
    )
);
check(
  "active projects and attention are capped",
  read("components/dashboard/DashboardActiveProjects.tsx").includes(
    "DASHBOARD_ACTIVE_PROJECT_PHONE_LIMIT"
  ) &&
    read("components/dashboard/DashboardActiveProjects.tsx").includes("max-lg:hidden") &&
    read("components/dashboard/DashboardAttention.tsx").includes("const DESKTOP_CAP = 5") &&
    read("components/dashboard/DashboardAttention.tsx").includes("const PHONE_CAP = 3") &&
    read("components/dashboard/DashboardAttention.tsx").includes("View all")
);
check(
  "projects register keeps search, filters, and a bounded first page",
  read("app/(protected)/app/projects/page.tsx").includes(
    'params.filter ? parseProjectListFilter(params.filter) : "active"'
  ) &&
    read("components/projects/DashboardProjectList.tsx").includes("Search projects") &&
    read("components/projects/DashboardProjectList.tsx").includes("DASHBOARD_FILTER_OPTIONS") &&
    read("components/projects/DashboardProjectList.tsx").includes("PROJECT_REGISTER_PAGE_SIZE = 24") &&
    read("components/projects/DashboardProjectList.tsx").includes("Load more") &&
    read("components/projects/DashboardProjectList.tsx").includes("/app/projects")
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

check(
  "four overview measures use the existing pipeline counts",
  WORK_OVERVIEW_MEASURES.map((item) => item.key).join(",") ===
    "activeCount,estimatingPricingCount,quotesSentCount,wonCount" &&
    WORK_OVERVIEW_MEASURES.every((item) => item.key !== "quoteDraftCount") &&
    !WORK_OVERVIEW_MEASURES.some((item) => item.key === "lostCount") &&
    read("components/projects/StatusCountRow.tsx").includes("grid-cols-2") &&
    read("components/projects/StatusCountRow.tsx").includes("lg:grid-cols-4")
);

function listProject(
  partial: Partial<ProjectListItem> & Pick<ProjectListItem, "id">
): ProjectListItem {
  return {
    title: partial.title ?? "Job",
    brief_text: null,
    client_name: null,
    client_email: null,
    site_address: null,
    priority: "normal",
    due_date: null,
    notes: null,
    stage: "brief",
    quality_level: "standard",
    status: "active",
    business_status: "lead",
    status_updated_at: null,
    lost_reason: null,
    won_at: null,
    lost_at: null,
    created_at: "2026-01-01T00:00:00.000Z",
    archived_at: null,
    deleted_at: null,
    duplicated_from_project_id: null,
    has_estimate: false,
    estimate_is_stale: false,
    pricing_summary: null,
    quote_summary: null,
    ...partial,
  };
}

const olderLead = listProject({
  id: "older",
  created_at: "2026-01-01T00:00:00.000Z",
});
const newerLead = listProject({
  id: "newer",
  status_updated_at: "2026-03-01T00:00:00.000Z",
  created_at: "2026-01-02T00:00:00.000Z",
});
const acceptedQuote = listProject({
  id: "accepted",
  business_status: "quote_draft",
  status_updated_at: "2026-04-01T00:00:00.000Z",
  quote_summary: {
    id: "q-accepted",
    status: "accepted",
    pricing_document_id: null,
    created_at: "2026-04-01T00:00:00.000Z",
    revision_number: 1,
  },
});
const won = listProject({
  id: "won",
  business_status: "won",
  status_updated_at: "2026-05-01T00:00:00.000Z",
});
const archived = listProject({
  id: "archived",
  archived_at: "2026-05-02T00:00:00.000Z",
  status_updated_at: "2026-05-02T00:00:00.000Z",
});

const selected = selectDashboardActiveProjects(
  [won, archived, acceptedQuote, olderLead, newerLead],
  8
);

check(
  "dashboard project selection prefers a next action, then recency, and skips closed work",
  selected.total === 3 &&
    selected.projects.map((project) => project.id).join(",") ===
      "newer,older,accepted" &&
    getProjectNextAction(acceptedQuote) === "View quote" &&
    getProjectNextAction(newerLead) === "Analyse project"
);

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
