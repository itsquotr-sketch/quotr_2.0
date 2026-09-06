/**
 * POLISH-03 — branding, compact Rates, Recent Activity, concrete bag architecture.
 *
 * Run: npx --yes tsx scripts/verify-polish-03.ts
 *
 * POLISH-03A adds the owner-approved Quotr benchmark on the existing
 * deck.concrete.premix.20kg.bag catalogue key. Quantity formulas unchanged.
 */
import { existsSync, readFileSync } from "node:fs";
import { deriveRecentActivity } from "../lib/dashboard/derive-recent-activity";
import { formatActivityWhen } from "../lib/dashboard/format-activity-time";
import { mapRateLabel } from "../lib/assistant/builder-review/compose";
import { presentLineFallback } from "../lib/estimate/fallback-presentation";
import {
  DECK_CONCRETE_MATERIAL_ITEM_KEY,
  purchasedConcreteBags,
} from "../lib/estimate/deck-scope-2c";
import { resolveMaterialRate } from "../lib/estimate/resolve-material-rate";
import { FULL_RATE_CATALOGUE } from "../lib/rates/catalogue";
import { DECK_CONCRETE_SPECIFIC_MATERIAL_CATALOGUE } from "../lib/rates/specific-material-catalogue";
import { roleAllowsPermission } from "../lib/team/permissions";
import { parseRatesSection } from "../lib/setup/recommendation-destinations";
import { QUOTR_ICON_SRC, QUOTR_WORDMARK_SRC } from "../lib/branding/assets";
import { summarizeProductivityWorkAreas } from "../lib/rates/productivity-work-area-summary";
import type { OrganisationRate, OrganisationSettings } from "../components/setup/types";

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

console.log("=== POLISH-03 ===\n");

console.log("--- BRANDING ---\n");
check(
  "official icon asset present",
  existsSync("public/branding/quotr-icon-black.png") &&
    QUOTR_ICON_SRC === "/branding/quotr-icon-black.png"
);
check(
  "official wordmark asset present",
  existsSync("public/branding/quotr-wordmark-black.png") &&
    QUOTR_WORDMARK_SRC === "/branding/quotr-wordmark-black.png"
);
check(
  "Next.js app/icon.png favicon convention",
  existsSync("app/icon.png") && existsSync("app/apple-icon.png")
);
const rootLayout = read("app/layout.tsx");
check(
  "root metadata icons point at official icon",
  rootLayout.includes("QUOTR_ICON_SRC") && rootLayout.includes("icons")
);
const logo = read("components/layout/quotr-logo.tsx");
check(
  "QuotrLogo uses official wordmark and icon paths",
  logo.includes("QUOTR_WORDMARK_SRC") &&
    logo.includes("QUOTR_ICON_SRC") &&
    !logo.includes("/quotr-logo.svg")
);
check("placeholder SVG removed", !existsSync("public/quotr-logo.svg"));
const authLayout = read("app/(auth)/layout.tsx");
check(
  "Auth uses official wordmark",
  authLayout.includes('variant="wordmark"') &&
    authLayout.includes("QUOTR_PRODUCT_LINE")
);
const sidebar = read("components/app-sidebar.tsx");
check(
  "expanded sidebar uses wordmark on light backing",
  sidebar.includes('variant="wordmark"') &&
    sidebar.includes("bg-white") &&
    /w-\[232px\]/.test(sidebar)
);
const appShell = read("components/layout/app-shell.tsx");
check(
  "mobile header uses compact square icon",
  appShell.includes('variant="icon"') && appShell.includes("QuotrLogo")
);
const inviteEmail = read("lib/team/invite-email.ts");
const quoteEmail = read("lib/quotes/delivery-email.ts");
check(
  "team invite remains text-branded (no local/base64 logo)",
  inviteEmail.includes("Sent via Quotr") &&
    !inviteEmail.includes("/branding/") &&
    !inviteEmail.includes("data:image")
);
check(
  "quote email stays contractor-first",
  quoteEmail.includes("Sent securely via Quotr") &&
    !quoteEmail.includes("QUOTR_WORDMARK") &&
    !quoteEmail.includes("/branding/quotr-wordmark")
);
const publicShell = read("components/quotes/QuotePublicShell.tsx");
const quoteTemplate = read("components/quotes/QuoteTemplate.tsx");
check(
  "public quote remains organisation-first",
  quoteTemplate.includes("QuoteCompanyLogo") &&
    !publicShell.includes("QuotrLogo") &&
    !quoteTemplate.includes("QUOTR_WORDMARK_SRC")
);

