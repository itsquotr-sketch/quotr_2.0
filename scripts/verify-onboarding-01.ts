/**
 * ONBOARDING-01 — required setup persistence, completion, routing,
 * tenant isolation, and carpenter/labourer rate authority.
 *
 * Run: npx --yes tsx scripts/verify-onboarding-01.ts
 */
import { readFileSync } from "fs";
import { join } from "path";
import type { CompanySettings } from "../lib/settings/types";
import type { OrganisationRate, OrganisationSettings } from "../components/setup/types";
import { quotrFallbackSellFromCost, resolveLabourRate } from "../lib/estimate/rates";
import {
  CARPENTER_LABOUR_RATE_KEY,
  GENERAL_LABOUR_RATE_KEY,
  LABOURER_LABOUR_RATE_KEY,
  WORK_AREA_LABOUR_AUTHORITY,
  labourRateKeyOrder,
} from "../lib/estimate/labour-trade-mapping";
import {
  firstRunForcedPath,
  firstRunIsComplete,
  isRequiredOnboardingAllowedPath,
  onboardingMutationIsTenantScoped,
  requiredOnboardingLocksNavigation,
  resolveFirstRunStage,
} from "../lib/setup/first-run-stage";
import {
  improveRatesAndProductivityHref,
  optionalRatesHref,
  RATES_CALIBRATION_HREF,
  resolveOptionalPersonalisationTarget,
} from "../lib/setup/optional-personalisation";
import { getSetupRecommendationHref } from "../lib/setup/recommendation-destinations";
import { parseRequiredTargetMargin } from "../lib/setup/pricing-basics";
import {
  calibrationStatusLabel,
  calibrationWorkAreaHref,
} from "../lib/rates/calibration-access";
import { summarizeProductivityWorkAreas } from "../lib/rates/productivity-work-area-summary";
import {
  normalizeAbn,
  normalizeNzGstNumber,
  parseRequiredCompanyProfile,
  parseRequiredHourlyCost,
} from "../lib/setup/tax-identifier";
import {
  formatCompanyAddress,
  formatGstTreatmentNote,
  formatRegistrationLines,
} from "../lib/quotes/display";
import { parseVariationDocumentIdentity } from "../lib/variations/document-identity";

function assert(label: string, ok: boolean) {
  console.log(ok ? "PASS" : "FAIL", label);
  if (!ok) process.exitCode = 1;
}

function read(rel: string): string {
  return readFileSync(join(process.cwd(), rel), "utf8");
}

function settings(partial: Partial<CompanySettings>): CompanySettings {
  return {
    organisationName: "Signup Co",
    tradingName: null,
    legalName: null,
    contactEmail: null,
    contactPhone: null,
    website: null,
    addressLine1: null,
    addressLine2: null,
    city: null,
    region: null,
    postcode: null,
    addressCountry: "New Zealand",
    nzbn: null,
    gstNumber: null,
    defaultGstRate: 15,
    defaultQuoteValidityDays: 30,
    defaultPaymentTerms: null,
    defaultQuoteTerms: null,
    defaultQuoteExclusions: null,
    defaultQuoteAssumptions: null,
    logoUrl: null,
    brandPrimaryColour: null,
    brandAccentColour: null,
    defaultMaterialWastagePercent: 0,
    deckingWastagePercent: null,
    sheetMaterialWastagePercent: null,
    flooringWastagePercent: null,
    paintWastagePercent: null,
    timberFramingWastagePercent: null,
    ...partial,
  };
}

function rate(itemKey: string, cost: number): OrganisationRate {
  return {
    id: itemKey,
    rate_type: "labour",
    trade: null,
    work_area_type: null,
    item_key: itemKey,
    label: itemKey,
    unit: "hour",
    cost_rate: cost,
    sell_rate: null,
    markup_percent: null,
    active: true,
  };
}

const ORG_SETTINGS = {
  id: "s",
  org_id: "org-a",
  default_margin_percent: 20,
  default_contingency_percent: 10,
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
} as OrganisationSettings;

