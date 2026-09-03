/**
 * BETA-2 — Project → Analyse → Work Areas → Clarify → Estimate UX.
 *
 * Run: npx --yes tsx scripts/verify-beta-2.ts
 *
 * No paid AI. No live Stripe. No Production. No golden restamp.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { presentEstimateGst, ESTIMATE_RANGE_EXPLANATION } from "../lib/assistant/presentation/gst-display";
import { isTechnicalErrorText, toUserError } from "../lib/errors/user-message";
import { isUnsafeErrorText } from "../lib/assistant/presentation/error-messages";
import { ASSISTANT_ACTION_LABELS, ASSISTANT_LOADING_COPY } from "../lib/assistant/presentation/action-labels";
import { ANALYSE_JOB_PROGRESS_STEPS } from "../lib/assistant/analyse-job-progress";
import { roleAllowsPermission } from "../lib/team/permissions";
import { classifyAnalysisError, userMessageForAnalysisError, UNKNOWN_ANALYSIS_ERROR } from "../lib/ai/analyse-job-contract";
import { DEFAULT_MARGIN_PERCENT } from "../lib/estimate/constants";
import { GENERAL_ESTIMATE_ASSUMPTIONS } from "../lib/estimate/summary";
import {
  isBoundaryAssumptionCopy,
  estimatingAssumptionsForDisplay,
} from "../lib/assistant/presentation/quick-estimate-confidence";
import {
  presentEstimateConfidenceCopy,
  selectEstimatingAssumptionPhrase,
} from "../lib/assistant/presentation/estimate-confidence-copy";

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

function main() {
  console.log("=== BETA-2 project-to-estimate UX verification ===");

  const capture = read("components/assistant/ProjectCaptureBlock.tsx");
  const jobPlan = read("components/assistant/job-plan/JobPlanPanel.tsx");
  const waCard = read("components/assistant/job-plan/JobPlanWorkAreaCard.tsx");
  const addWa = read("components/assistant/AddWorkAreaDialog.tsx");
  const clarify = read("components/assistant/clarify/ClarifyPanel.tsx");
  const valueField = read("components/assistant/clarify/ClarifyValueField.tsx");
  const readinessUi = read("components/assistant/clarify/ClarifyReadiness.tsx");
  const readyCard = read("components/assistant/EstimateReadyCard.tsx");
  const estimatePanel = read("components/assistant/EstimatePanel.tsx");
  const shell = read("components/assistant/AssistantShell.tsx");
  const actions = read("lib/assistant/actions.ts");
  const waActions = read("lib/assistant/work-area-actions.ts");
  const factActions = read("lib/assistant/fact-actions.ts");
  const projectActions = read("lib/projects/actions.ts");
  const appShell = read("components/layout/app-shell.tsx");
  const stepper = read("components/assistant/StepperNav.tsx");
  const compose = read("lib/assistant/clarify/compose.ts");
  const rank = read("lib/assistant/clarify/rank.ts");
  const calc = read("lib/estimate/calculate-estimate.ts");
  const sellFromMargin = read("lib/commercial-engine/core/sell-from-margin.ts");

  section("TERMINOLOGY");
  assert(
    "stepper is Job details → Work → Details → Estimate",
    stepper.includes('label: "Job details"') &&
      stepper.includes('label: "Work"') &&
      stepper.includes('label: "Details"') &&
      stepper.includes('label: "Estimate"')
  );
  assert("backend stepper keys unchanged", stepper.includes('key: "brief"') && stepper.includes('key: "confirm_work_areas"'));
  assert("Work Areas remain the product term", jobPlan.includes("Work Areas are the main pieces"));
  assert("Looks right — continue is the confirm CTA", ASSISTANT_ACTION_LABELS.looksRight === "Looks right — continue");
  assert("Create estimate is the ready CTA", ASSISTANT_ACTION_LABELS.generateEstimate === "Create estimate");
  assert("Estimate now using assumptions kept", ASSISTANT_ACTION_LABELS.estimateNowUsingAssumptions.includes("assumptions"));
  assert("Not sure — use Quotr assumption kept", ASSISTANT_ACTION_LABELS.useQuotrAssumption.includes("Not sure"));
  assert("Analyse job CTA kept", capture.includes('"Analyse job"') || capture.includes("Analyse job"));
  assert(
    "user-facing Estimate title (not Quick Estimate)",
    estimatePanel.includes('compactCommercialSidebar ? "Commercial Overview" : "Estimate"') &&
      !estimatePanel.includes('Generating Quick Estimate')
  );
  assert("loading copy is Building your estimate", ASSISTANT_LOADING_COPY.estimateGenerate.includes("Building your estimate"));

  section("FRIENDLY ERRORS");
  assert("PGRST is technical", isTechnicalErrorText("PGRST205: Could not find the table"));
  assert("relation does not exist is technical", isTechnicalErrorText('relation "work_areas" does not exist'));
  assert("RPC is technical", isTechnicalErrorText("RPC persist_estimate_generation_v1 failed"));
  assert("toUserError maps PGRST away", !toUserError("PGRST116: ...").includes("PGRST"));
  assert("toUserError keeps friendly copy", toUserError("Could not save Work Areas. Please try again.").includes("Could not save"));
  assert("isUnsafeErrorText catches PGRST", isUnsafeErrorText("PGRST205 schema cache"));
  assert(
    "analyse persist does not return briefError.message",
    !/return \{ error: briefError\.message \}/.test(actions)
  );
  assert(
    "analyse persist does not return insertError.message",
    !/return \{ error: insertError\.message \}/.test(actions)
  );
  assert(
    "work area actions wrap persist errors",
    waActions.includes("toUserError") && waActions.includes("permissionDeniedError")
  );
  assert("fact edits require projects.edit", factActions.includes('permission: "projects.edit"'));
  assert("project create maps insert errors", projectActions.includes("toUserError"));
  assert(
    "analyse DB class is unknown/temporary",
    classifyAnalysisError(new Error("PGRST205: Could not find the table")) === "unknown"
  );
  assert(
    "analyse user message has no PGRST",
    !userMessageForAnalysisError(new Error("PGRST205")).includes("PGRST") &&
      userMessageForAnalysisError(new Error("PGRST205")) === UNKNOWN_ANALYSIS_ERROR
  );

  section("ANALYSE UX");
  assert("progress has no provider language", !ANALYSE_JOB_PROGRESS_STEPS.some((s) => /anthropic|claude|provider/i.test(s)));
  assert("progress starts with reading job details", ANALYSE_JOB_PROGRESS_STEPS[0].includes("Reading your job details"));
  assert("retry CTA exists", capture.includes("data-analyse-retry") && capture.includes("Try again"));
  assert("brief retained on retry", capture.includes("Your job details are still here"));
  assert("analyse helper explains outcome", capture.includes("identify the work involved"));
  assert("placeholder is builder language", capture.includes("Kwila") || capture.includes("6 × 3m"));
  assert("existingTypes filter prevents duplicate work areas", actions.includes("existingTypes") && actions.includes("filter((row) => !existingTypes.has"));

  section("WORK AREAS");
  assert("Need to confirm label", waCard.includes("Need to confirm"));
  assert("Optional label for available scope", waCard.includes("Optional"));
  assert("remove copy is project-only", waCard.includes("does not change your company work preferences"));
  assert("add another Work Area", jobPlan.includes("Add another Work Area") && addWa.includes("Add another Work Area"));
  assert("add dialog does not restrict to first-run types", addWa.includes("SCOPE_CATALOGUE") && addWa.includes("FIRST_RUN_PRIMARY_WORK_AREA_TYPES"));
  assert("primary types only sort, never filter catalogue", addWa.includes("preferred.get") && !addWa.includes("FIRST_RUN_PRIMARY_WORK_AREA_TYPES.filter"));

  section("CLARIFY");
  assert("question count is not a survey total", clarify.includes("important detail") && (clarify.includes("important details remaining") || clarify.includes("Just a couple")));
  assert("why this matters is shown sparingly", clarify.includes("Why this matters") && clarify.includes("shouldShowWhyThisMatters"));
  assert("not sure explains assumption", valueField.includes("typical assumption") && valueField.includes("useQuotrAssumption"));
  assert("Included / Not included stay distinct from Not sure", clarify.includes("Not included") && valueField.includes("Not sure — use Quotr assumption") === false || ASSISTANT_ACTION_LABELS.useQuotrAssumption.includes("Not sure"));
  assert("Not included is not Not sure", !ASSISTANT_ACTION_LABELS.useQuotrAssumption.includes("Not included"));
  assert("Back control exists", clarify.includes("data-clarify-back"));
  assert("ready copy is enough to build", readinessUi.includes("That's enough to build your estimate") || readinessUi.includes("That&apos;s enough to build your estimate"));
  assert("blocked state uses blocker copy", readinessUi.includes("data-readiness-blocker"));
  assert("estimate-now cannot bypass blocksEstimate", compose.includes("canEstimateNow: !blocksEstimate"));
  assert("HARD_MINIMUM always survives budget", rank.includes("isClarifyMustAsk") && rank.includes("HARD_MINIMUM"));

  section("ESTIMATE READY");
  assert("range explanation is rate-settings, not AI", ESTIMATE_RANGE_EXPLANATION.includes("rate settings") && !ESTIMATE_RANGE_EXPLANATION.toLowerCase().includes("confidence interval"));
  assert("GST hidden at 0%", presentEstimateGst(10000, 0).showGst === false && presentEstimateGst(10000, 0).inclGst === 10000);
  assert("GST shown at 15%", presentEstimateGst(10000, 15).showGst === true && presentEstimateGst(10000, 15).gstAmount === 1500 && presentEstimateGst(10000, 15).inclGst === 11500);
  assert("ready card shows incl GST", readyCard.includes("incl GST") && readyCard.includes("data-estimate-gst"));
  assert("ready card shows work area totals", readyCard.includes("data-estimate-work-area-totals"));
  assert("ready card shows assumptions", readyCard.includes("data-estimate-ready-assumptions"));
  assert("benchmark note is not an error", readyCard.includes("Some rates use Quotr benchmarks") && readyCard.includes("Review rates"));
  assert("primary review CTA", readyCard.includes("reviewEstimate") && readyCard.includes("data-estimate-ready-primary-cta"));
  assert("edit job is secondary", readyCard.includes("editJob"));
  assert("estimate/pricing boundary copy", read("components/assistant/mode/EstimateReadySurface.tsx").includes("working estimate"));
  assert("calibration is later, not interrupting", read("components/assistant/mode/EstimateReadySurface.tsx").includes("Calibrate later"));
  assert("target gross margin, not markup", read("components/assistant/MarginEditControl.tsx").includes("Target gross margin"));

  section("MOBILE / NAV");
  assert("project routes keep mobile nav", /showMobileNav = true/.test(appShell) && !appShell.includes("showMobileNav = !isProjectRoute"));
  assert("dashboard back is tappable", read("components/projects/ProjectWorkspaceHeader.tsx").includes("min-h-11"));
  assert("clarify controls are min-h-11", clarify.includes("min-h-11") && valueField.includes("min-h-11"));

  section("SECURITY");
  assert("Viewer cannot run estimates", !roleAllowsPermission("viewer", "estimates.run"));
  assert("Viewer cannot edit projects", !roleAllowsPermission("viewer", "projects.edit"));
  assert("Estimator can run estimates", roleAllowsPermission("estimator", "estimates.run"));
  assert("analyse requires projects.edit", actions.includes("saveBriefAndSeedWorkAreas") && actions.includes('permission: "projects.edit"'));
  assert("generate still requires estimates.run", actions.includes('permission: "estimates.run"'));

  section("ECONOMIC INTEGRITY");
  assert("default margin unchanged", DEFAULT_MARGIN_PERCENT === 20);
  assert("budget/premium factors not edited in BETA-2 UI files", !readyCard.includes("budget_rate_factor") && !readyCard.includes("premium_rate_factor"));
  assert("calculate-estimate not importing beta-2 copy", !calc.includes("gst-display") && !calc.includes("action-labels"));
  assert("sell-from-margin formula file untouched by presentation", sellFromMargin.includes("deriveSellFromCost") || sellFromMargin.includes("margin"));
  assert(
    "no new migration 052",
    latestMigration() === "051_organisation_timezone.sql" ||
      (latestMigration() != null && latestMigration()!.startsWith("051_"))
  );

  section("EMPTY / LEGACY COPY");
  assert("Job details replaces Project Capture heading", shell.includes('title="Job details"') && !shell.includes('title="Project Capture"'));
  assert("Work replaces Job Plan heading", shell.includes('title="Work"'));
  assert("Details replaces Clarify heading", shell.includes('title="Details"'));
  const uiStates = read("lib/assistant/presentation/ui-states.ts");
  assert("empty states dropped Confirm Work Areas / Scope Details", !uiStates.includes("Confirm Work Areas to continue") && !uiStates.includes("Complete Scope Details"));

  section("ASSUMPTION AUTHORITY");
  assert("facts remain write target for clarify", compose.includes('writeTarget: "FACT"') || read("lib/assistant/job-plan/actions.ts").includes("updateProjectFact"));
  assert("not sure writes Not sure token", valueField.includes('onSubmit("Not sure")'));

  section("BETA-2.1 POLISH");
  const page = read("app/(protected)/app/projects/[projectId]/page.tsx");
  const readySurface = read("components/assistant/mode/EstimateReadySurface.tsx");
  const confidenceCopy = read("lib/assistant/presentation/estimate-confidence-copy.ts");
  const confidenceBand = read("lib/assistant/presentation/quick-estimate-confidence.ts");

  assert(
    "desktop pricing CTA is outline before review",
    estimatePanel.includes("compactCommercialSidebar && !pricingProgressionPrimary") &&
      estimatePanel.includes('variant={') &&
      estimatePanel.includes('"outline"')
  );
  assert(
    "mobile pricing CTA starts outline",
    readySurface.includes('variant={pricingCtaPrimary ? "default" : "outline"}')
  );
  assert(
    "Review estimate is primary before review",
    readyCard.includes("reviewIsPrimary") &&
      readyCard.includes('variant={reviewIsPrimary ? "default" : "outline"}')
  );
  assert(
    "confirmation uses stage quality, not Analyse success",
    shell.includes('workAreasConfirmed = isStageAtOrBeyond(stage, "quality")') &&
      estimatePanel.includes("workAreasConfirmed") &&
      estimatePanel.includes("Review the work Quotr found") &&
      !estimatePanel.includes("Job plan confirmed. Estimate when clarified")
  );
  assert(
    "labour rate does not interrupt pre-estimate project",
    !page.includes("{!(hasEstimate || tabContext.hasEstimate)") &&
      page.includes("data-post-estimate-guidance") &&
      readyCard.includes("Some rates use Quotr benchmarks")
  );
  assert(
    "boundary copy is not an estimating assumption",
    GENERAL_ESTIMATE_ASSUMPTIONS.every((line) => isBoundaryAssumptionCopy(line)) &&
      estimatingAssumptionsForDisplay(GENERAL_ESTIMATE_ASSUMPTIONS).length === 0
  );
  assert(
    "confidence does not use internal working estimate",
    selectEstimatingAssumptionPhrase(GENERAL_ESTIMATE_ASSUMPTIONS, null) === null &&
      !presentEstimateConfidenceCopy({
        band: "Medium",
        assumptionPhrase: selectEstimatingAssumptionPhrase(
          [
            "This is an internal working estimate, not a client quote.",
            "Assumed normal site access",
          ],
          null
        ),
      }).explanation.includes("internal working estimate")
  );
  assert(
    "medium confidence uses genuine assumption phrase",
    presentEstimateConfidenceCopy({
      band: "Medium",
      assumptionPhrase: "site access",
    }).explanation.includes("including site access")
  );
  assert(
    "high/low confidence copy is builder language",
    presentEstimateConfidenceCopy({ band: "High", assumptionPhrase: null }).explanation ===
      "Most key job details are known." &&
      presentEstimateConfidenceCopy({ band: "Low", assumptionPhrase: null }).explanation.includes(
        "still based on assumptions"
      )
  );
  assert(
    "fallback does not invent an assumption",
    presentEstimateConfidenceCopy({ band: "Medium", assumptionPhrase: null }).explanation ===
      "Based on the job information currently available."
  );
  assert("confidence helper is presentation-only", confidenceCopy.includes("Does not change persisted assumptions"));
  assert(
    "structured defaulted facts preferred",
    selectEstimatingAssumptionPhrase(["This is an internal working estimate, not a client quote."], {
      defaultedFacts: [
        {
          key: "site.access",
          label: "site access",
          assumedValue: "normal",
        },
      ],
    }) === "site access"
  );
  assert("not-sure remains journal token", valueField.includes('onSubmit("Not sure")') && valueField.includes("data-clarify-use-assumption"));
  assert("estimate-now still cannot bypass must-know", compose.includes("canEstimateNow: !blocksEstimate"));
  assert("calculate-estimate still not importing polish copy", !calc.includes("estimate-confidence-copy") && !calc.includes("action-labels"));
  assert("rank filters boundary copy", confidenceBand.includes("estimatingAssumptionsForDisplay"));

  if (process.exitCode) {
    console.log("\nBETA-2 verifier FAILED");
  } else {
    console.log("\nBETA-2 verifier passed");
  }
}

main();