console.log("\n--- RATES ---\n");
const ratesContent = read("components/rates/RatesPageContent.tsx");
const ratesTable = read("components/rates/RatesTableSection.tsx");
const dnaCompare = read("components/rates/CompanyDnaRatesCompare.tsx");
check(
  "compact Rates structure",
  ratesContent.includes('data-rates-compact') &&
    ratesContent.includes('{ id: "defaults", label: "Defaults" }') &&
    ratesContent.includes('{ id: "materials", label: "Materials" }') &&
    ratesContent.includes('{ id: "core", label: "Labour & Productivity" }')
);
check(
  "Defaults is the default Rates section",
  read("app/(protected)/app/rates/page.tsx").includes(
    'parseRatesSection(params.section) ?? "defaults"'
  ) && parseRatesSection("defaults") === "defaults"
);
check(
  "legacy core/productivity/work_types deep links still parse",
  parseRatesSection("core") === "core" &&
    parseRatesSection("productivity") === "productivity" &&
    parseRatesSection("work_types") === "work_types"
);
check(
  "Defaults section still present",
  ratesContent.includes('data-rates-defaults') &&
    ratesContent.includes("<CompanyDefaultsSection") &&
    ratesContent.includes("<MaterialWastageDefaultsSection")
);
check(
  "company vs benchmark source clarity",
  ratesTable.includes("Your rate") &&
    ratesTable.includes("Quotr benchmark") &&
    !ratesTable.includes("EXPLICIT_COMPANY") &&
    !dnaCompare.includes("explicit_company")
);
check(
  "productivity grouped by Work Area",
  dnaCompare.includes("data-productivity-work-area") &&
    dnaCompare.includes("tasks calibrated") &&
    read("lib/rates/productivity-work-area-summary.ts").includes(
      "summarizeProductivityWorkAreas"
    )
);
const groups = summarizeProductivityWorkAreas([], ["deck", "fence"]);
check(
  "productivity counts derive from DNA catalogue",
  groups.length === 3 &&
    groups[0]?.workAreaType === "deck" &&
    groups[0]?.taskTotal === groups[0]?.tasks.length &&
    groups[0]?.statusLabel === "Not calibrated"
);
check(
  "permissions preserved",
  ratesContent.includes("readOnly={!state.canManageRates}") &&
    ratesContent.includes("canCalibrate={state.canCalibrate}") &&
    roleAllowsPermission("owner", "company.rates.manage") &&
    roleAllowsPermission("admin", "company.rates.manage") &&
    !roleAllowsPermission("estimator", "company.rates.manage") &&
    !roleAllowsPermission("viewer", "company.rates.manage")
);
check(
  "mobile Rates is not a desktop-only HTML table",
  !ratesTable.includes("<table") &&
    ratesTable.includes("RateMobileCard") &&
    ratesTable.includes("data-rates-compact-list")
);

