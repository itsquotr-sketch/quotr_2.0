/**
 * Batch 2B.5 — GST source correction + pricing adoption gate verification.
 *
 * Pure helpers + parity classification checks. Does not invoke server actions,
 * mutate the database, or wire the commercial engine into live pricing.
 */

import { readFileSync } from "node:fs";
import { calculateDocumentTotals } from "../lib/pricing/calculations";
import {
  isValidGstRatePercent,
  resolveCreatePricingFromEstimateGstRates,
  resolveInitialPricingGstRate,
  resolvePricingGstForUpdate,
  resolveStoredPricingDocumentGstRate,
} from "../lib/pricing/gst-source";
import { DEFAULT_GST_RATE } from "../lib/pricing/status";
import { runShadowParitySuite } from "../lib/commercial-engine/parity";
import { KNOWN_MISMATCH_REGISTER } from "../lib/commercial-engine/parity/known-mismatches";
import { legacyCreatePricingFromEstimateGstBug } from "../lib/commercial-engine/parity/legacy/legacy-pricing-document";
import { gstRatePercentSchema } from "../lib/security/numeric-validation";

type Check = { name: string; ok: boolean; detail?: string };

function assert(name: string, condition: boolean, detail?: string): Check {
  return { name, ok: condition, detail };
}

function near(a: number, b: number, tol = 0.01): boolean {
  return Math.abs(a - b) <= tol;
}

