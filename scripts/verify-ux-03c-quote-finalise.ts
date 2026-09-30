/**
 * UX-03C — Quote finalisation and client details.
 *
 * Run: npx tsx scripts/verify-ux-03c-quote-finalise.ts
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { canMutateQuoteSnapshot } from "../lib/quotes/transaction";

const root = join(__dirname, "..");
let passed = 0;
let failed = 0;

function check(name: string, ok: boolean): void {
  if (ok) {
    passed += 1;
    console.log(`PASS  ${name}`);
  } else {
    failed += 1;
    console.log(`FAIL  ${name}`);
  }
}

function read(path: string): string {
  return readFileSync(join(root, path), "utf8").replaceAll("\r", "");
}

const workspace = read("components/quotes/QuoteWorkspace.tsx");
const page = read("app/(protected)/app/projects/[projectId]/quotes/[quoteId]/page.tsx");
const information = read("components/projects/information/ProjectInformationWorkspace.tsx");
const dialog = read("components/projects/EditProjectDialog.tsx");
const actions = read("lib/projects/actions.ts");
const nav = read("components/projects/ProjectSectionHeader.tsx");
const display = read("scripts/verify-quote-display-v1.ts");

check(
  "client and site editing opens the existing project editor",
  workspace.includes("/information#project-client-site") &&
    workspace.includes("Edit project client and site") &&
    !workspace.includes('href="#quote-client-context"') &&
    information.includes('id="project-client-site"') &&
    information.includes("EditProjectDialog") &&
    dialog.includes("client_name") &&
    dialog.includes("site_address") &&
    actions.includes("export async function updateProject")
);

check(
  "project details and the quote stay distinct",
  workspace.includes("Project details have changed since this Quote was created.") &&
    workspace.includes("Chosen when sending") &&
    workspace.includes("Client on Quote") &&
    !workspace.includes("updateQuote") === false &&
    canMutateQuoteSnapshot({
      status: "sent",
      superseded_by_quote_id: null,
      send_lock_delivery_id: null,
    }) === false
);

check(
  "readiness is one section and Back to Pricing is gone",
  workspace.includes("Before sending") &&
    workspace.includes('data-quote-client-warning="true"') &&
    !workspace.includes(">Final review<") &&
    !workspace.includes("Back to Pricing") &&
    !workspace.includes(">Client and delivery<") &&
    nav.includes('title="Pricing"')
);

check(
  "date fields share one structure and Finalise is one surface",
  workspace.includes("Shown on the client Quote.") &&
    workspace.includes("Shown to the client. Does not block sending.") &&
    workspace.includes("min-h-8 text-xs text-muted-foreground") &&
    workspace.includes("divide-y divide-border/70") &&
    workspace.includes('id="quote-terms"') &&
    workspace.includes("aria-expanded={termsOpen}")
);

check(
  "customisation and send stay on existing authority",
  workspace.includes("QuotePresentationControl") &&
    workspace.includes("QuoteDisplayControl") &&
    workspace.includes("Hidden from the client") &&
    workspace.includes("Update from Pricing") &&
    workspace.includes("onSendQuote") &&
    page.includes("getQuoteWorkspaceDataWithContext") &&
    !page.includes("revalidatePath") &&
    display.includes("080_project_document_delete.sql") &&
    display.includes('name.startsWith("054_")')
);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