console.log("\n--- ACTIVITY ---\n");
const dash = read("app/(protected)/app/dashboard/page.tsx");
const activityCard = read("components/dashboard/RecentActivityCard.tsx");
check(
  "first-job empty state unchanged",
  dash.includes("organisationHasProjects") &&
    dash.includes('data-first-job-empty="true"') &&
    dash.includes("Start your first job")
);
check(
  "Recent Activity is derived, not a new event table",
  read("lib/dashboard/recent-activity.ts").includes('from("quotes")') &&
    read("lib/dashboard/recent-activity.ts").includes('from("projects")') &&
    read("lib/dashboard/recent-activity.ts").includes('from("estimates")') &&
    !existsSync("supabase/migrations/054_recent_activity.sql")
);
const derived = deriveRecentActivity({
  projects: [
    {
      id: "p1",
      title: "Driveway Fence",
      created_at: "2026-09-01T00:00:00.000Z",
    },
  ],
  estimates: [
    {
      id: "e1",
      project_id: "p1",
      created_at: "2026-09-02T00:00:00.000Z",
      updated_at: "2026-09-03T00:00:00.000Z",
      generated_at: "2026-09-03T00:00:00.000Z",
    },
  ],
  quotes: [
    {
      id: "q1",
      project_id: "p1",
      created_at: "2026-09-04T00:00:00.000Z",
      sent_at: "2026-09-05T00:00:00.000Z",
      viewed_at: null,
      accepted_at: "2026-09-06T08:00:00.000Z",
      declined_at: null,
    },
  ],
  limit: 10,
});
check(
  "accepted quote activity derived",
  derived.some((item) => item.kind === "quote_accepted") &&
    derived.some((item) => item.detail === "Quote accepted")
);
check(
  "quote sent activity derived",
  derived.some((item) => item.kind === "quote_sent")
);
check(
  "project created and estimate activity derived",
  derived.some((item) => item.kind === "project_created") &&
    derived.some((item) => item.kind === "estimate_updated")
);
check(
  "activity deep-links to existing project/quote routes",
  derived.every(
    (item) =>
      item.href.startsWith("/app/projects/") && !item.href.includes("/activity")
  ) && activityCard.includes("aria-label")
);
check(
  "org timezone formatting",
  formatActivityWhen("2026-09-06T06:00:00.000Z", "Pacific/Auckland", new Date("2026-09-06T08:00:00.000Z")) ===
    "2 hours ago" &&
    activityCard.includes("formatActivityWhen")
);
check(
  "empty activity copy, no demo rows",
  read("lib/dashboard/derive-recent-activity.ts").includes(
    "No activity yet. Your recent estimates and quotes will appear here."
  ) &&
    activityCard.includes("RECENT_ACTIVITY_EMPTY") &&
    !activityCard.includes("Smith Deck")
);
check(
  "New Project CTA not displaced",
  dash.includes("<NewProjectDialog intent={isEmpty ? \"first-job\" : \"default\"} />") &&
    dash.includes("<RecentActivityCard")
);

console.log("\n--- CONCRETE ---\n");
const concreteEntry = DECK_CONCRETE_SPECIFIC_MATERIAL_CATALOGUE.find(
  (entry) => entry.item_key === DECK_CONCRETE_MATERIAL_ITEM_KEY
);
const catalogueDupes = FULL_RATE_CATALOGUE.filter(
  (entry) => entry.item_key === DECK_CONCRETE_MATERIAL_ITEM_KEY
);
const deckCalc = read("lib/estimate/calculators/deck.ts");
const deckQty = read("lib/estimate/deck-scope-2c.ts");
check(
  "canonical concrete bag material key",
  DECK_CONCRETE_MATERIAL_ITEM_KEY === "deck.concrete.premix.20kg.bag" &&
    concreteEntry?.unit === "bag" &&
    concreteEntry?.item_key === "deck.concrete.premix.20kg.bag"
);
check(
  "no duplicate catalogue item",
  DECK_CONCRETE_SPECIFIC_MATERIAL_CATALOGUE.length === 1 &&
    catalogueDupes.length === 1
);
check(
  "owner-approved Quotr benchmark is $9.80 / bag",
  concreteEntry?.defaultCostRate === 9.8 && concreteEntry?.unit === "bag"
);
check(
  "Rates compact row shows Your rate and Quotr benchmark",
  ratesTable.includes("Your rate") &&
    ratesTable.includes("Quotr benchmark") &&
    ratesTable.includes('"—"') &&
    (concreteEntry?.label === "Concrete bags" ||
      /Concrete bags/i.test(concreteEntry?.label ?? ""))
);

