/**
 * UX-01F.2a — Project Information and Document Centre presentation.
 *
 * Run: npx --yes tsx scripts/verify-ux-01f2a-project-information.ts
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { presentProjectDocuments, type ProjectDocumentView } from "../lib/projects/document-model";

const root = join(__dirname, "..");
let passed = 0;
let failed = 0;

function check(name: string, ok: boolean, detail = ""): void {
  if (ok) {
    passed += 1;
    console.log(`PASS  ${name}`);
  } else {
    failed += 1;
    console.log(`FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

function read(path: string): string {
  return readFileSync(join(root, path), "utf8").replaceAll("\r", "");
}

const header = read("components/projects/ProjectSectionHeader.tsx");
const workspacePage = read("components/layout/workspace-page.tsx");
const information = read("components/projects/information/ProjectInformationWorkspace.tsx");
const documents = read("components/projects/information/ProjectDocumentsSection.tsx");
const actions = read("lib/projects/document-actions.ts");
const route = read("app/api/projects/documents/route.ts");
const sql = read("supabase/migrations/080_project_document_delete.sql");
const variationStart = documents.indexOf('data-variation-attachment-index="true"');
const variationBlock = documents.slice(variationStart, documents.indexOf("</section>", variationStart));

function sample(id: string, mime: string): ProjectDocumentView {
  return {
    id,
    title: id,
    category: mime.startsWith("image/") ? "photos" : "plans_and_drawings",
    archived: false,
    createdAt: "2026-09-30T00:00:00.000Z",
    versions: [{
      id: `${id}-v`,
      versionNumber: 1,
      displayFilename: `${id}.bin`,
      mimeType: mime,
      byteSize: 1200,
      visibility: "internal",
      versionNote: null,
      uploadStatus: "ready",
      createdAt: "2026-09-30T00:00:00.000Z",
      uploaderName: null,
      current: true,
    }],
  };
}

const presented = presentProjectDocuments([sample("photo", "image/jpeg"), sample("plan", "application/pdf")]);

check(
  "1 desktop destinations have bounded active and idle states",
  header.includes('data-project-section-columns="four"') &&
    header.includes('data-project-column-surface={current ? "active" : "idle"}') &&
    header.includes("hover:border-foreground/30") &&
    header.includes("shadow-[inset_3px_0_0_0_var(--brand-orange)]") &&
    header.includes("lg:grid-cols-4")
);
check(
  "2 locked destinations remain non-links",
  header.includes('data-project-column-locked={href == null && !current ? "true" : undefined}') &&
    header.includes("<p") &&
    header.includes('aria-current={current ? "page" : undefined}') &&
    !header.includes("overflow-x-auto")
);
check(
  "3 mobile selector stays functional",
  header.includes("lg:hidden") &&
    header.includes('aria-label="Project section"') &&
    header.includes("data-project-section-select") &&
    header.includes("data-project-section-context") &&
    header.includes("data-quote-variations-control") &&
    header.includes("min-h-11") &&
    header.includes("text-base")
);
check(
  "4 shared header spacing is compact",
  workspacePage.includes("pt-4 pb-6 sm:pt-6 lg:pt-8") &&
    workspacePage.includes('data-workspace-content-gap="compact"') &&
    !workspacePage.includes("sm:mt-5 sm:pt-6") &&
    information.includes('className="text-lg font-semibold leading-6"')
);
check(
  "5 one project photo appears once in the default view",
  presented.gallery.length === 1 &&
    presented.listed.length === 1 &&
    presented.gallery[0]?.id === "photo" &&
    presented.listed[0]?.id === "plan" &&
    documents.includes("presentProjectDocuments") &&
    documents.includes('data-project-photo-gallery="true"') &&
    documents.includes('data-project-document-list="true"')
);
check(
  "6 image details and version history remain reachable",
  documents.includes("Details and version history") &&
    documents.includes("Version history for this project file.") &&
    documents.includes("<VersionHistory")
);
check(
  "7 non-image documents remain listed",
  documents.includes("projectDocumentCategoryGroups(presented.listed)") &&
    documents.includes("Download")
);
check(
  "8 archive, restore and permanent delete are authorised",
  documents.includes('data-project-document-archive-filter') &&
    documents.includes("Restore") &&
    documents.includes("Delete permanently") &&
    actions.includes("authorize_project_document_delete_v1") &&
    actions.includes("commit_project_document_delete_v1") &&
    sql.includes("org_id = v_org") &&
    sql.includes("project_id = p_project") &&
    sql.includes("project_document_version_is_referenced")
);
check(
  "9 variation attachments cannot be deleted here",
  !variationBlock.includes("Delete permanently") &&
    !variationBlock.includes("deleteProjectDocument") &&
    variationBlock.includes("Open variation")
);
check(
  "10 destructive confirmation is required",
  documents.includes("<AlertDialog") &&
    documents.includes("Delete this document permanently?") &&
    documents.includes("will be removed.")
);
check(
  "11 object cleanup failure does not claim success",
  actions.indexOf('return fail("DELETE_FAILED")') < actions.indexOf("commit_project_document_delete_v1") &&
    actions.includes("The file could not be removed. The document is still here.")
);
check(
  "12 no storage path reaches the UI and upload does not refresh the route",
  !documents.includes("storage_object_path") &&
    !documents.includes("storageObjectPath") &&
    !documents.includes("router.refresh") &&
    !documents.includes("useRouter") &&
    !route.includes("storageObjectPath") &&
    documents.includes("text-base sm:text-sm") &&
    information.includes("overflow-x-hidden") &&
    !information.includes("<table")
);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
