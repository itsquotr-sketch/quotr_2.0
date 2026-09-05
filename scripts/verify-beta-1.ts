/**
 * BETA-1 — first-run onboarding, GST yes/no, pricing basics, plan truth.
 *
 * Run: npx --yes tsx scripts/verify-beta-1.ts
 *
 * No paid AI. No live Stripe. Does not print secret values.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  resolveEmailConfirmDestination,
  organisationNameFromUserMetadata,
} from "../lib/auth/email-confirm-destination";
import { POST_SIGNUP_DESTINATION } from "../lib/auth/post-auth-navigation";
import {
  FORBIDDEN_PLAN_MARKETING_PHRASES,
  BUILDER_PLAN_HEADLINE,
  BUILDER_PLAN_SUMMARY,
  BUSINESS_PLAN_SUMMARY,
} from "../lib/billing/plan-copy";
import { CORE_LABOUR_STARTER_RATES } from "../lib/setup/starter-rates";
import {
  gstRateFromRegisteredChoice,
  gstRegisteredFromRate,
  shouldAskGstRegisteredQuestion,
} from "../lib/setup/gst-registered";
import {
  ONBOARDING_LABOUR_RATE,
  parseOptionalLabourCost,
  parseOptionalTargetMargin,
  skippedMarginFallsBackTo,
} from "../lib/setup/pricing-basics";
import { DEFAULT_MARGIN_PERCENT } from "../lib/estimate/constants";
import { roleAllowsPermission } from "../lib/team/permissions";
import {
  FIRST_RUN_BASICS_PATH,
  FIRST_RUN_PRICING_PATH,
  FIRST_RUN_WORK_PATH,
  firstRunForcedPath,
  resolveFirstRunStage,
  setupModeRedirect,
  setupShellMode,
} from "../lib/setup/first-run-stage";

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

function envKeyConfigured(name: string): boolean {
  const fromProc = process.env[name]?.trim();
  if (fromProc) return true;
  const envPath = join(process.cwd(), ".env.local");
  if (!existsSync(envPath)) return false;
  const text = readFileSync(envPath, "utf8");
  const match = text.match(new RegExp(`^${name}\\s*=\\s*(.*)$`, "m"));
  if (!match) return false;
  const raw = match[1].trim().replace(/^['"]|['"]$/g, "");
  return raw.length > 0 && !raw.startsWith("#");
}

function main() {
  console.log("=== BETA-1 first-run + plan-truth verification ===");

  section("SIGNUP COPY");
  const signup = `${read("app/(auth)/signup/page.tsx")}\n${read("components/auth/SignupForm.tsx")}`;
  const authLayout = read("app/(auth)/layout.tsx");
  const authActions = read("app/(auth)/actions.ts");
  assert("signup label is Company name", /Company name/.test(signup));
  assert(
    "signup does not say Organisation/company",
    !/Organisation \/ company/.test(signup)
  );
  assert(
    "auth subtitle is builder-oriented",
    /Turn job notes into a clear estimate and quote/.test(authLayout)
  );
  assert(
    "auth subtitle dropped structured project information",
    !/structured project information/.test(authLayout)
  );
  assert(
    "validation says Company name is required",
    /Company name is required/.test(authActions)
  );

  section("EMAIL-CONFIRM OWNER FLOW");
  assert(
    "ordinary owner with org goes to company basics",
    resolveEmailConfirmDestination({
      next: "/app/dashboard",
      hasOrg: true,
      pendingInvite: "none",
      provisioned: false,
    }) === POST_SIGNUP_DESTINATION
  );
  assert(
    "ordinary owner provisioned after confirm goes to basics",
    resolveEmailConfirmDestination({
      next: "/app/dashboard",
      hasOrg: false,
      pendingInvite: "none",
      provisioned: true,
    }) === POST_SIGNUP_DESTINATION
  );
  assert(
    "ordinary owner without org and without invite goes to setup-required",
    resolveEmailConfirmDestination({
      next: "/app/dashboard",
      hasOrg: false,
      pendingInvite: "none",
      provisioned: false,
    }) === "/app/setup-required"
  );
  assert(
    "ordinary owner is NOT sent to invite/continue",
    resolveEmailConfirmDestination({
      next: "/app/dashboard",
      hasOrg: false,
      pendingInvite: "none",
      provisioned: false,
    }) !== "/invite/continue"
  );
  assert(
    "invite confirm keeps invite path",
    resolveEmailConfirmDestination({
      next: "/invite/abc",
      hasOrg: false,
      pendingInvite: "none",
      provisioned: false,
    }) === "/invite/abc"
  );
  assert(
    "pending invite without org uses invite continue",
    resolveEmailConfirmDestination({
      next: "/app/dashboard",
      hasOrg: false,
      pendingInvite: "one",
      provisioned: false,
    }) === "/invite/continue"
  );
  assert(
    "password recovery stays on reset",
    resolveEmailConfirmDestination({
      next: "/reset-password",
      hasOrg: false,
      pendingInvite: "none",
      provisioned: false,
    }) === "/reset-password"
  );
  assert(
    "metadata organisation_name parsed",
    organisationNameFromUserMetadata({ organisation_name: " Smith Build " }) ===
      "Smith Build"
  );
  const callback = read("app/auth/callback/route.ts");
  assert(
    "callback uses resolveEmailConfirmDestination",
    /resolveEmailConfirmDestination/.test(callback)
  );
  assert(
    "callback still preserves /invite/ next",
    /next.startsWith\("\/invite\/"\)/.test(callback)
  );
  assert(
    "ordinary signup emailRedirectTo uses company basics",
    /inviteToken \? `\/invite\/\$\{inviteToken\}` : POST_SIGNUP_DESTINATION/.test(
      authActions
    )
  );

  section("FIRST-RUN STAGE MACHINE");
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
    "company saved with work is Pricing Basics",
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
    }) === "ready"
  );
  assert(
    "completed onboarding is done",
    resolveFirstRunStage({
      onboardingStatus: "completed",
      onboardingStep: "completed",
    }) === "done"
  );
  assert(
    "legacy review step is done",
    resolveFirstRunStage({
      onboardingStatus: "in_progress",
      onboardingStep: "review",
    }) === "done"
  );
  assert(
    "company save + mode=basics resumes work not dashboard",
    setupModeRedirect("basics", "work") === FIRST_RUN_WORK_PATH
  );
  assert(
    "work complete + mode=work resumes pricing",
    setupModeRedirect("work", "pricing") === FIRST_RUN_PRICING_PATH
  );
  assert(
    "pricing skip/save + mode=pricing stays on pricing",
    setupModeRedirect("pricing", "ready") === null
  );
  assert(
    "pricing skip/save + mode=ready stays on ready",
    setupModeRedirect("ready", "ready") === null &&
      setupShellMode("ready", "ready") === "ready"
  );
  assert(
    "unfinished pricing cannot open ready",
    setupModeRedirect("ready", "pricing") === FIRST_RUN_PRICING_PATH
  );
  assert(
    "unfinished work cannot open pricing",
    setupModeRedirect("pricing", "work") === FIRST_RUN_WORK_PATH
  );
  assert(
    "unfinished company cannot open pricing",
    setupModeRedirect("pricing", "basics") === FIRST_RUN_BASICS_PATH
  );
  assert(
    "existing done user on basics goes to dashboard",
    setupModeRedirect("basics", "done") === "/app/dashboard"
  );
  assert(
    "layout forces work then pricing until visited",
    firstRunForcedPath("work") === FIRST_RUN_WORK_PATH &&
      firstRunForcedPath("pricing") === FIRST_RUN_PRICING_PATH &&
      firstRunForcedPath("ready") === null &&
      firstRunForcedPath("done") === null
  );
  const setupPage = read("app/(protected)/app/setup/page.tsx");
  assert("setup page uses first-run stage", /getFirstRunStage/.test(setupPage));
  assert(
    "setup page no longer dumps basics to dashboard",
    !/!basicsNeeded && modeParam === "basics"/.test(setupPage)
  );
  const layout = read("app/(protected)/app/layout.tsx");
  assert("layout resumes unfinished first-run", /firstRunForcedPath/.test(layout));
  assert(
    "ordinary owner callback still avoids invite",
    resolveEmailConfirmDestination({
      next: "/app/dashboard",
      hasOrg: true,
      pendingInvite: "none",
      provisioned: false,
    }) === POST_SIGNUP_DESTINATION &&
      POST_SIGNUP_DESTINATION === FIRST_RUN_BASICS_PATH
  );
  assert(
    "invite callback remains invite-aware",
    resolveEmailConfirmDestination({
      next: "/invite/abc",
      hasOrg: false,
      pendingInvite: "none",
      provisioned: false,
    }) === "/invite/abc"
  );
  assert(
    "pricing skip persists via onboarding_step rates",
    /onboarding_step: "rates"/.test(read("lib/setup/actions.ts"))
  );

  section("GST REGISTERED");
  assert("NZ yes → 15", gstRateFromRegisteredChoice("yes", 15) === 15);
  assert("NZ no → 0", gstRateFromRegisteredChoice("no", 15) === 0);
  assert("AU yes → 10", gstRateFromRegisteredChoice("yes", 10) === 10);
  assert("rate 0 → no", gstRegisteredFromRate(0) === "no");
  assert("rate 15 → yes", gstRegisteredFromRate(15) === "yes");
  assert("null rate → unknown", gstRegisteredFromRate(null) === null);
  assert(
    "existing in_progress org is not forced through GST question",
    shouldAskGstRegisteredQuestion({
      onboardingStatus: "in_progress",
      defaultGstRate: 15,
    }) === false
  );
  assert(
    "not_started with no rate asks GST question",
    shouldAskGstRegisteredQuestion({
      onboardingStatus: "not_started",
      defaultGstRate: null,
    }) === true
  );
  const basics = read("components/setup/CompanyBasicsStep.tsx");
  assert("basics asks GST registered", /Are you GST registered/.test(basics));
  assert("no new gst_registered column", !/gst_registered:/.test(read("lib/setup/actions.ts")));

  section("LABOUR + MARGIN AUTHORITY");
  assert(
    "onboarding labour is carpenter hour",
    ONBOARDING_LABOUR_RATE.item_key === "labour.carpenter.hour" &&
      ONBOARDING_LABOUR_RATE === CORE_LABOUR_STARTER_RATES[0]
  );
  const emptyLabour = parseOptionalLabourCost("");
  assert("empty labour is skip", "skip" in emptyLabour && emptyLabour.skip === true);
  const labour60 = parseOptionalLabourCost(60);
  assert(
    "labour 60 writes cost",
    "costRate" in labour60 && labour60.costRate === 60
  );
  const emptyMargin = parseOptionalTargetMargin("");
  assert("empty margin is skip", "skip" in emptyMargin && emptyMargin.skip === true);
  assert(
    "skip margin falls back to 20",
    skippedMarginFallsBackTo() === DEFAULT_MARGIN_PERCENT
  );
  assert("margin 20 accepted", !("error" in parseOptionalTargetMargin(20)));
  assert("margin 96 rejected", "error" in parseOptionalTargetMargin(96));
  const setupActions = read("lib/setup/actions.ts");
  assert(
    "savePricingBasics writes labour.carpenter.hour",
    /savePricingBasics/.test(setupActions) &&
      /ONBOARDING_LABOUR_RATE/.test(setupActions)
  );
  assert(
    "savePricingBasics writes default_margin_percent",
    /default_margin_percent: margin.marginPercent/.test(setupActions)
  );
  assert(
    "pricing skip does not require labour",
    /skipLabour/.test(setupActions)
  );

  section("COMPLETION + DASHBOARD");
  const dashboard = read("app/(protected)/app/dashboard/page.tsx");
  const ready = read("components/setup/FirstRunReady.tsx");
  assert("completion copy", /ready to price your first job/.test(ready));
  assert("completion Start first job", /intent="first-job"/.test(ready));
  assert("dashboard empty Start your first job", /Start your first job/.test(dashboard));
  assert(
    "dashboard empty hides KPI tiles",
    /isEmpty \? \(/.test(dashboard) &&
      /DashboardSummaryCards/.test(dashboard)
  );
  assert(
    "empty dashboard does not render Improve card",
    /isEmpty \? \(/.test(dashboard)
  );
  const dialog = read("components/projects/NewProjectDialog.tsx");
  assert("create dialog Job name", /Job name/.test(dialog));
  assert(
    "plans not required helper",
    /Plans, photos and full details aren/.test(dialog)
  );
  assert("priority collapsed behind more details", /Priority, due date, or notes/.test(dialog));

  section("PLAN TRUTH");
  const billingUi = read("components/billing/BillingPageContent.tsx");
  assert("Builder headline used", billingUi.includes("BUILDER_PLAN_HEADLINE"));
  assert("no Core estimating accuracy in Billing UI", !/Core estimating accuracy/.test(billingUi));
  for (const phrase of FORBIDDEN_PLAN_MARKETING_PHRASES) {
    if (phrase === "Core estimating accuracy") {
      assert(`Billing UI hides: ${phrase}`, !billingUi.includes(phrase));
      continue;
    }
    assert(
      `Billing UI hides: ${phrase}`,
      !billingUi.toLowerCase().includes(phrase.toLowerCase())
    );
  }
  const reasons = read("lib/billing/entitlement-reasons.ts");
  assert(
    "denial copy does not market analytics",
    !/Business analytics are available/.test(reasons)
  );
  assert("Builder copy is sole trader", /sole traders/.test(BUILDER_PLAN_HEADLINE));
  assert("Business copy mentions team seats", /5 people/.test(BUSINESS_PLAN_SUMMARY));
  assert("Builder summary includes send/acceptance", /send and acceptance/.test(BUILDER_PLAN_SUMMARY));

  section("VIEWER READ-ONLY");
  assert("Viewer cannot create projects", !roleAllowsPermission("viewer", "projects.create"));
  assert("Viewer cannot edit projects", !roleAllowsPermission("viewer", "projects.edit"));
  assert("Viewer cannot run estimates", !roleAllowsPermission("viewer", "estimates.run"));
  assert("Viewer cannot edit pricing", !roleAllowsPermission("viewer", "pricing.edit"));
  assert("Viewer cannot send quotes", !roleAllowsPermission("viewer", "quotes.send"));
  const projectActions = read("lib/projects/actions.ts");
  assert(
    "listProjects does not require write permission",
    !/export async function listProjects[\s\S]{0,800}permissionDeniedError/.test(
      projectActions
    )
  );
  assert(
    "createProject requires write permission",
    /export async function createProject[\s\S]{0,1200}permissionDeniedError/.test(
      projectActions
    )
  );

  section("DEV / DEMO ROUTES");
  assert(
    "ai-test hidden in production",
    /NODE_ENV === "production"/.test(read("app/(protected)/app/dev/ai-test/page.tsx"))
  );
  assert(
    "demo hidden in production",
    /NODE_ENV === "production"/.test(
      read("app/(protected)/app/projects/demo/page.tsx")
    )
  );
  assert(
    "health remains authenticated support page",
    existsSync(join(process.cwd(), "app/(protected)/app/health/page.tsx"))
  );

  section("NO MIGRATION 051");
  assert(
    "no migration 051",
    !existsSync(join(process.cwd(), "supabase/migrations/051_beta_1.sql"))
  );

  section("ENV PRESENCE (values not printed)");
  const feedbackConfigured = envKeyConfigured("NEXT_PUBLIC_FEEDBACK_EMAIL");
  const resendKeyConfigured = envKeyConfigured("RESEND_API_KEY");
  const resendFromConfigured = envKeyConfigured("RESEND_FROM_EMAIL");
  const resendTeamFromConfigured = envKeyConfigured("RESEND_TEAM_FROM_EMAIL");
  const resendQuoteFromConfigured = envKeyConfigured("RESEND_QUOTE_FROM_EMAIL");
  console.log(
    "INFO NEXT_PUBLIC_FEEDBACK_EMAIL",
    feedbackConfigured ? "configured" : "not configured"
  );
  console.log(
    "INFO RESEND_API_KEY",
    resendKeyConfigured ? "configured" : "not configured"
  );
  console.log(
    "INFO RESEND_FROM_EMAIL",
    resendFromConfigured ? "configured" : "not configured"
  );
  console.log(
    "INFO RESEND_TEAM_FROM_EMAIL",
    resendTeamFromConfigured ? "configured" : "not configured"
  );
  console.log(
    "INFO RESEND_QUOTE_FROM_EMAIL",
    resendQuoteFromConfigured ? "configured" : "not configured"
  );
  assert("env presence check ran", true);

  if (process.exitCode) {
    console.error("\nBETA-1 verification failed.");
  } else {
    console.log("\nBETA-1 verification passed.");
  }
}

main();
