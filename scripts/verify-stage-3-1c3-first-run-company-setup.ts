/**
 * Stage 3.1C.3 — First-run & company setup verification.
 *
 * Run: npx --yes tsx scripts/verify-stage-3-1c3-first-run-company-setup.ts
 */
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import {
  COMPANY_SETUP_FIELD_CLASSIFICATION,
  SKIP_DEFER_RULES,
} from "../lib/setup/field-classification";
import { computeCompanySetupReadiness } from "../lib/setup/readiness";
import { DEFAULT_MARGIN_PERCENT } from "../lib/estimate/constants";

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
  console.log("=== Stage 3.1C.3 first-run company setup verification ===");

  section("CLASSIFICATION");
  assert(
    "classification catalogue is non-empty",
    COMPANY_SETUP_FIELD_CLASSIFICATION.length >= 10
  );
  assert(
    "company name classified REQUIRED_BEFORE_FIRST_PROJECT",
    COMPANY_SETUP_FIELD_CLASSIFICATION.some(
      (f) =>
        f.id === "organisations.name" &&
        f.classification === "REQUIRED_BEFORE_FIRST_PROJECT"
    )
  );
  assert(
    "labour rate is recommended not required-before-project",
    COMPANY_SETUP_FIELD_CLASSIFICATION.some(
      (f) =>
        f.id === "rates.labour.carpenter" &&
        f.classification === "RECOMMENDED_BEFORE_FIRST_ESTIMATE"
    )
  );
  assert(
    "logo is OPTIONAL_LATER",
    COMPANY_SETUP_FIELD_CLASSIFICATION.some(
      (f) =>
        f.id === "organisation_settings.logo_url" &&
        f.classification === "OPTIONAL_LATER"
    )
  );
  assert(
    "contact email required before issuing quote",
    COMPANY_SETUP_FIELD_CLASSIFICATION.some(
      (f) =>
        f.id === "organisation_settings.contact_email" &&
        f.classification === "REQUIRED_BEFORE_ISSUING_QUOTE"
    )
  );
  assert("skip/defer rules documented", SKIP_DEFER_RULES.length >= 4);

  section("FIRST RUN");
  assert(
    "CompanyBasicsStep exists",
    existsSync(join(process.cwd(), "components/setup/CompanyBasicsStep.tsx"))
  );
  assert(
    "saveCompanyBasics action exists",
    /export async function saveCompanyBasics/.test(read("lib/setup/actions.ts"))
  );
  const basics = read("components/setup/CompanyBasicsStep.tsx");
  assert("basics shows company name", /Company name/.test(basics));
  assert("basics shows currency", /Currency/.test(basics));
  assert("basics shows GST registered question", /Are you GST registered/.test(basics));
  assert("basics Continue CTA", /Continue/.test(basics));
  assert(
    "basics does not force labour rates",
    !/labour rate|carpenter/i.test(basics)
  );
  assert(
    "layout gates basics before Dashboard (R2A)",
    /needsCompanyBasics/.test(read("app/(protected)/app/layout.tsx")) &&
      /mode=basics/.test(read("app/(protected)/app/layout.tsx"))
  );
  assert(
    "dashboard does not soft-render basics gate",
    !/CompanyBasicsStep/.test(read("app/(protected)/app/dashboard/page.tsx"))
  );

  section("READINESS");
  assert(
    "readiness composer exists",
    existsSync(join(process.cwd(), "lib/setup/readiness.ts"))
  );
  assert(
    "readiness loader exists",
    existsSync(join(process.cwd(), "lib/setup/readiness-actions.ts"))
  );

  const notStarted = computeCompanySetupReadiness({
    accountReady: true,
    organisationName: "Acme Builders",
    onboardingStatus: "not_started",
    currency: "NZD",
    country: "NZ",
    region: null,
    defaultGstRate: 15,
    defaultMarginPercent: DEFAULT_MARGIN_PERCENT,
    hasLabourRate: false,
    hasWorkTypePreferences: false,
    tradingName: null,
    legalName: null,
    contactEmail: null,
    contactPhone: null,
    addressLine1: null,
    city: null,
  });
  assert("not_started needs first-run basics", notStarted.needsFirstRunBasics);
  assert("not_started not companyBasicsReady", !notStarted.companyBasicsReady);

  const afterBasics = computeCompanySetupReadiness({
    accountReady: true,
    organisationName: "Acme Builders",
    onboardingStatus: "in_progress",
    currency: "NZD",
    country: "NZ",
    region: "Auckland",
    defaultGstRate: 15,
    defaultMarginPercent: DEFAULT_MARGIN_PERCENT,
    hasLabourRate: false,
    hasWorkTypePreferences: false,
    tradingName: null,
    legalName: null,
    contactEmail: null,
    contactPhone: null,
    addressLine1: null,
    city: null,
  });
  assert("after basics companyBasicsReady", afterBasics.companyBasicsReady);
  assert("after basics estimateReady", afterBasics.estimateReady);
  assert("after basics not pricingReady without labour", !afterBasics.pricingReady);
  assert("after basics not quoteReady without contact", !afterBasics.quoteReady);
  assert(
    "missing estimate setup names labour",
    afterBasics.missingEstimateSetup.some((s) => s.id === "labour_rate")
  );

  const quoteReady = computeCompanySetupReadiness({
    accountReady: true,
    organisationName: "Acme Builders",
    onboardingStatus: "completed",
    currency: "NZD",
    country: "NZ",
    region: "Auckland",
    defaultGstRate: 15,
    defaultMarginPercent: 22,
    hasLabourRate: true,
    hasWorkTypePreferences: false,
    tradingName: "Acme",
    legalName: null,
    contactEmail: "hello@acme.test",
    contactPhone: null,
    addressLine1: "1 Main St",
    city: "Auckland",
  });
  assert("full setup quoteReady", quoteReady.quoteReady);
  assert("full setup pricingReady", quoteReady.pricingReady);
  assert("dimensions are separate booleans", typeof quoteReady.estimateReady === "boolean");

  section("DASHBOARD");
  const dashboard = read("app/(protected)/app/dashboard/page.tsx");
  assert("Create your first job CTA", /Start your first job/.test(dashboard));
  assert("ImproveSetupCard used", /ImproveSetupCard/.test(dashboard));
  assert(
    "SetupPromptCard no longer primary",
    !/SetupPromptCard/.test(dashboard)
  );

  section("COMPANY SETTINGS IA");
  const companyUi = read("components/settings/CompanySettingsContent.tsx");
  const companyDestinations = read("lib/setup/recommendation-destinations.ts");
  assert(
    "General section",
    /general:\s*"General"/.test(companyUi) ||
      /"general"/.test(companyDestinations)
  );
  assert(
    "Pricing defaults section",
    /pricing:\s*"Pricing defaults"/.test(companyUi) ||
      /"pricing"/.test(companyDestinations)
  );
  assert(
    "Quotes section",
    /quotes:\s*"Quotes"/.test(companyUi) || /"quotes"/.test(companyDestinations)
  );
  assert(
    "Advanced section",
    /advanced:\s*"Advanced"/.test(companyUi) ||
      /"advanced"/.test(companyDestinations)
  );
  assert(
    "Profile boundary called out",
    /Personal Profile/.test(companyUi)
  );

  section("PROJECT / PRICING / QUOTE GUIDANCE");
  assert(
    "estimate page uses setup guidance",
    /SetupGuidanceServerBanner/.test(
      read("app/(protected)/app/projects/[projectId]/page.tsx")
    ) &&
      /dimension="estimate"/.test(
        read("app/(protected)/app/projects/[projectId]/page.tsx")
      )
  );
  assert(
    "pricing page uses setup guidance",
    /dimension="pricing"/.test(
      read(
        "app/(protected)/app/projects/[projectId]/pricing/[pricingId]/page.tsx"
      )
    )
  );
  assert(
    "quote page uses setup guidance",
    /dimension="quote"/.test(
      read(
        "app/(protected)/app/projects/[projectId]/quotes/[quoteId]/page.tsx"
      )
    )
  );
  assert(
    "markQuoteSent checks quoteReady",
    /quoteReady/.test(read("lib/quotes/actions.ts")) &&
      /getCompanySetupReadiness/.test(read("lib/quotes/actions.ts"))
  );

  section("SECURITY / DEFAULTS");
  assert("default margin remains 20", DEFAULT_MARGIN_PERCENT === 20);
  assert(
    "readiness loader uses getAuthOrgContext",
    /getAuthOrgContext/.test(read("lib/setup/readiness-actions.ts"))
  );
  assert(
    "no client org_id mutation in readiness",
    !/org_id:\s*input/.test(read("lib/setup/readiness-actions.ts"))
  );

  section("BOUNDARIES");
  assert(
    "no Company DNA module",
    !existsSync(join(process.cwd(), "lib/company-dna"))
  );
  assert(
    "SCOPE_DISCOVERY not force-enabled in example",
    !/^SCOPE_DISCOVERY_ENABLED=true\s*$/m.test(read(".env.local.example"))
  );
  assert(
    "no migration 033 for setup flag",
    !existsSync(
      join(process.cwd(), "supabase/migrations/033_setup_complete.sql")
    )
  );
  assert(
    "architecture doc exists",
    existsSync(
      join(
        process.cwd(),
        "docs/architecture/QUOTR_FIRST_RUN_AND_COMPANY_SETUP_ARCHITECTURE.md"
      )
    )
  );
  assert(
    "audit doc exists",
    existsSync(
      join(
        process.cwd(),
        "docs/audits/STAGE_3_1C3_COMPANY_SETUP_CURRENT_STATE_AUDIT.md"
      )
    )
  );

  if (process.exitCode) {
    console.error("\nStage 3.1C.3 verification failed.");
  } else {
    console.log("\nStage 3.1C.3 first-run company setup verification passed.");
  }
}

main();
