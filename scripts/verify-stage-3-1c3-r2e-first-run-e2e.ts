/**
 * Stage 3.1C.3-R2E — First-run E2E / setup integration verification (static).
 *
 * Run: npx --yes tsx scripts/verify-stage-3-1c3-r2e-first-run-e2e.ts
 */
import { existsSync, readFileSync, readdirSync } from "fs";
import { join } from "path";
import { listCalibrationScenarios } from "../lib/calibration/catalogue";
import { RATE_SOURCE_FRIENDLY_LABELS } from "../lib/estimate/rate-source-labels";
import { RATE_AUTHORITY_LABELS } from "../lib/rates/authority";
import { computeCompanySetupReadiness } from "../lib/setup/readiness";
import { buildStarterRateRows } from "../lib/setup/starter-rates";

let failed = 0;

function assert(label: string, condition: boolean) {
  if (condition) {
    console.log(`PASS ${label}`);
  } else {
    failed += 1;
    console.error(`FAIL ${label}`);
  }
}

function section(title: string) {
  console.log(`\n=== ${title} ===\n`);
}

function read(rel: string): string {
  return readFileSync(join(process.cwd(), rel), "utf8");
}

console.log("=== Stage 3.1C.3-R2E first-run E2E verification ===\n");

section("BASICS GATE ONLY");
const layout = read("app/(protected)/app/layout.tsx");
assert(
  "layout Incomplete badge = basicsNeeded only",
  layout.includes("setupIncomplete = basicsNeeded") &&
    layout.includes("needsCompanyBasics")
);
assert(
  "layout redirects when basics missing",
  layout.includes('SETUP_BASICS_PATH = "/app/setup?mode=basics"') &&
    layout.includes("redirect(SETUP_BASICS_PATH)")
);
const basics = computeCompanySetupReadiness({
  accountReady: true,
  organisationName: "Co",
  onboardingStatus: "not_started",
  currency: "NZD",
  country: "NZ",
  region: null,
  defaultGstRate: 15,
  defaultMarginPercent: 20,
  hasLabourRate: false,
  hasWorkTypePreferences: false,
  tradingName: null,
  legalName: null,
  contactEmail: null,
  contactPhone: null,
  addressLine1: null,
  city: null,
});
assert("not_started needsFirstRunBasics", basics.needsFirstRunBasics);
assert("!companyBasicsReady", !basics.companyBasicsReady);

section("OPTIONAL SETUP AFTER BASICS");
const shell = read("components/setup/SetupShell.tsx");
assert("improve has Company/Work types/Rates/Calibrate", /"calibrate"/.test(shell));
assert("no ReviewStep in improve shell", !shell.includes("ReviewStep"));
const afterBasics = computeCompanySetupReadiness({
  accountReady: true,
  organisationName: "Co",
  onboardingStatus: "in_progress",
  currency: "NZD",
  country: "NZ",
  region: null,
  defaultGstRate: 15,
  defaultMarginPercent: 20,
  hasLabourRate: false,
  hasWorkTypePreferences: false,
  tradingName: "Co",
  legalName: null,
  contactEmail: null,
  contactPhone: null,
  addressLine1: null,
  city: null,
});
assert("after basics companyBasicsReady", afterBasics.companyBasicsReady);
assert("estimateReady without labour", afterBasics.estimateReady);

section("DASHBOARD CTA");
const dash = read("app/(protected)/app/dashboard/page.tsx");
assert("Create your first project primary copy", dash.includes("Create your first project"));
assert(
  "empty secondary does not duplicate Improve card title",
  dash.includes("Optional company setup") &&
    !/Create your first project[\s\S]*Improve Quotr for your business[\s\S]*ImproveSetupCard/.test(
      dash
    )
);
assert("ImproveSetupCard still on dashboard", dash.includes("ImproveSetupCard"));

section("PREFERENCES ≠ CAPABILITY");
assert(
  "Analyse Job uses capability catalogue",
  read("lib/assistant/actions.ts").includes("getAnalysisCapableWorkAreaTypes") &&
    read("lib/project-notes/proposals/actions.ts").includes(
      "getAnalysisCapableWorkAreaTypes"
    )
);
const workAreas = read("components/setup/WorkAreasStep.tsx");
assert(
  "Work areas do not silent-defaultEnabled",
  !/enabled:\s*item\.defaultEnabled/.test(workAreas)
);

section("RATE AUTHORITY");
assert(
  "rates authority Your company rate",
  RATE_AUTHORITY_LABELS.EXPLICIT_COMPANY === "Your company rate"
);
assert(
  "rates authority Quotr benchmark",
  RATE_AUTHORITY_LABELS.BENCHMARK === "Quotr benchmark"
);
assert(
  "estimate friendly label Your company rate",
  RATE_SOURCE_FRIENDLY_LABELS.user_rate === "Your company rate"
);
assert(
  "estimate friendly label Quotr benchmark",
  RATE_SOURCE_FRIENDLY_LABELS.benchmark === "Quotr benchmark"
);
assert(
  "estimate missing = Pricing required",
  RATE_SOURCE_FRIENDLY_LABELS.missing === "Pricing required"
);
const starter = buildStarterRateRows([
  { work_area_type: "deck", enabled: true },
  { work_area_type: "bathroom", enabled: true },
  { work_area_type: "fence", enabled: true },
]);
assert(
  "setup starter excludes scope.* primary",
  starter.rows.every((row) => !row.item_key.startsWith("scope."))
);
assert(
  "setup component cap keeps field count bounded",
  starter.rows.filter((r) => r.section === "component").length <= 9
);

