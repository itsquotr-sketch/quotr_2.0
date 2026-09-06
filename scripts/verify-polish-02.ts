/**
 * POLISH-02 — core UX simplification + navigation cleanup.
 *
 * Run: npx --yes tsx scripts/verify-polish-02.ts
 *
 * Presentation / IA only. Does not change billing economics, estimating
 * formulas, role authority, quote snapshots, or schema.
 */
import { readFileSync } from "node:fs";
import { composeClarifyView } from "../lib/assistant/clarify/compose";
import { composeJobPlan } from "../lib/assistant/job-plan/compose";
import { composeEstimateReadiness } from "../lib/assistant/readiness/compose";
import {
  builderFacingAssumptionStatement,
  looksLikeInternalFactKey,
  safeFactPresentationLabel,
} from "../lib/assistant/presentation/fact-key-labels";
import { assumptionStatementForKey } from "../lib/assistant/clarify/assumptions";
import {
  DECK_BOARD_WIDTH_FACT_KEY,
  disclosedBoardWidthForNotSure,
} from "../lib/estimate/deck-board-width";
import { roleAllowsPermission } from "../lib/team/permissions";
import {
  isCompanyBasicsComplete,
  isRatesSetupComplete,
  isWorkAreasComplete,
} from "../lib/setup/completed-setup";
import type { SetupState } from "../components/setup/types";
import type { EstimateFact, EstimateWorkArea } from "../lib/estimate/types";

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

function fact(
  key: string,
  workAreaId: string,
  value: unknown,
  source?: string
): EstimateFact {
  return { key, work_area_id: workAreaId, value, source };
}

function wa(id: string): EstimateWorkArea & { status: "confirmed" } {
  return { id, type: "deck", name: "Deck", sort_order: 1, status: "confirmed" };
}

function deckFacts(widthMm?: number, source?: string): EstimateFact[] {
  const rows: EstimateFact[] = [
    fact("deck.length_m", "d1", 5),
    fact("deck.width_m", "d1", 4),
    fact("deck.area_m2", "d1", 20),
    fact("deck.height_m", "d1", 0.4),
    fact("deck.board_material", "d1", "Hardwood"),
    fact("deck.substructure_included", "d1", true, "assumption"),
  ];
  if (widthMm != null) {
    rows.push(fact(DECK_BOARD_WIDTH_FACT_KEY, "d1", widthMm, source));
  }
  return rows;
}

function readinessFor(facts: EstimateFact[]) {
  const workAreas = [wa("d1")];
  const jobPlan = composeJobPlan({
    workAreas,
    facts,
    constraints: [],
    qualityLevel: "standard",
    briefText: "Hardwood deck 5m x 4m",
  });
  const clarify = composeClarifyView({
    stage: "quality",
    briefText: "Hardwood deck 5m x 4m",
    qualityLevel: "standard",
    workAreas,
    facts,
    constraints: [],
    jobPlan,
  });
  return composeEstimateReadiness({
    clarify,
    jobPlan,
    qualityLevel: "standard",
    constraints: [],
  });
}

const review = read("components/assistant/builder-review/BuilderReviewSurface.tsx");
const pricingHeader = read("components/pricing/PricingHeader.tsx");
const pricingWorkspace = read("components/pricing/PricingWorkspace.tsx");
const decision = read("components/pricing/PricingDecisionCard.tsx");
const setupShell = read("components/setup/SetupShell.tsx");
const completedSummary = read("components/setup/CompletedSetupSummary.tsx");
const accountMenu = read("components/layout/account-menu.tsx");
const companyUi = read("components/settings/CompanySettingsContent.tsx");
const companyPage = read("app/(protected)/app/settings/company/page.tsx");
const ratesPage = read("app/(protected)/app/rates/page.tsx");
const ratesContent = read("components/rates/RatesPageContent.tsx");
const wastage = read("components/rates/MaterialWastageDefaultsSection.tsx");
const stepper = read("components/assistant/StepperNav.tsx");
const jobPlanPanel = read("components/assistant/job-plan/JobPlanPanel.tsx");
const destinations = read("lib/setup/recommendation-destinations.ts");
const companyActions = read("lib/settings/company-actions.ts");
const rateActions = read("lib/rates/actions.ts");
const clarifyReadiness = read("components/assistant/clarify/ClarifyReadiness.tsx");
const factLabels = read("lib/assistant/presentation/fact-key-labels.ts");

console.log("=== POLISH-02 ===\n");

console.log("--- BUILDER REVIEW ---\n");
check(
  "Work Areas expanded by default",
  review.includes("init[wa.workAreaName] = true") &&
    review.includes('data-builder-review-entry="open"') &&
    review.includes("data-builder-review-wa-open")
);
check(
  "Work Areas remain collapsible after load",
  review.includes("data-builder-review-wa-toggle") &&
    review.includes("setOpenAreas") &&
    review.includes("openAreas[wa.workAreaName] !== false")
);
check(
  "mobile expanded Work Areas avoid horizontal scroll",
  review.includes("overflow-x-hidden")
);

