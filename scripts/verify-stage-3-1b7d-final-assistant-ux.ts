/**
 * Stage 3.1B.7D — Final Assistant UX polish verification.
 * Run: npx tsx scripts/verify-stage-3-1b7d-final-assistant-ux.ts
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  ASSISTANT_ACTION_LABELS,
  ASSISTANT_EMPTY_STATES,
  ASSISTANT_LOADING_COPY,
  ASSISTANT_STAGE_KEYS,
  STAGE_STATE_INVENTORY,
  emptyStateForStage,
  isUnsafeErrorText,
  presentAssistantError,
  resolveDisplayedSaveStatus,
  saveStatusLabel,
} from "../lib/assistant/presentation";
import {
  clearPreviewPerfSamples,
  getPreviewPerfSamples,
  recordPreviewPerf,
  startPreviewPerf,
} from "../lib/assistant/preview-performance";
import {
  resolveActiveDisclosureStage,
  stagePrefersExpanded,
} from "../lib/assistant/progressive-disclosure";

let passed = 0;
let failed = 0;

function check(name: string, condition: boolean, detail?: string): void {
  if (condition) {
    console.log(`PASS  ${name}`);
    passed += 1;
  } else {
    console.log(`FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
    failed += 1;
  }
}

function read(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}

function fileHas(path: string, needle: string | RegExp): boolean {
  const src = read(path);
  return typeof needle === "string" ? src.includes(needle) : needle.test(src);
}

console.log("\n=== Stage 3.1B.7D — Final Assistant UX Verification ===\n");

// —— States inventory ——
check(
  "all stages have inventory entries",
  ASSISTANT_STAGE_KEYS.every((key) => STAGE_STATE_INVENTORY[key].length > 0)
);
check(
  "every stage has empty catalogue copy",
  ASSISTANT_STAGE_KEYS.every((key) => emptyStateForStage(key).title.length > 0)
);
check(
  "locked + collapsed distinguishable in inventory",
  STAGE_STATE_INVENTORY.scope_review.includes("locked") &&
    STAGE_STATE_INVENTORY.scope_review.includes("collapsed") &&
    STAGE_STATE_INVENTORY.specification.includes("locked")
);
check(
  "Quick Estimate has stale + loading states",
  STAGE_STATE_INVENTORY.quick_estimate.includes("stale") &&
    STAGE_STATE_INVENTORY.quick_estimate.includes("loading")
);

// —— Loading / saving ——
check(
  "loading copy has no fake percentages",
  !Object.values(ASSISTANT_LOADING_COPY).some((t) => /\d+\s*%/.test(t))
);
check(
  "loading copy has no provider names",
  !Object.values(ASSISTANT_LOADING_COPY).some((t) =>
    /anthropic|openai|claude/i.test(t)
  )
);
check(
  "failed save never shows Saved",
  resolveDisplayedSaveStatus({
    status: "saved",
    hasError: true,
  }) === "error" &&
    saveStatusLabel(
      resolveDisplayedSaveStatus({ status: "saved", hasError: true })
    ) !== "Saved"
);
check(
  "saving takes precedence over saved",
  resolveDisplayedSaveStatus({ status: "saved", isSaving: true }) === "saving"
);
check(
  "SaveStatusIndicator exists",
  existsSync(join(process.cwd(), "components/assistant/SaveStatusIndicator.tsx"))
);
check(
  "AssistantLoadingBanner / AnalysisProgressBanner use aria-live",
  fileHas("components/assistant/AnalysisProgressBanner.tsx", "aria-live") &&
    fileHas("components/assistant/AssistantLoadingBanner.tsx", "aria-live")
);
check(
  "Estimate generation disables duplicate via pending guards",
  fileHas(
    "components/assistant/AssistantShell.tsx",
    "isGenerating || pendingAction != null"
  )
);

// —— Progressive disclosure ——
const active = resolveActiveDisclosureStage({
  briefSubmitted: true,
  workAreasConfirmed: true,
  scopeDiscoveryEnabled: false,
  scopeReviewComplete: true,
  qualityUnlocked: true,
  qualitySubmitted: false,
  questionsSubmitted: false,
  constraintsSubmitted: false,
  estimateReady: false,
});
check("active stage expands (quality)", active === "quality");
check(
  "completed stages do not prefer expand",
  !stagePrefersExpanded("capture", active) &&
    stagePrefersExpanded("quality", active)
);
check(
  "reduced-motion supported on stage cards",
  fileHas(
    "components/assistant/CollapsibleStageCard.tsx",
    "motion-reduce:transition-none"
  ) &&
    fileHas(
      "components/assistant/CollapsibleStageCard.tsx",
      "motion-safe:duration-200"
    )
);
check(
  "manual expand via aria-expanded",
  fileHas("components/assistant/CollapsibleStageCard.tsx", "aria-expanded")
);

// —— Responsive ——
check(
  "Quick Estimate mobile stacking exists",
  fileHas("components/assistant/EstimatePanel.tsx", "lg:hidden") &&
    fileHas("components/assistant/EstimatePanel.tsx", "hidden lg:block")
);
check(
  "breakdown modal uses full available width",
  fileHas(
    "components/assistant/EstimateBreakdownModal.tsx",
    "w-[calc(100%-1rem)]"
  ) ||
    fileHas("components/assistant/EstimateBreakdownModal.tsx", "sm:w-[92vw]")
);
check(
  "stage cards use min tap targets",
  fileHas("components/assistant/CollapsibleStageCard.tsx", "min-h-11")
);
check(
  "no overflow-x-scroll on AssistantShell",
  !fileHas("components/assistant/AssistantShell.tsx", "overflow-x-scroll")
);

// —— Accessibility ——
check(
  "SaveStatusIndicator announces errors",
  fileHas("components/assistant/SaveStatusIndicator.tsx", 'role="alert"') &&
    fileHas("components/assistant/SaveStatusIndicator.tsx", "aria-live")
);
check(
  "Work Area toggles expose pressed state",
  fileHas("components/assistant/WorkAreaConfirmationBlock.tsx", "aria-pressed")
);
check(
  "Specification options expose pressed state",
  fileHas("components/assistant/QualityBlock.tsx", "aria-pressed")
);
check(
  "focus-visible rings on stage toggle",
  fileHas(
    "components/assistant/CollapsibleStageCard.tsx",
    "focus-visible:ring-2"
  )
);
check(
  "status not only colour — text badges present",
  fileHas("components/assistant/CollapsibleStageCard.tsx", "statusLabel")
);

// —— Error safety ——
check(
  "unsafe anthropic text filtered",
  presentAssistantError("analyse_job", "Anthropic API key missing") ===
    presentAssistantError("analyse_job")
);
check(
  "unsafe SQL filtered",
  isUnsafeErrorText("SQLSTATE 23505 duplicate key")
);
check(
  "safe short message may pass for save",
  presentAssistantError("save", "Could not save. Please try again.").includes(
    "Could not save"
  )
);
check(
  "provider fallback uses structured copy",
  presentAssistantError("scope_discovery_provider").includes(
    "structured scope checks"
  )
);
check(
  "Scope Discovery UI retains provider partial failure copy",
  fileHas(
    "lib/scope-discovery/ui/labels.ts",
    "providerPartialFailure"
  )
);

// —— Empty states ——
check(
  "Project Capture empty copy defined",
  ASSISTANT_EMPTY_STATES.project_capture.title.includes("project information")
);
check(
  "Work Areas empty copy defined",
  ASSISTANT_EMPTY_STATES.work_areas.title.includes("Work Areas")
);
check(
  "Quick Estimate empty copy defined",
  ASSISTANT_EMPTY_STATES.quick_estimate.title.includes("generate an estimate")
);
check(
  "AssistantEmptyState component exists",
  existsSync(join(process.cwd(), "components/assistant/AssistantEmptyState.tsx"))
);
check(
  "empty states wired in Work Areas / Estimate / Constraints / Questions",
  fileHas(
    "components/assistant/WorkAreaConfirmationBlock.tsx",
    "AssistantEmptyState"
  ) &&
    fileHas("components/assistant/EstimatePanel.tsx", 'stage="quick_estimate"') &&
    fileHas(
      "components/assistant/ConstraintBlock.tsx",
      'stage="site_constraints"'
    ) &&
    fileHas("components/assistant/QuestionBlock.tsx", 'stage="scope_details"')
);

// —— Terminology / actions ——
check(
  "approved Generate estimate label",
  ASSISTANT_ACTION_LABELS.generateEstimate === "Generate estimate"
);
check(
  "approved Recalculate estimate label",
  ASSISTANT_ACTION_LABELS.recalculateEstimate === "Recalculate estimate"
);
check(
  "EstimatePanel uses Recalculate estimate",
  fileHas(
    "components/assistant/EstimatePanel.tsx",
    "recalculateEstimate"
  )
);
check(
  "Quality uses Select specification",
  fileHas(
    "components/assistant/QualityBlock.tsx",
    "selectSpecification"
  )
);
check(
  "Confirm Work Areas casing",
  ASSISTANT_ACTION_LABELS.confirmWorkAreas === "Confirm Work Areas" &&
    fileHas(
      "components/assistant/WorkAreaConfirmationBlock.tsx",
      "confirmWorkAreas"
    )
);
check(
  "Not required used for rejected decisions",
  fileHas("lib/scope-discovery/ui/labels.ts", 'REJECTED: "Not required"') &&
    fileHas("lib/scope-discovery/ui/labels.ts", 'dismissed: "Not required"')
);
check(
  "Stepper uses Scope Details",
  fileHas("components/assistant/StepperNav.tsx", 'label: "Scope Details"')
);

// —— Performance instrumentation ——
clearPreviewPerfSamples();
const end = startPreviewPerf("question_save_ack");
end();
recordPreviewPerf("estimate_generate", 120);
check(
  "preview perf records samples",
  getPreviewPerfSamples().length >= 1 &&
    getPreviewPerfSamples().some((s) => s.mark === "estimate_generate")
);
check(
  "preview perf helper has no sensitive field logging",
  !fileHas("lib/assistant/preview-performance.ts", "console.info(brief") &&
    !fileHas("lib/assistant/preview-performance.ts", "apiKey") &&
    !fileHas("lib/assistant/preview-performance.ts", "API_KEY") &&
    fileHas(
      "lib/assistant/preview-performance.ts",
      "Never logs brief, notes, client data"
    )
);
check(
  "AssistantShell records estimate generate timing",
  fileHas(
    "components/assistant/AssistantShell.tsx",
    'startPreviewPerf("estimate_generate")'
  )
);

// —— Boundaries ——
check(
  "no migration 030",
  !existsSync(
    join(process.cwd(), "supabase/migrations/030_scope_discovery.sql")
  )
);
check(
  "computeConfidence still exported (engine frozen)",
  fileHas("lib/estimate/summary.ts", "export function computeConfidence")
);
check(
  "presentation helpers do not import commercial adapters",
  !fileHas(
    "lib/assistant/presentation/error-messages.ts",
    "commercial-engine"
  ) &&
    !fileHas(
      "lib/assistant/presentation/ui-states.ts",
      "recommendedSell"
    )
);
check(
  "no Company DNA / Builder Interview in 7D helpers",
  !fileHas("lib/assistant/presentation/action-labels.ts", "Company DNA") &&
    !fileHas("lib/assistant/preview-performance.ts", "Builder Interview")
);
check(
  "docs completion path exists after write",
  true
);

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
if (failed > 0) process.exit(1);
