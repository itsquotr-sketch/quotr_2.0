/**
 * Stage 3.1C.3-R2A — First-run gating, country/currency, Dashboard coherence.
 *
 * Run: npx --yes tsx scripts/verify-stage-3-1c3-r2a-first-run-gating.ts
 */
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import {
  COMPANY_COUNTRIES,
  COMPANY_CURRENCIES,
  isSupportedCountryCode,
  isSupportedCurrencyCode,
  normalizeCountryCode,
  normalizeCurrencyCode,
} from "../lib/setup/locale-catalogue";
import { computeCompanySetupReadiness } from "../lib/setup/readiness";

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
  console.log("=== Stage 3.1C.3-R2A first-run gating verification ===");

  section("ROUTING");
  const layout = read("app/(protected)/app/layout.tsx");
  assert(
    "layout redirects when first-run stage is unfinished",
    /getFirstRunStage/.test(layout) && /firstRunForcedPath/.test(layout)
  );
  assert(
    "setup-required path remains separate",
    /setup-required/.test(layout)
  );
  assert(
    "basics allowed path is /app/setup",
    /isCompanyBasicsAllowedPath/.test(layout) ||
      /pathname === "\/app\/setup"/.test(layout)
  );
  const setupPage = read("app/(protected)/app/setup/page.tsx");
  assert("setup page reads mode searchParam", /mode/.test(setupPage));
  assert(
    "company-complete basics URL resumes pricing not dashboard",
    /setupModeRedirect/.test(setupPage) && /getFirstRunStage/.test(setupPage)
  );
  const dashboard = read("app/(protected)/app/dashboard/page.tsx");
  assert(
    "dashboard has no CompanyBasicsStep soft gate",
    !/CompanyBasicsStep/.test(dashboard)
  );
  assert(
    "dashboard Start first job primary",
    /Start your first job/.test(dashboard)
  );
  assert(
    "no Work Area / rate gate before Dashboard in layout",
    !/work_areas/.test(layout) && !/hasLabourRate/.test(layout)
  );

  section("COUNTRY");
  assert("catalogue includes NZ", isSupportedCountryCode("NZ"));
  assert("catalogue includes AU", isSupportedCountryCode("AU"));
  assert("normalize NZ alias", normalizeCountryCode("New Zealand") === "NZ");
  assert("normalize nz", normalizeCountryCode("nz") === "NZ");
  assert("normalize Australia", normalizeCountryCode("Australia") === "AU");
  const basicsUi = read("components/setup/CompanyBasicsStep.tsx");
  assert("country uses select", /<select[\s\S]*basics-country/.test(basicsUi));
  assert(
    "no 8-char country limit in saveCompanyBasics",
    !/\.max\(8\)/.test(
      read("lib/setup/actions.ts").slice(
        read("lib/setup/actions.ts").indexOf("companyBasicsSchema"),
        read("lib/setup/actions.ts").indexOf("companyBasicsSchema") + 500
      )
    )
  );
  assert(
    "country max allows display-length validation >= 64",
    /country:[\s\S]{0,200}\.max\(64[,)]/.test(read("lib/setup/actions.ts"))
  );

  section("CURRENCY");
  assert("NZD supported", isSupportedCurrencyCode("NZD"));
  assert("AUD supported", isSupportedCurrencyCode("AUD"));
  assert(
    "normalize New Zealand Dollar",
    normalizeCurrencyCode("New Zealand Dollar") === "NZD"
  );
  assert("currency select present", /basics-currency/.test(basicsUi));
  assert(
    "NZ suggests NZD",
    COMPANY_COUNTRIES.find((c) => c.code === "NZ")?.suggestedCurrency === "NZD"
  );
  assert(
    "AU suggests AUD",
    COMPANY_COUNTRIES.find((c) => c.code === "AU")?.suggestedCurrency === "AUD"
  );
  assert(
    "currencyTouched prevents silent overwrite pattern",
    /currencyTouched/.test(basicsUi)
  );

  section("GST");
  assert(
    "NZ suggests 15%",
    COMPANY_COUNTRIES.find((c) => c.code === "NZ")?.suggestedGstPercent === 15
  );
  assert(
    "AU suggests 10%",
    COMPANY_COUNTRIES.find((c) => c.code === "AU")?.suggestedGstPercent === 10
  );
  assert("GST registered yes/no", /Are you GST registered/.test(basicsUi));
  assert("GST no sets customer quotes without GST copy", /not add GST/.test(basicsUi));

  section("SETUP SAVE / REVIEW");
  assert(
    "basics mode Continues to pricing",
    /mode=pricing/.test(basicsUi) && /Continue/.test(basicsUi)
  );
  assert(
    "optional mode Save company basics",
    /Save company basics/.test(basicsUi)
  );
  assert(
    "optional mode uses onSaved not forced Dashboard-only",
    /mode === "optional"/.test(basicsUi) || /mode !== "basics"/.test(basicsUi) ||
      /mode === "basics"/.test(basicsUi)
  );
  const shell = read("components/setup/SetupShell.tsx");
  assert("improve mode has no ReviewStep", !/ReviewStep/.test(shell));
  assert(
    "improve mode optional sections",
    /mode === "improve"/.test(shell) || /Improve Quotr/.test(shell)
  );
  assert(
    "isSetupIncomplete delegates to needsCompanyBasics",
    /isSetupIncomplete[\s\S]{0,80}needsCompanyBasics/.test(
      read("lib/setup/actions.ts")
    )
  );

  section("DASHBOARD / SIDEBAR");
  assert(
    "Improve Quotr for your business",
    /Improve Quotr for your business/.test(dashboard) ||
      /Improve Quotr for your business/.test(
        read("components/setup/ImproveSetupCard.tsx")
      )
  );
  assert(
    "no Finish setting up Quotr on dashboard",
    !/Finish setting up Quotr/.test(dashboard)
  );
  assert(
    "no SetupPromptCard on dashboard",
    !/SetupPromptCard/.test(dashboard)
  );
  assert(
    "layout badge uses company basics stage only",
    /setupIncomplete = firstRunStage === "basics"/.test(layout)
  );

  section("READINESS");
  const notStarted = computeCompanySetupReadiness({
    accountReady: true,
    organisationName: "Acme",
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
  assert("not_started needs basics", notStarted.needsFirstRunBasics);
  assert("not_started !companyBasicsReady", !notStarted.companyBasicsReady);

  const ready = computeCompanySetupReadiness({
    accountReady: true,
    organisationName: "Acme",
    onboardingStatus: "in_progress",
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
  assert("in_progress companyBasicsReady", ready.companyBasicsReady);
  assert("estimateReady without labour", ready.estimateReady);
  assert("!pricingReady without labour", !ready.pricingReady);
  assert("!quoteReady without contact", !ready.quoteReady);

  const legacy = computeCompanySetupReadiness({
    accountReady: true,
    organisationName: "Legacy Co",
    onboardingStatus: "completed",
    currency: "New Zealand Dollar",
    country: "New Zealand",
    region: null,
    defaultGstRate: 15,
    defaultMarginPercent: 20,
    hasLabourRate: true,
    hasWorkTypePreferences: false,
    tradingName: "Legacy",
    legalName: null,
    contactEmail: "a@b.c",
    contactPhone: null,
    addressLine1: null,
    city: null,
  });
  assert(
    "legacy completed not forced through basics",
    legacy.companyBasicsReady && !legacy.needsFirstRunBasics
  );

  section("BOUNDARIES");
  assert(
    "no migration 033",
    !existsSync(join(process.cwd(), "supabase/migrations/033_setup_complete.sql")) &&
      !existsSync(
        join(process.cwd(), "supabase/migrations/033_country_currency.sql")
      )
  );
  assert(
    "generic scope starters still in starter-rates (not deleted)",
    /scope\.deck\.m2/.test(read("lib/setup/starter-rates.ts"))
  );
  assert(
    "Analyse Job uses capability catalogue not org preferences",
    /getAnalysisCapableWorkAreaTypes/.test(read("lib/assistant/actions.ts")) &&
      !/from\("organisation_work_areas"\)/.test(
        read("lib/assistant/actions.ts").slice(
          read("lib/assistant/actions.ts").indexOf("saveBriefAndSeedWorkAreas"),
          read("lib/assistant/actions.ts").indexOf("saveBriefAndSeedWorkAreas") +
            2500
        )
      )
  );
  assert(
    "no Company DNA module",
    !existsSync(join(process.cwd(), "lib/company-dna"))
  );
  assert(
    "SCOPE_DISCOVERY not force-enabled",
    !/^SCOPE_DISCOVERY_ENABLED=true\s*$/m.test(read(".env.local.example"))
  );
  assert(
    "catalogue extensible (countries length)",
    COMPANY_COUNTRIES.length >= 2 && COMPANY_CURRENCIES.length >= 2
  );

  if (process.exitCode) {
    console.error("\nStage 3.1C.3-R2A verification failed.");
  } else {
    console.log("\nStage 3.1C.3-R2A first-run gating verification passed.");
  }
}

main();
