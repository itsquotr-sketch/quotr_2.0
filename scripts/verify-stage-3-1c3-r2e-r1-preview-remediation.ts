/**
 * Stage 3.1C.3-R2E-R1 — Preview first-run coherence & calibration UX remediation.
 *
 * Run: npx --yes tsx scripts/verify-stage-3-1c3-r2e-r1-preview-remediation.ts
 */
import { existsSync, readFileSync, readdirSync } from "fs";
import { join } from "path";
import { compareCalibrationAnswers } from "../lib/calibration/compare";
import { getCalibrationScenario } from "../lib/calibration/catalogue";
import { POST_SIGNUP_DESTINATION } from "../lib/auth/post-auth-navigation";
import {
  SETUP_RECOMMENDATION_DESTINATIONS,
  getSetupRecommendationHref,
  parseRatesSection,
} from "../lib/setup/recommendation-destinations";
import { computeCompanySetupReadiness } from "../lib/setup/readiness";

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

console.log("=== Stage 3.1C.3-R2E-R1 preview remediation verification ===\n");

section("FIRST RUN");
const actions = read("app/(auth)/actions.ts");
const signupPage = read("app/(auth)/signup/page.tsx");
const authContinue = read("components/auth/AuthContinue.tsx");
assert(
  "signup returns continueTo instead of soft redirect",
  /continueTo:\s*POST_SIGNUP_DESTINATION/.test(actions) &&
    !/signup_completed[\s\S]{0,200}redirect\(["']\/app\/dashboard["']\)/.test(
      actions
    )
);
assert(
  "POST_SIGNUP_DESTINATION is Company Basics",
  POST_SIGNUP_DESTINATION === "/app/setup?mode=basics"
);
assert(
  "signup page hard-navigates via AuthContinue",
  signupPage.includes("AuthContinue") && signupPage.includes("continueTo")
);
assert(
  "AuthContinue uses location.assign not reload",
  authContinue.includes("window.location.assign") &&
    !authContinue.includes("location.reload") &&
    !authContinue.includes("setTimeout") &&
    !/setInterval/.test(authContinue)
);
assert(
  "login returns continueTo for hard navigation",
  /return \{\s*continueTo:\s*next\s*\}/.test(actions)
);
const layout = read("app/(protected)/app/layout.tsx");
assert(
  "Basics still hard-gated before Dashboard",
  layout.includes("needsCompanyBasics") &&
    layout.includes("redirect(SETUP_BASICS_PATH)")
);

section("DASHBOARD DISCLOSURE");
const improve = read("components/setup/ImproveSetupCard.tsx");
assert("Collapse control present", /Collapse/.test(improve));
assert("Expand control present", improve.includes("Expand"));
assert("no misleading Hide CTA", !/\bHide\b/.test(improve));
assert(
  "localStorage presentation preference",
  improve.includes("localStorage") && improve.includes("quotr.setupGuidance.collapsed")
);
assert(
  "hasProjects defaults collapsed",
  improve.includes("hasProjects") && improve.includes("defaultCollapsed")
);
const dash = read("app/(protected)/app/dashboard/page.tsx");
assert(
  "Dashboard passes hasProjects",
  dash.includes("hasProjects={!isEmpty}")
);

section("DEEP LINKS");
assert(
  "margin → Rates/Defaults",
  getSetupRecommendationHref("default_margin") ===
    "/app/rates?section=defaults"
);
assert(
  "labour → Rates/Core",
  getSetupRecommendationHref("labour_rate") === "/app/rates?section=core"
);
assert(
  "work types → Setup work_areas",
  getSetupRecommendationHref("work_types").includes("section=work_areas")
);
assert(
  "calibrate → Setup calibrate",
  getSetupRecommendationHref("calibrate").includes("section=calibrate")
);
assert(
  "quote details → Company quotes",
  getSetupRecommendationHref("company_contact").includes("section=quotes")
);
const readiness = computeCompanySetupReadiness({
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
const margin = readiness.recommendedSetup.find((s) => s.id === "default_margin");
assert(
  "readiness margin href uses defaults section",
  margin?.href === SETUP_RECOMMENDATION_DESTINATIONS.default_margin.href
);
const labour = readiness.recommendedSetup.find((s) => s.id === "labour_rate");
assert(
  "readiness labour href uses core section",
  labour?.href === SETUP_RECOMMENDATION_DESTINATIONS.labour_rate.href
);
const ratesPage = read("app/(protected)/app/rates/page.tsx");
assert(
  "Rates page accepts section searchParam",
  ratesPage.includes("searchParams") && ratesPage.includes("parseRatesSection")
);
assert("parseRatesSection(defaults)", parseRatesSection("defaults") === "defaults");
const ratesContent = read("components/rates/RatesPageContent.tsx");
assert(
  "RatesPageContent honours initialSection",
  ratesContent.includes("initialSection")
);

section("CALIBRATION UX");
const flow = read("components/calibration/CalibrationFlow.tsx");
assert(
  "sticky example job on desktop",
  flow.includes("sticky top-4") && flow.includes("Example job")
);
assert(
  "mobile Show details disclosure",
  flow.includes("Show details") && flow.includes("Hide details") && flow.includes("lg:hidden")
);
assert(
  "purpose copy: no automatic rate changes",
  /won[’']t automatically change your company rates/.test(flow)
);
assert(
  "compare copy: evidence, no automatic alter",
  /does not automatically alter this[\s\S]*estimate or your saved rates/.test(
    flow
  )
);
const scenario = getCalibrationScenario("deck.standard_pine.v1");
assert("deck has referenceHighlights", (scenario?.referenceHighlights.length ?? 0) >= 5);

const hoursOnly = compareCalibrationAnswers({
  scenario: scenario!,
  answers: {
    labour_hours: 30,
    materials_cost: 1200,
    expected_sell: 5000,
    confidence: "medium",
  },
});
const labourRow = hoursOnly.categories.find((c) => c.category === "labour");
assert(
  "hours-only labour not monetarily comparable",
  labourRow?.comparable === false
);
assert(
  "hours still available for hours compare",
  hoursOnly.quotrLabourHours != null
);
const withLabourCost = compareCalibrationAnswers({
  scenario: scenario!,
  answers: {
    labour_hours: 30,
    labour_cost: 2500,
    materials_cost: 1200,
    expected_sell: 5000,
    confidence: "medium",
  },
});
assert(
  "labour $ comparable when provided",
  withLabourCost.categories.find((c) => c.category === "labour")?.comparable ===
    true
);
assert(
  "cost difference narrative explains above calculation",
  /above Quotr/.test(hoursOnly.narrative) ||
    /close to Quotr/.test(hoursOnly.narrative) ||
    /below Quotr/.test(hoursOnly.narrative) ||
    /evidence about how your business prices/.test(hoursOnly.narrative)
);

section("AUTHORITY");
assert(
  "estimate rates ignore calibration",
  !read("lib/estimate/rates.ts").includes("lib/calibration")
);
assert(
  "commercial engine ignores calibration",
  !read("lib/pricing/commercial-engine-adapter.ts").includes("lib/calibration") &&
    !read("lib/quotes/quote-commercial-engine-adapter.ts").includes(
      "lib/calibration"
    )
);

section("BOUNDARIES");
assert("no Company DNA", !existsSync(join(process.cwd(), "lib/company-dna")));
assert(
  "SCOPE_DISCOVERY not force-enabled",
  !/^[^#\n]*SCOPE_DISCOVERY_ENABLED\s*=\s*true/m.test(read(".env.local.example"))
);
assert(
  "no migration 034",
  !readdirSync(join(process.cwd(), "supabase/migrations")).some((f) =>
    f.startsWith("034")
  )
);
assert(
  "defect register updated",
  read("docs/audits/STAGE_3_1C3_R2E_PREVIEW_DEFECT_REGISTER.md").includes(
    "R2E-R1-01"
  )
);

console.log(
  `\n=== Done: ${failed === 0 ? "ALL PASSED" : `${failed} FAILED`} ===\n`
);
process.exit(failed === 0 ? 0 : 1);
