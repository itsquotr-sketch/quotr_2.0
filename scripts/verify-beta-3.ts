/**
 * BETA-3 — Review estimate → Pricing → Quote → Send → Accept UX.
 *
 * Run: npx --yes tsx scripts/verify-beta-3.ts
 *
 * No paid AI. No live Stripe. No Production. No golden restamp.
 * Does not change commercial formulas.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { isTechnicalErrorText, toUserError } from "../lib/errors/user-message";
import { roleAllowsPermission } from "../lib/team/permissions";
import {
  allocateFinalSell,
  presentExpectedGrossMarginPercent,
  sellsMatchRecommended,
} from "../lib/pricing/final-sell";
import { presentStoredGst } from "../lib/pricing/gst-presentation";
import { presentEstimateGst } from "../lib/assistant/presentation/gst-display";
import { MAX_GROSS_MARGIN_PERCENT } from "../lib/security/margin-validation";
import {
  formatContractorQuoteStatusLabel,
  formatClientQuoteStatusLabel,
  contractorQuoteNextActionLabel,
} from "../lib/quotes/status";
import { isInternalClientNarrative } from "../lib/quotes/client-narrative";
import { TRANSACTION_COMPLETION_CAPABILITIES } from "../lib/billing/capabilities";
import { canMutateQuoteSnapshot } from "../lib/quotes/transaction";
import { ASSISTANT_ACTION_LABELS } from "../lib/assistant/presentation/action-labels";

function assert(label: string, ok: boolean) {
  console.log(ok ? "PASS" : "FAIL", label);
  if (!ok) process.exitCode = 1;
}

function read(rel: string): string {
  return readFileSync(join(process.cwd(), rel), "utf8");
}

function section(title: string) {
  console.log(`\n=== ${title} ===\n`);
}

function latestMigration(): string | null {
  const dir = join(process.cwd(), "supabase/migrations");
  if (!existsSync(dir)) return null;
  const files = readdirSync(dir)
    .filter((name) => /^\d+_/.test(name) && name.endsWith(".sql"))
    .sort();
  return files.at(-1) ?? null;
}

function main() {
  console.log("=== BETA-3 pricing and quote UX verification ===");

  const review = read("components/assistant/builder-review/BuilderReviewSurface.tsx");
  const readySurface = read("components/assistant/mode/EstimateReadySurface.tsx");
  const shell = read("components/assistant/AssistantShell.tsx");
  const decision = read("components/pricing/PricingDecisionCard.tsx");
  const workspace = read("components/pricing/PricingWorkspace.tsx");
  const summary = read("components/pricing/PricingSummaryPanel.tsx");
  const waSection = read("components/pricing/PricingWorkAreaSection.tsx");
  const pricingActions = read("lib/pricing/actions.ts");
  const quoteWorkspace = read("components/quotes/QuoteWorkspace.tsx");
  const quoteSummary = read("components/quotes/QuoteSummaryPanel.tsx");
  const sendSheet = read("components/quotes/QuoteSendSheet.tsx");
  const acceptSheet = read("components/quotes/QuoteAcceptSheet.tsx");
  const publicDoc = read("components/quotes/QuotePublicDocument.tsx");
  const publicActions = read("components/quotes/QuotePublicActions.tsx");
  const publicShell = read("components/quotes/QuotePublicShell.tsx");
  const template = read("components/quotes/QuoteTemplate.tsx");
  const tabs = read("components/projects/ProjectWorkspaceTabs.tsx");
  const statusSrc = read("lib/quotes/status.ts");
  const narrative = read("lib/quotes/client-narrative.ts");
  const transaction = read("lib/quotes/transaction.ts");
  const acceptanceActions = read("lib/quotes/acceptance-actions.ts");
  const capabilities = read("lib/billing/capabilities.ts");
  const calc = read("lib/estimate/calculate-estimate.ts");
  const sellFromMargin = read("lib/commercial-engine/core/sell-from-margin.ts");
  const quoteFromPricing = read("lib/quotes/from-pricing.ts");
  const snapshotBuild = read("lib/quotes/build-from-pricing.ts");
  const permissions = read("lib/team/permissions.ts");
  const quoteActions = read("lib/quotes/actions.ts");
  const declineSheet = read("components/quotes/QuoteDeclineSheet.tsx");
  const acceptDetails = read("components/quotes/QuoteAcceptanceDetails.tsx");
  const deliveryHistory = read("components/quotes/QuoteDeliveryHistory.tsx");
  const mobileBar = read("components/quotes/QuoteMobileActionBar.tsx");
  const pricingMobile = read("components/pricing/PricingMobileActionBar.tsx");
  const createDialog = read("components/pricing/CreateFinalPricingDialog.tsx");

  section("ESTIMATE → PRICING BOUNDARY");
  assert(
    "Continue to Pricing is the canonical CTA",
    ASSISTANT_ACTION_LABELS.continueToPricing === "Continue to Pricing"
  );
  assert(
    "Review estimate remains the review CTA",
    ASSISTANT_ACTION_LABELS.reviewEstimate === "Review estimate"
  );
  assert(
    "Builder Review states working-estimate purpose",
    review.includes("working estimate before deciding your final price")
  );
  assert(
    "Pricing decision card states estimate vs pricing vs quote",
    decision.includes("working recommendation") &&
      decision.includes("intend to charge") &&
      decision.includes("quote will use this price")
  );
  assert(
    "Create pricing dialog explains the boundary once",
    createDialog.includes("Pricing is where you decide what to charge")
  );
  assert(
    "Review Continue to Pricing is inside Builder Review",
    review.includes("data-builder-review-cta") &&
      review.includes("PrepareFinalPricingButton")
  );
  assert(
    "Assistant Review receives GST and continue CTA",
    shell.includes("gstRate={initialState.defaultGstRate}") && shell.includes("showContinueToPricing")
  );
  assert("quote summary does not own the status badge", !quoteSummary.includes("statusDef.label"));
  assert(
    "issued snapshot freeze and Auckland expiry calendar remain",
    transaction.includes("canMutateQuoteSnapshot") && transaction.includes("Pacific/Auckland")
  );
  assert(
    "Duplicate mobile pricing CTA hidden while review is open",
    readySurface.includes("reviewOpen") &&
      readySurface.includes("pricingCtaEnabled && !reviewOpen")
  );
  assert(
    "Edit job remains secondary on review",
    review.includes("data-builder-review-edit-job") &&
      review.includes('variant="outline"')
  );

  section("BUILDER REVIEW ABOVE THE FOLD");
  assert(
    "Review shows recommended sell, cost, gross margin, GST, WA totals",
    review.includes("data-builder-review-recommended-sell") &&
      review.includes("data-builder-review-cost-margin") &&
      review.includes("Target gross margin") &&
      review.includes("data-builder-review-gst") &&
      review.includes("data-builder-review-wa-totals")
  );
  assert(
    "Category rollup is not the lead — Cost breakdown is collapsed",
    review.includes("Cost breakdown") &&
      review.includes("data-builder-review-category-summary") &&
      review.includes("<details")
  );
  assert(
    "Work Area details start collapsed",
    review.includes("init[wa.workAreaName] = false")
  );
  assert(
    "Review GST uses presentEstimateGst (no formula change)",
    review.includes("presentEstimateGst") &&
      presentEstimateGst(1000, 15).inclGst === 1150
  );

  section("FINAL-PRICE AUTHORITY");
  assert(
    "Decision card has Use Quotr recommendation and Set my own price",
    decision.includes("Use Quotr recommendation") &&
      decision.includes("Set my own price") &&
      decision.includes("data-pricing-final-price-control")
  );
  assert(
    "applyPricingFinalSell uses existing per-line sell override",
    pricingActions.includes("export async function applyPricingFinalSell") &&
      pricingActions.includes("manualSellOverride: true") &&
      pricingActions.includes("allocateFinalSell")
  );
  const scaled = allocateFinalSell(
    [
      { id: "a", total_sell: 80, total_cost: 50, cost_known: true },
      { id: "b", total_sell: 20, total_cost: 10, cost_known: true },
    ],
    200
  );
  assert("allocation doubles sells proportionally", scaled.ok && scaled.ok && scaled.allocations[0]?.totalSell === 160 && scaled.allocations[1]?.totalSell === 40);
  assert("recommended match helper is tight", sellsMatchRecommended(100, 100.01) && !sellsMatchRecommended(100, 101));
  const belowCost = allocateFinalSell(
    [{ id: "a", total_sell: 100, total_cost: 80, cost_known: true }],
    50
  );
  assert("cannot set final sell below cost", !belowCost.ok);
  const tooHigh = presentExpectedGrossMarginPercent(100, 10000);
  assert(
    "max gross margin policy preserved",
    MAX_GROSS_MARGIN_PERCENT === 95 && !tooHigh.ok
  );
  assert("negative sell rejected", !allocateFinalSell([{ id: "a", total_sell: 10, total_cost: 5, cost_known: true }], -1).ok);
  assert(
    "NaN sell rejected",
    !allocateFinalSell([{ id: "a", total_sell: 10, total_cost: 5, cost_known: true }], Number.NaN).ok
  );

  section("GROSS MARGIN UX");
  assert(
    "Pricing default shows Expected gross margin, not markup",
    decision.includes("Expected gross margin") &&
      !decision.includes("Markup") &&
      summary.includes("Expected gross margin") &&
      !summary.includes("markup")
  );
  assert(
    "Own-price preview derives margin from cost/sell",
    decision.includes("presentExpectedGrossMarginPercent")
  );
  const preview = presentExpectedGrossMarginPercent(80, 100);
  assert("20% gross margin from 80 cost / 100 sell", preview.ok && Math.abs(preview.marginPercent - 20) < 0.001);

  section("GST UX");
  assert(
    "stored GST hides at 0%",
    presentStoredGst({ gstRate: 0, gstAmount: 0, subtotalExGst: 100, totalInclGst: 100 }).showGst === false
  );
  assert(
    "stored GST shows at 15%",
    presentStoredGst({ gstRate: 15, gstAmount: 15, subtotalExGst: 100, totalInclGst: 115 }).showGst === true
  );
  assert("pricing summary hides GST when rate is 0", summary.includes("view.showGst"));
  assert("quote template hides GST when rate is 0", template.includes("gstPresentation.showGst"));
  assert("public mobile total respects showGst", publicActions.includes("view.showGst"));

  section("QUOTE SNAPSHOT");
  assert(
    "issued quotes cannot mutate snapshot",
    canMutateQuoteSnapshot({ status: "draft", send_lock_delivery_id: null, superseded_by_quote_id: null }) &&
      !canMutateQuoteSnapshot({ status: "sent", send_lock_delivery_id: null, superseded_by_quote_id: null }) &&
      !canMutateQuoteSnapshot({ status: "accepted", send_lock_delivery_id: null, superseded_by_quote_id: null })
  );
  assert(
    "quote is built from reviewed pricing snapshot",
    snapshotBuild.includes("buildQuoteSnapshotFromReviewedPricing") &&
      quoteFromPricing.includes("visible_on_quote")
  );
  assert(
    "pricing changes do not silently rewrite issued quotes",
    workspace.includes("Changing this price does not change a sent") &&
      quoteWorkspace.includes("Create revision")
  );

  section("CLIENT-SAFE BOUNDARY");
  assert("PACKAGE_FALLBACK is internal", isInternalClientNarrative("PACKAGE_FALLBACK"));
  assert("Medium confidence is internal", isInternalClientNarrative("Medium confidence"));
  assert("benchmark remains internal", isInternalClientNarrative("Quotr benchmark"));
  assert("site access stays client-safe", !isInternalClientNarrative("Pricing assumes clear site access."));
  assert(
    "public template has no internal cost/margin",
    !template.includes("gross margin") &&
      !template.includes("recommendedCost") &&
      !publicDoc.includes("gross_profit")
  );
  assert("narrative filter covers confidence enums", narrative.includes("high|medium|low) confidence"));

  section("FRIENDLY STATUS LABELS");
  assert("draft is Ready to send for contractor", formatContractorQuoteStatusLabel("draft") === "Ready to send");
  assert("sent/viewed/accepted/declined/expired labels", 
    formatContractorQuoteStatusLabel("sent") === "Sent" &&
    formatContractorQuoteStatusLabel("viewed") === "Viewed" &&
    formatContractorQuoteStatusLabel("accepted") === "Accepted" &&
    formatContractorQuoteStatusLabel("declined") === "Declined" &&
    formatContractorQuoteStatusLabel("expired") === "Expired"
  );
  assert("client public draft does not leak Draft", formatClientQuoteStatusLabel("draft") === "Sent");
  assert("next action for draft is Send quote", contractorQuoteNextActionLabel("draft") === "Send quote");
  assert("Quote tab uses contractor labels", tabs.includes("formatContractorQuoteStatusLabel"));
  assert("no customer-facing Quote transaction", !quoteWorkspace.includes("Quote transaction") && statusSrc.includes("Ready to send"));
  assert("delivery accepted is not shown as quote accepted", deliveryHistory.includes("Email submitted — finalising Quote status"));

  section("SEND GATE");
  assert(
    "send requires quotes.send entitlement",
    quoteActions.includes('entitlement: "quotes.send"') || quoteActions.includes('permission: "quotes.send"')
  );
  assert(
    "quotes.acceptance is transaction completion",
    TRANSACTION_COMPLETION_CAPABILITIES.includes("quotes.acceptance") &&
      capabilities.includes("TRANSACTION_COMPLETION_CAPABILITIES")
  );
  assert(
    "public accept does not check contractor billing",
    !acceptanceActions.includes('entitlement: "quotes.send"') &&
      read("lib/quotes/entitlements.ts").includes("not gated on contractor billing")
  );
  assert("send sheet has client email + send confirmation", sendSheet.includes("quote-send-email") && sendSheet.includes("Quote sent to"));
  assert("copy client link is available after send", sendSheet.includes("Copy client link"));
  assert("send success is visible on contractor quote", quoteWorkspace.includes("data-quote-send-success"));

  section("PUBLIC ACCEPT / DECLINE / EXPIRY");
  assert("public page has Accept quote + Decline", publicActions.includes("Accept quote") && publicActions.includes("Decline"));
  assert("digital acceptance language is accurate", acceptSheet.includes("identity-verified signature"));
  assert("accepted reopen hides actions", publicActions.includes("canClientAcceptQuote") && publicShell.includes("Quote accepted"));
  assert("expired banner exists", publicShell.includes("This quote expired") || publicShell.includes("has expired"));
  assert("decline optional reason exists", declineSheet.includes("Tell us why (optional)"));
  assert("no login on public quote", publicDoc.includes("QuotePublicDocument") && !publicDoc.includes("requireAuth"));

  section("TIMEZONE");
  assert(
    "acceptance display uses org timezone helper",
    acceptDetails.includes("formatQuoteDateTime") &&
      publicShell.includes("resolveDisplayTimezone")
  );
  assert("workspace uses displayTimeZone", quoteWorkspace.includes("resolveDisplayTimezone"));

  section("ROLE PERMISSIONS");
  assert("Owner can edit pricing", roleAllowsPermission("owner", "pricing.edit"));
  assert("Admin can edit pricing", roleAllowsPermission("admin", "pricing.edit"));
  assert("Estimator can edit pricing and send quotes", roleAllowsPermission("estimator", "pricing.edit") && roleAllowsPermission("estimator", "quotes.send"));
  assert("Viewer cannot edit pricing or send quotes", !roleAllowsPermission("viewer", "pricing.edit") && !roleAllowsPermission("viewer", "quotes.send") && !roleAllowsPermission("viewer", "quotes.create"));
  assert("pricing mutations require pricing.edit", pricingActions.includes("requirePricingEditPermission") && pricingActions.includes('permission: "pricing.edit"'));
  assert("quote update requires quotes.create", quoteActions.includes('permission: "quotes.create"'));
  assert("permissions file unchanged for Estimator project pricing", permissions.includes('"pricing.edit"') && permissions.includes("estimator"));

  section("FRIENDLY ERRORS");
  assert("PGRST is technical", isTechnicalErrorText("PGRST205: Could not find the table"));
  assert("toUserError maps PGRST away", !toUserError("PGRST116: ...").includes("PGRST"));
  assert("pricing save uses toUserError", pricingActions.includes("toUserError") && pricingActions.includes("Could not save pricing changes"));
  assert("apply final sell uses friendly errors", read("lib/pricing/final-sell.ts").includes("Final price cannot be negative"));
  assert("no raw PostgREST in touched UX files", !decision.includes("PostgREST") && !sendSheet.includes("PostgREST") && !acceptSheet.includes("RPC"));

  section("MOBILE STRUCTURAL CONTRACTS");
  assert("review CTAs are full-width min-h-11", review.includes("h-11 min-h-11 w-full"));
  assert("pricing decision card exists for mobile hero", decision.includes("data-pricing-decision-card"));
  assert("pricing line tables are advanced/collapsed", workspace.includes("data-pricing-advanced-lines") && waSection.includes("useState(false)"));
  assert("pricing mobile bar exists", pricingMobile.includes("data-pricing-mobile-action-bar"));
  assert("public mobile accept bar is sticky", publicActions.includes('data-quote-public-actions="mobile"') && publicActions.includes("fixed inset-x-0 bottom-0"));
  assert("contractor quote mobile send is primary", mobileBar.includes("Send quote") && quoteWorkspace.includes("Back to Pricing"));
  assert("quote preview labelled for the client", quoteWorkspace.includes("What the client will see"));

  section("NAVIGATION / TERMINOLOGY");
  assert("project tabs are Estimate / Pricing / Quote", tabs.includes("\n            Estimate\n") && tabs.includes("Pricing") && tabs.includes("Quote") && tabs.includes('activeTab === "assistant"'));
  assert("no customer-facing Quick Estimate in tabs", !tabs.includes("quick estimate"));
  assert("Open Pricing replaces Open final pricing", read("components/pricing/PrepareFinalPricingButton.tsx").includes("Open Pricing"));
  assert("allowance helper is plain language", review.includes("budgeted amount included in the price"));

  section("ECONOMIC INTEGRITY");
  assert("calculate-estimate not importing beta-3 UX files", !calc.includes("PricingDecisionCard") && !calc.includes("final-sell"));
  assert("sell-from-margin formula file untouched by presentation", sellFromMargin.includes("deriveSellFromCost"));
  assert(
    "no BETA-3-owned migration 053",
    latestMigration() === "052_company_productivity_calibration.sql"
  );
  assert(
    "create pricing uses the current/latest estimate",
    pricingActions.includes('.order("created_at", { ascending: false })') &&
      pricingActions.includes("Generate an estimate before continuing to pricing.")
  );

  section("ACCEPTANCE EVIDENCE");
  assert("contractor sees client name and timestamp", acceptDetails.includes("Accepted by") && acceptDetails.includes("formatQuoteDateTime"));
  assert("fingerprint is not shown as a raw hash", !acceptDetails.includes("snapshot_fingerprint}"));
  assert("IP is not shown", acceptDetails.includes("Technical network evidence is stored privately"));
}

main();
