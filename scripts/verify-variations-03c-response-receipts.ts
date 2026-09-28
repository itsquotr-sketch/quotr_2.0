/**
 * VARIATIONS-03C — response receipts and commercial record.
 *
 * Run: npx --yes tsx scripts/verify-variations-03c-response-receipts.ts
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  buildVariationClientConfirmationEmail,
  buildVariationResponseNotificationEmail,
} from "../lib/variations/response-email";
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

function identity(title = "Deck") {
  return {
    contractor: {
      organisationName: "ERC Contracting",
      tradingName: "ERC Contracting",
      legalName: "ERC Contracting Limited",
      email: "builder@example.test",
      phone: "021000000",
      logoUrl: "https://example.test/logo.png",
      timezone: "Pacific/Auckland",
      addressLine1: "1 Yard Lane",
      city: "Auckland",
    },
    client: { name: "Ada Client" },
    project: { title, siteAddress: "12 Site Road" },
    masterQuote: {
      quoteNumber: "Q-100",
      revisionNumber: 2,
      available: true,
      acceptedAt: "2026-01-15T00:00:00.000Z",
    },
  };
}

const manifest = {
  count: 1,
  files: [{
    fileId: "secret-file-id",
    displayFilename: "north-elevation.jpg",
    caption: "North elevation",
    mimeType: "image/jpeg",
    byteSize: 5,
    sortOrder: 0,
    storageObjectPath: "org/project/private-note.pdf",
    internalDescription: "Site diary",
  }],
};

const acceptVersions = {
  authority: "variation-accept-authority-v1",
  scopeAndPrice: "variation-accept-scope-v1",
  attachments: "variation-accept-attachments-v1",
  masterQuoteTerms: "variation-accept-master-terms-v1",
  final: "variation-accept-final-v1",
};

const baseline = { exGst: 10000, gst: 1500, inclGst: 11500 };
const positive = { exGst: 1500, gst: 225, inclGst: 1725 };
const negative = { exGst: -500, gst: -75, inclGst: -575 };

function receipt(overrides: Partial<Parameters<typeof buildVariationResponseReceipt>[0]> = {}) {
  return buildVariationResponseReceipt({
    outcome: "accepted",
    source: "client",
    respondedAt: "2026-03-01T01:30:00.000Z",
    responderName: "Ada Client",
    responderEmail: "ada@example.test",
    declineReason: null,
    issued: positive,
    currency: "NZD",
    documentIdentity: identity(),
    clientAttachmentManifest: manifest,
    confirmationVersions: acceptVersions,
    variationNumber: 4,
    revisionNumber: 1,
    baseline,
    earlierAdjustments: [],
    ...overrides,
  });
}

console.log("\nVARIATIONS-03C");
const accepted = receipt();
const declined = receipt({
  outcome: "declined",
  declineReason: "Not this scope",
  confirmationVersions: { final: "variation-decline-final-v1" },
  clientAttachmentManifest: { count: 0, files: [] },
});
const manual = receipt({
  source: "manual",
  outcome: "accepted",
  issued: negative,
  earlierAdjustments: [positive],
  confirmationVersions: { received: "variation-manual-received-v1" },
  clientAttachmentManifest: { count: 0, files: [] },
  responderEmail: null,
});
const renamed = receipt({ documentIdentity: identity("Deck") });
const missingBaseline = receipt({ baseline: null });
const unknownConfirmation = receipt({ confirmationVersions: { authority: "variation-accept-authority-v2" } });
const acceptedText = JSON.stringify(accepted);
const clientEmail = accepted ? buildVariationClientConfirmationEmail({ receipt: accepted, recordUrl: "https://example.test/v/vt_example/response" }) : null;
const contractorEmail = accepted ? buildVariationResponseNotificationEmail({ receipt: accepted, internalUrl: "https://example.test/app/projects/p/variations/v" }) : null;
const declinedEmail = declined ? buildVariationClientConfirmationEmail({ receipt: declined, recordUrl: "https://example.test/v/vt_example/response" }) : null;
const actions = read("lib/variations/response-actions.ts");
const receiptView = read("components/variations/VariationResponseReceipt.tsx");
const form = read("components/variations/VariationClientResponse.tsx");
const publicPage = read("app/v/[token]/response/page.tsx");
const internalPage = read("app/(protected)/app/projects/[projectId]/variations/[variationId]/response/page.tsx");
const editor = read("components/variations/VariationEditor.tsx");
const list = read("components/variations/VariationList.tsx");
const loader = read("lib/variations/response-receipt-load.ts");
const emailSource = read("lib/variations/response-email.ts");
const forbidden = ["COST", "margin", "profit", "unitCost", "userAgent", "manual_evidence", "storageObjectPath", "builder_actor"];

check("1 accepted receipt uses frozen identity, quote, adjustment and confirmations", Boolean(accepted) && accepted?.companyName === "ERC Contracting" && accepted?.clientName === "Ada Client" && accepted?.projectTitle === "Deck" && accepted?.siteAddress === "12 Site Road" && accepted?.variationNumber === 4 && accepted?.quoteNumber === "Q-100" && accepted?.quoteRevision === 2 && accepted?.adjustmentExGst === 1500 && accepted?.adjustmentGst === 225 && accepted?.adjustmentInclGst === 1725 && accepted?.sourceLabel === "Client response" && accepted?.confirmations.some((line) => line.includes("3 supporting attachments") === false && line.includes("1 supporting attachment")) && accepted?.masterQuoteStatement.includes("Q-100") && accepted?.reference === "Q-100-V4-R1");
check("2 accepted receipt states the previous and revised contract from stored amounts", accepted?.previousContractExGst === 10000 && accepted?.revisedContractExGst === 11500 && accepted?.contractUnchanged === false);
check("3 a later adjustment is not part of an earlier receipt", manual?.previousContractExGst === 11500 && manual?.revisedContractExGst === 11000 && manual?.sourceLabel === "Recorded manually");
check("4 declined receipt leaves the contract unchanged and keeps the client reason", declined?.contractUnchanged === true && declined?.revisedContractExGst == null && declined?.declineReason === "Not this scope" && declined?.outcomeLabel === "Declined");
check("5 attachment list is the frozen client manifest", accepted?.attachmentCount === 1 && accepted?.attachments[0]?.displayFilename === "north-elevation.jpg" && !acceptedText.includes("storageObjectPath") && !acceptedText.includes("Site diary") && !acceptedText.includes("secret-file-id"));
check("6 missing baseline or an unknown confirmation blocks the receipt", missingBaseline == null && unknownConfirmation == null);
check("7 a renamed live project is not an input to the receipt", renamed?.projectTitle === "Deck" && !read("lib/variations/response-receipt.ts").includes("liveProjectTitle"));
check("8 client acceptance email uses the required subject and record link", Boolean(clientEmail && accepted) && clientEmail!.subject === "Variation 4 accepted — Deck" && clientEmail!.html.includes("View response record") && clientEmail!.html.includes("Sent securely via Quotr") && clientEmail!.html.includes("Q-100") && clientEmail!.text.includes(accepted!.revisedContractInclLabel ?? ""));
check("9 client decline email says the contract is unchanged", declinedEmail?.subject === "Variation 4 declined — Deck" && declinedEmail.html.includes("Contract value unchanged"));
check("10 client email omits internal commercial fields", Boolean(clientEmail) && forbidden.every((word) => !clientEmail!.html.includes(word) && !clientEmail!.text.includes(word)));
check("11 contractor notification includes the outcome, adjustment, revised contract and internal link", Boolean(contractorEmail) && contractorEmail!.text.includes("Ada Client") && contractorEmail!.text.includes("Revised accepted contract") && contractorEmail!.html.includes("View Variation") && !contractorEmail!.text.includes("userAgent") && !contractorEmail!.html.includes("manual_evidence"));
check("12 emails do not open a second provider", !emailSource.includes("new Resend") && !emailSource.includes("api.resend.com"));
check("13 notification failure stays after the committed response", actions.indexOf("respond_to_variation_by_token_v1") < actions.indexOf("await notifyContractor") && actions.includes("catch {") && actions.includes("if (row.idempotent === true) return") && !actions.includes("variation_accepted_adjustments"));
check("14 public receipt route reads the token, not query-string totals", publicPage.includes("loadPublicVariationResponseReceipt(token)") && !publicPage.includes("searchParams") && publicPage.includes("Print / Save as PDF") === false && publicPage.includes("VariationPrintButton"));
check("15 withdrawn and unavailable tokens do not render a receipt", loader.includes("withdrawn") && loader.includes("isVariationAccessTokenFormat") && loader.includes("current_revision_id"));
check("16 internal receipt access is signed-in and project scoped", loader.includes("getAuthOrgContext") && loader.includes('.eq("org_id", context.orgId)') && loader.includes('.eq("project_id", projectId)'));
check("17 manual evidence stays off the client receipt and on the internal record", !receiptView.includes("evidenceNote") && !receiptView.includes("manual_evidence") && internalPage.includes("print:hidden") && internalPage.includes("Recorded by") && internalPage.includes("Evidence note"));
check("18 public terminal page links to the response record and drops the response form after an outcome", read("components/variations/VariationPublicView.tsx").includes("View response record") && read("components/variations/VariationPublicView.tsx").includes('view.state === "proposed"'));
check("19 internal response section shows outcome, record link and manual evidence", editor.includes(">Response<") && editor.includes("View response record") && editor.includes("Recorded by") && editor.includes("Contract value unchanged") && editor.includes("A failed notification does not change this response."));
check("20 list keeps status, date and adjustment scannable", list.includes('data-variation-list-scan="true"') && list.includes("Adjustment applied"));
check("21 response form stacks controls, labels errors and blocks a second submit", form.includes("flex-col") && form.includes("min-h-11") && form.includes('role="alert"') && form.includes("focus-visible:outline-2") && form.includes("lock.current") && form.includes("Saving…") && form.includes('htmlFor="variation-response-name"'));
check("22 receipt prints with the quote document conventions", receiptView.includes("quote-template") && receiptView.includes("overflow-x-hidden") && receiptView.includes("break-all") && read("app/globals.css").includes("size: A4") && read("components/variations/VariationPrintButton.tsx").includes("Print / Save as PDF"));
check("23 receipt view does not render internal commercial fields", forbidden.every((word) => !receiptView.includes(word)));

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
