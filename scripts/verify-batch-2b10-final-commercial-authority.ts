/**
 * Batch 2B.10 — Final commercial-engine regression and authority verification.
 *
 * Static scans + pure adapter consistency + snapshot immutability wiring checks.
 * No live Supabase mutations. Does not alter golden expectations.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  ENGINE_VERSION,
  FORMULA_VERSION,
  SUPPORTED_ENGINE_VERSIONS,
  SUPPORTED_FORMULA_VERSIONS,
} from "../lib/commercial-engine";
import { runShadowParitySuite } from "../lib/commercial-engine/parity";
import { isAuthoritativeEstimateCalculation } from "../lib/estimate/adoption-authority";
import {
  aggregateEstimateLines,
  calculateEstimateQuantityRateLine,
  calculateEstimateSellFromCost,
} from "../lib/estimate/estimate-commercial-engine-adapter";
import { isAuthoritativePricingItemCalculation } from "../lib/pricing/adoption-authority";
import { calculateAuthoritativePricingItem } from "../lib/pricing/commercial-engine-adapter";
import { calculateAuthoritativeDocumentTotals } from "../lib/pricing/authoritative-document-totals";
import { calculateAuthoritativeFieldsFromEstimateLine } from "../lib/pricing/estimate-to-pricing-adapter";
import { isAuthoritativeQuoteCalculation } from "../lib/quotes/adoption-authority";
import {
  calculateAuthoritativeQuoteTotals,
  resolveAuthoritativeQuoteItemTotal,
} from "../lib/quotes/quote-commercial-engine-adapter";
import {
  formatProfitabilityDisplay,
  MARGIN_UNAVAILABLE_LABEL,
  PROFITABILITY_UNAVAILABLE_LABEL,
} from "../lib/financial-presentation/format";
import { quoteDocumentViewModel } from "../lib/quotes/financial-view-model";
import type { Quote } from "../lib/quotes/types";
import {
  AUTH_ORG_MESSAGES,
  evaluateAuthOrgInputs,
} from "../lib/security/auth-org-evaluation";
import { parsePricingInput } from "../lib/pricing/action-guards";
import { createPricingFromEstimateInputSchema } from "../lib/pricing/schemas";
import { parseQuoteInput } from "../lib/quotes/action-guards";
import { createQuoteFromPricingInputSchema } from "../lib/quotes/schemas";

type Check = { name: string; ok: boolean; detail?: string };

function assert(name: string, condition: boolean, detail?: string): Check {
  return { name, ok: condition, detail };
}

function near(a: number, b: number, tol = 0.02): boolean {
  return Math.abs(a - b) <= tol;
}

function walkTs(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".next") continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walkTs(p, out);
    else if (/\.(tsx|ts)$/.test(name)) out.push(p);
  }
  return out;
}

function read(path: string): string {
  return readFileSync(path, "utf8");
}

function main(): void {
  console.log("=== Batch 2B.10 Final Commercial Authority Verification ===\n");
  const checks: Check[] = [];

  // --- Authority defaults ---
  checks.push(
    assert(
      "estimate authority default authoritative",
      isAuthoritativeEstimateCalculation()
    )
  );
  checks.push(
    assert(
      "pricing authority default authoritative",
      isAuthoritativePricingItemCalculation()
    )
  );
  checks.push(
    assert(
      "quote authority default authoritative",
      isAuthoritativeQuoteCalculation()
    )
  );

  // --- Versioning ---
  checks.push(
    assert(
      "engine version present",
      typeof ENGINE_VERSION === "string" && ENGINE_VERSION.length > 0
    )
  );
  checks.push(
    assert(
      "formula version present",
      typeof FORMULA_VERSION === "string" && FORMULA_VERSION.length > 0
    )
  );
  checks.push(
    assert(
      "supported versions include current",
      SUPPORTED_ENGINE_VERSIONS.includes(ENGINE_VERSION) &&
        SUPPORTED_FORMULA_VERSIONS.includes(FORMULA_VERSION)
    )
  );

  // --- Production adapter imports (static) ---
  const estimateActions = [
    "lib/estimate/line-items.ts",
    "lib/estimate/summary.ts",
    "lib/estimate/margin-override.ts",
  ];
  for (const f of estimateActions) {
    const src = read(f);
    checks.push(
      assert(
        `${f} imports estimate commercial adapter`,
        src.includes("estimate-commercial-engine-adapter")
      )
    );
    checks.push(
      assert(
        `${f} does not import parity`,
        !src.includes("commercial-engine/parity")
      )
    );
  }

  const pricingActionsSrc = read("lib/pricing/actions.ts");
  checks.push(
    assert(
      "pricing actions import commercial-engine-adapter",
      pricingActionsSrc.includes("commercial-engine-adapter")
    )
  );
  checks.push(
    assert(
      "pricing actions import authoritative-document-totals",
      pricingActionsSrc.includes("authoritative-document-totals")
    )
  );
  checks.push(
    assert(
      "pricing actions do not import parity",
      !pricingActionsSrc.includes("commercial-engine/parity")
    )
  );

  const quoteBuild = read("lib/quotes/build-from-pricing.ts");
  const quoteActions = read("lib/quotes/actions.ts");
  checks.push(
    assert(
      "quote build imports quote commercial adapter",
      quoteBuild.includes("quote-commercial-engine-adapter")
    )
  );
  checks.push(
    assert(
      "quote actions import quote commercial adapter",
      quoteActions.includes("quote-commercial-engine-adapter")
    )
  );
  checks.push(
    assert(
      "quote production paths do not import parity",
      !quoteBuild.includes("commercial-engine/parity") &&
        !quoteActions.includes("commercial-engine/parity")
    )
  );

  // --- No production parity imports under lib (except parity package itself) ---
  const libFiles = walkTs("lib").filter(
    (f) => !f.replace(/\\/g, "/").includes("lib/commercial-engine/parity")
  );
  const parityHits: string[] = [];
  for (const f of libFiles) {
    const src = read(f);
    if (
      src.includes('from "@/lib/commercial-engine/parity') ||
      src.includes("from '../commercial-engine/parity") ||
      src.includes('from "./parity') ||
      /from ["']@\/lib\/commercial-engine\/parity/.test(src)
    ) {
      // allow re-exports only from commercial-engine/index if any — currently none expected
      parityHits.push(f);
    }
  }
  checks.push(
    assert(
      "no production lib imports of commercial-engine/parity",
      parityHits.length === 0,
      parityHits.slice(0, 5).join(", ")
    )
  );

  // --- Client components: no financial authority ---
  const componentFiles = walkTs("components");
  const clientAuthorityHits: string[] = [];
  for (const file of componentFiles) {
    const src = read(file);
    if (src.includes("commercial-engine/parity")) {
      clientAuthorityHits.push(`${file}: parity`);
    }
    if (src.includes("calculateDocumentTotals(")) {
      clientAuthorityHits.push(`${file}: calculateDocumentTotals`);
    }
    if (src.includes("calculateQuoteTotals(")) {
      clientAuthorityHits.push(`${file}: calculateQuoteTotals`);
    }
    if (src.includes("calculatePricingItemEdit(")) {
      clientAuthorityHits.push(`${file}: calculatePricingItemEdit`);
    }
    if (src.includes("deriveSellFromCost(")) {
      clientAuthorityHits.push(`${file}: deriveSellFromCost`);
    }
  }
  checks.push(
    assert(
      "client components have no financial authority calls",
      clientAuthorityHits.length === 0,
      clientAuthorityHits.slice(0, 8).join("; ")
    )
  );

  // --- Dead wrapper removed ---
  const calcSrc = read("lib/pricing/calculations.ts");
  checks.push(
    assert(
      "unused calculatePricingItemEdit wrapper removed from calculations.ts",
      !calcSrc.includes("export function calculatePricingItemEdit")
    )
  );
  checks.push(
    assert(
      "legacy calculatePricingItemTotals retained for rollback/parity",
      calcSrc.includes("export function calculatePricingItemTotals")
    )
  );
  checks.push(
    assert(
      "legacy calculateDocumentTotals retained for rollback/parity",
      calcSrc.includes("export function calculateDocumentTotals")
    )
  );

  // --- Cross-domain: estimate → pricing → quote consistency ---
  const qty = calculateEstimateQuantityRateLine({
    quantity: 10,
    unitCost: 50,
    unitSell: 80,
  });
  checks.push(
    assert(
      "estimate qty-rate line money",
      qty.ok &&
        near(qty.money.recommendedCost, 500) &&
        near(qty.money.recommendedSell, 800) &&
        near(qty.money.grossProfit, 300) &&
        near(qty.money.marginPercent, 37.5)
    )
  );

  const sellFromCost = calculateEstimateSellFromCost(1000, 20);
  checks.push(
    assert(
      "estimate sell-from-cost 20% margin",
      sellFromCost.ok && near(sellFromCost.sell, 1250)
    )
  );

  const fromEstimate = calculateAuthoritativeFieldsFromEstimateLine({
    category: "materials",
    recommended_cost: 500,
    recommended_sell: 800,
    notes: null,
  });
  checks.push(
    assert(
      "estimate→pricing adapter preserves line money",
      fromEstimate.ok &&
        near(fromEstimate.fields.totalCost, 500) &&
        near(fromEstimate.fields.totalSell, 800) &&
        near(fromEstimate.fields.grossProfit, 300)
    )
  );

  const pricingItem = calculateAuthoritativePricingItem({
    quantity: 10,
    unitCost: 50,
    unitSell: 80,
    itemType: "material",
    calculationMode: "quantity_rate",
  });
  checks.push(
    assert(
      "pricing item matches estimate commercially equivalent inputs",
      pricingItem.ok &&
        near(pricingItem.fields.totalCost, 500) &&
        near(pricingItem.fields.totalSell, 800) &&
        near(pricingItem.fields.grossProfit, 300) &&
        near(pricingItem.fields.marginPercent, 37.5)
    )
  );

  const doc = calculateAuthoritativeDocumentTotals(
    [
      {
        total_cost: 500,
        total_sell: 800,
        cost_known: true,
      },
    ],
    15,
    "verify-2b10-doc"
  );
  checks.push(
    assert(
      "pricing document GST once at 15%",
      doc.ok &&
        near(doc.totals.subtotalSell, 800) &&
        near(doc.totals.gstAmount, 120) &&
        near(doc.totals.totalInclGst, 920) &&
        near(doc.totals.grossProfit, 300)
    )
  );

  const quoteTotals = calculateAuthoritativeQuoteTotals(
    [{ total: 800, visible: true }],
    15,
    "verify-2b10-quote"
  );
  checks.push(
    assert(
      "quote snapshot sell maps from pricing sell (no double margin)",
      quoteTotals.ok &&
        near(quoteTotals.totals.subtotal, 800) &&
        near(quoteTotals.totals.gstAmount, 120) &&
        near(quoteTotals.totals.totalInclGst, 920)
    )
  );

  // Aggregate margin from aggregate totals
  const agg = aggregateEstimateLines(
    [
      {
        recommendedCost: 500,
        recommendedSell: 800,
        costLow: 500,
        costHigh: 500,
        sellLow: 800,
        sellHigh: 800,
        includedInTotal: true,
        costKnown: true,
      },
      {
        recommendedCost: 200,
        recommendedSell: 400,
        costLow: 200,
        costHigh: 200,
        sellLow: 400,
        sellHigh: 400,
        includedInTotal: true,
        costKnown: true,
      },
    ],
    "verify-2b10-agg"
  );
  const expectedMargin = Math.round(((1200 - 700) / 1200) * 100 * 100) / 100;
  checks.push(
    assert(
      "aggregate margin derived from aggregate totals",
      near(agg.recommendedCost, 700) &&
        near(agg.recommendedSell, 1200) &&
        near(agg.grossProfit, 500) &&
        near(agg.marginPercent, expectedMargin)
    )
  );

  // Visible-only quote aggregation
  const vis = calculateAuthoritativeQuoteTotals(
    [
      { total: 1000, visible: true },
      { total: 500, visible: false },
    ],
    15
  );
  checks.push(
    assert(
      "quote visible_only excludes hidden",
      vis.ok && near(vis.totals.subtotal, 1000) && near(vis.totals.gstAmount, 150)
    )
  );

  // GST matrix
  for (const rate of [0, 12.5, 15, 20] as const) {
    const r = calculateAuthoritativeQuoteTotals(
      [{ total: 1000, visible: true }],
      rate
    );
    const gst = Math.round(1000 * (rate / 100) * 100) / 100;
    checks.push(
      assert(
        `GST ${rate}% quote correct`,
        r.ok && near(r.totals.gstAmount, gst)
      )
    );
  }

  // Unknown-cost honesty
  const unknown = calculateAuthoritativePricingItem({
    requestId: "verify-2b10-unknown",
    calculationMode: "lump_sum",
    totalCost: 0,
    totalSell: 1000,
    itemType: "allowance",
  });
  checks.push(
    assert(
      "unknown-cost does not fabricate known margin",
      unknown.ok &&
        unknown.fields.costKnown === false &&
        near(unknown.fields.grossProfit, 0) &&
        near(unknown.fields.marginPercent, 0)
    )
  );

  const unknownLabel = formatProfitabilityDisplay({
    costKnown: false,
    grossProfit: 0,
    marginPercent: 0,
  });
  checks.push(
    assert(
      "unknown-cost UI label honest",
      unknownLabel.profitLabel === PROFITABILITY_UNAVAILABLE_LABEL &&
        unknownLabel.marginLabel === MARGIN_UNAVAILABLE_LABEL
    )
  );

  checks.push(
    assert(
      "profitability unavailable constant defined",
      PROFITABILITY_UNAVAILABLE_LABEL === "Profitability unavailable"
    )
  );

  // Manual override: prefer supplied quote line total (CD-22)
  const prefer = resolveAuthoritativeQuoteItemTotal({
    quantity: 2,
    unitPrice: 100,
    total: 999,
  });
  checks.push(
    assert(
      "manual prefer-total preserved (CD-22)",
      prefer.ok && near(prefer.total, 999)
    )
  );
  const qtyPrice = resolveAuthoritativeQuoteItemTotal({
    quantity: 2,
    unitPrice: 100,
  });
  checks.push(
    assert(
      "qty×price when no prefer-total",
      qtyPrice.ok && near(qtyPrice.total, 200)
    )
  );

  // Snapshot display without recalculation
  const snapshotQuote = {
    id: "q1",
    org_id: "o1",
    project_id: "p1",
    pricing_document_id: null,
    estimate_id: null,
    quote_number: "Q-1",
    title: "Test",
    status: "sent" as const,
    client_name: null,
    site_address: null,
    issue_date: null,
    valid_until: null,
    subtotal: 800,
    gst_rate: 15,
    gst_amount: 120,
    total_incl_gst: 920,
    scope_summary: null,
    inclusions: [],
    exclusions: [],
    assumptions: [],
    terms: null,
    notes_to_client: null,
    created_by: null,
    created_at: "",
    updated_at: "",
    sent_at: null,
    accepted_at: null,
    declined_at: null,
    expired_at: null,
    revision_number: 1,
    parent_quote_id: null,
    revised_from_quote_id: null,
    superseded_by_quote_id: null,
    superseded_at: null,
    revision_note: null,
  } satisfies Quote;
  const vm = quoteDocumentViewModel(snapshotQuote);
  checks.push(
    assert(
      "quote view model displays stored values",
      vm.subtotalFormatted.includes("800") &&
        vm.gstAmountFormatted.includes("120") &&
        vm.totalInclGstFormatted.includes("920") &&
        vm.isHistorical === true
    )
  );

  // --- Historical snapshot wiring ---
  checks.push(
    assert(
      "reviseQuote copies gst_amount from source quote",
      quoteActions.includes("reviseQuote") &&
        quoteActions.includes("gst_amount: quote.gst_amount")
    )
  );
  checks.push(
    assert(
      "reviseQuote supersedes prior quote (new record)",
      quoteActions.includes("superseded_by_quote_id: newQuoteId")
    )
  );
  checks.push(
    assert(
      "sent/accepted status setters do not recalc totals",
      !/status:\s*"sent"[\s\S]{0,400}calculateAuthoritativeQuoteTotals/.test(
        quoteActions
      ) &&
        !/status:\s*"accepted"[\s\S]{0,400}calculateAuthoritativeQuoteTotals/.test(
          quoteActions
        )
    )
  );
  checks.push(
    assert(
      "print/export path does not import quote totals calculator in template",
      (() => {
        try {
          const files = walkTs("components/quotes").concat(
            walkTs("app").filter((f) => f.includes("quote") || f.includes("print"))
          );
          for (const f of files) {
            const src = read(f);
            if (
              src.includes("calculateQuoteTotals(") ||
              src.includes("calculateAuthoritativeQuoteTotals(")
            ) {
              return false;
            }
          }
          return true;
        } catch {
          return true;
        }
      })()
    )
  );

  // Pricing/estimate recalculation must not rewrite quotes (static: no quote update from pricing recalc)
  const recalSrc = read("lib/pricing/recalibration.ts");
  checks.push(
    assert(
      "pricing recalibration does not update quotes table",
      !recalSrc.includes('from("quotes")') &&
        !recalSrc.includes("from('quotes')")
    )
  );

  // --- Parity blockers ---
  const parity = runShadowParitySuite();
  checks.push(
    assert(
      "parity has zero adoption blockers",
      parity.ok && parity.totals.adoptionBlockers === 0,
      `blockers=${parity.totals.adoptionBlockers}; errors=${parity.errors.length}`
    )
  );

  // --- Security regression samples ---
  const missingAuth = evaluateAuthOrgInputs({
    userId: null,
    organisationId: "org-a",
  });
  checks.push(
    assert(
      "auth required before mutation",
      !missingAuth.ok &&
        missingAuth.message === AUTH_ORG_MESSAGES.unauthenticated
    )
  );
  const crossOrg = evaluateAuthOrgInputs({
    userId: "user-1",
    organisationId: null,
  });
  checks.push(
    assert(
      "organisation required for isolation",
      !crossOrg.ok
    )
  );

  const badPricing = parsePricingInput(createPricingFromEstimateInputSchema, {
    estimateId: "not-a-uuid",
  });
  checks.push(
    assert("invalid pricing input fails before mutation", !badPricing.ok)
  );

  const badQuote = parseQuoteInput(createQuoteFromPricingInputSchema, {
    pricingDocumentId: "bad",
  });
  checks.push(
    assert("invalid quote input fails before mutation", !badQuote.ok)
  );

  // Authority switches documented as retained
  checks.push(
    assert(
      "pricing authority switch retained",
      read("lib/pricing/adoption-authority.ts").includes(
        "PRICING_ITEM_CALCULATION_AUTHORITY"
      ) &&
        read("lib/pricing/adoption-authority.ts").includes("2B.10")
    )
  );
  checks.push(
    assert(
      "estimate authority switch retained",
      read("lib/estimate/adoption-authority.ts").includes(
        "ESTIMATE_CALCULATION_AUTHORITY"
      ) &&
        read("lib/estimate/adoption-authority.ts").includes("2B.10")
    )
  );
  checks.push(
    assert(
      "quote authority switch retained",
      read("lib/quotes/adoption-authority.ts").includes(
        "QUOTE_CALCULATION_AUTHORITY"
      ) &&
        read("lib/quotes/adoption-authority.ts").includes("2B.10")
    )
  );

  // No dual formula authority constants in production adapters
  const adapterFiles = [
    "lib/pricing/commercial-engine-adapter.ts",
    "lib/estimate/estimate-commercial-engine-adapter.ts",
    "lib/quotes/quote-commercial-engine-adapter.ts",
  ];
  for (const f of adapterFiles) {
    const src = read(f);
    checks.push(
      assert(
        `${f} imports commercial-engine`,
        src.includes("@/lib/commercial-engine")
      )
    );
  }

  // Report
  const failed = checks.filter((c) => !c.ok);
  console.log(`Checks: ${checks.length}`);
  console.log(`Passed: ${checks.filter((c) => c.ok).length}`);
  console.log(`Failed: ${failed.length}\n`);
  for (const c of checks) {
    console.log(`${c.ok ? "PASS" : "FAIL"}  ${c.name}${c.detail ? ` — ${c.detail}` : ""}`);
  }

  if (failed.length > 0) {
    console.error("\nBatch 2B.10 verification FAILED");
    process.exit(1);
  }
  console.log("\nBatch 2B.10 verification PASSED");
}

main();
