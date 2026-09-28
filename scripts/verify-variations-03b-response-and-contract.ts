/**
 * VARIATIONS-03B — response evidence and accepted contract ledger.
 *
 * Run: npx --yes tsx scripts/verify-variations-03b-response-and-contract.ts
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { calculateRevisedContractValue } from "../lib/variations/domain";
import { variationDeliveryListLabel, variationStatusLabel } from "../lib/variations/presentation";
import {
  summariseVariationResponses,
  variationAttachmentConfirmation,
  variationDeclineExplanation,
  manualEvidenceNoteProblem,
} from "../lib/variations/response";

const root = join(__dirname, "..");
let passed = 0;
let failed = 0;

function read(path: string): string {
  return readFileSync(join(root, path), "utf8");
}

function check(name: string, ok: boolean, detail = ""): void {
  if (ok) {
    passed += 1;
    console.log(`PASS  ${name}`);
  } else {
    failed += 1;
    console.log(`FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

const sql = read("supabase/migrations/072_variation_response_and_contract_application.sql");
const response = read("lib/variations/response.ts");
const actions = read("lib/variations/response-actions.ts");
const email = read("lib/variations/response-email.ts");
const lookup = read("lib/variations/public-lookup.ts");
const publicView = read("components/variations/VariationPublicView.tsx");
const clientForm = read("components/variations/VariationClientResponse.tsx");
const manualForm = read("components/variations/VariationManualResponse.tsx");
const list = read("components/variations/VariationList.tsx");
const domain = read("lib/variations/domain.ts");

const baseline = {
  currency: "NZD",
  gstRate: 15,
  taxTreatment: "gst_exclusive",
  sellExGst: 10000,
  gstAmount: 1500,
  sellInclGst: 11500,
};

const issued = {
  id: "issued",
  status: "issued" as const,
  isCurrent: true,
  totalSellAdjustmentExGst: 900,
  gstAdjustment: 135,
  totalAdjustmentInclGst: 1035,
  items: [],
};
const declined = { ...issued, id: "declined", status: "rejected" as const };
const withdrawn = { ...issued, id: "withdrawn", status: "withdrawn" as const };

console.log("\nVARIATIONS-03B");

check("1 migration 072 is additive and leaves 058–071 untouched", sql.includes("variation_responses") && sql.includes("variation_accepted_adjustments") && !sql.includes("058_project"));
check("2 response evidence stores organisation, project, variation, revision, outcome, source and issued totals", ["org_id", "project_id", "variation_id", "variation_revision_id", "outcome in ('accepted', 'declined')", "source in ('client', 'manual')", "issued_total_ex_gst", "issued_total_incl_gst", "accepted_snapshot_id", "document_identity", "client_attachment_manifest", "idempotency_key", "schema_version"].every((part) => sql.includes(part)));
check("3 ledger stores one signed adjustment and names itself the contract authority", sql.includes("net_adjustment_ex_gst numeric(12, 2) not null") && sql.includes("gst_adjustment numeric(12, 2) not null") && sql.includes("adjustment_incl_gst numeric(12, 2) not null") && sql.includes("revised contract authority"));
check("4 responses and ledger rows reject update and delete", sql.includes("variation response evidence is append-only") && sql.includes("variation_responses_no_update") && sql.includes("variation_responses_no_delete") && sql.includes("variation_accepted_adjustments_no_update") && sql.includes("variation_accepted_adjustments_no_delete") && !sql.includes("correct_variation"));
check("5 one response and one ledger row per logical variation", sql.includes("variation_responses_variation_uidx") && sql.includes("variation_accepted_adjustments_variation_uidx") && sql.includes("variation_responses_idempotency_uidx"));
check("6 terminal transition locks the variation and both entry points share it", sql.includes("for update") && sql.includes("variation_apply_terminal_response_v1") && sql.includes("respond_to_variation_by_token_v1") && sql.includes("record_variation_response_v1"));
check("7 client and manual commands do not accept browser totals or organisation ids", !sql.includes("p_total") && !sql.includes("p_org_id") && !actions.includes("orgId") && !actions.includes("p_adjustment"));
check("8 draft, withdrawn, stale and already-final revisions cannot respond", ["'DRAFT'", "'WITHDRAWN'", "'STALE_REVISION'", "'INVALID_TRANSITION'"].every((code) => sql.includes(code)));
check("9 unresolved manifest blocks acceptance and the stored manifest omits internal files", sql.includes("MANIFEST_UNRESOLVED") && sql.includes("a.visibility = 'client'") && !sql.slice(sql.indexOf("client_attachment_manifest"), sql.indexOf("v_event")).includes("internalDescription"));
check("10 issued money is copied from the revision", sql.includes("v_rev.total_sell_adjustment_ex_gst, v_rev.gst_adjustment, v_rev.total_adjustment_incl_gst") && !sql.includes("v_rev.gst_rate *"));
check("11 events are variation_accepted and variation_declined without private notes", sql.includes("v_event, p_variation, v_variation.variation_number") && sql.includes("'variation_declined'") && sql.includes("variation_append_event") && !sql.includes("variation_append_event(\n      p_org, p_project, p_actor, v_event, p_variation, v_variation.variation_number,\n      p_revision, v_rev.revision_number, v_note"));
check("12 public lookup uses the ledger and keeps internal files out", sql.includes("from public.variation_accepted_adjustments a") && sql.includes("a.visibility = 'client'") && sql.includes("when 'rejected' then 'declined'") && !lookup.includes("unitCost") && !lookup.includes("internalNotes"));
check("13 attachment download stays on the frozen client file after acceptance", sql.includes("v_rev.status not in ('issued', 'accepted', 'rejected')") && sql.includes("visibility = 'client'"));
check("14 authenticated users can select evidence but cannot update or delete it", sql.includes("grant select on table public.variation_responses to authenticated") && sql.includes("revoke all on table public.variation_responses from public, anon, authenticated") && !sql.includes("grant update on table public.variation_responses to authenticated"));
check("15 manual command requires a signed-in organisation and checks the project", sql.includes("NOT_AUTHENTICATED") && sql.includes("CROSS_PROJECT") && sql.includes("CROSS_TENANT") && sql.includes("auth.uid()") && sql.includes("auth_org_id()"));

const contract = calculateRevisedContractValue({
  baseline,
  revisions: [issued, declined, withdrawn],
  ledger: [
    { variationId: "v1", revisionId: "r1", netAdjustmentExGst: 1500, gstAdjustment: 225, adjustmentInclGst: 1725 },
    { variationId: "v2", revisionId: "r2", netAdjustmentExGst: -500, gstAdjustment: -75, adjustmentInclGst: -575 },
  ],
});
check(
  "16 positive and negative ledger entries revise the contract once",
  contract.ok && contract.value.revisedContractValueExGst === 11000 && contract.value.netAcceptedVariationAdjustmentExGst === 1000 && contract.value.pendingVariationValueExGst === 900
);
const missing = calculateRevisedContractValue({
  baseline,
  revisions: [],
  ledger: [{ variationId: "v", revisionId: "r", netAdjustmentExGst: null, gstAdjustment: 10, adjustmentInclGst: 10 }],
});
check("17 missing ledger money is unresolved rather than zero", !missing.ok && missing.ok === false && missing.error === "UNRESOLVED_PRICING");
const pendingOnly = calculateRevisedContractValue({
  baseline,
  revisions: [declined, withdrawn, { ...issued, totalSellAdjustmentExGst: null, gstAdjustment: null, totalAdjustmentInclGst: null }],
  ledger: [],
});
check("18 declined and withdrawn values stay out of the revised contract, and a missing issued price is not zero", !pendingOnly.ok);
check("19 three supporting attachments are named in the confirmation", variationAttachmentConfirmation(3) === "I confirm that I have reviewed this Variation, including its scope, pricing and 3 supporting attachments.");
check("20 verbal and other evidence need a meaningful note", manualEvidenceNoteProblem("verbal_approval", "ok") === "meaningful" && manualEvidenceNoteProblem("email_confirmation", "Email from the client on Tuesday.") === null);
check("21 decline explains that the contract value does not change", variationDeclineExplanation().includes("will not change") && clientForm.includes("Decline Variation") && clientForm.includes("Accept Variation"));
check("22 acceptance states that the contract value changes and does not call it a signature", clientForm.includes("changes the accepted contract value") && !clientForm.toLowerCase().includes("signature") && !publicView.toLowerCase().includes("signature"));
check("23 public terminal states stay read-only and omit internal evidence", publicView.includes("Variation accepted") && publicView.includes("Variation declined") && publicView.includes("did not change the accepted contract value") && !publicView.includes("manual_evidence") && !publicView.includes("userAgent") && !publicView.includes("COST"));
check("24 notification is best-effort after the response and does not email on a retry", actions.includes("await notifyContractor") && actions.includes("if (row.idempotent === true) return") && actions.includes("catch {") && email.includes("Sent securely via Quotr") && email.includes("getQuoteDeliveryProvider") === false);
check("25 notification reuses the existing delivery provider", actions.includes("getQuoteDeliveryProvider") && !actions.includes("new Resend") && !email.includes("resend"));
check("26 list labels distinguish delivery and terminal outcomes", variationDeliveryListLabel({ status: "issued", latestAttempt: null }) === "Issued · Not sent" && variationDeliveryListLabel({ status: "issued", latestAttempt: "sent" }) === "Issued · Sent" && variationDeliveryListLabel({ status: "issued", latestAttempt: "failed" }) === "Issued · Delivery failed" && variationStatusLabel("accepted") === "Accepted" && variationStatusLabel("rejected") === "Declined" && variationStatusLabel("withdrawn") === "Withdrawn" && list.includes("Adjustment applied") && list.includes("Revised accepted contract"));
check("27 manual and client forms do not send organisation ownership or totals", !manualForm.includes("orgId") && !clientForm.includes("totalAdjustment") && manualForm.includes("Record acceptance") && manualForm.includes("Record decline"));

const analytics = summariseVariationResponses([
  { outcome: "accepted", respondedAt: "2026-09-02T00:00:00.000Z", issuedAt: "2026-09-01T00:00:00.000Z", netAdjustmentExGst: 1500 },
  { outcome: "accepted", respondedAt: "2026-09-03T00:00:00.000Z", issuedAt: "2026-09-01T00:00:00.000Z", netAdjustmentExGst: -500 },
  { outcome: "declined", respondedAt: "2026-09-04T00:00:00.000Z", issuedAt: "2026-09-01T00:00:00.000Z", netAdjustmentExGst: 800 },
]);
const emptyAnalytics = summariseVariationResponses([]);
const undated = summariseVariationResponses([{ outcome: "accepted", respondedAt: null, issuedAt: null, netAdjustmentExGst: 100 }]);
check("28 analytics count outcomes, signed adjustments and duration without deriving profit", analytics.acceptedCount === 2 && analytics.declinedCount === 1 && analytics.acceptanceRate === 2 / 3 && analytics.acceptedPositiveAdjustmentExGst === 1500 && analytics.acceptedNegativeAdjustmentExGst === -500 && analytics.netAcceptedContractChangeExGst === 1000 && analytics.averageResponseDurationMs === 2 * 86400000 && emptyAnalytics.acceptanceRate === null && undated.averageResponseDurationMs === null && !response.includes("profit"));
check("29 domain contract comment names the ledger, not lifecycle events", domain.includes("adjustment ledger") && domain.includes("Lifecycle events are not a money source"));
check("30 server action stores request metadata only from headers", actions.includes("clientIpFromHeaders") && actions.includes("userAgentFromHeaders") && !clientForm.includes("userAgent") && !clientForm.includes("x-forwarded-for"));

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
