/**
 * UX-01F.1 — Project Information workspace.
 *
 * Run: npx tsx scripts/verify-ux-01f1-project-information.ts
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { projectInformationModel } from "../lib/projects/project-information";
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

const orientation = read("lib/projects/workflow-orientation.ts");
const tabs = read("components/projects/ProjectWorkspaceTabs.tsx");
const menu = read("components/projects/ProjectActionsMenu.tsx");
const header = read("components/projects/ProjectSectionHeader.tsx");
const page = read("app/(protected)/app/projects/[projectId]/information/page.tsx");
const workspace = read("components/projects/information/ProjectInformationWorkspace.tsx");
const documents = read("components/projects/information/project-documents.ts");
const projector = read("lib/projects/project-information.ts");
const projectLoader = read("lib/projects/project-loaders.ts");
const assistantLoader = read("lib/assistant/state.ts");
const informationFiles = `${page}\n${workspace}\n${projector}\n${documents}`;
const ASSISTANT_LABEL = "ASSISTANT_ACTION_LABELS.editJobDetails";

const filled = projectInformationModel({
  project: {
    title: "Deck replacement",
    business_status: "estimating",
    priority: "high" as ProjectPriority,
    client_name: "Aroha Ngata",
    client_email: "aroha@example.com",
    site_address: "12 Harbour View Road",
    brief_text: "Replace the deck",
    notes: "Access from the side path",
    due_date: "2026-10-02",
    created_at: "2026-09-01T00:00:00.000Z",
  },
  workAreas: [
    { name: "Deck", status: "confirmed", missingCount: 0 },
    { name: "Fence", status: "suggested", missingCount: 2 },
  ],
  captured: [{ workArea: "Deck", label: "Width", value: "4 m" }],
  conditions: [{ label: "Access", value: "Side path" }],
  hasEstimate: true,
  estimateIsStale: true,
  estimateHref: "/app/projects/project-1",
});

const emptyOptional = projectInformationModel({
  project: {
    title: "Untitled",
    business_status: "lead",
    priority: "normal" as ProjectPriority,
    client_name: "  ",
    client_email: null,
    site_address: "",
    brief_text: null,
    notes: "   ",
    due_date: null,
    created_at: "2026-09-01T00:00:00.000Z",
  },
  workAreas: [],
  captured: [{ workArea: "Deck", label: "Width", value: "  " }],
  conditions: [{ label: "Access", value: "" }],
  hasEstimate: false,
  estimateIsStale: false,
  estimateHref: "/app/projects/project-1",
});

check(
  "1 Project information sits outside the commercial lifecycle",
  orientation.includes('export type WorkflowStageId = "estimate" | "pricing" | "quote" | "variations"') &&
    !tabs.includes("Project information") &&
    !menu.includes("data-project-information-entry") &&
    header.includes("Project information") &&
    page.includes('activeTab="information"') &&
    page.includes("<ProjectWorkspaceNav") &&
    !page.includes("deriveProjectWorkflow")
);

check(
  "2 Estimate, Pricing, Quote and Variations remain",
  tabs.replaceAll("\r\n", "\n").includes("\n            Estimate\n") &&
    tabs.includes("Pricing") &&
    tabs.includes("Quote") &&
    tabs.includes("Variations") &&
    header.includes("Estimate") &&
    header.includes("Pricing") &&
    header.includes("Quote") &&
    header.includes("Variations")
);

check(
  "3 only stored project fields are shown",
  filled.overview.some((field) => field.label === "Project" && field.value === "Deck replacement") &&
    filled.overview.some((field) => field.label === "Status" && field.value === "Estimating") &&
    filled.overview.some((field) => field.label === "Priority" && field.value === "High") &&
    filled.overview.some((field) => field.label === "Client" && field.value === "Aroha Ngata") &&
    filled.overview.some((field) => field.label === "Client email") &&
    filled.overview.some((field) => field.label === "Site address") &&
    filled.job.some((field) => field.label === "Job brief" && field.value === "Replace the deck") &&
    filled.job.some((field) => field.label === "Site notes") &&
    filled.captured[0]?.value === "4 m" &&
    filled.conditions[0]?.value === "Side path" &&
    filled.workAreas[0]?.status === "Confirmed" &&
    filled.workAreas[0]?.completeness === "Details captured" &&
    filled.workAreas[1]?.completeness === "Details still needed" &&
    !JSON.stringify({
      overview: filled.overview,
      job: filled.job,
      captured: filled.captured,
      conditions: filled.conditions,
      workAreas: filled.workAreas,
    }).includes("project-1") &&
    filled.estimateHref === "/app/projects/project-1"
);

check(
  "4 empty optional fields are omitted",
  !emptyOptional.overview.some((field) => field.label === "Client") &&
    !emptyOptional.overview.some((field) => field.label === "Client email") &&
    !emptyOptional.overview.some((field) => field.label === "Site address") &&
    !emptyOptional.overview.some((field) => field.label === "Due") &&
    emptyOptional.job.length === 0 &&
    emptyOptional.captured.length === 0 &&
    emptyOptional.conditions.length === 0 &&
    emptyOptional.estimateLabel === "No estimate"
);

check(
  "5 edits use the existing project action",
  menu.includes("<EditProjectDialog") &&
    page.includes("<ProjectWorkspaceHeader") &&
    !workspace.includes("updateProject") &&
    !workspace.includes("<textarea") &&
    !workspace.includes("<input")
);

check(
  "6 Job details are not duplicated as a form",
  workspace.includes(ASSISTANT_LABEL) &&
    workspace.includes("Review Work Area details") &&
    workspace.includes('dataAttribute="edit-job"') &&
    workspace.includes("data-project-information-record={dataAttribute}") &&
    !workspace.includes("saveBrief") &&
    !projector.includes("composeBuilderReview")
);

check(
  "7 documents belong to Project Information",
  documents.includes('PROJECT_DOCUMENT_OWNERSHIP = "project-information"') &&
    workspace.includes("data-project-documents-owner={PROJECT_DOCUMENT_OWNERSHIP}") &&
    documents.includes("UX-01F.2") &&
    !informationFiles.includes('type="file"') &&
    !informationFiles.includes("storage.from") &&
    !informationFiles.includes("variation_attachments")
);

check(
  "8 tenant isolation stays on the existing loaders",
  page.includes("requireAuthOrgContext") &&
    page.includes("if (!auth.ok)") &&
    page.includes("notFound()") &&
    page.includes("getProjectWithContext(auth, projectId)") &&
    page.includes("getAssistantStateWithContext(auth, projectId)") &&
    projectLoader.includes('.eq("org_id", context.orgId)') &&
    assistantLoader.includes("assertOrgOwnsActiveProjectForRead") &&
    !workspace.includes("storage_path") &&
    !workspace.includes("signedUrl")
);

check(
  "9 mobile layout has no wide table or horizontal overflow",
  workspace.includes("overflow-x-hidden") &&
    workspace.includes("break-words") &&
    workspace.includes("min-h-11") &&
    workspace.includes("text-sm leading-5") &&
    workspace.includes("text-xs leading-4") &&
    !workspace.includes("<table") &&
    !workspace.includes("overflow-x-auto") &&
    !workspace.includes("text-[10px]") &&
    !workspace.includes("text-[11px]")
);

check(
  "10 no calculation or commercial action changes",
  filled.estimateLabel === "Stale estimate" &&
    filled.pricingRequiredCount === null &&
    emptyOptional.pricingRequiredCount === null &&
    !informationFiles.includes("formatCurrency") &&
    !informationFiles.includes("createPricing") &&
    !informationFiles.includes("updateProject") &&
    !page.includes("revalidate") &&
    !page.includes("fetch(")
);

if (failed > 0) {
  console.error(`\n${failed} check(s) failed`);
  process.exit(1);
}

console.log("\nUX-01F.1 project information passed");