section("CALIBRATION AUTHORITY");
const scenarios = listCalibrationScenarios();
assert("MVP scenarios Deck+Bathroom only", scenarios.length === 2);
assert(
  "no Fence scenario invented",
  scenarios.every((s) => s.workAreaType === "deck" || s.workAreaType === "bathroom")
);
const actions = read("lib/calibration/actions.ts");
assert("save uses persistCalibrationResponse", actions.includes("persistCalibrationResponse"));
assert("no persistenceGated save", !actions.includes("persistenceGated"));
assert(
  "estimate rates do not import calibration",
  !read("lib/estimate/rates.ts").includes("lib/calibration")
);
assert(
  "calculate-estimate does not import calibration",
  !read("lib/estimate/calculate-estimate.ts").includes("lib/calibration")
);
const hub = read("components/calibration/CalibrationHub.tsx");
assert("hub shows Calibrated status", hub.includes("Calibrated"));
assert(
  "hub explains missing preferred scenarios",
  hub.includes("No calibration examples yet for your preferred")
);

section("CALIBRATION TIP SEMANTICS");
const withCal = computeCompanySetupReadiness({
  accountReady: true,
  organisationName: "Co",
  onboardingStatus: "in_progress",
  currency: "NZD",
  country: "NZ",
  region: null,
  defaultGstRate: 15,
  defaultMarginPercent: 30,
  hasLabourRate: true,
  hasWorkTypePreferences: true,
  hasCalibration: true,
  calibratedScenarioCount: 1,
  calibrationScenarioTotal: 2,
  tradingName: "Co",
  legalName: null,
  contactEmail: "a@b.c",
  contactPhone: null,
  addressLine1: null,
  city: null,
});
assert(
  "first calibrate tip removed after calibration",
  !withCal.recommendedSetup.some((s) => s.id === "calibrate")
);
assert(
  "subtle calibrate another tip when one of two done",
  withCal.recommendedSetup.some((s) => s.id === "calibrate_another")
);
const bothCal = computeCompanySetupReadiness({
  ...{
    accountReady: true,
    organisationName: "Co",
    onboardingStatus: "in_progress" as const,
    currency: "NZD",
    country: "NZ",
    region: null,
    defaultGstRate: 15,
    defaultMarginPercent: 30,
    hasLabourRate: true,
    hasWorkTypePreferences: true,
    hasCalibration: true,
    calibratedScenarioCount: 2,
    calibrationScenarioTotal: 2,
    tradingName: "Co",
    legalName: null,
    contactEmail: "a@b.c",
    contactPhone: null,
    addressLine1: null,
    city: null,
  },
});
assert(
  "no calibrate nag when all MVP scenarios done",
  !bothCal.recommendedSetup.some(
    (s) => s.id === "calibrate" || s.id === "calibrate_another"
  )
);

section("QUOTE READINESS INDEPENDENT");
const quoteActions = read("lib/quotes/actions.ts");
assert(
  "markQuoteSent uses quoteReady",
  /quoteReady/.test(quoteActions) && /markQuoteSent/.test(quoteActions)
);
assert(
  "quoteReady needs contact not setup complete",
  !afterBasics.quoteReady
);

section("BOUNDARIES");
assert("no Company DNA module", !existsSync(join(process.cwd(), "lib/company-dna")));
assert(
  "SCOPE_DISCOVERY not force-enabled",
  !/^[^#\n]*SCOPE_DISCOVERY_ENABLED\s*=\s*true/m.test(read(".env.local.example"))
);
assert(
  "migration 033 present",
  readdirSync(join(process.cwd(), "supabase/migrations")).some((f) =>
    f.startsWith("033")
  )
);
assert(
  "no migration 034 unless needed",
  !readdirSync(join(process.cwd(), "supabase/migrations")).some((f) =>
    f.startsWith("034")
  )
);
assert(
  "defect register exists",
  existsSync(
    join(process.cwd(), "docs/audits/STAGE_3_1C3_R2E_PREVIEW_DEFECT_REGISTER.md")
  )
);
assert(
  "completion doc exists",
  existsSync(
    join(
      process.cwd(),
      "docs/implementation/STAGE_3_1C3_R2E_FIRST_RUN_COMPLETION.md"
    )
  )
);

console.log(
  `\n=== Done: ${failed === 0 ? "ALL PASSED" : `${failed} FAILED`} ===\n`
);
process.exit(failed === 0 ? 0 : 1);
