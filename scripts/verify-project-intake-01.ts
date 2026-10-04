/**
 * Project creation and first-job intake.
 * Static only. Does not contact Production or Preview.
 *
 * Run: npx --yes tsx scripts/verify-project-intake-01.ts
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { memberCanCreateProjects, memberCanEditProjects } from "../lib/team/permissions";

const root = join(__dirname, "..");
let failed = 0;

function read(path: string): string {
  return readFileSync(join(root, path), "utf8").replaceAll("\r", "");
}

function check(name: string, ok: boolean): void {
  if (ok) {
    console.log(`PASS  ${name}`);
    return;
  }
  failed += 1;
  console.error(`FAIL  ${name}`);
}

const dialog = read("components/projects/NewProjectDialog.tsx");
const edit = read("components/projects/EditProjectDialog.tsx");
const schema = read("lib/projects/schema.ts");
const actions = read("lib/projects/actions.ts");
const dashboard = read("app/(protected)/app/dashboard/page.tsx");
const projects = read("app/(protected)/app/projects/page.tsx");
const mobile = read("components/layout/mobile-nav.tsx");
const handoff = read("components/projects/DashboardOnboardingHandoff.tsx");
const capture = read("components/assistant/ProjectCaptureBlock.tsx");
const analysis = read("lib/project-notes/build-analysis-source.ts");
const extract = read("lib/ai/extract.ts");
const prompt = read("lib/ai/brief-extraction-prompt.ts");
const documents = read("components/projects/information/ProjectDocumentsSection.tsx");
const estimatePage = read("app/(protected)/app/projects/[projectId]/page.tsx");
const infoPage = read("app/(protected)/app/projects/[projectId]/information/page.tsx");
const workAreas = read("lib/assistant/work-area-actions.ts");
const jobPlan = read("components/assistant/job-plan/JobPlanPanel.tsx");
const assistantActions = read("lib/assistant/actions.ts");

check("title-only dialog still calls createProject", dialog.includes("createProject({"));
check(
  "optional client and site are submitted only when filled",
  dialog.includes("...(client ? { client_name: client } : {})") &&
    dialog.includes("...(site ? { site_address: site } : {})")
);
check("submit lock blocks a second create", dialog.includes("submitLock.current"));
check(
  "removed create fields are absent from the dialog",
  !dialog.includes('htmlFor="client-email"') &&
    !dialog.includes('htmlFor="project-brief"') &&
    !dialog.includes('htmlFor="priority"') &&
    !dialog.includes('htmlFor="due-date"') &&
    !dialog.includes('htmlFor="notes"')
);
check(
  "removed fields remain on the edit dialog",
  edit.includes("edit-client-email") &&
    edit.includes("edit-priority") &&
    edit.includes("edit-due-date") &&
    edit.includes("edit-notes") &&
    edit.includes("edit-project-brief")
);
check(
  "create schema still accepts the established fields",
  schema.includes("client_email") &&
    schema.includes("brief_text") &&
    schema.includes("priority") &&
    schema.includes("due_date") &&
    schema.includes("notes") &&
    schema.includes("title")
);
check(
  "create still starts at brief, draft, lead, unknown",
  actions.includes('stage: "brief"') &&
    actions.includes('status: "draft"') &&
    actions.includes('business_status: "lead"') &&
    actions.includes('quality_level: "unknown"') &&
    actions.includes("redirect(`/app/projects/${project.id}`)")
);
check(
  "server create permission is unchanged",
  /export async function createProject[\s\S]{0,900}permission: "projects.create"/.test(actions) &&
    actions.includes('entitlement: "projects.create"')
);
check("owner admin estimator can see create", memberCanCreateProjects("owner") && memberCanCreateProjects("admin") && memberCanCreateProjects("estimator"));
check("viewer cannot see create", !memberCanCreateProjects("viewer") && !memberCanCreateProjects(null));
check("viewer cannot see file upload control", !memberCanEditProjects("viewer"));
check(
  "create actions use the role gate",
  dashboard.includes("memberCanCreateProjects") &&
    projects.includes("memberCanCreateProjects") &&
    mobile.includes("canCreateProject") &&
    handoff.includes("NewProjectDialog")
);
check("empty dashboard explains details come next", dashboard.includes("Name the job now."));
check("dialog title and action", dialog.includes("Start a job") && dialog.includes("Create job"));
check(
  "job description and site notes stay separate analysis text",
  capture.includes("Job description") &&
    capture.includes("Quotr reads") &&
    capture.includes("eligible site notes") &&
    capture.includes("SiteNotesCaptureCard") &&
    capture.includes('id="project-brief"')
);
check(
  "internal notes stay out of the analysis card",
  capture.includes("Internal project notes") &&
    capture.includes("are not included in analysis") &&
    !capture.includes('htmlFor="notes"')
);
check(
  "analysis disclosure excludes files",
  capture.replace(/\s+/g, " ").includes(
    "Quotr analyses the job description and site notes. Files are saved with the project but are not read during analysis."
  )
);
check("analyse stays an explicit click", capture.includes("onClick={onAnalyse}") && capture.includes("Analyse job"));
check(
  "analysis input is still brief plus notes",
  analysis.includes("export function buildInitialAnalysisInput") &&
    analysis.includes("Project brief:") &&
    analysis.includes("Site notes:") &&
    !analysis.includes("project-documents")
);
check("extraction entry is unchanged", extract.includes("export async function extractFromBrief"));
check("prompt module still exports the brief prompt", prompt.includes("BRIEF_EXTRACTION_SYSTEM_PROMPT"));
check(
  "files reuse the document upload action",
  documents.includes("prepareProjectDocumentUpload") &&
    documents.includes('variant === "capture"') &&
    documents.includes("Add files") &&
    documents.includes("Manage files in Project information") &&
    !documents.includes("extractFromBrief") &&
    !documents.includes("saveBriefAndSeedWorkAreas")
);
check(
  "estimate page does not call the information document reader by name",
  estimatePage.includes("readProjectDocumentsForJobDetails") &&
    !estimatePage.includes("readProjectDocumentCentre") &&
    infoPage.includes("readProjectDocumentCentre")
);
check(
  "zero-result recovery is distinct from other analysis errors",
  capture.includes("NO_WORK_AREAS_ERROR") &&
    capture.includes('data-manual-work-area-recovery="true"') &&
    capture.includes("Add a work area")
);
check(
  "manual stage write stays on the existing confirm stage",
  workAreas.includes("openWorkConfirmationFromBrief") &&
    workAreas.includes('if (stage !== "brief") return null;') &&
    workAreas.includes('stage: "confirm_work_areas"') &&
    workAreas.includes("MANUAL_WORK_CONFIRMATION_ERROR") &&
    workAreas.includes('.eq("stage", "brief")') &&
    !workAreas.includes("extractFromBrief")
);
check(
  "analyse action still owns recognition",
  assistantActions.includes("export async function saveBriefAndSeedWorkAreas") &&
    assistantActions.includes("NO_WORK_AREAS_ERROR") &&
    assistantActions.includes("extractFromBrief")
);
check(
  "work action clears the mobile nav and desktop bottom",
  jobPlan.includes("mobileNavBottomClass") &&
    jobPlan.includes("md:bottom-0") &&
    jobPlan.includes("Looks right") === false &&
    jobPlan.includes("ASSISTANT_ACTION_LABELS.looksRight")
);

if (failed > 0) {
  console.error(`\n${failed} failed`);
  process.exit(1);
}
console.log("\nproject intake checks passed");
