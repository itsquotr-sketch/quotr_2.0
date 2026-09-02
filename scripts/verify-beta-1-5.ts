/**
 * BETA-1.5 — first-run Work step, timezone path, personalisation ladder,
 * trial indicator, Team nav, Rates orange-card regression.
 *
 * Run: npx --yes tsx scripts/verify-beta-1-5.ts
 *
 * No paid AI. No live Stripe. Does not print secret values.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { deriveSellFromCost } from "../lib/commercial-engine/core/sell-from-margin";
import {
  deriveTrialCountdown,
  trialBannerNotice,
} from "../lib/billing/trial-countdown";
import { shouldShowTeamPrimaryNav } from "../lib/billing/team-nav-visibility";
import {
  DEFAULT_ORG_TIMEZONE,
  defaultTimezoneForCountry,
  formatInOrgTimezone,
  isIanaTimezone,
  resolveDisplayTimezone,
} from "../lib/org/timezone";
import { formatQuoteDateTime, QUOTE_DISPLAY_TIMEZONE } from "../lib/quotes/display";
import {
  FIRST_RUN_BASICS_PATH,
  FIRST_RUN_PRICING_PATH,
  FIRST_RUN_WORK_PATH,
  firstRunForcedPath,
  firstRunIsComplete,
  resolveFirstRunStage,
  setupModeRedirect,
  setupShellMode,
} from "../lib/setup/first-run-stage";
import {
  FIRST_RUN_ALLOW_OTHER,
  FIRST_RUN_PRIMARY_WORK_AREA_TYPES,
  getFirstRunPrimaryWorkAreas,
  hasEnabledPrimaryWorkArea,
  isFirstRunPrimaryWorkAreaType,
} from "../lib/setup/first-run-work-areas";
import {
  RATE_REVIEW_MIN_COMPANY_RATES,
  resolvePersonalisationNextStep,
} from "../lib/setup/personalisation-ladder";
import { SCOPE_CATALOGUE } from "../lib/scopes/catalogue";

function assert(label: string, ok: boolean) {
  console.log(ok ? "PASS" : "FAIL", label);
  if (!ok) process.exitCode = 1;
}

function read(rel: string): string {
  return readFileSync(join(process.cwd(), rel), "utf8");
}

function section(title: string) {
  console.log(`\n=== ${title} ===\n`);
}

function main() {
  console.log("=== BETA-1.5 first-run personalisation verification ===");

  section("STAGE ORDER");
  assert(
    "not_started is Company Basics",
    resolveFirstRunStage({
      onboardingStatus: "not_started",
      onboardingStep: "company",
    }) === "basics"
  );
  assert(
    "company saved without work is Your Work",
    resolveFirstRunStage({
      onboardingStatus: "in_progress",
      onboardingStep: "work_areas",
      hasPrimaryWorkAreas: false,
    }) === "work"
  );
  assert(
    "work selected is Pricing Basics",
    resolveFirstRunStage({
      onboardingStatus: "in_progress",
      onboardingStep: "work_areas",
      hasPrimaryWorkAreas: true,
    }) === "pricing"
  );
  assert(
    "pricing visited (rates) is ready",
    resolveFirstRunStage({
      onboardingStatus: "in_progress",
      onboardingStep: "rates",
      hasPrimaryWorkAreas: false,
    }) === "ready"
  );
  assert(
    "completed first-run is done even without work areas",
    resolveFirstRunStage({
      onboardingStatus: "completed",
      onboardingStep: "completed",
      hasPrimaryWorkAreas: false,
    }) === "done"
  );
  assert(
    "legacy review is done without blocking on work",
    resolveFirstRunStage({
      onboardingStatus: "in_progress",
      onboardingStep: "review",
      hasPrimaryWorkAreas: false,
    }) === "done"
  );
  assert(
    "progress labels are Company Work Pricing First job",
    /Company/.test(read("components/setup/FirstRunProgress.tsx")) &&
      /Work/.test(read("components/setup/FirstRunProgress.tsx")) &&
      /Pricing/.test(read("components/setup/FirstRunProgress.tsx")) &&
      /First job/.test(read("components/setup/FirstRunProgress.tsx"))
  );

  section("RESUME / NO LOOPS");
  assert(
    "unfinished company cannot open work",
    setupModeRedirect("work", "basics") === FIRST_RUN_BASICS_PATH
  );
  assert(
    "unfinished work cannot open pricing",
    setupModeRedirect("pricing", "work") === FIRST_RUN_WORK_PATH
  );
  assert(
    "unfinished pricing cannot open ready",
    setupModeRedirect("ready", "pricing") === FIRST_RUN_PRICING_PATH
  );
  assert(
    "ready can open ready",
    setupModeRedirect("ready", "ready") === null &&
      setupShellMode("ready", "ready") === "ready"
  );
  assert(
    "forced path covers company/work/pricing only",
    firstRunForcedPath("basics") === FIRST_RUN_BASICS_PATH &&
      firstRunForcedPath("work") === FIRST_RUN_WORK_PATH &&
      firstRunForcedPath("pricing") === FIRST_RUN_PRICING_PATH &&
      firstRunForcedPath("ready") === null &&
      firstRunForcedPath("done") === null
  );
  assert(
    "ready and done are complete for dashboard",
    firstRunIsComplete("ready") &&
      firstRunIsComplete("done") &&
      !firstRunIsComplete("work")
  );
  const layout = read("app/(protected)/app/layout.tsx");
  assert("layout still forces unfinished first-run", /firstRunForcedPath/.test(layout));

  section("EXISTING USERS NOT BLOCKED");
  assert(
    "existing rates-step user is ready without work",
    resolveFirstRunStage({
      onboardingStatus: "in_progress",
      onboardingStep: "rates",
      hasPrimaryWorkAreas: false,
    }) === "ready" && firstRunForcedPath("ready") === null
  );
  assert(
    "existing completed org is done without work",
    firstRunForcedPath(
      resolveFirstRunStage({
        onboardingStatus: "completed",
        onboardingStep: "completed",
        hasPrimaryWorkAreas: false,
      })
    ) === null
  );

  section("WORK SELECTION STORAGE");
  assert(
    "first-run types are canonical catalogue ids",
    FIRST_RUN_PRIMARY_WORK_AREA_TYPES.every((type) =>
      SCOPE_CATALOGUE.some((item) => item.type === type)
    )
  );
  assert(
    "first-run list excludes nested stairs and unfinished types",
    !isFirstRunPrimaryWorkAreaType("external_stairs") &&
      !isFirstRunPrimaryWorkAreaType("cladding") &&
      !isFirstRunPrimaryWorkAreaType("other")
  );
  assert("Other is not offered", FIRST_RUN_ALLOW_OTHER === false);
  const primary = getFirstRunPrimaryWorkAreas();
  assert(
    "first-run shows estimate-ready beta Work Areas",
    primary.map((item) => item.type).join(",") ===
      FIRST_RUN_PRIMARY_WORK_AREA_TYPES.join(",")
  );
  assert(
    "at least one enabled work area is required",
    hasEnabledPrimaryWorkArea([{ work_area_type: "deck", enabled: true }]) &&
      !hasEnabledPrimaryWorkArea([{ work_area_type: "deck", enabled: false }])
  );
  const workStep = read("components/setup/WorkAreasStep.tsx");
  const setupActions = read("lib/setup/actions.ts");
  assert("first-run Work step uses savePrimaryWorkAreas", /savePrimaryWorkAreas/.test(workStep));
  assert(
    "savePrimaryWorkAreas requires a selection",
    /Choose at least one kind of work/.test(setupActions)
  );
  assert(
    "savePrimaryWorkAreas does not skip pricing",
    !/export async function savePrimaryWorkAreas[\s\S]{0,1800}onboarding_step: "rates"/.test(
      setupActions
    )
  );
  assert(
    "improve save still allows empty preferences",
    /save does not require at least one selection/.test(
      read("scripts/verify-stage-3-1c3-r2b-work-area-preferences.ts")
    ) || /Empty selection is valid/.test(setupActions)
  );

  section("TIMEZONE");
  assert("default IANA is Pacific/Auckland", DEFAULT_ORG_TIMEZONE === "Pacific/Auckland");
  assert("UTC+12 is rejected", !isIanaTimezone("UTC+12") && !isIanaTimezone("GMT+12"));
  assert("Pacific/Auckland accepted", isIanaTimezone("Pacific/Auckland"));
  assert("Pacific/Chatham accepted", isIanaTimezone("Pacific/Chatham"));
  assert(
    "NZ defaults to Auckland",
    defaultTimezoneForCountry({ country: "NZ" }) === "Pacific/Auckland"
  );
  assert(
    "Chatham region maps to Chatham",
    defaultTimezoneForCountry({ country: "NZ", region: "Chatham Islands" }) ===
      "Pacific/Chatham"
  );
  assert(
    "AU is not silently guessed",
    defaultTimezoneForCountry({ country: "AU" }) === null
  );
  assert(
    "missing stored timezone falls back to Auckland",
    resolveDisplayTimezone(null) === "Pacific/Auckland"
  );
  const accepted = "2026-03-20T01:30:00.000Z";
  assert(
    "formatter uses org timezone argument",
    formatInOrgTimezone(accepted, "Pacific/Auckland") ===
      formatQuoteDateTime(accepted, "Pacific/Auckland")
  );
  assert(
    "quote display default is Auckland until schema exists",
    QUOTE_DISPLAY_TIMEZONE === "Pacific/Auckland"
  );
  assert(
    "no timezone column migration 051",
    !existsSync(join(process.cwd(), "supabase/migrations/051_organisation_timezone.sql")) &&
      !existsSync(join(process.cwd(), "supabase/migrations/051_beta_1_5.sql"))
  );
  assert(
    "company basics does not collect unpersistable timezone",
    !/Pacific\/Auckland/.test(read("components/setup/CompanyBasicsStep.tsx"))
  );

  section("PRICING SKIP + MARGIN EXAMPLE");
  assert(
    "pricing skip still writes rates step",
    /onboarding_step: "rates"/.test(setupActions) &&
      /savePricingBasics/.test(setupActions)
  );
  assert(
    "20% margin on $100 cost is $125 sell",
    deriveSellFromCost(100, 20) === 125
  );
  const pricingUi = read("components/setup/PricingBasicsStep.tsx");
  assert(
    "labour copy is cost to the business",
    /What does an hour of your labour cost the business/.test(pricingUi)
  );
  assert(
    "margin copy avoids markup and charge-out",
    /What gross margin do you usually aim for/.test(pricingUi) &&
      !/markup/.test(pricingUi.toLowerCase()) &&
      !/charge-out/.test(pricingUi.toLowerCase())
  );
  assert("margin example present", /\$125 sell/.test(pricingUi));

  section("READY ACTIONS");
  const ready = read("components/setup/FirstRunReady.tsx");
  assert("ready title", /ready to price your first job/.test(ready));
  assert("ready start first job", /intent="first-job"/.test(ready));
  assert("ready go to dashboard", /Go to dashboard/.test(ready));
  assert(
    "ready does not force calibration",
    /benchmark rates/.test(ready) && !/Calibrate/.test(ready)
  );

  section("DASHBOARD LADDER");
  assert(
    "missing work is first prompt for existing orgs",
    resolvePersonalisationNextStep({
      firstRunComplete: true,
      hasWorkTypePreferences: false,
      hasCalibration: false,
      companyRateCount: 0,
      hasContactEmail: true,
      hasAddress: false,
      hasLogo: false,
    })?.id === "work_areas"
  );
  assert(
    "calibration is first after work is known",
    resolvePersonalisationNextStep({
      firstRunComplete: true,
      hasWorkTypePreferences: true,
      hasCalibration: false,
      companyRateCount: 1,
      hasContactEmail: true,
      hasAddress: false,
      hasLogo: false,
    })?.id === "calibrate"
  );
  assert(
    "rate review follows calibration",
    resolvePersonalisationNextStep({
      firstRunComplete: true,
      hasWorkTypePreferences: true,
      hasCalibration: true,
      companyRateCount: 1,
      hasContactEmail: true,
      hasAddress: false,
      hasLogo: false,
    })?.id === "rates" && RATE_REVIEW_MIN_COMPANY_RATES === 2
  );
  assert(
    "company profile is third",
    resolvePersonalisationNextStep({
      firstRunComplete: true,
      hasWorkTypePreferences: true,
      hasCalibration: true,
      companyRateCount: 3,
      hasContactEmail: true,
      hasAddress: false,
      hasLogo: false,
    })?.id === "company_profile"
  );
  assert(
    "unfinished first-run has no dashboard prompt",
    resolvePersonalisationNextStep({
      firstRunComplete: false,
      hasWorkTypePreferences: false,
      hasCalibration: false,
      companyRateCount: 0,
      hasContactEmail: false,
      hasAddress: false,
      hasLogo: false,
    }) === null
  );
  const ladderCard = read("components/setup/ImproveSetupCard.tsx");
  assert(
    "dashboard shows one next step",
    /resolvePersonalisationNextStep/.test(ladderCard) &&
      /Calibrate how you work/.test(read("lib/setup/personalisation-ladder.ts"))
  );

  section("TRIAL INDICATOR");
  const now = new Date("2026-09-03T00:00:00.000Z");
  const day14 = deriveTrialCountdown({
    trialEndsAt: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString(),
    effectiveTrialState: "trialing",
    now,
  });
  assert(
    "days 14–8 are a subtle persistent indicator",
    day14?.tone === "subtle" &&
      /Business Trial/.test(day14.label) &&
      trialBannerNotice(day14)?.tone === "subtle"
  );
  const day6 = deriveTrialCountdown({
    trialEndsAt: new Date(now.getTime() + 6 * 24 * 60 * 60 * 1000).toISOString(),
    effectiveTrialState: "trialing",
    now,
  });
  assert("days 7–4 are stronger but calm", day6?.tone === "strong");
  const day2 = deriveTrialCountdown({
    trialEndsAt: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString(),
    effectiveTrialState: "trialing",
    now,
  });
  assert("days ≤3 are urgent", day2?.tone === "urgent");
  assert("trial duration unchanged", /TRIAL_DURATION_DAYS === 14/.test(read("scripts/verify-billing-1.ts")));

  section("TEAM VISIBILITY");
  assert(
    "Business shows Team",
    shouldShowTeamPrimaryNav({ source: "stripe", planCode: "business" })
  );
  assert(
    "Builder hides Team from primary nav",
    shouldShowTeamPrimaryNav({ source: "stripe", planCode: "builder" }) === false
  );
  assert(
    "Trial hides Team",
    shouldShowTeamPrimaryNav({ source: "internal_trial", planCode: "business" }) ===
      false
  );
  assert(
    "Custom shows Team",
    shouldShowTeamPrimaryNav({ source: "override", planCode: "custom" })
  );
  assert(
    "sidebar filters Team by showTeamNav",
    /showTeamNav/.test(read("components/app-sidebar.tsx")) &&
      /showTeamNav/.test(layout)
  );

  section("RATES ORANGE CARD");
  const ratesPage = read("components/rates/RatesPageContent.tsx");
  assert(
    "Rates no longer auto-focuses a visible orange section heading",
    !/focus:not-sr-only/.test(ratesPage) &&
      !/sectionHeadingRef/.test(ratesPage) &&
      /className="sr-only"/.test(ratesPage)
  );

  section("SIGNATURE TIMEZONE PATH");
  assert(
    "acceptance record uses formatQuoteDateTime",
    /formatQuoteDateTime\(acceptance.accepted_at\)/.test(
      read("components/quotes/QuoteAcceptanceRecord.tsx")
    )
  );
  assert(
    "formatQuoteDateTime accepts an org timezone argument",
    /timeZone: string = QUOTE_DISPLAY_TIMEZONE/.test(
      read("lib/quotes/display.ts")
    )
  );

  section("NO MIGRATION / NO BETA-2");
  assert(
    "no new supabase migration 051+",
    !existsSync(join(process.cwd(), "supabase/migrations/051_organisation_timezone.sql"))
  );
  assert(
    "company email uses existing contact_email column",
    /contact_email: data.contact_email/.test(setupActions)
  );

  if (process.exitCode) {
    console.error("\nBETA-1.5 verification failed.");
  } else {
    console.log("\nBETA-1.5 verification passed.");
  }
}

main();
