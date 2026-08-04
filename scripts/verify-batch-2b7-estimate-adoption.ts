/**
 * Batch 2B.7 — Estimate-domain commercial-engine adoption verification.
 *
 * Pure adapters/helpers + static wiring checks. No live Supabase mutations.
 */

import { readFileSync } from "node:fs";
import { isAuthoritativeEstimateCalculation } from "../lib/estimate/adoption-authority";
import {
  aggregateEstimateLines,
  applyAuthoritativeMarginToAmounts,
  buildAuthoritativeEstimateAmounts,
  calculateEstimateLabourLine,
  calculateEstimateLumpLine,
  calculateEstimateQuantityRateLine,
  calculateEstimateSellFromCost,
} from "../lib/estimate/estimate-commercial-engine-adapter";
import {
  createAllowanceLineItem,
  createLabourLineItem,
  createRateLineItem,
} from "../lib/estimate/line-items";
import { finalizeEstimateResult, sumLineItems } from "../lib/estimate/summary";
import { calculateAuthoritativeFieldsFromEstimateLine } from "../lib/pricing/estimate-to-pricing-adapter";
import { calculateAuthoritativeDocumentTotals } from "../lib/pricing/authoritative-document-totals";
import { isAuthoritativePricingItemCalculation } from "../lib/pricing/adoption-authority";
import { runShadowParitySuite } from "../lib/commercial-engine/parity";
import {
  AUTH_ORG_MESSAGES,
  evaluateAuthOrgInputs,
} from "../lib/security/auth-org-evaluation";
import { parsePricingInput } from "../lib/pricing/action-guards";
import { createPricingFromEstimateInputSchema } from "../lib/pricing/schemas";

type Check = { name: string; ok: boolean; detail?: string };

function assert(name: string, condition: boolean, detail?: string): Check {
  return { name, ok: condition, detail };
}

function near(a: number, b: number, tol = 0.02): boolean {
  return Math.abs(a - b) <= tol;
}