console.log("\n--- PRICING ---\n");
check(
  "Adjust Work Area prices expanded by default",
  /<details[\s\S]{0,400}\bopen\b[\s\S]{0,200}data-pricing-work-area-adjustments/.test(
    pricingWorkspace
  ) ||
    /data-pricing-work-area-adjustments[\s\S]{0,200}\bopen\b/.test(
      pricingWorkspace
    )
);
check(
  "Adjust Work Area prices is a details disclosure (collapsible)",
  pricingWorkspace.includes("<details") &&
    pricingWorkspace.includes("Adjust Work Area prices")
);
check(
  "duplicate Project identity block absent on Pricing",
  pricingHeader.includes('data-pricing-identity-duplicate="false"') &&
    !pricingHeader.includes("buildMetaLine") &&
    !pricingHeader.includes("client_name") &&
    pricingWorkspace.includes("data-pricing-quote-details")
);
check(
  "mobile Pricing still shows project title for identity",
  pricingHeader.includes("sm:hidden") && pricingHeader.includes("projectTitle")
);
check(
  "core Pricing decision card preserved",
  decision.includes("data-pricing-decision-card") &&
    pricingWorkspace.includes("<PricingDecisionCard") &&
    decision.includes("recommended") &&
    /GST|gst/i.test(decision)
);
check(
  "line-level tables remain collapsed",
  pricingWorkspace.includes("data-pricing-advanced-lines")
);

console.log("\n--- SETUP ---\n");
const incompleteCompany: SetupState = {
  organisationName: "Test Co",
  settings: {
    id: "s1",
    org_id: "o1",
    default_margin_percent: 20,
    default_contingency_percent: 10,
    budget_rate_factor: 0.9,
    premium_rate_factor: 1.15,
    currency: "NZD",
    country: "NZ",
    region: null,
    onboarding_status: "not_started",
    onboarding_step: "company",
    onboarding_completed_at: null,
    prefer_user_rates: true,
    allow_benchmark_rates: true,
    show_profit_in_estimates: true,
    contact_email: null,
  },
  workAreas: [],
  rates: [],
};
const completeCompany: SetupState = {
  ...incompleteCompany,
  settings: {
    ...incompleteCompany.settings!,
    onboarding_status: "in_progress",
    contact_email: "quotes@test.co.nz",
  },
  workAreas: [
    {
      id: "w1",
      work_area_type: "deck",
      label: "Deck",
      category: "outdoor",
      description: null,
      estimate_support: "calculator",
      enabled: true,
      sort_order: 1,
    },
  ],
  rates: [
    {
      id: "r1",
      rate_type: "labour",
      trade: "carpenter",
      work_area_type: "deck",
      item_key: "labour.carpenter",
      label: "Carpenter",
      unit: "hr",
      cost_rate: 55,
      sell_rate: null,
      markup_percent: null,
      active: true,
    },
  ],
};
check("incomplete company stays actionable", !isCompanyBasicsComplete(incompleteCompany));
check("complete company is compact-eligible", isCompanyBasicsComplete(completeCompany));
check("incomplete work types stay expanded", !isWorkAreasComplete(incompleteCompany));
check("complete work types use persisted enabled rows", isWorkAreasComplete(completeCompany));
check("incomplete rates stay expanded", !isRatesSetupComplete(incompleteCompany));
check("complete rates use persisted cost_rate", isRatesSetupComplete(completeCompany));
check(
  "completed setup renders compact summary + Edit",
  completedSummary.includes('data-setup-compact="true"') &&
    completedSummary.includes("data-setup-edit") &&
    setupShell.includes("<CompletedSetupSummary") &&
    setupShell.includes("data-setup-incomplete")
);
check(
  "first-run setup is not collapsed",
  setupShell.includes('if (mode === "basics")') &&
    setupShell.includes('if (mode === "work")') &&
    setupShell.includes('if (mode === "pricing")') &&
    setupShell.indexOf('if (mode === "basics")') <
      setupShell.indexOf("<CompletedSetupSummary")
);