function main() {
  console.log("=== ONBOARDING-01 ===\n");

  const nz = parseRequiredCompanyProfile(
    {
      tradingName: "Harbour Decks",
      country: "NZ",
      addressLine1: "12 Quay Street",
      addressLine2: "Level 2",
      city: "Auckland",
      postcode: "1010",
      region: "Auckland",
      gstRegistered: "yes",
      taxIdentifier: "123-456-789",
    },
    15
  );
  assert("NZ registered profile persists", nz.ok === true);
  if (nz.ok) {
    assert("NZ trading name", nz.value.tradingName === "Harbour Decks");
    assert("NZ gst number digits", nz.value.gstNumber === "123456789");
    assert("NZ does not invent an ABN", nz.value.nzbn === null);
    assert("NZ gst rate 15", nz.value.defaultGstRate === 15);
    assert("NZ address country", nz.value.addressCountry === "New Zealand");
  }

  const nzNo = parseRequiredCompanyProfile(
    {
      tradingName: "Harbour Decks",
      country: "NZ",
      addressLine1: "12 Quay Street",
      city: "Auckland",
      postcode: "1010",
      gstRegistered: "no",
      taxIdentifier: "12345678",
    },
    15
  );
  assert("NZ unregistered ignores a typed GST number", nzNo.ok && nzNo.value.gstNumber === null && nzNo.value.defaultGstRate === 0);

  const missingGst = parseRequiredCompanyProfile(
    {
      tradingName: "Harbour Decks",
      country: "NZ",
      addressLine1: "12 Quay Street",
      city: "Auckland",
      postcode: "1010",
      gstRegistered: "yes",
      taxIdentifier: "",
    },
    15
  );
  assert("NZ registered requires GST number", !missingGst.ok && Boolean(missingGst.ok ? false : missingGst.fieldErrors.tax_identifier));

  const au = parseRequiredCompanyProfile(
    {
      tradingName: "Sydney Fences",
      country: "AU",
      addressLine1: "8 George Street",
      city: "Sydney",
      postcode: "2000",
      gstRegistered: "yes",
      taxIdentifier: "51 824 753 556",
    },
    10
  );
  assert(
    "AU registered profile persists ABN",
    au.ok && au.value.abn === "51824753556" && au.value.nzbn === null && au.value.gstNumber === null
  );
  assert("AU gst rate 10", au.ok && au.value.defaultGstRate === 10);
  assert("invalid ABN rejected", normalizeAbn("51824753555") === null);
  assert("short NZ GST rejected", normalizeNzGstNumber("1234567") === null);
  assert("hourly costs are required", !parseRequiredHourlyCost("", "carpenter").ok);
  assert("hourly cost accepts 85", parseRequiredHourlyCost("85", "labourer").ok);

  if (nz.ok && nzNo.ok && au.ok) {
    const registered = settings({
      organisationName: "Signup Co",
      tradingName: nz.value.tradingName,
      addressLine1: nz.value.addressLine1,
      addressLine2: nz.value.addressLine2,
      city: nz.value.city,
      region: nz.value.region,
      postcode: nz.value.postcode,
      addressCountry: nz.value.addressCountry,
      gstNumber: nz.value.gstNumber,
      nzbn: nz.value.nzbn,
      defaultGstRate: nz.value.defaultGstRate,
    });
    assert(
      "quote address uses the manual fields",
      formatCompanyAddress(registered) === "12 Quay Street, Level 2, Auckland, Auckland, 1010"
    );
    assert("quote shows GST number only when saved", formatRegistrationLines(registered).join(" ") === "GST 123456789");
    assert(
      "unregistered quote omits GST number",
      formatRegistrationLines(
        settings({
          gstNumber: nzNo.value.gstNumber,
          defaultGstRate: 0,
          addressCountry: "New Zealand",
        })
      ).length === 0
    );
    assert(
      "unregistered quote does not say GST exclusive",
      formatGstTreatmentNote(settings({ addressCountry: "New Zealand", defaultGstRate: 0 }), 0) ===
        "All amounts are in NZD."
    );
    const auSettings = settings({
      tradingName: au.value.tradingName,
      addressLine1: au.value.addressLine1,
      city: au.value.city,
      postcode: au.value.postcode,
      addressCountry: au.value.addressCountry,
      nzbn: au.value.nzbn,
      abn: au.value.abn,
      gstNumber: au.value.gstNumber,
      defaultGstRate: au.value.defaultGstRate,
    });
    assert("variation identity shows ABN not a blank GST line", formatRegistrationLines(auSettings).join(" ") === "ABN 51824753556");
    const variation = parseVariationDocumentIdentity({
      contractor: {
        organisationName: "Signup Co",
        tradingName: au.value.tradingName,
        addressLine1: au.value.addressLine1,
        city: au.value.city,
        postcode: au.value.postcode,
        addressCountry: au.value.addressCountry,
        nzbn: au.value.nzbn,
      abn: au.value.abn,
        gstNumber: au.value.gstNumber,
      },
      client: { name: "Client" },
      project: { title: "Fence" },
      masterQuote: { quoteNumber: "Q-1", revisionNumber: 1, available: true },
    });
    assert("variation address includes the street", variation?.address?.includes("8 George Street") === true);
    assert("variation registration is the ABN", variation?.registrationLines.join(" ") === "ABN 51824753556");
    assert(
      "issued Australian snapshot still prints ABN",
      formatRegistrationLines(
        settings({ addressCountry: "Australia", nzbn: "51824753556", abn: null })
      ).join(" ") === "ABN 51824753556"
    );
    assert(
      "NZBN is not labelled as an ABN",
      formatRegistrationLines(
        settings({ addressCountry: "New Zealand", nzbn: "9429000000000" })
      ).join(" ") === "NZBN 9429000000000"
    );
  }

  const margin25 = parseRequiredTargetMargin("25");
  assert("margin uses the organisation gross-margin rule", margin25.ok && margin25.marginPercent === 25);
  assert("margin above 95 is rejected", !parseRequiredTargetMargin("96").ok);
  assert(
    "saved margin prices a new labour cost",
    quotrFallbackSellFromCost(85, { ...ORG_SETTINGS, default_margin_percent: 25 }) === 113.33
  );

  assert("new user starts at company", resolveFirstRunStage({ onboardingStatus: "not_started", onboardingStep: "company" }) === "basics");
  assert(
    "work types still required",
    resolveFirstRunStage({
      onboardingStatus: "in_progress",
      onboardingStep: "work_areas",
      hasPrimaryWorkAreas: false,
    }) === "work"
  );
  assert(
    "saved work types move to labour",
    resolveFirstRunStage({
      onboardingStatus: "in_progress",
      onboardingStep: "work_areas",
      hasPrimaryWorkAreas: true,
    }) === "labour"
  );
  assert(
    "ready screen is still required",
    resolveFirstRunStage({ onboardingStatus: "in_progress", onboardingStep: "ready" }) === "ready" &&
      !firstRunIsComplete("ready") &&
      firstRunForcedPath("ready") === "/app/setup?mode=ready"
  );
  assert(
    "completed onboarding stays complete after sign-in",
    resolveFirstRunStage({
      onboardingStatus: "completed",
      onboardingStep: "completed",
      hasPrimaryWorkAreas: true,
    }) === "done" && firstRunForcedPath("done") === null
  );
  assert(
    "new rates step is not a completion shortcut",
    resolveFirstRunStage({
      onboardingStatus: "in_progress",
      onboardingStep: "rates",
      hasPrimaryWorkAreas: true,
    }) !== "done"
  );
  assert(
    "new review step is not a completion shortcut",
    resolveFirstRunStage({
      onboardingStatus: "in_progress",
      onboardingStep: "review",
    }) !== "done"
  );
  assert(
    "direct project route is blocked during setup",
    requiredOnboardingLocksNavigation("labour") &&
      !isRequiredOnboardingAllowedPath("/app/projects/new") &&
      !isRequiredOnboardingAllowedPath("/app/dashboard") &&
      !isRequiredOnboardingAllowedPath("/app/setup/dna/deck") &&
      isRequiredOnboardingAllowedPath("/app/setup") &&
      isRequiredOnboardingAllowedPath("/app/profile") &&
      isRequiredOnboardingAllowedPath("/app/settings/billing")
  );

  const next = resolveOptionalPersonalisationTarget({
    preferredWorkAreaTypes: ["kitchen", "deck"],
    progress: [
      { workAreaType: "deck", calibrated: 0, total: 3, complete: false },
    ],
  });
  assert("optional route opens deck calibration, not the setup wizard", next?.href === "/app/setup/dna/deck");
  const continued = resolveOptionalPersonalisationTarget({
    preferredWorkAreaTypes: ["deck"],
    progress: [{ workAreaType: "deck", calibrated: 1, total: 3, complete: false }],
  });
  assert("partial calibration continues at the next task", continued?.href === "/app/setup/dna/deck?view=continue");
  assert(
    "dismissed prompt stays hidden",
    resolveOptionalPersonalisationTarget({
      dismissed: true,
      preferredWorkAreaTypes: ["deck"],
      progress: [],
    }) === null
  );
  assert("rates remain the other optional route", optionalRatesHref() === "/app/rates?section=core");
  assert(
    "optional improvement opens the next calibration task",
    improveRatesAndProductivityHref({
      preferredWorkAreaTypes: ["deck"],
      progress: [],
    }) === "/app/setup/dna/deck"
  );
  assert(
    "optional improvement without a calibration task opens Rates",
    improveRatesAndProductivityHref({
      preferredWorkAreaTypes: ["kitchen"],
      progress: [],
    }) === RATES_CALIBRATION_HREF
  );
  assert(
    "calibration recommendations stay on Rates",
    getSetupRecommendationHref("calibrate") === RATES_CALIBRATION_HREF &&
      getSetupRecommendationHref("calibrate_another") === RATES_CALIBRATION_HREF
  );
  const deckSummary = summarizeProductivityWorkAreas([], ["bathroom", "deck"]).find(
    (row) => row.workAreaType === "deck"
  );
  const bathroomSummary = summarizeProductivityWorkAreas([], ["bathroom", "deck"]).find(
    (row) => row.workAreaType === "bathroom"
  );
  assert(
    "calibration lists selected work areas first",
    summarizeProductivityWorkAreas([], ["bathroom"]).map((row) => row.workAreaType)[0] === "bathroom"
  );
  assert(
    "uncalibrated work uses Quotr benchmarks",
    deckSummary != null && calibrationStatusLabel(deckSummary.status) === "Quotr benchmarks"
  );
  assert(
    "calibration opens the work-area flow",
    bathroomSummary != null && calibrationWorkAreaHref(bathroomSummary).startsWith("/app/setup/dna/")
  );

  assert("tenant match", onboardingMutationIsTenantScoped("org-a", "org-a"));
  assert("tenant mismatch rejected", !onboardingMutationIsTenantScoped("org-a", "org-b"));
  assert("empty org rejected", !onboardingMutationIsTenantScoped("", "org-a"));

  const ready = read("components/setup/FirstRunReady.tsx");
  const labourStep = read("components/setup/LabourCostsStep.tsx");
  const ratesNav = read("components/rates/RatesPageContent.tsx");
  assert(
    "ready screen creates a project only after the form and offers the dashboard",
    ready.includes('intent="first-job"') &&
      ready.includes("Create your first project") &&
      ready.includes("completeRequiredOnboarding") &&
      ready.includes("Go to Dashboard") &&
      ready.includes("later under Rates") &&
      !ready.includes("Improve my rates and productivity") &&
      !ready.includes("createProject")
  );
  assert(
    "labour step collects both costs and the default margin",
    labourStep.includes("Carpenter internal cost per hour") &&
      labourStep.includes("Labourer internal cost per hour") &&
      labourStep.includes("Default target gross margin %") &&
      labourStep.includes("not the client charge-out rate")
  );
  assert("Rates navigation includes Calibration", ratesNav.includes('label: "Calibration"'));

  const actions = read("lib/setup/actions.ts");
  const labourSave = actions.slice(actions.indexOf("export async function saveRequiredLabourCosts"));
  assert(
    "labour save writes the organisation margin and not historical documents",
    labourSave.includes("default_margin_percent: margin.marginPercent") &&
      labourSave.includes("parseRequiredTargetMargin") &&
      !labourSave.includes('.from("quotes")') &&
      !labourSave.includes('.from("variations")')
  );
  assert(
    "GST choice clears GST number and ABN without writing NZBN",
    actions.includes("gst_registered: registration.gst_registered") &&
      actions.includes("abn: registration.abn") &&
      actions.includes("gst_number: registration.gst_number") &&
      !actions.includes("nzbn: null") &&
      !actions.includes("nzbn = null")
  );
  assert(
    "onboarding writes use the authenticated org",
    actions.includes('.eq("org_id", orgId)') &&
      !/input\.org_id|input\.orgId/.test(actions)
  );
  assert(
    "company defaults no longer rewind onboarding",
    !/onboarding_step:\s*"work_areas"/.test(
      actions.slice(actions.indexOf("export async function saveCompanyDefaults"))
    )
  );

  const layout = read("app/(protected)/app/layout.tsx");
  assert(
    "layout uses role-aware onboarding access",
    layout.includes("resolveProtectedOnboardingAccess") &&
      read("lib/setup/first-run-stage.ts").includes("isRequiredOnboardingAllowedPath")
  );
  assert("focused frame replaces primary nav", layout.includes("OnboardingFrame"));
  assert("sidebar has no Setup item", !read("components/app-sidebar.tsx").includes('href: "/app/setup"'));
  assert("mobile menu has no Setup item", !read("components/layout/mobile-menu-sheet.tsx").includes('href: "/app/setup"'));
  assert(
    "work types live under Company",
    read("lib/setup/recommendation-destinations.ts").includes('href: "/app/settings/company?section=work"')
  );

  const both = [rate(CARPENTER_LABOUR_RATE_KEY, 82), rate(LABOURER_LABOUR_RATE_KEY, 46), rate(GENERAL_LABOUR_RATE_KEY, 55)];
  const carpenter = resolveLabourRate({ rates: both, organisationSettings: ORG_SETTINGS });
  const labourer = resolveLabourRate({ rates: both, organisationSettings: ORG_SETTINGS, trade: "labourer" });
  assert("carpenter work uses the carpenter cost", carpenter.costRate === 82 && carpenter.itemKey === CARPENTER_LABOUR_RATE_KEY);
  assert("labourer work uses the labourer cost", labourer.costRate === 46 && labourer.itemKey === LABOURER_LABOUR_RATE_KEY);
  const generalOnly = resolveLabourRate({
    rates: [rate(GENERAL_LABOUR_RATE_KEY, 55)],
    organisationSettings: ORG_SETTINGS,
  });
  assert("missing carpenter still falls back to general", generalOnly.costRate === 55 && generalOnly.itemKey === GENERAL_LABOUR_RATE_KEY);
  const labourerFallback = resolveLabourRate({
    rates: [rate(GENERAL_LABOUR_RATE_KEY, 55), rate(CARPENTER_LABOUR_RATE_KEY, 82)],
    organisationSettings: ORG_SETTINGS,
    trade: "labourer",
  });
  assert(
    "missing labourer keeps general before carpenter",
    labourerFallback.itemKey === GENERAL_LABOUR_RATE_KEY &&
      labourRateKeyOrder("labourer")[0] === LABOURER_LABOUR_RATE_KEY
  );
  assert(
    "priced work areas cannot split labourer yet",
    WORK_AREA_LABOUR_AUTHORITY.length >= 10 &&
      WORK_AREA_LABOUR_AUTHORITY.every((row) => row.distinguishesLabourer === false)
  );
  assert(
    "labour save does not touch quote snapshots",
    !read("lib/setup/actions.ts").includes("issuer_snapshot") &&
      !read("lib/setup/actions.ts").includes("accepted_snapshot")
  );

  if (process.exitCode) {
    console.log("\nONBOARDING-01 failed");
  } else {
    console.log("\nONBOARDING-01 passed");
  }
}

main();
