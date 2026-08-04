/**
 * Batch 2B.8 — Quote-domain commercial-engine adoption verification.
 *
 * Pure adapters/helpers + static wiring checks. No live Supabase mutations.
 */

import { readFileSync } from "node:fs";
import { isAuthoritativeQuoteCalculation } from "../lib/quotes/adoption-authority";
import {
  calculateAuthoritativeQuoteTotals,
  resolveAuthoritativeQuoteItemTotal,
} from "../lib/quotes/quote-commercial-engine-adapter";
import { calculateQuoteTotals } from "../lib/quotes/calculations";
import { isAuthoritativePricingItemCalculation } from "../lib/pricing/adoption-authority";
import { isAuthoritativeEstimateCalculation } from "../lib/estimate/adoption-authority";
import { runShadowParitySuite } from "../lib/commercial-engine/parity";
import {
  AUTH_ORG_MESSAGES,
  evaluateAuthOrgInputs,
} from "../lib/security/auth-org-evaluation";
import { parseQuoteInput } from "../lib/quotes/action-guards";
import {
  createQuoteFromPricingInputSchema,
  updateQuoteItemInputSchema,
} from "../lib/quotes/schemas";

type Check = { name: string; ok: boolean; detail?: string };

function assert(name: string, condition: boolean, detail?: string): Check {
  return { name, ok: condition, detail };
}

function near(a: number, b: number, tol = 0.02): boolean {
  return Math.abs(a - b) <= tol;
}

