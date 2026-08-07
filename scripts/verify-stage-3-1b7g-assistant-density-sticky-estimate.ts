/**
 * Stage 3.1B.7G — Assistant density, sticky Quick Estimate, responsive presentation.
 * Run: npx tsx scripts/verify-stage-3-1b7g-assistant-density-sticky-estimate.ts
 *
 * Presentation-only. Does not enable Production or close 7F owner E2E.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  QUICK_ESTIMATE_STICKY_BREAKPOINT,
  QUICK_ESTIMATE_STICKY_CLASS,
  buildQuickEstimateMobileSummary,
  buildQuickEstimateStatusPresentation,
} from "../lib/assistant/presentation/quick-estimate-view-model";
import { computeConfidence } from "../lib/estimate/summary";

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

const ROOT = process.cwd();
const PANEL = "components/assistant/EstimatePanel.tsx";
const SHELL = "components/assistant/AssistantShell.tsx";
const CARD = "components/assistant/CollapsibleStageCard.tsx";
const SUMMARIES = "components/assistant/StageCollapsedSummaries.tsx";
const VM = "lib/assistant/presentation/quick-estimate-view-model.ts";

console.log(
  "\n=== Stage 3.1B.7G — Assistant Density / Sticky Estimate Verification ===\n"
);

// —— Quick Estimate hierarchy ——
check(
  "recommended sell is primary typography",
  fileHas(PANEL, "Recommended sell") &&
    fileHas(PANEL, "text-3xl font-semibold")
);
check(
  "estimate range present",
  fileHas(PANEL, "Estimate range") && fileHas(PANEL, "formatCurrencyRange")
);
check(
  "estimate confidence label retained",
  fileHas(PANEL, "Estimate confidence")
);
check(
  "cost / margin / GP commercial metrics retained",
  fileHas(PANEL, "Commercial metrics") &&
    fileHas(PANEL, 'label="Cost"') &&
    fileHas(PANEL, 'label="Margin"') &&
    fileHas(PANEL, 'label="Gross profit"')
);
check(
  "uses authoritative financial view-model (no local money math)",
  fileHas(PANEL, "estimateDocumentViewModel") &&
    !fileHas(PANEL, "calculateSell") &&
    !fileHas(PANEL, "commercial-engine")
);
check(
  "secondary information collapsible",
  fileHas(PANEL, "QuickEstimateDisclosure") &&
    fileHas(PANEL, "Project readiness") &&
    fileHas(PANEL, 'title="Scope"') &&
    fileHas(PANEL, 'title="Assumptions"') &&
    fileHas(PANEL, 'title="Rate sources"') &&
    fileHas(PANEL, "aria-expanded={open}")
);
check(
  "Prepare final pricing CTA retained",
  fileHas(PANEL, "PrepareFinalPricingButton")
);
check(
  "View full breakdown retained as secondary",
  fileHas(PANEL, "viewFullBreakdown") ||
    fileHas(PANEL, "ASSISTANT_ACTION_LABELS.viewFullBreakdown")
);
check(
  "project health detail preserved (sr-only / disclosure)",
  fileHas(PANEL, "Project health") &&
    fileHas(PANEL, "QuickEstimateHierarchy")
);
check(
  "concise status statement present",
  fileHas(PANEL, "status.statusLabel") &&
    fileHas(VM, "Ready for pricing") &&
    fileHas(VM, "need attention")
);
check(
  "blockers stay outside collapsed-only path",
  fileHas(PANEL, 'role="alert"') &&
    fileHas(PANEL, "Assumed dimensions affect this estimate")
);

// —— Sticky ——
check(
  "CSS sticky implementation (no fixed overlay)",
  (fileHas(PANEL, "lg:sticky") ||
    fileHas(PANEL, "QUICK_ESTIMATE_STICKY_CLASS") ||
    fileHas(VM, "lg:sticky")) &&
    !fileHas(PANEL, "fixed inset") &&
    !/position:\s*fixed/.test(read(PANEL))
);
check(
  "sticky class constant matches panel usage",
  QUICK_ESTIMATE_STICKY_CLASS.includes("lg:sticky") &&
    fileHas(PANEL, "QUICK_ESTIMATE_STICKY_CLASS")
);
check(
  "sticky breakpoint is lg (1024+)",
  QUICK_ESTIMATE_STICKY_BREAKPOINT === "lg"
);
check(
  "safe header offset top-6",
  QUICK_ESTIMATE_STICKY_CLASS.includes("top-6")
);
check(
  "no JS scroll listener for sticky rail",
  !fileHas(PANEL, "addEventListener(\"scroll") &&
    !fileHas(PANEL, "onScroll") &&
    !fileHas(SHELL, "addEventListener(\"scroll")
);
check(
  "shell column uses self-start for sticky containment",
  fileHas(SHELL, "lg:self-start")
);

// —— Mobile ——
check(
  "mobile compact summary below lg only",
  fileHas(PANEL, "lg:hidden") &&
    fileHas(PANEL, "buildQuickEstimateMobileSummary") &&
    fileHas(PANEL, "mobileSummary.secondaryActionLabel") &&
    fileHas(VM, "View estimate")
);
check(
  "desktop header hidden on mobile (no simultaneous duplicate chrome)",
  fileHas(PANEL, "hidden pb-3 lg:block") &&
    fileHas(PANEL, "hidden lg:block")
);
const mobile = buildQuickEstimateMobileSummary({
  hasEstimate: true,
  sellDisplay: "$7,263",
  confidencePercent: 85,
  statusLabel: "Ready for pricing",
});
check(
  "mobile summary formats sell · confidence",
  mobile.primaryLine.includes("$7,263") &&
    mobile.primaryLine.includes("85%") &&
    mobile.secondaryActionLabel === "View estimate"
);

const ready = buildQuickEstimateStatusPresentation({
  hasEstimate: true,
  missingCount: 0,
  outstandingClarificationCount: 0,
});
const attention = buildQuickEstimateStatusPresentation({
  hasEstimate: true,
  missingCount: 2,
  outstandingClarificationCount: 0,
});
check(
  "status presentation ready / attention",
  ready.kind === "ready" &&
    ready.statusLabel === "Ready for pricing" &&
    attention.kind === "attention" &&
    attention.statusLabel.includes("attention")
);

// —— Centre density ——
check(
  "collapsed summaries use compact one-line helper",
  fileHas(SUMMARIES, "CompactLine") &&
    fileHas(SUMMARIES, "outcomeLabel") &&
    fileHas(SUMMARIES, "included") &&
    (fileHas(SUMMARIES, "need detail") || fileHas(SUMMARIES, "Needs detail"))
);
check(
  "questions collapsed accepts answeredCount",
  fileHas(SUMMARIES, "answeredCount") &&
    fileHas(SHELL, "answeredCount={answeredQuestionCount}")
);
check(
  "full stage bodies remain in CollapsibleStageCard children",
  fileHas(SHELL, "ProjectCaptureBlock") &&
    fileHas(SHELL, "WorkAreaConfirmationBlock") &&
    fileHas(SHELL, "QuestionBlock") &&
    fileHas(SHELL, "ScopeSummaryBlock")
);
check(
  "active stage elevation retained",
  fileHas(CARD, "data-stage-active") &&
    fileHas(CARD, "isActive") &&
    fileHas(CARD, "shadow-md")
);
check(
  "completed stages quieter when collapsed",
  fileHas(CARD, "opacity-[0.88]") &&
    fileHas(CARD, "text-muted-foreground")
);

// —— Accessibility ——
check(
  "disclosure uses aria-expanded + controls",
  fileHas(PANEL, "aria-expanded={open}") &&
    fileHas(PANEL, "aria-controls={panelId}")
);
check(
  "collapsed disclosure content not shown (hidden)",
  fileHas(PANEL, "hidden={!open}") || fileHas(PANEL, 'hidden={!open}')
);
check(
  "status uses role=status text",
  fileHas(PANEL, 'role="status"')
);
check(
  "stage cards retain aria-expanded",
  fileHas(CARD, "aria-expanded={isExpanded}")
);

// —— Boundaries ——
check(
  "no migration 030",
  !existsSync(join(ROOT, "supabase/migrations/030_scope_discovery.sql"))
);
check(
  "confidence export unchanged (engine frozen)",
  typeof computeConfidence === "function"
);
check(
  "quick estimate VM has no commercial-engine / anthropic",
  !fileHas(VM, "commercial-engine") &&
    !fileHas(VM, "anthropic") &&
    !fileHas(VM, "runScopeDiscovery")
);
check(
  "presentation index exports quick-estimate VM",
  fileHas("lib/assistant/presentation/index.ts", "quick-estimate-view-model")
);
check(
  "7G completion doc exists",
  existsSync(
    join(
      ROOT,
      "docs/implementation/STAGE_3_1B7G_ASSISTANT_DENSITY_STICKY_ESTIMATE_COMPLETION.md"
    )
  )
);
check(
  "responsive architecture doc exists",
  existsSync(
    join(
      ROOT,
      "docs/architecture/QUOTR_ASSISTANT_RESPONSIVE_AND_MOBILE_PRESENTATION.md"
    )
  )
);
check(
  "preview retest runbook exists",
  existsSync(
    join(ROOT, "docs/runbooks/STAGE_3_1B7G_PREVIEW_RETEST.md")
  )
);
check(
  "7F owner E2E remains open (DEF-7E-003)",
  fileHas(
    "docs/audits/STAGE_3_1B7E_PREVIEW_DEFECT_REGISTER.md",
    "DEF-7E-003"
  ) &&
    (fileHas(
      "docs/audits/STAGE_3_1B7E_PREVIEW_DEFECT_REGISTER.md",
      "Owner Pending"
    ) ||
      fileHas(
        "docs/audits/STAGE_3_1B7E_PREVIEW_DEFECT_REGISTER.md",
        "BLOCKED BY PREVIEW DEFECTS"
      ))
);
check(
  "7F pack mentions sticky / density checks",
  fileHas(
    "docs/runbooks/STAGE_3_1B7F_OWNER_E2E_TEST_PACK.md",
    "sticky"
  ) ||
    fileHas(
      "docs/runbooks/STAGE_3_1B7F_OWNER_E2E_TEST_PACK.md",
      "Sticky Quick Estimate"
    )
);
check(
  "7G completion does not enable Production",
  fileHas(
    "docs/implementation/STAGE_3_1B7G_ASSISTANT_DENSITY_STICKY_ESTIMATE_COMPLETION.md",
    "Disabled"
  ) &&
    !fileHas(
      "docs/implementation/STAGE_3_1B7G_ASSISTANT_DENSITY_STICKY_ESTIMATE_COMPLETION.md",
      "Production — Enabled"
    )
);
check(
  "7G does not close Stage 3.1B or begin 3.2",
  fileHas(
    "docs/implementation/STAGE_3_1B7G_ASSISTANT_DENSITY_STICKY_ESTIMATE_COMPLETION.md",
    "BLOCKED BY PREVIEW DEFECTS"
  ) &&
    fileHas(
      "docs/implementation/STAGE_3_1B7G_ASSISTANT_DENSITY_STICKY_ESTIMATE_COMPLETION.md",
      "Not Started"
    )
);

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
if (failed > 0) process.exit(1);