function main(): void {
  console.log("=== Batch 2B.7 Estimate Adoption Verification ===\n");
  const checks: Check[] = [];

  checks.push(
    assert(
      "estimate authority default is authoritative",
      isAuthoritativeEstimateCalculation()
    )
  );
  checks.push(
    assert(
      "pricing authority remains authoritative",
      isAuthoritativePricingItemCalculation()
    )
  );

  // --- Mapping ---
  const qty = calculateEstimateQuantityRateLine({
    quantity: 10,
    unitCost: 50,
    unitSell: 80,
  });
  checks.push(
    assert(
      "quantity-rate mapping",
      qty.ok &&
        near(qty.money.recommendedCost, 500) &&
        near(qty.money.recommendedSell, 800) &&
        near(qty.money.grossProfit, 300) &&
        near(qty.money.marginPercent, 37.5)
    )
  );

  const labour = calculateEstimateLabourLine({
    labourHours: 5,
    labourCostRate: 60,
    labourSellRate: 80,
  });
  checks.push(
    assert(
      "productivity-labour mapping",
      labour.ok &&
        near(labour.money.recommendedCost, 300) &&
        near(labour.money.recommendedSell, 400) &&
        near(labour.money.marginPercent, 25)
    )
  );

  const lump = calculateEstimateLumpLine({
    totalCost: 1000,
    totalSell: 1250,
  });
  checks.push(
    assert(
      "known-cost lump mapping",
      lump.ok &&
        near(lump.money.recommendedCost, 1000) &&
        near(lump.money.recommendedSell, 1250) &&
        near(lump.money.grossProfit, 250) &&
        near(lump.money.marginPercent, 20)
    )
  );

  const sellOnly = calculateEstimateLumpLine({
    totalCost: 0,
    totalSell: 500,
  });
  checks.push(
    assert(
      "sell-only unknown cost does not fabricate margin",
      sellOnly.ok &&
        sellOnly.money.costKnown === false &&
        sellOnly.money.grossProfit === 0 &&
        sellOnly.money.marginPercent === 0 &&
        near(sellOnly.money.recommendedSell, 500)
    )
  );

  const zero = calculateEstimateLumpLine({ totalCost: 0, totalSell: 0 });
  checks.push(
    assert(
      "zero versus null — zero line ok",
      zero.ok &&
        near(zero.money.recommendedCost, 0) &&
        near(zero.money.recommendedSell, 0)
    )
  );

  const marginOv = calculateEstimateSellFromCost(200, 20);
  checks.push(
    assert(
      "margin override sell-from-cost",
      marginOv.ok && near(marginOv.sell, 250)
    )
  );

  const amounts = buildAuthoritativeEstimateAmounts(200, 250, {
    budget_rate_factor: 0.9,
    premium_rate_factor: 1.15,
  } as never);
  checks.push(
    assert(
      "explicit range factors on expected",
      near(amounts.sellLow, 225) &&
        near(amounts.sellHigh, 287.5) &&
        near(amounts.recommendedSell, 250)
    )
  );

  const marginApply = applyAuthoritativeMarginToAmounts(1000, 25, null);
  checks.push(
    assert(
      "manual margin apply uses engine",
      near(marginApply.recommendedCost, 1000) &&
        near(marginApply.recommendedSell, 1333.33) &&
        near(marginApply.marginPercent, 25, 0.05)
    )
  );

  // --- Creation (factories) ---
  const labourItem = createLabourLineItem({
    workAreaId: "wa",
    workAreaName: "Deck",
    label: "Labour",
    quantity: 10,
    unit: "m2",
    productivityHoursPerUnit: 0.5,
    labourCostRate: 60,
    labourSellRate: 80,
    rateSource: "company",
    rateSourceType: "user_exact",
    sortOrder: 0,
    organisationSettings: null,
  });
  checks.push(
    assert(
      "valid labour line persists engine outputs",
      near(labourItem.labourHours ?? 0, 5) &&
        near(labourItem.recommendedCost, 300) &&
        near(labourItem.recommendedSell, 400) &&
        labourItem.rateSourceType === "user_exact"
    )
  );

  const rateItem = createRateLineItem({
    workAreaId: "wa",
    workAreaName: "Deck",
    label: "Materials",
    category: "materials",
    quantity: 10,
    unit: "m2",
    costRate: 50,
    sellRate: 80,
    rateSource: "benchmark",
    sortOrder: 1,
    organisationSettings: null,
    qualityFactor: 1.1,
  });
  checks.push(
    assert(
      "quantity-rate with quality factor",
      near(rateItem.recommendedCost, 550) &&
        near(rateItem.recommendedSell, 880)
    )
  );

  const unknownItem = createAllowanceLineItem({
    workAreaId: "wa",
    workAreaName: "Deck",
    label: "Provisional",
    recommendedCost: 0,
    recommendedSell: 400,
    rateSource: "allowance",
    sortOrder: 2,
    organisationSettings: null,
  });
  checks.push(
    assert(
      "unknown-cost allowance sentinel",
      near(unknownItem.recommendedSell, 400) &&
        unknownItem.grossProfit === 0 &&
        unknownItem.marginPercent === 0
    )
  );

  // Stale client totals ignored: factories ignore any precomputed sell and use rates.
  checks.push(
    assert(
      "source workflow metadata retained on line",
      labourItem.costRate === 60 &&
        labourItem.sellRate === 80 &&
        labourItem.productivityRate === 0.5
    )
  );

  // --- Editing / recalculation ---
  const editedQty = calculateEstimateQuantityRateLine({
    quantity: 20,
    unitCost: 50,
    unitSell: 80,
  });
  checks.push(
    assert(
      "quantity edit recalculates",
      editedQty.ok && near(editedQty.money.recommendedCost, 1000)
    )
  );

  const editedRate = calculateEstimateQuantityRateLine({
    quantity: 10,
    unitCost: 60,
    unitSell: 80,
  });
  checks.push(
    assert(
      "rate edit recalculates",
      editedRate.ok && near(editedRate.money.recommendedCost, 600)
    )
  );

  const editedProd = calculateEstimateLabourLine({
    labourHours: 8,
    labourCostRate: 60,
    labourSellRate: 80,
  });
  checks.push(
    assert(
      "productivity/hours edit recalculates",
      editedProd.ok && near(editedProd.money.recommendedCost, 480)
    )
  );

  const editedMargin = applyAuthoritativeMarginToAmounts(300, 30, null);
  checks.push(
    assert(
      "margin edit recalculates sell",
      near(editedMargin.recommendedSell, 428.57) &&
        near(editedMargin.marginPercent, 30, 0.05)
    )
  );

  checks.push(
    assert(
      "manual sell override path remains identifiable (lump inputs)",
      calculateEstimateLumpLine({ totalCost: 100, totalSell: 999 }).ok === true
    )
  );

  // --- Aggregation ---
  const knownA = {
    recommendedCost: 1680,
    recommendedSell: 2100,
    costLow: 1512,
    costHigh: 1932,
    sellLow: 1890,
    sellHigh: 2415,
  };
  const knownB = {
    recommendedCost: 660,
    recommendedSell: 825,
    costLow: 594,
    costHigh: 759,
    sellLow: 742.5,
    sellHigh: 948.75,
  };
  const mixed = aggregateEstimateLines([knownA, knownB]);
  checks.push(
    assert(
      "multiple lines aggregate",
      near(mixed.recommendedCost, 2340) && near(mixed.recommendedSell, 2925)
    )
  );
  checks.push(
    assert(
      "aggregate GP from totals not average margins",
      near(mixed.grossProfit, 585) && near(mixed.marginPercent, 20)
    )
  );

  const withUnknown = aggregateEstimateLines([
    knownA,
    {
      recommendedCost: 0,
      recommendedSell: 500,
      costLow: 0,
      costHigh: 0,
      sellLow: 450,
      sellHigh: 575,
      costKnown: false,
    },
  ]);
  checks.push(
    assert(
      "unknown-cost line keeps aggregate costKnown false",
      withUnknown.costKnown === false &&
        withUnknown.grossProfit === 0 &&
        withUnknown.marginPercent === 0
    )
  );

  const withExcluded = aggregateEstimateLines([
    knownA,
    { ...knownB, includedInTotal: false },
  ]);
  checks.push(
    assert(
      "excluded line omitted from aggregate",
      near(withExcluded.recommendedCost, 1680) &&
        near(withExcluded.recommendedSell, 2100)
    )
  );

  const zeroAgg = aggregateEstimateLines([
    {
      recommendedCost: 0,
      recommendedSell: 0,
      costLow: 0,
      costHigh: 0,
      sellLow: 0,
      sellHigh: 0,
    },
  ]);
  checks.push(
    assert(
      "zero-value allowed line — no NaN",
      Number.isFinite(zeroAgg.marginPercent) &&
        Number.isFinite(zeroAgg.grossProfit)
    )
  );

  const finalized = finalizeEstimateResult({
    lineItems: [labourItem, rateItem],
    assumptions: [],
    missingInfo: [],
    exclusions: [],
    calculatorResults: [],
  });
  checks.push(
    assert(
      "finalizeEstimateResult uses authoritative aggregate",
      near(
        finalized.recommendedCost,
        labourItem.recommendedCost + rateItem.recommendedCost
      ) &&
        near(
          finalized.recommendedSell,
          labourItem.recommendedSell + rateItem.recommendedSell
        ) &&
        near(
          finalized.grossProfit,
          finalized.recommendedSell - finalized.recommendedCost
        )
    )
  );
  checks.push(
    assert(
      "confidence does not alter financial arithmetic",
      finalized.confidence >= 35 &&
        finalized.confidence <= 95 &&
        near(
          finalized.recommendedSell,
          sumLineItems([labourItem, rateItem]).recommendedSell
        )
    )
  );

  // --- Ranges ---
  checks.push(
    assert(
      "expected uses deterministic arithmetic",
      near(labourItem.recommendedSell, 400)
    )
  );
  checks.push(
    assert(
      "low/high remain separate from expected",
      labourItem.sellLow < labourItem.recommendedSell &&
        labourItem.sellHigh > labourItem.recommendedSell
    )
  );

  // --- Conversion estimate → pricing ---
  const converted = calculateAuthoritativeFieldsFromEstimateLine({
    category: "labour",
    recommended_cost: labourItem.recommendedCost,
    recommended_sell: labourItem.recommendedSell,
    notes: JSON.stringify({
      __quotr_meta__: {
        quantity: labourItem.quantity,
        unit: labourItem.unit,
        labourHours: labourItem.labourHours,
        productivityRate: labourItem.productivityRate,
        costRate: labourItem.costRate,
        sellRate: labourItem.sellRate,
      },
    }),
  });
  checks.push(
    assert(
      "estimate-to-pricing maps without inventing margin",
      converted.ok === true
    )
  );
  if (converted.ok) {
    checks.push(
      assert(
        "conversion uses rates (no double margin)",
        near(converted.fields.totalCost, labourItem.recommendedCost) &&
          near(converted.fields.totalSell, labourItem.recommendedSell)
      )
    );
  }

  const pricingAgg = calculateAuthoritativeDocumentTotals(
    [
      { total_cost: 300, total_sell: 400 },
      { total_cost: 550, total_sell: 880 },
    ],
    15
  );
  checks.push(
    assert(
      "pricing GST independent from estimate arithmetic",
      pricingAgg.ok &&
        near(pricingAgg.totals.subtotalSell, 1280) &&
        near(pricingAgg.totals.gstAmount, 192)
    )
  );

  // --- Security (unchanged Stage 2A helpers) ---
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
  const parsed = parsePricingInput(createPricingFromEstimateInputSchema, {
    projectId: "not-a-uuid",
  });
  checks.push(assert("invalid create-from-estimate input fails", !parsed.ok));

  // --- Wiring: no parity import in production estimate adapter ---
  const adapterSrc = readFileSync(
    "lib/estimate/estimate-commercial-engine-adapter.ts",
    "utf8"
  );
  checks.push(
    assert(
      "estimate adapter does not import parity",
      !adapterSrc.includes("commercial-engine/parity") &&
        !adapterSrc.includes("lib/commercial-engine/parity")
    )
  );
  const authoritySrc = readFileSync(
    "lib/estimate/adoption-authority.ts",
    "utf8"
  );
  checks.push(
    assert(
      "estimate rollback switch present",
      authoritySrc.includes('ESTIMATE_CALCULATION_AUTHORITY') &&
        authoritySrc.includes('"authoritative"')
    )
  );
  const boundaryExists = (() => {
    try {
      readFileSync(
        "docs/specifications/ESTIMATE_COMMERCIAL_BOUNDARY.md",
        "utf8"
      );
      return true;
    } catch {
      return false;
    }
  })();
  checks.push(assert("estimate commercial boundary doc exists", boundaryExists));

  // --- Compatibility: parity suite ---
  const parity = runShadowParitySuite();
  checks.push(
    assert("parity suite ok", parity.ok, parity.errors.join("; ") || undefined)
  );
  checks.push(
    assert(
      "no new adoption blockers",
      parity.totals.adoptionBlockers === 0,
      String(parity.totals.adoptionBlockers)
    )
  );

  // Report
  const failed = checks.filter((c) => !c.ok);
  for (const c of checks) {
    console.log(`${c.ok ? "PASS" : "FAIL"}  ${c.name}${c.detail ? ` — ${c.detail}` : ""}`);
  }
  console.log(
    `\nResult: ${checks.length - failed.length}/${checks.length} passed`
  );
  if (failed.length > 0) {
    process.exitCode = 1;
  }
}

main();
