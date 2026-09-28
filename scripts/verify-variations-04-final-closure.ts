/**
 * VARIATIONS-04 — final hosted closure.
 *
 * Run: npx --yes tsx scripts/verify-variations-04-final-closure.ts
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { calculateRevisedContractValue } from "../lib/variations/domain";
import { buildVariationResponseReceipt } from "../lib/variations/response-receipt";

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

const identity = {
  contractor: { organisationName: "ERC Contracting", tradingName: "ERC Contracting", legalName: "ERC Contracting Limited", email: "builder@example.test", timezone: "Pacific/Auckland" },
  client: { name: "Ada Client" },
  project: { title: "Deck", siteAddress: "12 Site Road" },
  masterQuote: { quoteNumber: "Q-100", revisionNumber: 2, available: true, acceptedAt: "2026-01-15T00:00:00.000Z" },
};
const baseline = { exGst: 10000, gst: 1500, inclGst: 11500 };
const first = { exGst: 1500, gst: 225, inclGst: 1725 };
const later = { exGst: 400, gst: 60, inclGst: 460 };
const versions = {
  authority: "variation-accept-authority-v1",
  scopeAndPrice: "variation-accept-scope-v1",
  attachments: "variation-accept-attachments-v1",
  masterQuoteTerms: "variation-accept-master-terms-v1",
  final: "variation-accept-final-v1",
};

function receipt(overrides: Partial<Parameters<typeof buildVariationResponseReceipt>[0]> = {}) {
  return buildVariationResponseReceipt({
    outcome: "accepted", source: "client", respondedAt: "2026-03-01T01:30:00.000Z",
    responderName: "Ada Client", responderEmail: "ada@example.test", declineReason: null,
    issued: first, currency: "NZD", documentIdentity: identity,
    clientAttachmentManifest: { count: 1, files: [{ displayFilename: "north-elevation.jpg", caption: "North elevation", mimeType: "image/jpeg", byteSize: 5, sortOrder: 0, storageObjectPath: "private/path", internalDescription: "Site diary" }] },
    confirmationVersions: versions, variationNumber: 1, revisionNumber: 1, baseline, earlierAdjustments: [],
    ...overrides,
  });
}

console.log("\nVARIATIONS-04");
const early = receipt();
const afterLater = receipt({ earlierAdjustments: [later] });
const decline = receipt({
  outcome: "declined", issued: later, earlierAdjustments: [first],
  confirmationVersions: { final: "variation-decline-final-v1" },
  clientAttachmentManifest: { count: 0, files: [] }, declineReason: "Not this scope",
});
const contract = calculateRevisedContractValue({
  baseline: { currency: "NZD", gstRate: 15, taxTreatment: "gst_exclusive", sellExGst: 10000, gstAmount: 1500, sellInclGst: 11500 },
  revisions: [
    { id: "accepted", status: "accepted", isCurrent: true, totalSellAdjustmentExGst: 9999, gstAdjustment: 0, totalAdjustmentInclGst: 9999, items: [] },
    { id: "issued", status: "issued", isCurrent: true, totalSellAdjustmentExGst: 200, gstAdjustment: 30, totalAdjustmentInclGst: 230, items: [] },
    { id: "declined", status: "rejected", isCurrent: true, totalSellAdjustmentExGst: 800, gstAdjustment: 120, totalAdjustmentInclGst: 920, items: [] },
    { id: "withdrawn", status: "withdrawn", isCurrent: false, totalSellAdjustmentExGst: 50, gstAdjustment: 7.5, totalAdjustmentInclGst: 57.5, items: [] },
  ],
  ledger: [{ variationId: "v", revisionId: "r", netAdjustmentExGst: 1500, gstAdjustment: 225, adjustmentInclGst: 1725 }],
});
const migration = read("supabase/migrations/072_variation_response_and_contract_application.sql");
const actions = read("lib/variations/response-actions.ts");
const document = read("components/variations/VariationDocument.tsx");
const receiptView = read("components/variations/VariationResponseReceipt.tsx");
const publicView = read("components/variations/VariationPublicView.tsx");
const form = read("components/variations/VariationClientResponse.tsx");
const loader = read("lib/variations/response-receipt-load.ts");
const withdraw = read("supabase/migrations/066_variation_issued_withdrawal.sql");
const migrations = readdirSync(join(root, "supabase/migrations")).filter((name) => name.endsWith(".sql")).sort();

check("1 one response and one ledger row are enforced per Variation", migration.includes("variation_responses_variation_uidx") && migration.includes("variation_accepted_adjustments_variation_uidx") && migration.includes("variation_responses_idempotency_uidx"));
check("2 a terminal response cannot be answered again", migration.includes("v_rev.status in ('accepted', 'rejected')") && migration.includes("'INVALID_TRANSITION'"));
check("3 only an acceptance writes a ledger row", migration.includes("if p_outcome = 'accepted' then") && migration.indexOf("if p_outcome = 'accepted' then") < migration.indexOf("insert into public.variation_accepted_adjustments"));
check("4 the accepted Quote snapshot is not rewritten by a response", !migration.includes("update public.accepted_commercial_snapshots") && !migration.includes("update public.quotes"));
check("5 an earlier receipt stays at the contract from that moment", early?.previousContractExGst === 10000 && early?.revisedContractExGst === 11500 && afterLater?.previousContractExGst === 10400 && afterLater?.revisedContractExGst === 11900);
check("6 a decline keeps the earlier acceptance and changes no contract", decline?.contractUnchanged === true && decline.previousContractExGst === 11500 && decline.revisedContractExGst == null);
check("7 receipt history excludes this Variation and later rows", loader.includes('.lte("accepted_at", response.responded_at)') && loader.includes("row.variation_id === response.variation_id"));
check("8 revised contract money comes from the ledger, not a later status", contract.ok === true && contract.value.revisedContractValueExGst === 11500 && contract.value.pendingVariationValueExGst === 200);
check("9 withdrawal is limited to an issued Variation", withdraw.includes("v_lock->>'status' is distinct from 'issued'") && withdraw.includes("WITHDRAW_BLOCKED"));
check("10 a withdrawn public link has no response actions", publicView.includes('view.state === "withdrawn"') && publicView.includes('view.state === "proposed"') && loader.includes('status === "withdrawn"'));
check("11 client files stay on the receipt and internal file fields do not", early?.attachments[0]?.displayFilename === "north-elevation.jpg" && !JSON.stringify(early).includes("storageObjectPath") && !JSON.stringify(early).includes("Site diary") && migration.includes("a.visibility = 'client'"));
check("12 notification failure cannot roll back the response", actions.indexOf("respond_to_variation_by_token_v1") < actions.indexOf("await notifyContractor") && actions.includes("if (row.idempotent === true) return") && actions.includes("catch {"));
check("13 issued wording stays proposed and a recorded outcome replaces it", document.includes("Proposed Variation — awaiting response") && document.includes("model.statusWording") && document.includes("Contract value unchanged."));
check("14 phone layout wraps long text and keeps money on the page", document.includes("break-all") && document.includes("flex-wrap") && document.includes("min-w-0") && publicView.includes("overflow-x-hidden") && publicView.includes("break-words") && receiptView.includes("break-all"));
check("15 response controls stay keyboard-reachable and errors are announced", form.includes('htmlFor="variation-response-name"') && form.includes("<label") && form.includes('type="checkbox"') && form.includes('role="alert"') && form.includes("Saving…") && form.includes("min-h-11") && form.includes("focus-visible:outline-2"));
check("16 print removes the browser control and keeps the A4 page", read("components/variations/VariationPrintButton.tsx").includes("print:hidden") && read("app/globals.css").includes("size: A4") && receiptView.includes("print:p-0"));
check("17 manual evidence is internal and print-hidden", !receiptView.includes("evidenceNote") && read("app/(protected)/app/projects/[projectId]/variations/[variationId]/response/page.tsx").includes("print:hidden") && read("components/variations/VariationEditor.tsx").includes('data-variation-manual-evidence="true"'));
check("18 work-area migration does not rewrite accepted quotes or estimator areas", migrations.at(-1) === "073_variation_work_areas.sql" && !existsSync(join(root, "supabase/migrations/073_variation_closure.sql")) && !read("supabase/migrations/073_variation_work_areas.sql").includes("update public.accepted_commercial_snapshots") && !read("supabase/migrations/073_variation_work_areas.sql").includes("update public.quotes") && !read("supabase/migrations/073_variation_work_areas.sql").includes("insert into public.work_areas"));
check("19 duplicate catalogue or browser totals are not a second authority", !actions.includes("variation_accepted_adjustments") && read("lib/variations/domain.ts").includes("Accepted revision status is not a money source."));
check("20 public terminal copy stays outcome-specific", publicView.includes("Variation accepted") && publicView.includes("Variation declined") && publicView.includes("did not change the accepted contract value"));

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
