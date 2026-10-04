/**
 * Unified six-step onboarding UI.
 * Run: npx --yes tsx scripts/verify-unified-onboarding-ui.ts
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { POST_SIGNUP_DESTINATION } from "../lib/auth/post-auth-navigation";
import { shouldProvisionSignupOrganisation } from "../lib/auth/email-confirm-destination";
import { parseRequiredTargetMargin } from "../lib/setup/pricing-basics";
import {
  FIRST_RUN_ADDRESS_PATH,
  FIRST_RUN_BASICS_PATH,
  FIRST_RUN_LABOUR_PATH,
  FIRST_RUN_READY_PATH,
  FIRST_RUN_TAX_PATH,
  FIRST_RUN_WORK_PATH,
  ONBOARDING_SHELL_MODES,
  firstRunForcedPath,
  resolveProtectedOnboardingAccess,
  setupModeRedirect,
  setupShellMode,
} from "../lib/setup/first-run-stage";
import {
  gstRegistrationPersistence,
  incompleteSetupCategoryLabels,
  resolveLabourOnboardingWrite,
  type OnboardingAuthoritySnapshot,
} from "../lib/setup/onboarding-authority";

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), "utf8");

let failed = 0;

function assert(name: string, condition: boolean): void {
  if (condition) {
    console.log(`  ok  ${name}`);
    return;
  }
  failed += 1;
  console.error(`  FAIL  ${name}`);
}

function main(): void {
  console.log("=== Unified onboarding UI ===\n");

  assert(
    "six canonical stages and urls",
    ONBOARDING_SHELL_MODES.join(",") === "basics,address,tax,work,labour,ready" &&
      firstRunForcedPath("basics") === FIRST_RUN_BASICS_PATH &&
      firstRunForcedPath("address") === FIRST_RUN_ADDRESS_PATH &&
      firstRunForcedPath("tax") === FIRST_RUN_TAX_PATH &&
      firstRunForcedPath("work") === FIRST_RUN_WORK_PATH &&
      firstRunForcedPath("labour") === FIRST_RUN_LABOUR_PATH &&
      firstRunForcedPath("ready") === FIRST_RUN_READY_PATH
  );

  const shell = read("components/setup/SetupShell.tsx");
  const business = read("components/setup/BusinessIdentityStep.tsx");
  const address = read("components/setup/BusinessAddressStep.tsx");
  const gst = read("components/setup/GstRegistrationStep.tsx");
  const work = read("components/setup/WorkAreasStep.tsx");
  const labour = read("components/setup/LabourCostsStep.tsx");
  const ready = read("components/setup/FirstRunReady.tsx");
  const frame = read("components/setup/OnboardingFrame.tsx");
  const surface = read("components/setup/OnboardingSurface.tsx");
  const notice = read("components/setup/IncompleteSetupNotice.tsx");
  const appShell = read("components/layout/app-shell.tsx");
  const layout = read("app/(protected)/app/layout.tsx");
  const actions = read("lib/setup/actions.ts");
  const signup = read("app/(auth)/actions.ts");

  assert(
    "business, address, and GST are separate screens",
    shell.includes("BusinessIdentityStep") &&
      shell.includes("BusinessAddressStep") &&
      shell.includes("GstRegistrationStep") &&
      !shell.includes("RequiredCompanyProfileStep") &&
      !business.includes("gst_registered") &&
      !address.includes("gst_registered") &&
      address.includes("Postcode") &&
      setupShellMode("address", "address") === "address" &&
      setupShellMode("tax", "tax") === "tax"
  );
  assert(
    "signup company name is the trading-name prefill",
    business.includes("organisationName") &&
      business.includes("trading_name") &&
      business.includes("Your trading name is the name clients normally see.")
  );
  assert(
    "ordinary signup still provisions from metadata without a second name form",
    POST_SIGNUP_DESTINATION === "/app/setup?mode=basics" &&
      shouldProvisionSignupOrganisation({
        hasOrg: false,
        pendingInvite: "none",
        organisationName: "Smith Building Co.",
        fullName: "Alex Smith",
      }) &&
      !shouldProvisionSignupOrganisation({
        hasOrg: true,
        pendingInvite: "none",
        organisationName: "Smith Building Co.",
        fullName: "Alex Smith",
      }) &&
      !shouldProvisionSignupOrganisation({
        hasOrg: false,
        pendingInvite: "one",
        organisationName: "Smith Building Co.",
        fullName: "Alex Smith",
      })
  );
  assert(
    "GST null stays unanswered",
    gst.includes('gst_registered === false ? "no"') &&
      !gst.includes("default_gst_rate") &&
      gst.includes("Yes, registered") &&
      gst.includes("No, not registered")
  );

  const cleared = gstRegistrationPersistence({
    registered: false,
    countryCode: "NZ",
    gstNumber: "123456789",
    abn: "51824753556",
    suggestedRate: 15,
  });
  const gstSave = actions.slice(actions.indexOf("export async function saveGstRegistration"));
  assert(
    "GST No writes zero and clears GST number and ABN, not NZBN",
    cleared.gst_registered === false &&
      cleared.default_gst_rate === 0 &&
      cleared.gst_number === null &&
      cleared.abn === null &&
      !("nzbn" in cleared) &&
      gstSave.includes("gst_number: registration.gst_number") &&
      gstSave.includes("abn: registration.abn") &&
      !gstSave.includes("nzbn")
  );
  assert(
    "GST Yes requires the country identifier",
    gstSave.includes("Enter an 8 or 9 digit GST number.") &&
      gstSave.includes("Enter a valid 11-digit ABN.") &&
      gst.includes("This identifier can appear on client documents.")
  );
  assert(
    "work types are compact selectable rows and require one choice",
    work.includes("min-h-[3.25rem]") &&
      work.includes('type="checkbox"') &&
      work.includes("You can still use every supported work type later.") &&
      work.includes("Choose at least one kind of work") &&
      actions.includes("Choose at least one kind of work you usually price.")
  );

  const benchmark = resolveLabourOnboardingWrite({
    choice: "quotr_benchmark",
    cost: "85",
    label: "carpenter",
  });
  const company = resolveLabourOnboardingWrite({
    choice: "company",
    cost: "0",
    label: "carpenter",
  });
  const companyOk = resolveLabourOnboardingWrite({
    choice: "company",
    cost: "65",
    label: "labourer",
  });
  assert(
    "carpenter and labourer choices are separate",
    labour.includes('name="carpenterChoice"') &&
      labour.includes('name="labourerChoice"') &&
      labour.includes("Use my company cost") &&
      labour.includes("Use the Quotr benchmark")
  );
  assert(
    "benchmark does not write a company rate",
    benchmark.ok && benchmark.writeRate === false
  );
  assert(
    "an existing company rate is not described as overridden",
    labour.includes("Estimates still use that rate") &&
      labour.includes("Manage the saved rate") &&
      !labour.includes("overrides")
  );
  assert(
    "company choices require a positive cost",
    !company.ok && companyOk.ok && companyOk.writeRate === true
  );
  assert(
    "margin accepts 0 to 95",
    parseRequiredTargetMargin("0").ok &&
      parseRequiredTargetMargin("95").ok &&
      !parseRequiredTargetMargin("-1").ok &&
      !parseRequiredTargetMargin("96").ok
  );
  assert(
    "marketing consent is optional and sourced from onboarding",
    actions.includes('p_source: "onboarding"') &&
      ready.includes("Send me product updates and practical Quotr tips.") &&
      ready.includes("recordOnboardingMarketingConsent") &&
      !actions.slice(actions.indexOf("export async function completeRequiredOnboarding")).includes(
        "marketing_consent"
      )
  );
  assert(
    "both final actions complete onboarding and do not create a project",
    ready.includes("completeRequiredOnboarding") &&
      ready.includes("beforeOpen={finish}") &&
      ready.includes("goToDashboard") &&
      ready.includes("Create your first project") &&
      ready.includes("Go to Dashboard") &&
      !ready.includes("createProject")
  );

  const owner = resolveProtectedOnboardingAccess({
    stage: "address",
    role: "owner",
    pathname: "/app/dashboard",
  });
  const admin = resolveProtectedOnboardingAccess({
    stage: "tax",
    role: "admin",
    pathname: "/app/dashboard",
  });
  const estimator = resolveProtectedOnboardingAccess({
    stage: "work",
    role: "estimator",
    pathname: "/app/setup",
  });
  const viewer = resolveProtectedOnboardingAccess({
    stage: "labour",
    role: "viewer",
    pathname: "/app/setup",
  });
  const completed = resolveProtectedOnboardingAccess({
    stage: "done",
    role: "owner",
    pathname: "/app/dashboard",
  });
  assert(
    "owner resumes at the first incomplete step",
    owner.lockNavigation && owner.redirectTo === FIRST_RUN_ADDRESS_PATH
  );
  assert(
    "admin can open setup and is not trapped",
    !admin.lockNavigation && admin.redirectTo === null
  );
  assert(
    "estimator and viewer leave the setup wizard",
    estimator.redirectTo === "/app/dashboard" && viewer.redirectTo === "/app/dashboard"
  );
  assert(
    "a completed organisation stays open",
    !completed.lockNavigation &&
      completed.redirectTo === null &&
      setupModeRedirect("basics", "done") === null
  );
  assert(
    "later urls cannot skip a missing step",
    setupModeRedirect("ready", "basics") === FIRST_RUN_BASICS_PATH &&
      setupModeRedirect("improve", "work") === FIRST_RUN_WORK_PATH &&
      setupModeRedirect("basics", "ready") === null
  );

  const labels = incompleteSetupCategoryLabels({
    tradingName: "Build Co",
    country: "NZ",
    addressLine1: "",
    city: "",
    postcode: "",
    gstRegistered: null,
    gstNumber: "123456789",
    abn: null,
    nzbn: "9429000000000",
    defaultGstRate: 15,
    hasPrimaryWorkAreas: false,
    carpenterChoice: null,
    carpenterHasPositiveCost: false,
    labourerChoice: null,
    labourerHasPositiveCost: false,
    marginPercent: null,
  } satisfies OnboardingAuthoritySnapshot);
  assert(
    "incomplete notice names categories and keeps the review link to owners and admins",
    labels.includes("address") &&
      labels.includes("GST") &&
      !labels.includes("123456789") &&
      !labels.includes("9429000000000") &&
      notice.includes("Review setup") &&
      notice.includes("An owner or admin can update this in setup") &&
      layout.includes('role === "owner"') &&
      layout.includes('role === "admin"') &&
      appShell.includes("IncompleteSetupNotice") &&
      appShell.includes('!pathname?.startsWith("/app/setup")') &&
      !frame.includes("IncompleteSetupNotice")
  );
  assert(
    "focused setup has no application navigation",
    surface.includes("Step {index + 1} of 6") &&
      !frame.includes("AccountMenu") &&
      !frame.includes("MobileNav") &&
      !frame.includes("AppSidebarNav") &&
      frame.includes("overflow-y-auto") &&
      frame.includes("safe-area-inset-bottom")
  );
  assert(
    "stale improve and four-stage setup UI is gone from the wizard",
    !shell.includes("Improve Quotr") &&
      !shell.includes("mode=improve") &&
      !shell.includes("Improve my rates") &&
      !shell.includes("First job") &&
      !ready.includes("mode=improve") &&
      !ready.includes("Improve Quotr")
  );
  assert(
    "signup confirmation still uses the request host",
    signup.includes("getAuthCallbackOrigin") &&
      read("components/auth/AuthShell.tsx").includes("min-h-dvh") &&
      read("lib/auth/errors.ts").includes(
        "This confirmation link is invalid or has expired."
      )
  );

  if (failed > 0) {
    console.error(`\n${failed} check(s) failed`);
    process.exitCode = 1;
    return;
  }
  console.log("\nUnified onboarding UI verification passed");
}

main();
