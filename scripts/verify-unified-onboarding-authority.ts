/**
 * Unified onboarding authority — phase 1.
 * Resume stages, canonical completion, GST, labour choices, and role routing.
 *
 * Run: npx --yes tsx scripts/verify-unified-onboarding-authority.ts
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  isMarketingConsentSource,
  marketingConsentSourceError,
} from "../lib/communications/marketing-consent-source";
import {
  FIRST_RUN_ADDRESS_PATH,
  FIRST_RUN_BASICS_PATH,
  FIRST_RUN_LABOUR_PATH,
  FIRST_RUN_READY_PATH,
  FIRST_RUN_TAX_PATH,
  FIRST_RUN_WORK_PATH,
  firstRunForcedPath,
  resolveFirstRunStage,
  resolveProtectedOnboardingAccess,
  setupModeRedirect,
  setupShellMode,
} from "../lib/setup/first-run-stage";
import {
  assessRequiredOnboarding,
  backfillGstRegistered,
  backfillLabourChoice,
  canonicalCompletionBackfill,
  classifyOnboardingFields,
  deriveIncompleteSetup,
  gstRegistrationPersistence,
  resolveLabourOnboardingWrite,
  type OnboardingAuthoritySnapshot,
} from "../lib/setup/onboarding-authority";
import type { MembershipRole } from "../lib/team/roles";

let failed = 0;

function assert(name: string, condition: boolean): void {
  if (condition) {
    console.log(`  ok  ${name}`);
    return;
  }
  failed += 1;
  console.error(`  FAIL  ${name}`);
}

function snapshot(
  overrides: Partial<OnboardingAuthoritySnapshot> = {}
): OnboardingAuthoritySnapshot {
  return {
    tradingName: "Build Co",
    country: "NZ",
    addressLine1: "1 Main Street",
    city: "Auckland",
    postcode: "1010",
    gstRegistered: true,
    gstNumber: "123456789",
    abn: null,
    nzbn: "9429000000000",
    defaultGstRate: 15,
    hasPrimaryWorkAreas: true,
    carpenterChoice: "company",
    carpenterHasPositiveCost: true,
    labourerChoice: "company",
    labourerHasPositiveCost: true,
    marginPercent: 20,
    ...overrides,
  };
}

function stageFor(overrides: Partial<OnboardingAuthoritySnapshot>) {
  return resolveFirstRunStage({
    onboardingStatus: "in_progress",
    onboardingStep: "company",
    authority: snapshot(overrides),
  });
}

function main(): void {
  console.log("=== Unified onboarding authority ===\n");

  assert("resume basics", stageFor({ tradingName: "  " }) === "basics");
  assert("resume address", stageFor({ addressLine1: "" }) === "address");
  assert("resume tax", stageFor({ gstRegistered: null }) === "tax");
  assert("resume work", stageFor({ hasPrimaryWorkAreas: false }) === "work");
  assert("resume labour for carpenter", stageFor({ carpenterChoice: null }) === "labour");
  assert("resume labour for labourer", stageFor({ labourerChoice: null }) === "labour");
  assert("resume ready", stageFor({}) === "ready");
  assert(
    "six forced paths",
    firstRunForcedPath("basics") === FIRST_RUN_BASICS_PATH &&
      firstRunForcedPath("address") === FIRST_RUN_ADDRESS_PATH &&
      firstRunForcedPath("tax") === FIRST_RUN_TAX_PATH &&
      firstRunForcedPath("work") === FIRST_RUN_WORK_PATH &&
      firstRunForcedPath("labour") === FIRST_RUN_LABOUR_PATH &&
      firstRunForcedPath("ready") === FIRST_RUN_READY_PATH
  );
  assert(
    "address and tax open their own screens",
    setupShellMode("address", "address") === "address" &&
      setupShellMode("tax", "tax") === "tax" &&
      setupShellMode("basics", "tax") === "basics" &&
      setupModeRedirect("ready", "tax") === FIRST_RUN_TAX_PATH
  );

  const rates = canonicalCompletionBackfill("in_progress", "rates");
  const review = canonicalCompletionBackfill("in_progress", "review");
  const already = canonicalCompletionBackfill("completed", "completed");
  const active = canonicalCompletionBackfill("in_progress", "labour");
  assert(
    "grandfather rates and review become completed",
    rates.changed &&
      rates.onboardingStatus === "completed" &&
      rates.onboardingStep === "completed" &&
      review.changed &&
      review.onboardingStep === "completed"
  );
  assert("already canonical completion is unchanged", !already.changed);
  assert("an in-progress labour step is not grandfathered", !active.changed);

  assert(
    "completed organisation is never re-gated",
    resolveFirstRunStage({
      onboardingStatus: "completed",
      onboardingStep: "company",
      hasPrimaryWorkAreas: false,
      authority: snapshot({
        gstRegistered: null,
        hasPrimaryWorkAreas: false,
        carpenterChoice: null,
        labourerChoice: null,
      }),
    }) === "done"
  );
  assert(
    "clearing work types after completion does not re-gate",
    resolveFirstRunStage({
      onboardingStatus: "completed",
      onboardingStep: "completed",
      authority: snapshot({ hasPrimaryWorkAreas: false }),
    }) === "done" &&
      classifyOnboardingFields(snapshot({ hasPrimaryWorkAreas: false })).work ===
        "missing" &&
      deriveIncompleteSetup(snapshot({ hasPrimaryWorkAreas: false }))
  );
  assert(
    "new rates and review steps are not completion",
    resolveFirstRunStage({
      onboardingStatus: "in_progress",
      onboardingStep: "rates",
    }) !== "done" &&
      resolveFirstRunStage({
        onboardingStatus: "in_progress",
        onboardingStep: "review",
      }) !== "done"
  );

  const gstTrue = backfillGstRegistered({
    onboardingStatus: "in_progress",
    onboardingStep: "company",
    gstNumber: "123-456-789",
    abn: null,
    defaultGstRate: 15,
  });
  const abnTrue = backfillGstRegistered({
    onboardingStatus: "not_started",
    onboardingStep: "company",
    gstNumber: null,
    abn: "51 824 753 556",
    defaultGstRate: 10,
  });
  const nzbnIgnored = backfillGstRegistered({
    onboardingStatus: "completed",
    onboardingStep: "completed",
    gstNumber: null,
    abn: null,
    defaultGstRate: 15,
  });
  const gstFalse = backfillGstRegistered({
    ...canonicalCompletionBackfill("in_progress", "rates"),
    gstNumber: null,
    abn: null,
    defaultGstRate: 0,
  });
  const unknownZero = backfillGstRegistered({
    onboardingStatus: "in_progress",
    onboardingStep: "labour",
    gstNumber: null,
    abn: null,
    defaultGstRate: 0,
  });
  const junk = backfillGstRegistered({
    onboardingStatus: "completed",
    onboardingStep: "completed",
    gstNumber: "abc",
    abn: null,
    defaultGstRate: 0,
  });
  assert("GST true from a GST number or ABN", gstTrue === true && abnTrue === true);
  assert("NZBN and a default 15% rate do not become GST true", nzbnIgnored === null);
  assert("completed rate 0 with no identifier is GST false", gstFalse === false);
  assert("zero GST on an unfinished organisation stays unknown", unknownZero === null);
  assert("a junk identifier stays unknown", junk === null);
  assert(
    "stored false at rate 0 is satisfied and null at rate 0 is missing",
    classifyOnboardingFields(
      snapshot({ gstRegistered: false, gstNumber: null, abn: null, defaultGstRate: 0 })
    ).gst === "satisfied" &&
      classifyOnboardingFields(
        snapshot({ gstRegistered: null, gstNumber: null, abn: null, defaultGstRate: 0 })
      ).gst === "missing"
  );

  const cleared = gstRegistrationPersistence({
    registered: false,
    countryCode: "NZ",
    gstNumber: "123456789",
    abn: "51824753556",
    suggestedRate: 15,
  });
  assert(
    "not registered sets rate 0 and clears GST number and ABN",
    cleared.gst_registered === false &&
      cleared.default_gst_rate === 0 &&
      cleared.gst_number === null &&
      cleared.abn === null &&
      !("nzbn" in cleared)
  );
  const kept = gstRegistrationPersistence({
    registered: true,
    countryCode: "AU",
    gstNumber: "123456789",
    abn: "51824753556",
    suggestedRate: 10,
  });
  assert(
    "registered Australia keeps the ABN and clears the GST number",
    kept.gst_registered === true &&
      kept.abn === "51824753556" &&
      kept.gst_number === null &&
      kept.default_gst_rate === 10
  );

  const carpenterBenchmark = resolveLabourOnboardingWrite({
    choice: "quotr_benchmark",
    cost: 85,
    label: "carpenter",
  });
  const labourerCompany = resolveLabourOnboardingWrite({
    choice: "company",
    cost: 46,
    label: "labourer",
  });
  const impliedCompany = resolveLabourOnboardingWrite({
    cost: 82,
    label: "carpenter",
  });
  const unanswered = resolveLabourOnboardingWrite({ label: "labourer" });
  assert(
    "benchmark does not write a rate",
    carpenterBenchmark.ok && carpenterBenchmark.writeRate === false
  );
  assert(
    "company labour writes the supplied cost",
    labourerCompany.ok &&
      labourerCompany.writeRate === true &&
      labourerCompany.costRate === 46 &&
      impliedCompany.ok &&
      impliedCompany.choice === "company" &&
      impliedCompany.writeRate === true
  );
  assert("an unanswered labour role is rejected", !unanswered.ok);
  assert(
    "backfill uses a real cost as company and never invents a benchmark",
    backfillLabourChoice({
      existingChoice: null,
      hasPositiveCompanyCost: true,
    }) === "company" &&
      backfillLabourChoice({
        existingChoice: null,
        hasPositiveCompanyCost: false,
      }) === null
  );
  assert(
    "both answers can be company or benchmark",
    assessRequiredOnboarding(
      snapshot({
        carpenterChoice: "company",
        carpenterHasPositiveCost: true,
        labourerChoice: "quotr_benchmark",
        labourerHasPositiveCost: false,
      })
    ).readyToComplete &&
      assessRequiredOnboarding(
        snapshot({
          carpenterChoice: "quotr_benchmark",
          carpenterHasPositiveCost: false,
          labourerChoice: "company",
          labourerHasPositiveCost: true,
        })
      ).readyToComplete
  );

  const roles: MembershipRole[] = ["admin", "estimator", "viewer"];
  for (const role of roles) {
    const entered = resolveProtectedOnboardingAccess({
      stage: "basics",
      role,
      pathname: "/app/dashboard",
    });
    assert(
      `${role} enters the app without company setup`,
      entered.redirectTo === null && entered.lockNavigation === false
    );
  }
  assert(
    "owner is forced through unfinished setup",
    resolveProtectedOnboardingAccess({
      stage: "address",
      role: "owner",
      pathname: "/app/dashboard",
    }).redirectTo === FIRST_RUN_ADDRESS_PATH
  );
  assert(
    "admin may open setup and is not trapped",
    resolveProtectedOnboardingAccess({
      stage: "labour",
      role: "admin",
      pathname: "/app/setup",
    }).redirectTo === null &&
      resolveProtectedOnboardingAccess({
        stage: "labour",
        role: "admin",
        pathname: "/app/projects",
      }).redirectTo === null
  );
  assert(
    "estimator and viewer are not sent into the company form",
    resolveProtectedOnboardingAccess({
      stage: "basics",
      role: "estimator",
      pathname: "/app/setup",
    }).redirectTo === "/app/dashboard" &&
      resolveProtectedOnboardingAccess({
        stage: "tax",
        role: "viewer",
        pathname: "/app/setup",
      }).redirectTo === "/app/dashboard"
  );
  assert(
    "a completed organisation is not redirected for any role",
    (["owner", "admin", "estimator", "viewer"] as const).every(
      (role) =>
        resolveProtectedOnboardingAccess({
          stage: "done",
          role,
          pathname: "/app/dashboard",
        }).redirectTo === null
    )
  );

  const ready = assessRequiredOnboarding(snapshot());
  assert(
    "marketing consent is optional",
    ready.marketingConsentRequired === false &&
      ready.readyToComplete &&
      isMarketingConsentSource("onboarding") &&
      isMarketingConsentSource("signup") &&
      isMarketingConsentSource("settings") &&
      marketingConsentSourceError("promo") != null
  );

  const sql = readFileSync(
    join(process.cwd(), "supabase/migrations/081_unified_onboarding_authority.sql"),
    "utf8"
  );
  const completionAt = sql.indexOf("onboarding_status = 'completed'");
  const gstAt = sql.indexOf("set gst_registered = case");
  assert(
    "migration canonicalises completion before the GST backfill",
    completionAt > -1 && gstAt > completionAt
  );
  assert(
    "migration does not insert a labour rate or assign a benchmark answer",
    !/insert\s+into\s+(public\.)?rates/i.test(sql) &&
      !sql.includes("carpenter_onboarding_choice = 'quotr_benchmark'") &&
      !sql.includes("labourer_onboarding_choice = 'quotr_benchmark'") &&
      sql.includes("carpenter_onboarding_choice = 'company'") &&
      sql.includes("labourer_onboarding_choice = 'company'")
  );
  assert(
    "migration allows the onboarding consent source and ignores NZBN",
    sql.includes("'onboarding'") &&
      sql.includes("p_source is distinct from 'onboarding'") &&
      !/nzbn/i.test(sql.split("set gst_registered = case")[1]?.split("where gst_registered is null")[0] ?? "nzbn")
  );
  const actions = readFileSync(join(process.cwd(), "lib/setup/actions.ts"), "utf8");
  assert(
    "legacy rates and review steps are no longer written",
    !actions.includes('onboarding_step: "rates"') &&
      !actions.includes('onboarding_step: "review"') &&
      actions.includes("return completeRequiredOnboarding()")
  );

  if (failed > 0) {
    console.error(`\n${failed} failed`);
    process.exitCode = 1;
    return;
  }
  console.log("\nUnified onboarding authority passed");
}

main();