function main(): void {
  console.log("=== Batch 2B.8 Quote Adoption Verification ===\n");
  const checks: Check[] = [];

  checks.push(
    assert(
      "quote authority default is authoritative",
      isAuthoritativeQuoteCalculation()
    )
  );
  checks.push(
    assert(
      "pricing authority remains authoritative",
      isAuthoritativePricingItemCalculation()
    )
  );
  checks.push(
    assert(
      "estimate authority remains authoritative",
      isAuthoritativeEstimateCalculation()
    )
  );

  // --- Visibility + GST (CCS-045 / PAR-Q-DOC-001 shape) ---
  const visibleItems = [
    { total: 20000, visible: true },
    { total: 2000, visible: false },
  ];
  const vis = calculateAuthoritativeQuoteTotals(visibleItems, 15, "verify-vis");
  checks.push(
    assert(
      "visible_only excludes hidden lines",
      vis.ok &&
        near(vis.totals.subtotal, 20000) &&
        near(vis.totals.gstAmount, 3000) &&
        near(vis.totals.totalInclGst, 23000)
    )
  );

  const allVisible = calculateAuthoritativeQuoteTotals(
    [
      { total: 20000, visible: true },
      { total: 2000, visible: true },
    ],
    15
  );
  checks.push(
    assert(
      "all-visible sums both lines",
      allVisible.ok && near(allVisible.totals.subtotal, 22000)
    )
  );

  // --- GST rates ---
  for (const rate of [0, 10, 12.5, 15, 20] as const) {
    const r = calculateAuthoritativeQuoteTotals(
      [{ total: 1000, visible: true }],
      rate,
      `gst-${rate}`
    );
    const expectedGst = Math.round(1000 * (rate / 100) * 100) / 100;
    checks.push(
      assert(
        `GST ${rate}% applied once on sell subtotal`,
        r.ok &&
          near(r.totals.subtotal, 1000) &&
          near(r.totals.gstAmount, expectedGst) &&
          near(r.totals.totalInclGst, 1000 + expectedGst)
      )
    );
  }

  const badGst = calculateAuthoritativeQuoteTotals(
    [{ total: 100, visible: true }],
    Number.NaN
  );
  checks.push(
    assert(
      "invalid GST rejected (no silent 15 fallback on authoritative path)",
      !badGst.ok
    )
  );

  const zeroDoc = calculateAuthoritativeQuoteTotals([], 15);
  checks.push(
    assert(
      "empty quote totals are zero",
      zeroDoc.ok &&
        near(zeroDoc.totals.subtotal, 0) &&
        near(zeroDoc.totals.gstAmount, 0) &&
        near(zeroDoc.totals.totalInclGst, 0)
    )
  );

  // Authoritative sell matches legacy visible math for known fixtures
  const legacy = calculateQuoteTotals(visibleItems, 15);
  checks.push(
    assert(
      "authoritative sell/GST matches legacy visible aggregate",
      vis.ok &&
        near(vis.totals.subtotal, legacy.subtotal) &&
        near(vis.totals.gstAmount, legacy.gstAmount) &&
        near(vis.totals.totalInclGst, legacy.totalInclGst)
    )
  );

  // --- CD-22 prefer-total ---
  const prefer = resolveAuthoritativeQuoteItemTotal({
    quantity: 10,
    unitPrice: 50,
    total: 600,
  });
  checks.push(
    assert(
      "CD-22 prefer supplied total over qty×price",
      prefer.ok && near(prefer.total, 600)
    )
  );

  const fromRates = resolveAuthoritativeQuoteItemTotal({
    quantity: 10,
    unitPrice: 50,
    total: null,
  });
  checks.push(
    assert(
      "qty×unitPrice via engine when total omitted",
      fromRates.ok && near(fromRates.total, 500)
    )
  );

  const zeroLine = resolveAuthoritativeQuoteItemTotal({
    quantity: null,
    unitPrice: null,
    total: null,
  });
  checks.push(
    assert("empty item total is zero", zeroLine.ok && near(zeroLine.total, 0))
  );

  // --- Snapshot / historical guarantees (static) ---
  const actionsSrc = readFileSync("lib/quotes/actions.ts", "utf8");
  checks.push(
    assert(
      "reviseQuote copies source money (no silent recalc)",
      actionsSrc.includes("subtotal: quote.subtotal") &&
        actionsSrc.includes("gst_amount: quote.gst_amount") &&
        actionsSrc.includes("total_incl_gst: quote.total_incl_gst") &&
        actionsSrc.includes("reviseQuote")
    )
  );
  checks.push(
    assert(
      "reviseQuoteFromFinalPricing uses snapshot builder",
      actionsSrc.includes("buildQuoteSnapshotFromReviewedPricing") &&
        actionsSrc.includes("reviseQuoteFromFinalPricing")
    )
  );
  checks.push(
    assert(
      "draft recalc uses authoritative adapter",
      actionsSrc.includes("calculateAuthoritativeQuoteTotals") &&
        actionsSrc.includes("resolveAuthoritativeQuoteItemTotal")
    )
  );
  checks.push(
    assert(
      "assertQuoteEditable gates draft mutations",
      actionsSrc.includes("assertQuoteEditable")
    )
  );

  const buildSrc = readFileSync("lib/quotes/build-from-pricing.ts", "utf8");
  checks.push(
    assert(
      "create/refresh snapshot uses authoritative totals",
      buildSrc.includes("calculateAuthoritativeQuoteTotals") &&
        !buildSrc.includes("calculateQuoteTotals(")
    )
  );

  const mappersSrc = readFileSync("lib/quotes/mappers.ts", "utf8");
  checks.push(
    assert(
      "read mappers do not recalculate money",
      !mappersSrc.includes("calculateQuoteTotals") &&
        !mappersSrc.includes("calculateAuthoritativeQuoteTotals") &&
        mappersSrc.includes("Number(row.subtotal")
    )
  );

  const adapterSrc = readFileSync(
    "lib/quotes/quote-commercial-engine-adapter.ts",
    "utf8"
  );
  checks.push(
    assert(
      "quote adapter does not import parity",
      !adapterSrc.includes("commercial-engine/parity")
    )
  );
  checks.push(
    assert(
      "quote aggregate uses visible_only",
      adapterSrc.includes('inclusionRule: "visible_only"') ||
        adapterSrc.includes("inclusionRule: \"visible_only\"")
    )
  );

  const authoritySrc = readFileSync(
    "lib/quotes/adoption-authority.ts",
    "utf8"
  );
  checks.push(
    assert(
      "quote rollback switch present",
      authoritySrc.includes("QUOTE_CALCULATION_AUTHORITY") &&
        authoritySrc.includes('"authoritative"')
    )
  );

  // --- Security ---
  const authEval = evaluateAuthOrgInputs({
    userId: null,
    orgId: null,
    projectId: "11111111-1111-4111-8111-111111111111",
  });
  checks.push(
    assert(
      "auth/org failure still blocking",
      authEval.ok === false &&
        authEval.message === AUTH_ORG_MESSAGES.unauthenticated
    )
  );
  const badCreate = parseQuoteInput(createQuoteFromPricingInputSchema, {
    projectId: "not-a-uuid",
    pricingDocumentId: "also-bad",
  });
  checks.push(assert("invalid create-quote input fails", !badCreate.ok));
  const badItem = parseQuoteInput(updateQuoteItemInputSchema, {
    quoteItemId: "not-uuid",
    quantity: -1,
  });
  checks.push(assert("invalid update-quote-item input fails", !badItem.ok));

  // --- Parity ---
  const parity = runShadowParitySuite();
  checks.push(
    assert("parity suite ok", parity.ok, parity.errors.join("; ") || undefined)
  );
  checks.push(
    assert(
      "no adoption blockers",
      parity.totals.adoptionBlockers === 0,
      String(parity.totals.adoptionBlockers)
    )
  );
  const parQ = parity.results.find((r) => r.fixtureId === "PAR-Q-DOC-001");
  checks.push(
    assert(
      "PAR-Q-DOC-001 remains EXACT_MATCH",
      parQ?.classification === "EXACT_MATCH"
    )
  );
  const parItem = parity.results.find((r) => r.fixtureId === "PAR-Q-ITEM-001");
  checks.push(
    assert(
      "PAR-Q-ITEM-001 remains non-blocking deferred policy",
      parItem?.classification === "DEFERRED_WORKFLOW_DIFFERENCE" &&
        parItem.blockingStatus === false
    )
  );

  const failed = checks.filter((c) => !c.ok);
  for (const c of checks) {
    console.log(
      `${c.ok ? "PASS" : "FAIL"}  ${c.name}${c.detail ? ` — ${c.detail}` : ""}`
    );
  }
  console.log(
    `\nResult: ${checks.length - failed.length}/${checks.length} passed`
  );
  if (failed.length > 0) {
    process.exitCode = 1;
  }
}

main();