const polishSettings: OrganisationSettings = {
  id: "s",
  org_id: "o",
  default_margin_percent: 20,
  default_contingency_percent: 10,
  default_gst_rate: 15,
  budget_rate_factor: 0.9,
  premium_rate_factor: 1.15,
  currency: "NZD",
  country: "NZ",
  region: null,
  onboarding_status: "completed",
  onboarding_step: "completed",
  onboarding_completed_at: null,
  prefer_user_rates: true,
  allow_benchmark_rates: true,
  show_profit_in_estimates: true,
};
const companyBagRate: OrganisationRate = {
  id: "r-bag",
  rate_type: "material",
  trade: null,
  work_area_type: "deck",
  item_key: DECK_CONCRETE_MATERIAL_ITEM_KEY,
  label: "Concrete bags",
  unit: "bag",
  cost_rate: 12.5,
  sell_rate: null,
  markup_percent: null,
  active: true,
};
const companyResolved = resolveMaterialRate({
  orgRates: [companyBagRate],
  materialKey: DECK_CONCRETE_MATERIAL_ITEM_KEY,
  unit: "bag",
  label: "Concrete bags",
  benchmarkCostRate: concreteEntry?.defaultCostRate ?? 0,
  organisationSettings: polishSettings,
});
const benchmarkResolved = resolveMaterialRate({
  orgRates: [],
  materialKey: DECK_CONCRETE_MATERIAL_ITEM_KEY,
  unit: "bag",
  label: "Concrete bags",
  benchmarkCostRate: concreteEntry?.defaultCostRate ?? 0,
  organisationSettings: polishSettings,
});
check(
  "company rate overrides benchmark",
  companyResolved.costRate === 12.5 &&
    companyResolved.materialRateSource === "company_specific" &&
    companyResolved.rateResolutionDisplay === "Your company rate" &&
    companyResolved.costRate !== 9.8
);
check(
  "benchmark used when company rate absent",
  benchmarkResolved.costRate === 9.8 &&
    benchmarkResolved.unit === "bag" &&
    benchmarkResolved.materialRateSource === "benchmark_specific" &&
    benchmarkResolved.rateResolutionDisplay === "Quotr benchmark"
);
const reviewBenchmark = presentLineFallback({
  label: "Post-hole concrete",
  rateSource: "Quotr benchmark",
  itemKey: DECK_CONCRETE_MATERIAL_ITEM_KEY,
  quantityBasis: {
    sourceFact: "deck.concrete_bags_per_hole",
    sourceLabel: "Post holes",
    quantity: 10,
    unit: "bag",
    confidence: "derived",
  },
});
check(
  "Review names calculated-bag benchmark as Quotr benchmark, not Allowance used",
  reviewBenchmark?.kind === "benchmark_rate" &&
    reviewBenchmark.label === "Quotr benchmark" &&
    mapRateLabel("Quotr benchmark") === "Quotr benchmark" &&
    mapRateLabel("Fallback allowance") === "Allowance used"
);
check(
  "calculator still prefers company rate then catalogue benchmark",
  deckCalc.includes("DECK_CONCRETE_MATERIAL_ITEM_KEY") &&
    deckCalc.includes('rateSourceType: "user_rate"') &&
    deckCalc.includes('rateSourceType: "benchmark"') &&
    deckCalc.includes("getCatalogueEntry")
);
check(
  "bag quantity formula unchanged",
  purchasedConcreteBags(4, 2.5) === 10 &&
    deckQty.includes("Math.ceil(round2(supportCount * bagsPerHole)") &&
    deckCalc.includes("purchasedConcreteBags") &&
    deckCalc.includes("concreteBagsPerHole") &&
    !deckCalc.includes("bagsEach * 20")
);

if (failed > 0) {
  console.error(`\nFAILED ${failed} checks`);
  process.exit(1);
}
console.log(`\nAll POLISH-03 checks passed (${passed}).`);
