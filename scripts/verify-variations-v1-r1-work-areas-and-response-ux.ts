/**
 * VARIATIONS V1-R1 — work areas and response UX.
 *
 * Run: npx --yes tsx scripts/verify-variations-v1-r1-work-areas-and-response-ux.ts
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildVariationDocument } from "../lib/variations/presentation";
import { buildVariationResponseReceipt } from "../lib/variations/response-receipt";
import { groupVariationScope, variationWorkAreaNamesConflict } from "../lib/variations/work-areas";

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

const sql = read("supabase/migrations/073_variation_work_areas.sql");
const editor = read("components/variations/VariationEditor.tsx");
const manual = read("components/variations/VariationManualResponse.tsx");
const client = read("components/variations/VariationClientResponse.tsx");
const quote = read("components/quotes/QuoteAcceptSheet.tsx");
const publicView = read("components/variations/VariationPublicView.tsx");
const receiptView = read("components/variations/VariationResponseReceipt.tsx");
const documentView = read("components/variations/VariationDocument.tsx");
const loader = read("lib/variations/response-receipt-load.ts");
const actions = read("lib/variations/actions.ts");
const publicPage = read("app/v/[token]/response/page.tsx");
const internalPage = read("app/(protected)/app/projects/[projectId]/variations/[variationId]/response/page.tsx");

const lookupStart = sql.indexOf("create or replace function public.lookup_variation_client_by_token_hash_v1");
const lookup = lookupStart >= 0 ? sql.slice(lookupStart, sql.indexOf("create or replace function public.variation_apply_terminal_response_v1", lookupStart)) : "";
const createArea = sql.slice(
  sql.indexOf("create or replace function public.create_draft_variation_work_area_v1"),
  sql.indexOf("create or replace function public.update_draft_variation_work_area_v1"),
);

const groups = groupVariationScope([
  { workAreaName: " Garage ", workAreaDescription: "New garage", clientDescription: "Garage framing", sortOrder: 1 },
  { workAreaName: "garage", clientDescription: "Garage lining", sortOrder: 2 },
  { workAreaName: "Garage", clientDescription: "Garage painting", sortOrder: 3 },
  { clientDescription: "Unlinked item", sortOrder: 0 },
]);

const document = buildVariationDocument({
  companyName: "ERC Contracting",
  clientName: "Ada Client",
  projectTitle: "House",
  siteAddress: null,
  variationNumber: 1,
  revisionNumber: 1,
  issuedAt: null,
  status: "issued",
  title: "Garage",
  summary: null,
  clientNotes: null,
  currency: "NZD",
  items: [
    { itemType: "addition", clientDescription: "Garage framing", lineSellAdjustmentExGst: 1000, substitutionGroupId: null, sortOrder: 1, workAreaName: "Garage", workAreaDescription: "New garage" },
    { itemType: "addition", clientDescription: "Garage lining", lineSellAdjustmentExGst: 400, substitutionGroupId: null, sortOrder: 2, workAreaName: "Garage" },
  ],
  totals: { totalSellAdjustmentExGst: 1400, gstAdjustment: 210, totalAdjustmentInclGst: 1610 },
  baseline: { sellExGst: 10000, sellInclGst: 11500 },
});

const receipt = buildVariationResponseReceipt({
  outcome: "declined",
  source: "manual",
  respondedAt: "2026-09-01T00:00:00.000Z",
  responderName: "Ada Client",
  responderEmail: null,
  declineReason: "Not proceeding",
  issued: { exGst: 1400, gst: 210, inclGst: 1610 },
  currency: "NZD",
  documentIdentity: {
    contractor: { organisationName: "ERC Contracting", tradingName: "ERC Contracting", legalName: "ERC Contracting Limited", email: "builder@example.test", timezone: "Pacific/Auckland" },
    client: { name: "Ada Client" },
    project: { title: "House", siteAddress: "12 Site Road" },
    masterQuote: { quoteNumber: "Q-100", revisionNumber: 2, available: true, acceptedAt: "2026-01-15T00:00:00.000Z" },
  },
  clientAttachmentManifest: { count: 0, files: [] },
  confirmationVersions: { final: "variation-decline-final-v1" },
  variationNumber: 1,
  revisionNumber: 1,
  baseline: { exGst: 10000, gst: 1500, inclGst: 11500 },
  earlierAdjustments: [],
  scopeGroups: groups,
});

check("1 a Variation work area is named, described and owned by the revision", sql.includes("create table if not exists public.variation_work_areas") && sql.includes("name text not null") && sql.includes("description text") && sql.includes("revision_id uuid not null") && sql.includes("org_id uuid not null") && sql.includes("project_id uuid not null") && sql.includes("variation_id uuid not null"));
check("2 duplicate names are rejected within one revision", sql.includes("variation_work_areas_name_uidx") && sql.includes("lower(btrim(name))") && createArea.includes("'DUPLICATE_NAME'") && variationWorkAreaNamesConflict(" Garage ", "garage") && !variationWorkAreaNamesConflict("Garage", "Deck"));
check("3 creation is draft-only and takes organisation from the signed-in lock", createArea.includes("variation_lock_current") && createArea.includes("is distinct from 'draft'") && !createArea.includes("p_org") && createArea.includes("v_lock->>'orgId'") && createArea.includes("v_lock->>'projectId'"));
check("4 cross-tenant and cross-project links fail", sql.includes("'CROSS_TENANT'") && sql.includes("'CROSS_PROJECT'") && sql.includes("v_area.org_id is distinct from") && sql.includes("v_area.project_id is distinct from") && sql.includes("v_area.variation_id is distinct from p_variation"));
check("5 issued work areas are immutable and a new revision copies them", sql.includes("tg_table_name = 'variation_work_areas'") && sql.includes("VARIATION_IMMUTABLE") && sql.includes("copied_from_id") && sql.includes("insert into public.variation_work_areas") && sql.includes("area.copied_from_id = v_source.variation_work_area_id") && !sql.includes("update public.variation_work_areas\n  set revision_id"));
check("6 creating a work area does not write estimator areas, quotes or the ledger", !sql.includes("insert into public.work_areas") && !sql.includes("update public.quotes") && !sql.includes("update public.accepted_commercial_snapshots") && !createArea.includes("variation_accepted_adjustments"));
check("7 Garage items group together and an unlinked item stays out", groups.length === 1 && groups[0]?.name === "Garage" && groups[0]?.items.join("|") === "Garage framing|Garage lining|Garage painting");
check("8 the client document shows the Variation work area and its items", document.scopeGroups[0]?.name === "Garage" && document.scopeGroups[0]?.items.includes("Garage framing") && document.scopeGroups[0]?.items.includes("Garage lining") && documentView.includes('data-variation-scope-groups="true"'));
check("9 the public lookup returns the client-facing name and not internal evidence", lookup.includes("'workAreaName'") && lookup.includes("coalesce(vwa.name, wa.name)") && !lookup.includes("manual_evidence_note") && !lookup.includes("unit_cost"));
check("10 the editor offers no link, accepted areas, Variation areas and create", editor.includes("No linked work area") && editor.includes("Existing accepted Work Areas") && editor.includes("Variation Work Areas") && editor.includes("+ Create new work area") && editor.includes('data-variation-create-work-area="true"') && editor.includes("Create work area"));
check("11 creating a work area stays in the open item dialog", editor.includes("setExtraAreas") && editor.includes("setWorkAreaChoice(`variation:${result.workAreaId}`)") && !editor.slice(editor.indexOf("async function createWorkArea"), editor.indexOf("async function persistSide")).includes("reload("));
check("12 draft scope can be edited or removed and issued scope is read-only in the editor", editor.includes("updateDraftVariationWorkArea") && editor.includes("deleteDraftVariationWorkArea") && editor.includes("{draft ? ("));
check("13 an item stores one scope link", sql.includes("variation_items_one_work_area_chk") && sql.includes("work_area_id is null or variation_work_area_id is null") && actions.includes("workAreaId: input.variationWorkAreaId ? null : input.workAreaId") && actions.includes("assign_draft_variation_item_scope_v1"));
check("14 the manual response starts closed and asks for the outcome first", manual.includes("useState(false)") && manual.includes("Record client response") && manual.includes("How did the client respond?") && manual.includes(">Accepted<") && manual.includes(">Declined<") && manual.includes('data-variation-manual-dialog="true"'));
check("15 accepted and declined reveal only their own confirmation", manual.includes("outcome === \"accepted\"") && manual.includes("Record acceptance") && manual.includes("Record decline") && manual.includes("recording an acceptance already received") && manual.includes("recording a decline already received") && manual.includes("Adjustment {props.adjustmentInclLabel}"));
check("16 cancel closes the dialog without recording a response", manual.includes("if (!next) close();") && !manual.slice(manual.indexOf("function close"), manual.indexOf("function openDialog")).includes("recordVariationResponse"));
check("17 the dialog still uses the existing response command", manual.includes("recordVariationResponse") && manual.includes("confirmReceived: confirmed") && manual.includes("idempotencyKey: key.current") && sql.includes("'INVALID_TRANSITION'") && sql.includes("v_rev.status in ('accepted', 'rejected')"));
check("18 the public response card reuses the Quote card treatment", client.includes("border-neutral-200 bg-neutral-50") && quote.includes("border-neutral-200 bg-neutral-50") && client.includes('data-variation-client-response="true"') && client.includes("Accept Variation") && client.includes("changes the accepted contract value") && !client.toLowerCase().includes("signature"));
check("19 public outcome banners stay distinct and the email is not a response form", publicView.includes("border-emerald-300 bg-emerald-50") && publicView.includes("border-neutral-300 bg-neutral-50") && publicView.includes("text-red-700") && !publicView.includes("recordVariationResponse") && !publicView.includes("Back to Variation"));
check("20 the contractor receipt has an explicit back link and the public receipt does not", receiptView.includes("← Back to Variation") && receiptView.includes("backHref") && internalPage.includes("backHref={loaded.backHref}") && !publicPage.includes("backHref") && !publicPage.includes("Back to Variation"));
check("21 the back link is built from the authorised response row", loader.includes("row.project_id !== projectId") && loader.includes("row.variation_id !== variationId") && loader.includes("row.org_id !== context.orgId") && loader.includes("`/app/projects/${row.project_id}/variations/${row.variation_id}?revision=${row.variation_revision_id}`"));
check("22 a manual decline reason stays off the client receipt", receipt != null && receipt.declineReason == null && receipt.scopeGroups[0]?.name === "Garage" && !JSON.stringify(receipt).includes("manual_evidence_note"));
check("23 public users do not receive the internal evidence note", !publicPage.includes("evidenceNote") && !receiptView.includes("evidenceNote") && internalPage.includes("print:hidden") && internalPage.includes("recordedDeclineReason"));
check("24 work-area writes are authenticated only", sql.includes("revoke all on function public.create_draft_variation_work_area_v1(uuid, uuid, text, text) from public, anon, authenticated, service_role") && sql.includes("grant execute on function public.create_draft_variation_work_area_v1(uuid, uuid, text, text) to authenticated") && sql.includes("grant select on table public.variation_work_areas to authenticated") && !sql.includes("grant insert on table public.variation_work_areas to authenticated"));
check("25 migrations 058–072 are not the work-area file", sql.startsWith("-- VARIATIONS V1-R1") && !read("supabase/migrations/072_variation_response_and_contract_application.sql").includes("variation_work_areas"));

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
