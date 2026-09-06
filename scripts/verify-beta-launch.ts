/**
 * BETA LAUNCH CLOSE — static launch invariants.
 *
 * Run: npx --yes tsx scripts/verify-beta-launch.ts
 *
 * No paid AI. No live Stripe. No Production. No secret prints.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  BUILDER_PLAN_HEADLINE,
  BUILDER_PLAN_SUMMARY,
  BUSINESS_PLAN_SUMMARY,
  FORBIDDEN_PLAN_MARKETING_PHRASES,
} from "../lib/billing/plan-copy";
import {
  PLAN_DISPLAY_CATALOGUE,
  formatExclusivePlusGst,
} from "../lib/billing/display-catalogue";
import { roleAllowsPermission } from "../lib/team/permissions";
import { deriveTrialCountdown } from "../lib/billing/trial-countdown";
import { PAST_DUE_GRACE_DAYS } from "../lib/billing/access-policy";
import {
  TRANSACTION_COMPLETION_CAPABILITIES,
  VALUE_PRODUCING_CAPABILITIES,
} from "../lib/billing/capabilities";
import { shouldShowTeamPrimaryNav } from "../lib/billing/team-nav-visibility";
import { resolveBillingEnvironment } from "../lib/billing/environment";
import {
  PREVIEW_SUPABASE_PROJECT_REF,
  PRODUCTION_SUPABASE_PROJECT_REF,
} from "../lib/deployment/environment";
import { isTechnicalErrorText, toUserError } from "../lib/errors/user-message";
import { allocateFinalSell } from "../lib/pricing/final-sell";
import { computeCompanySetupReadiness } from "../lib/setup/readiness";
import { isQuoteExpired } from "../lib/quotes/transaction";
import { STRIPE_FOUNDATION_EVENT_TYPES } from "../lib/billing/webhook";

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

function latestMigration(): string | null {
  const dir = join(process.cwd(), "supabase/migrations");
  if (!existsSync(dir)) return null;
  const files = readdirSync(dir)
    .filter((name) => /^\d+_/.test(name) && name.endsWith(".sql"))
    .sort();
  return files.at(-1) ?? null;
}

function migrationNumbers(): string[] {
  const dir = join(process.cwd(), "supabase/migrations");
  return readdirSync(dir)
    .filter((name) => /^\d+_/.test(name) && name.endsWith(".sql"))
    .map((name) => name.slice(0, 3))
    .sort();
}

function main() {
  console.log("=== BETA LAUNCH CLOSE verification ===");

  section("PLAN TRUTH");
  assert("Builder exclusive is $65", PLAN_DISPLAY_CATALOGUE.builder.exclusiveMonthlyNzd === 65);
  assert("Business exclusive is $79", PLAN_DISPLAY_CATALOGUE.business.exclusiveMonthlyNzd === 79);
  assert(
    "Additional user is $35",
    PLAN_DISPLAY_CATALOGUE.business.extraSeatExclusiveMonthlyNzd === 35
  );
  assert(
    "Builder included users is 1",
    PLAN_DISPLAY_CATALOGUE.builder.includedUsers === 1 &&
      PLAN_DISPLAY_CATALOGUE.builder.maxSelfServiceUsers === 1
  );
  assert("format shows + GST", formatExclusivePlusGst(65) === "$65 + GST / month");
  assert("Builder headline is sole traders", BUILDER_PLAN_HEADLINE.includes("sole traders"));
  assert("Builder summary has 1 user", BUILDER_PLAN_SUMMARY.includes("1 user"));
  assert("Business summary has $35 + GST", BUSINESS_PLAN_SUMMARY.includes("$35 + GST"));
  const billingPage = read("components/billing/BillingPageContent.tsx");
  const planCopySrc = read("lib/billing/plan-copy.ts");
  for (const phrase of FORBIDDEN_PLAN_MARKETING_PHRASES) {
    assert(`Billing UI does not promise "${phrase}"`, !billingPage.toLowerCase().includes(phrase.toLowerCase()));
    assert(`plan-copy forbids "${phrase}"`, planCopySrc.includes(phrase));
  }

  section("ROLE PERMISSIONS");
  assert("Owner can manage billing", roleAllowsPermission("owner", "billing.manage"));
  assert("Admin cannot manage billing", !roleAllowsPermission("admin", "billing.manage"));
  assert("Admin can manage rates", roleAllowsPermission("admin", "company.rates.manage"));
  assert(
    "Estimator cannot manage company rates",
    !roleAllowsPermission("estimator", "company.rates.manage")
  );
  assert("Estimator cannot edit company", !roleAllowsPermission("estimator", "company.edit"));
  assert("Owner can edit company", roleAllowsPermission("owner", "company.edit"));
  assert("Admin can edit company", roleAllowsPermission("admin", "company.edit"));
  assert("Viewer cannot edit company", !roleAllowsPermission("viewer", "company.edit"));
  assert(
    "Estimator can calibrate",
    roleAllowsPermission("estimator", "company.calibration.manage")
  );
  assert("Estimator can price", roleAllowsPermission("estimator", "pricing.edit"));
  assert("Viewer cannot edit projects", !roleAllowsPermission("viewer", "projects.edit"));
  assert("Viewer cannot create quotes", !roleAllowsPermission("viewer", "quotes.create"));
  assert("Viewer cannot send quotes", !roleAllowsPermission("viewer", "quotes.send"));
  assert("Viewer cannot manage rates", !roleAllowsPermission("viewer", "company.rates.manage"));
  assert("Viewer cannot calibrate", !roleAllowsPermission("viewer", "company.calibration.manage"));
  assert("Admin cannot invite (Owner-only seats)", !roleAllowsPermission("admin", "team.invite"));
  assert("Admin cannot remove seats", !roleAllowsPermission("admin", "team.remove"));
  assert("Builder trial hides Team nav", !shouldShowTeamPrimaryNav({ source: "internal_trial", planCode: "business" }));
  assert(
    "Business shows Team nav",
    shouldShowTeamPrimaryNav({ source: "stripe", planCode: "business" })
  );
  assert(
    "Builder paid hides Team nav",
    !shouldShowTeamPrimaryNav({ source: "stripe", planCode: "builder" })
  );

  section("TRIAL STATES");
  const now = new Date("2026-09-04T12:00:00.000Z");
  const inDays = (days: number) =>
    new Date(now.getTime() + days * 24 * 60 * 60 * 1000).toISOString();
  const band = (days: number) =>
    deriveTrialCountdown({
      trialEndsAt: inDays(days),
      effectiveTrialState: "trialing",
      now,
    });
  assert("14–8 days is subtle", band(12)?.tone === "subtle");
  assert("7–4 days is strong", band(6)?.tone === "strong");
  assert("3–1 days is urgent", band(2)?.tone === "urgent");
  const expired = deriveTrialCountdown({
    trialEndsAt: inDays(-1),
    effectiveTrialState: "trial_expired",
    now,
  });
  assert("expired tone", expired?.tone === "expired" && expired.expired === true);
  assert("past-due grace is 7 days", PAST_DUE_GRACE_DAYS === 7);
  assert(
    "value-producing includes send and create",
    VALUE_PRODUCING_CAPABILITIES.includes("quotes.send") &&
      VALUE_PRODUCING_CAPABILITIES.includes("projects.create")
  );
  assert(
    "acceptance is transaction-completion, not value-producing",
    TRANSACTION_COMPLETION_CAPABILITIES.includes("quotes.acceptance") &&
      !(VALUE_PRODUCING_CAPABILITIES as readonly string[]).includes("quotes.acceptance")
  );

  section("PUBLIC ACCEPTANCE / CLIENT-SAFE QUOTE");
  const payload = read("lib/quotes/delivery-client-payload.ts");
  assert("public payload forbids total_cost", payload.includes('"total_cost"'));
  assert("public payload forbids margin", payload.includes('"margin"'));
  assert("public payload forbids gp", payload.includes('"gp"'));
  const publicDoc = read("components/quotes/QuotePublicDocument.tsx");
  assert("public quote pads for mobile accept bar", publicDoc.includes("pb-28"));
  const publicActions = read("components/quotes/QuotePublicActions.tsx");
  assert(
    "public accept bar uses safe-area",
    publicActions.includes("safe-area-inset-bottom")
  );
  const acceptSrc = read("lib/quotes/acceptance.ts");
  assert("acceptance evidence version is v1", acceptSrc.includes("QUOTE_ACCEPTANCE_EVIDENCE_VERSION"));
  const acceptActions = read("lib/quotes/acceptance-actions.ts");
  assert("expired quote cannot be accepted", acceptActions.includes("can no longer be accepted"));

  section("OWN-PRICE CENT ALLOCATION");
  const items = [
    { id: "a", total_sell: 12000.11, total_cost: 8000, cost_known: true as const },
    { id: "b", total_sell: 8333.33, total_cost: 5000, cost_known: true as const },
    { id: "c", total_sell: 9666.56, total_cost: 6100, cost_known: true as const },
  ];
  const allocated = allocateFinalSell(items, 40000);
  assert("allocate $40,000 succeeds", allocated.ok);
  if (allocated.ok) {
    const sum = allocated.allocations.reduce((acc, row) => acc + row.totalSell, 0);
    const residual = Math.round((sum - 40000) * 100) / 100;
    assert(`allocated sum equals $40,000.00 (residual ${residual})`, Math.abs(residual) < 0.005);
  }
  const finalSell = read("lib/pricing/final-sell.ts");
  assert("last line absorbs remainder", finalSell.includes("target - allocated"));

  section("DEFAULT MARGIN BANNER");
  const afterOnboarding = computeCompanySetupReadiness({
    accountReady: true,
    organisationName: "Northland Decks",
    onboardingStatus: "completed",
    currency: "NZD",
    country: "NZ",
    region: "Auckland",
    defaultGstRate: 15,
    defaultMarginPercent: 20,
    hasLabourRate: true,
    hasWorkTypePreferences: true,
    tradingName: "Northland Decks",
    legalName: null,
    contactEmail: "hello@example.com",
    contactPhone: null,
    addressLine1: "1 Queen St",
    city: "Auckland",
  });
  assert(
    "Pricing does not nag default margin after onboarding",
    !afterOnboarding.missingPricingSetup.some((item) => item.id === "default_margin")
  );
  const firstRun = computeCompanySetupReadiness({
    accountReady: true,
    organisationName: "Northland Decks",
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
  assert(
    "first-run still surfaces default margin on Pricing readiness",
    firstRun.missingPricingSetup.some((item) => item.id === "default_margin")
  );

  section("QUOTE EXPIRY CALENDAR (KNOWN LIMITATION)");
  const transaction = read("lib/quotes/transaction.ts");
  assert(
    "expiry calendar remains Pacific/Auckland",
    transaction.includes("Pacific/Auckland") &&
      isQuoteExpired({
        status: "sent",
        valid_until: "2000-01-01",
        expired_at: null,
      })
  );

  section("ERROR SUPPRESSION");
  assert("PGRST is technical", isTechnicalErrorText("PGRST116: ..."));
  assert("Postgres is technical", isTechnicalErrorText("Postgres error"));
  assert("sk_live is technical", isTechnicalErrorText("using sk_live_abc"));
  assert("resend.com is technical", isTechnicalErrorText("resend.com 403"));
  const sanitised = toUserError(new Error("PGRST116 relation does not exist"), "test");
  assert("toUserError hides PGRST", !sanitised.includes("PGRST"));
  const ratesSrc = read("lib/rates/actions.ts");
  assert("rates actions use toUserError", ratesSrc.includes("toUserError") && !/return \{ error: error\.message \}/.test(ratesSrc));
  const setupSrc = read("lib/setup/actions.ts");
  assert(
    "setup actions use toUserError",
    setupSrc.includes("toUserError") && !/return \{ error: \w+\.message \}/.test(setupSrc)
  );

  section("MOBILE CTA PADDING");
  const quoteBar = read("components/quotes/QuoteMobileActionBar.tsx");
  assert(
    "contractor quote mobile bar has safe-area",
    quoteBar.includes("safe-area-inset-bottom")
  );
  const pricingBar = read("components/pricing/PricingMobileActionBar.tsx");
  assert("pricing mobile bar has safe-area", pricingBar.includes("safe-area-inset-bottom"));
  const pricingWorkspace = read("components/pricing/PricingWorkspace.tsx");
  assert(
    "pricing workspace reserves mobile bar space",
    pricingWorkspace.includes("safe-area-inset-bottom")
  );

  section("ENVIRONMENT GUARDS");
  assert("Preview ref is shhpjsoldmqtkdbgrbtm", PREVIEW_SUPABASE_PROJECT_REF === "shhpjsoldmqtkdbgrbtm");
  assert(
    "Production ref is lxvnylhsbvudzzupxeqr",
    PRODUCTION_SUPABASE_PROJECT_REF === "lxvnylhsbvudzzupxeqr"
  );
  assert(
    "hosted preview requires test",
    resolveBillingEnvironment({ VERCEL_ENV: "preview", BILLING_ENVIRONMENT: "test" }) === "test"
  );
  let previewLiveThrew = false;
  try {
    resolveBillingEnvironment({ VERCEL_ENV: "preview", BILLING_ENVIRONMENT: "live" });
  } catch {
    previewLiveThrew = true;
  }
  assert("hosted preview rejects live billing", previewLiveThrew);
  let productionTestThrew = false;
  try {
    resolveBillingEnvironment({ VERCEL_ENV: "production", BILLING_ENVIRONMENT: "test" });
  } catch {
    productionTestThrew = true;
  }
  assert("hosted production rejects test billing", productionTestThrew);
  const dbTarget = read("scripts/db-target.mjs");
  assert("db-target Preview ref is not Production", dbTarget.includes(PREVIEW_SUPABASE_PROJECT_REF));
  assert("db-target never defaults to Production", /Never defaults the target to Production/.test(dbTarget));
  const envExample = read(".env.local.example");
  assert("example documents Preview SITE_URL alias", envExample.includes("quotr-2-0-git-hardening-stage-2a-security"));
  assert("example does not set Production URL as local default", /NEXT_PUBLIC_SITE_URL=http:\/\/localhost:3000/.test(envExample));
  assert("example documents BILLING_ENVIRONMENT=test for Preview", envExample.includes("BILLING_ENVIRONMENT=test"));

  section("MIGRATIONS");
  const latest = latestMigration();
  assert("latest migration is 053", latest === "053_role_aware_rls_hardening.sql");
  const numbers = migrationNumbers();
  assert("no migration 037", !numbers.includes("037"));
  assert(
    "046 through 053 present",
    ["046", "047", "048", "049", "050", "051", "052", "053"].every((n) => numbers.includes(n))
  );
  assert(
    "052 Company DNA remains",
    existsSync(join(process.cwd(), "supabase/migrations/052_company_productivity_calibration.sql"))
  );
  const proposal = read("docs/runbooks/MIGRATION_053_ROLE_RLS_PROPOSAL.md");
  assert(
    "053 role RLS exists and is no longer proposal-only",
    existsSync(join(process.cwd(), "supabase/migrations/053_role_aware_rls_hardening.sql")) &&
      proposal.includes("053_role_aware_rls_hardening.sql") &&
      !proposal.includes("DO NOT CREATE / APPLY")
  );

  section("WEBHOOK / EMAIL / FEEDBACK");
  assert(
    "Stripe foundation events include checkout and invoices",
    STRIPE_FOUNDATION_EVENT_TYPES.includes("checkout.session.completed") &&
      STRIPE_FOUNDATION_EVENT_TYPES.includes("invoice.payment_failed")
  );
  const delivery = read("lib/quotes/delivery-email.ts");
  assert("quote email CTA is View Quote", delivery.includes("View Quote"));
  assert("quote subject uses company and project", delivery.includes("for ${project}"));
  const feedback = read("lib/feedback.ts");
  assert("feedback subject is beta feedback", feedback.includes("Quotr beta feedback"));
  assert("feedback uses NEXT_PUBLIC_FEEDBACK_EMAIL", feedback.includes("NEXT_PUBLIC_FEEDBACK_EMAIL"));
  const sidebar = read("components/app-sidebar.tsx");
  assert("sidebar has FeedbackLink", sidebar.includes("FeedbackLink"));
  const forgot = read("app/(auth)/forgot-password/page.tsx");
  const reset = read("app/(auth)/reset-password/page.tsx");
  assert("password reset routes exist", forgot.length > 0 && reset.length > 0);

  section("LAUNCH DOCS");
  for (const doc of [
    "docs/BETA_LAUNCH_DEFERRED_REGISTER.md",
    "docs/BETA_SMOKE_TEST.md",
    "docs/BETA_LAUNCH_CHECKLIST.md",
    "docs/BETA_RELEASE_RUNBOOK.md",
  ]) {
    assert(`${doc} exists`, existsSync(join(process.cwd(), doc)));
  }

  if (process.exitCode) {
    console.log("\nBETA LAUNCH CLOSE verifier FAILED");
    process.exit(1);
  }
  console.log("\nBETA LAUNCH CLOSE verifier passed");
}

main();