function main(): void {
  console.log("=== Batch 2B.5 GST Source + Adoption Gate Verification ===\n");

  const checks: Check[] = [];
  const items = [{ total_cost: 6400, total_sell: 8000 }];

  // --- Creation rates ---
  for (const rate of [15, 0, 12.5, 20] as const) {
    const resolved = resolveCreatePricingFromEstimateGstRates(rate);
    checks.push(
      assert(
        `create org GST ${rate}% → document ${rate}%`,
        resolved.documentGstRate === rate &&
          resolved.recalculationGstRate === rate &&
          resolved.source === "organisation_settings"
      )
    );
    const totals = calculateDocumentTotals(items, resolved.recalculationGstRate);
    const expectedGst = Math.round(8000 * (rate / 100) * 100) / 100;
    checks.push(
      assert(
        `create org GST ${rate}% totals use same rate (gst=${expectedGst})`,
        near(totals.gstAmount, expectedGst) &&
          near(totals.totalInclGst, 8000 + expectedGst)
      )
    );
  }

  const missingOrg = resolveCreatePricingFromEstimateGstRates(null);
  checks.push(
    assert(
      "no org GST falls back to application default 15%",
      missingOrg.documentGstRate === DEFAULT_GST_RATE &&
        missingOrg.recalculationGstRate === DEFAULT_GST_RATE &&
        missingOrg.source === "application_default"
    )
  );

  const undefinedOrg = resolveInitialPricingGstRate(undefined);
  checks.push(
    assert(
      "undefined org GST falls back to 15%",
      undefinedOrg.rate === 15 && undefinedOrg.source === "application_default"
    )
  );

  checks.push(
    assert(
      "invalid GST -1 rejected by schema",
      gstRatePercentSchema.safeParse(-1).success === false
    )
  );
  checks.push(
    assert(
      "invalid GST 101 rejected by schema",
      gstRatePercentSchema.safeParse(101).success === false
    )
  );
  checks.push(
    assert(
      "invalid GST NaN rejected by helper",
      isValidGstRatePercent(Number.NaN) === false
    )
  );
  checks.push(
    assert(
      "valid GST 0 accepted",
      isValidGstRatePercent(0) === true &&
        gstRatePercentSchema.safeParse(0).success === true
    )
  );

  // --- Recalculation / stored document ---
  for (const rate of [0, 12.5, 15] as const) {
    const stored = resolveStoredPricingDocumentGstRate(rate);
    checks.push(
      assert(
        `stored ${rate}% remains ${rate}%`,
        stored.rate === rate && stored.source === "pricing_document"
      )
    );
  }

  checks.push(
    assert(
      "null document GST falls back to 15% (not coerced via Number(null)=0)",
      resolveStoredPricingDocumentGstRate(null).rate === 15 &&
        resolveStoredPricingDocumentGstRate(null).source ===
          "application_default"
    )
  );

  // Item add/update/delete/duplicate simulation: recalc must use stored rate
  const storedZero = resolveStoredPricingDocumentGstRate(0).rate;
  const afterItemEdit = calculateDocumentTotals(
    [...items, { total_cost: 100, total_sell: 125 }],
    storedZero
  );
  checks.push(
    assert(
      "item add with stored 0% does not reset GST",
      afterItemEdit.gstAmount === 0 && afterItemEdit.totalInclGst === 8125
    )
  );

  const dupRecalc = calculateDocumentTotals(
    [...items, items[0]],
    resolveStoredPricingDocumentGstRate(12.5).rate
  );
  checks.push(
    assert(
      "duplicate item keeps stored 12.5%",
      near(dupRecalc.gstAmount, 2000) && near(dupRecalc.totalInclGst, 18000)
    )
  );

  const gstUpdate = resolvePricingGstForUpdate({
    mutationGstRate: 20,
    storedDocumentGstRate: 15,
  });
  const updatedTotals = calculateDocumentTotals(items, gstUpdate.rate);
  checks.push(
    assert(
      "GST update recalculates with new validated value",
      gstUpdate.rate === 20 &&
        gstUpdate.source === "validated_mutation" &&
        near(updatedTotals.gstAmount, 1600)
    )
  );

  const preserveZeroMutation = resolvePricingGstForUpdate({
    mutationGstRate: 0,
    storedDocumentGstRate: 15,
  });
  checks.push(
    assert(
      "GST mutation to 0% is not treated as falsy fallback",
      preserveZeroMutation.rate === 0 &&
        preserveZeroMutation.source === "validated_mutation"
    )
  );

  // save/reopen: stored rate is source of truth
  const reopen = resolveStoredPricingDocumentGstRate(12.5);
  checks.push(
    assert(
      "save/reopen preserves stored GST",
      reopen.rate === 12.5 && reopen.source === "pricing_document"
    )
  );

  // GST applied once at document total
  const once = calculateDocumentTotals(
    [
      { total_cost: 100, total_sell: 100 },
      { total_cost: 100, total_sell: 100 },
    ],
    15
  );
  checks.push(
    assert(
      "GST applied once at document total (not per line)",
      near(once.gstAmount, 30) && near(once.totalInclGst, 230)
    )
  );

  // --- C-28 regression: corrected path vs historic bug ---
  const historic = legacyCreatePricingFromEstimateGstBug({
    items,
    orgGstRate: 0,
  });
  const corrected = resolveCreatePricingFromEstimateGstRates(0);
  const correctedTotals = calculateDocumentTotals(
    items,
    corrected.recalculationGstRate
  );
  checks.push(
    assert(
      "C-28 historic bug still documented (recalc 15 vs label 0)",
      historic.labelledGstRate === 0 &&
        historic.recalculatedWith === 15 &&
        near(historic.postRecalcTotals.gstAmount, 1200)
    )
  );
  checks.push(
    assert(
      "C-28 corrected: insert and recalc agree at 0%",
      corrected.documentGstRate === 0 &&
        corrected.recalculationGstRate === 0 &&
        correctedTotals.gstAmount === 0
    )
  );
  checks.push(
    assert(
      "C-28 corrected differs from historic bug totals",
      correctedTotals.gstAmount !== historic.postRecalcTotals.gstAmount
    )
  );

  // Margin / line cost unchanged for identical excl-GST inputs
  const base15 = calculateDocumentTotals(items, 15);
  const base0 = calculateDocumentTotals(items, 0);
  checks.push(
    assert(
      "margin/line excl-GST outputs unchanged across GST rates",
      base15.subtotalCost === base0.subtotalCost &&
        base15.subtotalSell === base0.subtotalSell &&
        base15.grossProfit === base0.grossProfit &&
        base15.marginPercent === base0.marginPercent
    )
  );

  // --- Parity: C-28 no longer adoption blocker ---
  const parity = runShadowParitySuite();
  const c28 = parity.results.find((r) => r.fixtureId === "PAR-P-GST-BUG-C28");
  checks.push(
    assert("parity suite ok", parity.ok, parity.errors.join("; ") || undefined)
  );
  checks.push(
    assert(
      "PAR-P-GST-BUG-C28 is EXACT_MATCH",
      c28?.classification === "EXACT_MATCH",
      c28 ? c28.classification : "missing"
    )
  );
  checks.push(
    assert(
      "PAR-P-GST-BUG-C28 not blocking",
      c28 != null && c28.blockingStatus === false
    )
  );
  checks.push(
    assert(
      "parity adoption blockers === 0",
      parity.totals.adoptionBlockers === 0,
      String(parity.totals.adoptionBlockers)
    )
  );

  const km = KNOWN_MISMATCH_REGISTER.find((m) => m.mismatchId === "KM-GST-C28");
  checks.push(
    assert(
      "KM-GST-C28 no longer blocks adoption",
      km != null && km.blocksAdoption === false
    )
  );

  // Static wiring: GST fix retained; parity never imported into production actions.
  // Batch 2B.6A may import lib/pricing/commercial-engine-adapter (contains substring
  // "commercial-engine") — that is allowed. Direct parity imports are not.
  const actionsSrc = readFileSync("lib/pricing/actions.ts", "utf8");
  checks.push(
    assert(
      "pricing actions do not import commercial-engine/parity",
      !actionsSrc.includes("commercial-engine/parity")
    )
  );
  checks.push(
    assert(
      "createPricingFromEstimate does not pass DEFAULT_GST_RATE to recalc",
      !actionsSrc.includes("DEFAULT_GST_RATE")
    )
  );
  checks.push(
    assert(
      "createPricingFromEstimate uses createGst.recalculationGstRate",
      actionsSrc.includes("createGst.recalculationGstRate")
    )
  );

  // Print results
  let failed = 0;
  for (const c of checks) {
    const mark = c.ok ? "PASS" : "FAIL";
    if (!c.ok) failed += 1;
    console.log(`${mark}  ${c.name}${c.detail ? ` — ${c.detail}` : ""}`);
  }

  console.log(`\n=== ${checks.length - failed}/${checks.length} checks passed ===`);
  if (failed > 0) {
    process.exit(1);
  }
  console.log(
    "Batch 2B.5 GST source + adoption-gate verification passed."
  );
}

main();
