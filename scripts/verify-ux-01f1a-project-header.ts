/**
 * UX-01F.1a — unified project header and scalable captured details.
 *
 * Run: npx tsx scripts/verify-ux-01f1a-project-header.ts
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  filterCapturedDetailGroups,
  projectInformationModel,
} from "../lib/projects/project-information";
import {
  estimateStatusText,
  pricingLockReason,
  variationsLockReason,
} from "../lib/projects/project-section-nav";
import {
  deriveProjectWorkflow,
  type ProjectWorkflowInput,
  type WorkflowStageModel,
} from "../lib/projects/workflow-orientation";
import type { ProjectPriority } from "../lib/projects/types";

let failed = 0;

function check(name: string, ok: boolean) {
  if (ok) {
    console.log(`PASS ${name}`);
    return;
  }
  failed += 1;
  console.error(`FAIL ${name}`);
}

function read(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

function workflow(
  overrides: Partial<ProjectWorkflowInput> & Pick<ProjectWorkflowInput, "activeTab">
): ProjectWorkflowInput {
  return {
    projectId: "project-1",
    hasEstimate: false,
    estimateIsStale: false,
    pricingSummary: null,
    quoteSummary: null,
    variations: null,
    ...overrides,
  };
}

function stage(input: ProjectWorkflowInput, id: WorkflowStageModel["id"]) {
  const found = deriveProjectWorkflow(input).stages.find((item) => item.id === id);
  if (!found) throw new Error(id);
  return found;
}

const header = read("components/projects/ProjectSectionHeader.tsx");
const nav = read("components/projects/ProjectWorkspaceNav.tsx");
const menu = read("components/projects/ProjectActionsMenu.tsx");
const captured = read("components/projects/information/CapturedDetails.tsx");
const workspace = read("components/projects/information/ProjectInformationWorkspace.tsx");
const documents = read("components/projects/information/project-documents.ts");
const capture = read("components/assistant/ProjectCaptureBlock.tsx");
const shell = read("components/assistant/AssistantShell.tsx");
const orientation = read("lib/projects/workflow-orientation.ts");

const before = workflow({ activeTab: "assistant" });
const accepted = workflow({
  activeTab: "variations",
  hasEstimate: true,
  quoteSummary: { id: "quote-1", status: "accepted" },
});
const onQuote = workflow({
  activeTab: "quote",
  hasEstimate: true,
  quoteSummary: { id: "quote-1", status: "sent" },
});

check(
  "1 four top-level columns",
  header.includes("lg:grid-cols-4") &&
    header.includes('title="Project information"') &&
    header.includes('title="Estimate"') &&
    header.includes('title="Pricing"') &&
    header.includes('title="Quote"') &&
    header.includes('title="Variations"') &&
    nav.includes("<ProjectSectionHeader") &&
    !nav.includes("<ProjectWorkflowStrip") &&
    !nav.includes("<ProjectWorkspaceTabs")
);

check(
  "2 Quote keeps a separate Variations destination",
  stage(before, "variations").locked === true &&
    stage(before, "variations").href === null &&
    variationsLockReason(stage(before, "variations")) === "Available after Quote acceptance" &&
    stage(accepted, "variations").locked === false &&
    stage(accepted, "variations").href === "/app/projects/project-1/variations" &&
    header.includes('data-variations-nav={column === "variations" ? "true" : undefined}') &&
    orientation.includes("variationsStage")
);

check(
  "3 status wording stays on the existing derivation",
  estimateStatusText(stage(before, "estimate"), false) === "Not started · Current" &&
    estimateStatusText(stage(workflow({ activeTab: "pricing", hasEstimate: true, estimateIsStale: true }), "estimate"), true) ===
      "Previous estimate" &&
    estimateStatusText(stage(workflow({ activeTab: "pricing", hasEstimate: true }), "estimate"), false) === "Ready" &&
    pricingLockReason(stage(before, "pricing")) === "Complete the Estimate first" &&
    stage(onQuote, "quote").viewing === true &&
    stage(onQuote, "variations").viewing === false &&
    stage(accepted, "quote").viewing === false &&
    stage(accepted, "variations").viewing === true
);

check(
  "4 old navigation is not rendered with the new header",
  !nav.includes("ProjectWorkflowStrip") &&
    !nav.includes("ProjectWorkspaceTabs") &&
    !menu.includes("data-project-information-entry") &&
    header.includes("lg:hidden") &&
    header.includes('aria-label="Project section"') &&
    header.includes("data-quote-variations-control") &&
    header.includes("text-base") &&
    header.includes("min-h-11") &&
    !header.includes("overflow-x-auto") &&
    header.includes('aria-current={current ? "page" : undefined}')
);

check(
  "5 Capture remains the first substantive task",
  shell.includes('title="Job details"') &&
    capture.includes("Analyse job") &&
    !header.includes("Analyse job") &&
    !header.includes("Commercial Overview")
);

const many = projectInformationModel({
  project: {
    title: "Deck",
    business_status: "scoping",
    priority: "normal" as ProjectPriority,
    client_name: null,
    client_email: null,
    site_address: null,
    brief_text: null,
    notes: null,
    due_date: null,
    created_at: "2026-09-01T00:00:00.000Z",
  },
  workAreas: [
    { name: "Deck", status: "confirmed", missingCount: 0 },
    { name: "Fence", status: "suggested", missingCount: 1 },
  ],
  captured: Array.from({ length: 50 }, (_, index) => ({
    workArea: index === 49 ? "Fence" : "Deck",
    label: index === 3 ? "Joist size" : `Fact ${index + 1}`,
    value: index === 3 ? "90x45" : `Value ${index + 1}`,
    unit: index === 3 ? "mm" : null,
    category: null,
  })),
  conditions: [{ label: "Access", value: "Side path" }],
  hasEstimate: false,
  estimateIsStale: false,
  estimateHref: "/app/projects/project-1",
});

const deck = many.capturedGroups.find((group) => group.name === "Deck");
const filtered = filterCapturedDetailGroups(many.capturedGroups, "joist");

check(
  "6 fifty facts stay inside collapsed Work Area groups",
  many.capturedSummary.factCount === 50 &&
    many.capturedSummary.workAreaCount === 2 &&
    many.capturedSummary.conditionCount === 1 &&
    many.capturedSummary.needingDetailsCount === 1 &&
    deck?.factCount === 49 &&
    deck?.categories[0]?.name === "Facts" &&
    deck?.categories[0]?.facts[3]?.unit === "mm" &&
    many.capturedGroups.some((group) => group.name === "General project details") &&
    captured.includes("useState<ReadonlySet<string>>(() => new Set())") &&
    captured.includes("aria-expanded={open}") &&
    captured.includes("aria-controls={panelId}") &&
    captured.includes("View details") &&
    !captured.includes("<table")
);

check(
  "7 local search filters facts and Work Areas",
  filtered.length === 1 &&
    filtered[0]?.name === "Deck" &&
    filtered[0]?.factCount === 1 &&
    filtered[0]?.categories[0]?.facts[0]?.value === "90x45" &&
    filterCapturedDetailGroups(many.capturedGroups, "Fence")[0]?.name === "Fence" &&
    captured.includes("filterCapturedDetailGroups") &&
    !captured.includes("fetch(")
);

check(
  "8 documents stay inside Project Information",
  workspace.includes('id="project-documents"') &&
    workspace.includes("Plans, specifications, photos and project files will be managed here.") &&
    documents.includes('PROJECT_DOCUMENT_OWNERSHIP = "project-information"') &&
    !workspace.includes('type="file"') &&
    !workspace.includes("storage.from") &&
    !header.includes("createPricingFromEstimate") &&
    !orientation.includes("createPricingFromEstimate")
);

if (failed > 0) {
  console.error(`\n${failed} check(s) failed`);
  process.exit(1);
}

console.log("\nUX-01F.1a project header passed");
