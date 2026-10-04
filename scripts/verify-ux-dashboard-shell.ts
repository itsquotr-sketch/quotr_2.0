/**
 * Dashboard and shell information architecture.
 *
 * Run: npx --yes tsx scripts/verify-ux-dashboard-shell.ts
 */
import { existsSync, readFileSync } from "node:fs";
import { deriveDashboardAttention } from "../lib/dashboard/attention";
import { selectDashboardActiveProjects } from "../lib/dashboard/select-active-projects";
import {
  isDashboardRoute,
  isNewProjectRoute,
  isProjectsRoute,
  isRatesRoute,
} from "../components/layout/mobile-nav-metrics";
import { defaultDashboardWorkTab } from "../lib/dashboard/work-panel";
import {
  presentDashboardOverview,
  WORK_OVERVIEW_MEASURES,
} from "../lib/dashboard/work-overview";
import { isRequiredOnboardingAllowedPath } from "../lib/setup/first-run-stage";
import type { CompanySetupReadiness } from "../lib/setup/readiness";
import type { ProjectListItem } from "../lib/projects/types";
import { getProjectNextAction } from "../lib/projects/next-action";
import { applyProjectListFilter } from "../lib/projects/query-utils";

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
  "bottom navigation is Dashboard, Projects, New, Rates, and Menu",
  mobileNav.indexOf('href="/app/dashboard"') <
    mobileNav.indexOf('href="/app/projects"') &&
    mobileNav.indexOf('href="/app/projects"') <
      mobileNav.indexOf("data-mobile-new-project") &&
    mobileNav.indexOf("data-mobile-new-project") <
      mobileNav.indexOf('href="/app/rates"') &&
    mobileNav.indexOf('href="/app/rates"') < mobileNav.indexOf("<MobileMenuSheet") &&
    mobileNav.includes('data-mobile-nav="five"') &&
    mobileNav.includes('aria-label="New project"') &&
    mobileNav.includes("NewProjectDialog") &&
    mobileNav.includes("grid-cols-5") &&
    mobileNav.includes("min-w-0") &&
    mobileNav.includes("h-[4.5rem]") &&
    mobileNav.includes("justify-center") &&
    mobileNav.includes("gap-1") &&
    mobileNav.includes("size-[22px]") &&
    mobileNav.includes("size-14") &&
    mobileNav.includes("rounded-full") &&
    !mobileNav.includes("speed dial")
);
check(
  "mobile menu is secondary destinations and closes after navigation",
  !menu.includes('"/app/projects"') &&
    !menu.includes('"/app/dashboard"') &&
    !menu.includes('"/app/rates"') &&
    menu.indexOf('"/app/settings/company"') <
      menu.indexOf('"/app/settings/billing"') &&
    menu.includes("Organisation") &&
    menu.includes("Account") &&
    menu.includes("SheetTitle") &&
    menu.includes(">Menu<") &&
    menu.includes("setOpen(false)") &&
    menu.includes("overflow-y-auto") &&
    menu.includes('height: "100dvh"') &&
    menu.includes("max-h-dvh") &&
    menu.includes('position: "fixed"') &&
    menu.includes("finalFocus") &&
    menu.includes('html.style.overflow = "hidden"') &&
    menu.includes("SidebarAccount") &&
    menu.includes("aria-expanded={open}") &&
    menu.includes("safe-area-inset-bottom") &&
    menu.includes("min-h-11") &&
    menu.includes('aria-current={open ? "page" : undefined}')
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
    read("components/dashboard/DashboardWorkPanel.tsx").includes("Nothing needs attention")
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
    !dash.includes("order-3") &&
    dash.includes("DashboardWorkPanel") &&
    !dash.includes("<RecentActivityCard") &&
    !dash.includes("<UserMenu") &&
    !dash.includes("DashboardProjectList")
);
check(
  "phone stack is the shared panel, then active projects",
  dash.indexOf("order-1") < dash.indexOf("order-2") &&
    !dash.includes("order-3") &&
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
    read("components/dashboard/DashboardWorkPanel.tsx").includes("const DESKTOP_CAP = 5") &&
    read("components/dashboard/DashboardWorkPanel.tsx").includes("const PHONE_CAP = 3") &&
    read("components/dashboard/DashboardWorkPanel.tsx").includes("View all")
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

const panel = read("components/dashboard/DashboardWorkPanel.tsx");
check(
  "attention and activity share one accessible tab panel",
  panel.includes("Tabs.List") &&
    panel.includes("Tabs.Tab") &&
    panel.includes("Tabs.Panel") &&
    panel.includes("keepMounted") &&
    panel.includes('value="attention"') &&
    panel.includes('value="activity"') &&
    panel.includes('aria-label="Needs attention and recent activity"') &&
    !dash.includes("order-3") &&
    !existsSync("components/dashboard/DashboardAttention.tsx")
);
check(
  "default tab follows attention, then activity, then the attention empty state",
  defaultDashboardWorkTab(2, 3) === "attention" &&
    defaultDashboardWorkTab(0, 3) === "activity" &&
    defaultDashboardWorkTab(0, 0) === "attention"
);
const overviewCounts = presentDashboardOverview([
  { business_status: "lead", archived_at: null },
  { business_status: "estimating", archived_at: null },
  { business_status: "estimating", archived_at: "2026-01-01" },
  { business_status: "estimate_ready", archived_at: null },
  { business_status: "quote_sent", archived_at: null },
  { business_status: "quote_sent", archived_at: "2026-01-01" },
  { business_status: "won", archived_at: null },
  { business_status: "won", archived_at: "2026-01-01" },
]);
check(
  "dashboard presentation counts exclude archived current work and keep all-time won",
  overviewCounts.activeCount === 4 &&
    overviewCounts.estimatingPricingCount === 2 &&
    overviewCounts.quotesSentCount === 1 &&
    overviewCounts.wonCount === 2 &&
    WORK_OVERVIEW_MEASURES.find((item) => item.key === "wonCount")?.context ===
      "Accepted projects" &&
    WORK_OVERVIEW_MEASURES.find((item) => item.key === "quotesSentCount")
      ?.label === "Quotes out" &&
    WORK_OVERVIEW_MEASURES.find((item) => item.key === "activeCount")?.context ===
      "Current pipeline" &&
    loader.includes('if (status === "estimating" || status === "estimate_ready")') &&
    read("lib/projects/actions.ts").includes("function getDashboardPipelineSummary")
);
const quoteSentRows = [
  listProject({ id: "sent-open", business_status: "quote_sent" }),
  listProject({
    id: "sent-archived",
    business_status: "quote_sent",
    archived_at: "2026-01-01T00:00:00.000Z",
  }),
  listProject({ id: "won-open", business_status: "won" }),
  listProject({
    id: "won-archived",
    business_status: "won",
    archived_at: "2026-01-01T00:00:00.000Z",
  }),
  listProject({
    id: "lost-archived",
    business_status: "lost",
    archived_at: "2026-01-01T00:00:00.000Z",
  }),
  listProject({
    id: "lead-archived",
    business_status: "lead",
    archived_at: "2026-01-01T00:00:00.000Z",
  }),
];
const quoteSentDestination = applyProjectListFilter(
  quoteSentRows,
  "quote_sent",
  true,
  true
);
check(
  "quote sent card count matches the non-archived quote sent destination",
  presentDashboardOverview(quoteSentRows).quotesSentCount ===
    quoteSentDestination.length &&
    quoteSentDestination.map((project) => project.id).join(",") === "sent-open" &&
    WORK_OVERVIEW_MEASURES.find((item) => item.key === "quotesSentCount")?.href ===
      "/app/projects?filter=quote_sent" &&
    applyProjectListFilter(quoteSentRows, "won", true, true)
      .map((project) => project.id)
      .sort()
      .join(",") === "won-archived,won-open" &&
    applyProjectListFilter(quoteSentRows, "lost", true, true)
      .map((project) => project.id)
      .join(",") === "lost-archived" &&
    applyProjectListFilter(quoteSentRows, "lead", true, true)
      .map((project) => project.id)
      .join(",") === "lead-archived" &&
    applyProjectListFilter(quoteSentRows, "archived", true, true).some(
      (project) => project.id === "sent-archived"
    ) &&
    read("lib/projects/actions.ts").includes('filter === "quote_sent"') &&
    read("lib/projects/actions.ts").includes('query.is("archived_at", null)')
);
const registerGrid = read("lib/projects/register-columns.ts");
check(
  "projects header and rows share one grid",
  registerGrid.includes("minmax(0,1fr)") &&
    registerGrid.includes("minmax(13rem,15rem)") &&
    read("components/projects/ProjectRow.tsx").includes("PROJECT_REGISTER_GRID") &&
    read("components/projects/DashboardProjectList.tsx").includes("PROJECT_REGISTER_GRID") &&
    read("components/projects/ProjectRow.tsx").includes("whitespace-nowrap text-sm")
);
check(
  "mobile menu is fixed to the viewport and restores focus",
  menu.includes('height: "100dvh"') &&
    menu.includes("maxHeight: \"100dvh\"") &&
    menu.includes("finalFocus={triggerRef}") &&
    menu.includes("showTeamNav") &&
    read("components/ui/sheet.tsx").includes("data-[side=right]:h-dvh") &&
    read("components/ui/sheet.tsx").includes("data-[side=right]:max-h-dvh") &&
    read("components/layout/mobile-nav.tsx").includes('href="/app/dashboard"') &&
    read("components/layout/mobile-nav.tsx").includes('href="/app/rates"') &&
    read("app/(protected)/app/dashboard/page.tsx").includes("hideActionsOnMobile") &&
    read("app/(protected)/app/projects/page.tsx").includes("hideActionsOnMobile") &&
    read("components/layout/page-header.tsx").includes("hidden md:flex") &&
    read("components/layout/app-shell.tsx").includes("mobileNavPaddingClass") &&
    read("components/layout/mobile-nav-metrics.ts").includes(
      "bottom-[calc(5.75rem+env(safe-area-inset-bottom))]"
    ) &&
    read("components/quotes/QuoteMobileActionBar.tsx").includes("mobileNavBottomClass") &&
    read("components/variations/VariationEditor.tsx").includes("mobileNavBottomClass") &&
    read("components/variations/VariationDeliveryPanel.tsx").includes("mobileNavBottomClass") &&
    read("components/pricing/PricingMobileActionBar.tsx").includes("mobileNavBottomClass") &&
    read("components/assistant/clarify/ClarifyPanel.tsx").includes("mobileNavBottomClass") &&
    isDashboardRoute("/app/dashboard") &&
    !isDashboardRoute("/app/projects") &&
    isProjectsRoute("/app/projects") &&
    isProjectsRoute("/app/projects/job-1") &&
    !isProjectsRoute("/app/projects/new") &&
    isNewProjectRoute("/app/projects/new") &&
    !isNewProjectRoute("/app/projects") &&
    isRatesRoute("/app/rates") &&
    isRatesRoute("/app/rates/core") &&
    !isRatesRoute("/app/projects") &&
    read("components/setup/OnboardingFrame.tsx").includes("No primary nav") &&
    !read("components/setup/OnboardingFrame.tsx").includes("MobileNav")
);

check(
  "attention keeps required setup and a sent quote, and skips recommended setup",
  attention.some((item) => item.state === "Add a company name for quotes") &&
    attention.some((item) => item.state === "Awaiting a client response") &&
    attention.some((item) => item.href === "/app/projects/p1/quotes/q1") &&
    !attention.some((item) => item.href.includes("section=core"))
);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