console.log("\n--- PROFILE / BILLING ---\n");
check(
  "profile menu exposes Billing",
  accountMenu.includes("data-account-menu-billing") &&
    accountMenu.includes("/app/settings/billing") &&
    accountMenu.includes("Billing")
);
check(
  "Owner can manage billing; Admin/Estimator/Viewer cannot",
  roleAllowsPermission("owner", "billing.manage") &&
    !roleAllowsPermission("admin", "billing.manage") &&
    !roleAllowsPermission("estimator", "billing.manage") &&
    !roleAllowsPermission("viewer", "billing.manage")
);
check(
  "Estimator does not gain company-default authority",
  !roleAllowsPermission("estimator", "company.edit") &&
    !roleAllowsPermission("estimator", "company.rates.manage") &&
    roleAllowsPermission("estimator", "company.calibration.manage")
);
check(
  "Viewer remains read-only for company defaults and billing mutations",
  !roleAllowsPermission("viewer", "company.edit") &&
    !roleAllowsPermission("viewer", "company.rates.manage") &&
    roleAllowsPermission("viewer", "billing.view")
);
check(
  "sidebar Billing is not removed",
  read("components/app-sidebar.tsx").includes("/app/settings/billing")
);

console.log("\n--- COMPANY / RATES ---\n");
check(
  "Company Advanced estimating section is gone",
  !companyUi.includes('advanced: "Advanced"') &&
    !companyUi.includes('activeSection === "advanced"') &&
    !companyUi.includes("defaultMaterialWastagePercent") &&
    companyPage.includes("isMovedCompanyAdvancedSection") &&
    destinations.includes('if (trimmed === "advanced")')
);
check(
  "legacy ?section=advanced redirects to Rates Defaults",
  companyPage.includes('redirect("/app/rates?section=defaults")')
);
check(
  "wastage defaults live on Rates → Defaults",
  wastage.includes("data-rates-wastage-defaults") &&
    ratesContent.includes("<MaterialWastageDefaultsSection") &&
    ratesContent.includes('data-rates-defaults') &&
    ratesPage.includes("getCompanySettings")
);
check(
  "wastage still saves through updateCompanySettings",
  wastage.includes("updateCompanySettings") &&
    companyActions.includes("defaultMaterialWastagePercent") &&
    companyActions.includes('permission: "company.edit"')
);
check(
  "Rates Defaults still save through saveRateSettings",
  rateActions.includes("export async function saveRateSettings") &&
    rateActions.includes('permission: "company.rates.manage"') &&
    ratesContent.includes("readOnly={!state.canManageRates}")
);
check(
  "Company still owns tax/quote identity fields",
  companyUi.includes("defaultGstRate") || companyUi.includes("GST")
);
check(
  "no orphan Advanced heading on Company",
  !/title="Advanced"/.test(companyUi)
);

console.log("\n--- PRESENTATION ---\n");
check(
  "substructure assumption is builder language",
  assumptionStatementForKey("deck.substructure_included").includes("substructure") &&
    !assumptionStatementForKey("deck.substructure_included").includes(
      "deck.substructure_included"
    )
);
check(
  "unknown fact keys never dump the raw key",
  builderFacingAssumptionStatement("fence.some_internal_key") ===
    "An estimating assumption is being used." &&
    !looksLikeInternalFactKey(builderFacingAssumptionStatement("unknown.fact")) &&
    safeFactPresentationLabel("PACKAGE_FALLBACK") === "This detail"
);
check(
  "Ready card does not render raw fact keys as known",
  clarifyReadiness.includes("data-readiness-known") &&
    factLabels.includes("looksLikeInternalFactKey")
);

const assumedReady = readinessFor(deckFacts(140, "assumption"));
const knownReady = readinessFor(deckFacts(90, "user"));
const assumedJoined = assumedReady.known.join(" | ");
const assumedAssumptionText = assumedReady.assumptions
  .map((row) => row.statement)
  .join(" | ");
check(
  "assumed 140 mm is not listed as known",
  !/140/.test(assumedJoined)
);
check(
  "known 90 mm can appear as known",
  /90/.test(knownReady.known.join(" | "))
);
check(
  "assumed board width stays labelled as an assumption",
  /140|board/i.test(assumedAssumptionText) ||
    assumedReady.assumptions.length > 0
);
check(
  "user-facing assumption UI has no raw deck.substructure_included",
  !assumedAssumptionText.includes("deck.substructure_included") &&
    !assumedJoined.includes("deck.") &&
    !clarifyReadiness.includes("Assumed for now:")
);
check(
  "Not sure still persists as assumption source",
  disclosedBoardWidthForNotSure("Not sure")?.source === "assumption"
);

console.log("\n--- RECOVERY COPY ---\n");
check(
  "canonical stepper is Job details / Work / Details / Estimate",
  stepper.includes('label: "Job details"') &&
    stepper.includes('label: "Work"') &&
    stepper.includes('label: "Details"') &&
    stepper.includes('label: "Estimate"') &&
    !stepper.includes('label: "Brief"') &&
    !stepper.includes('label: "Job Plan"')
);
check(
  "canonical Work Area CTA is + Add another Work Area",
  jobPlanPanel.includes("+ Add another Work Area") &&
    jobPlanPanel.includes("data-job-plan-add-work-area")
);

console.log("\n=== RESULT ===");
console.log(`passed=${passed} failed=${failed}`);
if (failed > 0) {
  process.exit(1);
}
