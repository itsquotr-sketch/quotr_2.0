/**
 * Batch 2B.6A — Pricing item mutation adoption verification.
 *
 * Tests production adapters/helpers (no live Supabase / server actions).
 * Does not duplicate commercial arithmetic.
 */

import { readFileSync } from "node:fs";
import {
  calculateAuthoritativePricingItem,
  calculateBlankPricingItem,
  persistCommercialMetric,
  resolveLineCalculationMode,
} from "../lib/pricing/commercial-engine-adapter";
import {
  calculateAuthoritativeDocumentTotals,
  inferPersistedLineCostKnown,
} from "../lib/pricing/authoritative-document-totals";
import { isAuthoritativePricingItemCalculation } from "../lib/pricing/adoption-authority";
import {
  parsePricingInput,
  validateComputedItemForPersistence,
} from "../lib/pricing/action-guards";
import {
  addPricingItemInputSchema,
  deletePricingItemInputSchema,
  duplicatePricingItemInputSchema,
  pricingItemInputSchema,
  updatePricingItemInputSchema,
} from "../lib/pricing/schemas";
import { runShadowParitySuite } from "../lib/commercial-engine/parity";
import {
  AUTH_ORG_MESSAGES,
  evaluateAuthOrgInputs,
} from "../lib/security/auth-org-evaluation";
import { pricingAuthFailure } from "../lib/pricing/action-guards";

type Check = { name: string; ok: boolean; detail?: string };

function assert(name: string, condition: boolean, detail?: string): Check {
  return { name, ok: condition, detail };
}

function near(a: number, b: number, tol = 0.01): boolean {
  return Math.abs(a - b) <= tol;
}

const DOC_UUID = "44444444-4444-4444-8444-444444444444";
const PROJECT_UUID = "55555555-5555-4555-8555-555555555555";
const ITEM_UUID = "33333333-3333-4333-8333-333333333333";

function main(): void {
  console.log("=== Batch 2B.6A Pricing Item Adoption Verification ===\n");
  const checks: Check[] = [];

  checks.push(
    assert(
      "authority default is authoritative",
      isAuthoritativePricingItemCalculation()
    )
  );

  // --- Mapping ---
  const qty = calculateAuthoritativePricingItem({
    requestId: "map-qty",
    calculationMode: "quantity_rate",
    quantity: 10,
    unitCost: 50,
    unitSell: 80,
  });
  checks.push(
    assert(
      "quantity-rate mapping",
      qty.ok &&
        near(qty.fields.totalCost, 500) &&
        near(qty.fields.totalSell, 800) &&
        near(qty.fields.grossProfit, 300) &&
        near(qty.fields.marginPercent, 37.5)
    )
  );

  const prod = calculateAuthoritativePricingItem({
    requestId: "map-prod",
    calculationMode: "productivity_labour",
    quantity: 20,
    productivityRate: 0.5,
    unitCost: 60,
    unitSell: 90,
  });
  checks.push(
    assert(
      "productivity-labour mapping",
      prod.ok &&
        near(prod.fields.calculatedQuantity ?? -1, 10) &&
        near(prod.fields.totalCost, 600) &&
        near(prod.fields.totalSell, 900)
    )
  );

  const lumpKnown = calculateAuthoritativePricingItem({
    requestId: "map-lump",
    calculationMode: "lump_sum",
    totalCost: 1000,
    totalSell: 1250,
  });
  checks.push(
    assert(
      "known-cost lump sum",
      lumpKnown.ok &&
        lumpKnown.fields.costKnown &&
        near(lumpKnown.fields.grossProfit, 250) &&
        near(lumpKnown.fields.marginPercent, 20)
    )
  );

  const sellOnly = calculateAuthoritativePricingItem({
    requestId: "map-sellonly",
    calculationMode: "lump_sum",
    totalCost: 0,
    totalSell: 5000,
  });
  checks.push(
    assert(
      "sell-only lump — unknown cost, no fabricated margin",
      sellOnly.ok &&
        !sellOnly.fields.costKnown &&
        sellOnly.fields.marginPercent === 0 &&
        sellOnly.fields.grossProfit === 0 &&
        sellOnly.fields.totalSell === 5000
    )
  );

  checks.push(
    assert(
      "persist null metric → 0 when unknown",
      persistCommercialMetric(null, false) === 0 &&
        persistCommercialMetric(25, true) === 25
    )
  );

  const zeroVsNull = calculateAuthoritativePricingItem({
    requestId: "map-zero",
    calculationMode: "lump_sum",
    totalCost: 0,
    totalSell: 0,
  });
  checks.push(
    assert(
      "explicit zero cost+sell is known (not unknown)",
      zeroVsNull.ok && zeroVsNull.fields.costKnown
    )
  );

  const manual = calculateAuthoritativePricingItem({
    requestId: "map-manual",
    calculationMode: "quantity_rate",
    quantity: 5,
    unitCost: 100,
    unitSell: 150,
    manualSellOverride: true,
  });
  checks.push(
    assert(
      "manual sell override metadata carried",
      manual.ok && manual.record.manualOverrides.length === 1
    )
  );

  const nonDefaultMargin = calculateAuthoritativePricingItem({
    requestId: "map-margin",
    calculationMode: "quantity_rate",
    quantity: 1,
    unitCost: 100,
    // no unit_sell — adapter supplies default margin from settings
  });
  checks.push(
    assert(
      "non-default / derived sell from margin when sell omitted",
      nonDefaultMargin.ok && nonDefaultMargin.fields.unitSell != null
    )
  );

  // --- Add (blank) ---
  const blank = calculateBlankPricingItem({ requestId: "add-blank" });
  checks.push(
    assert(
      "blank add item persists engine zeros",
      blank.ok &&
        blank.fields.totalCost === 0 &&
        blank.fields.totalSell === 0 &&
        blank.fields.costKnown
    )
  );

  const blocking = calculateAuthoritativePricingItem({
    requestId: "add-block",
    calculationMode: "quantity_rate",
    quantity: 0,
    unitCost: 10,
    unitSell: 20,
  });
  checks.push(
    assert("blocking quantity_rate does not succeed", !blocking.ok)
  );

  for (const gst of [0, 15, 12.5] as const) {
    const agg = calculateAuthoritativeDocumentTotals(
      [
        {
          total_cost: blank.ok ? blank.fields.totalCost : 0,
          total_sell: blank.ok ? blank.fields.totalSell : 0,
        },
        { total_cost: 100, total_sell: 200 },
      ],
      gst
    );
    const expectedGst = Math.round(200 * (gst / 100) * 100) / 100;
    checks.push(
      assert(
        `document aggregate preserves GST ${gst}%`,
        agg.ok &&
          near(agg.totals.gstAmount, expectedGst) &&
          near(agg.totals.subtotalSell, 200) &&
          near(agg.totals.totalInclGst, 200 + expectedGst)
      )
    );
  }

  // --- Update semantics ---
  const staleIgnored = calculateAuthoritativePricingItem({
    requestId: "upd-stale",
    calculationMode: "quantity_rate",
    quantity: 2,
    unitCost: 50,
    unitSell: 75,
    totalCost: 9999,
    totalSell: 9999,
  });
  checks.push(
    assert(
      "stale client totals ignored for quantity_rate",
      staleIgnored.ok &&
        near(staleIgnored.fields.totalCost, 100) &&
        near(staleIgnored.fields.totalSell, 150)
    )
  );

  const unknownPersist = validateComputedItemForPersistence({
    totalCost: 0,
    totalSell: 5000,
    marginPercent: 0,
    markupPercent: 0,
    costKnown: false,
  });
  checks.push(
    assert("unknown-cost persistence guard allows sentinel", unknownPersist.ok)
  );

  // --- Duplicate input mapping ---
  const sourceMode = resolveLineCalculationMode({
    calculationMode: "lump_sum",
    totalCost: 200,
    totalSell: 300,
  });
  const dup = calculateAuthoritativePricingItem({
    requestId: "dup",
    calculationMode: sourceMode,
    totalCost: 200,
    totalSell: 300,
  });
  checks.push(
    assert(
      "duplicate recalculates from source inputs",
      dup.ok && near(dup.fields.totalCost, 200) && near(dup.fields.totalSell, 300)
    )
  );

  // --- Delete / aggregate ---
  const remaining = calculateAuthoritativeDocumentTotals(
    [
      { total_cost: 400, total_sell: 500 },
      { total_cost: 100, total_sell: 150 },
    ],
    15
  );
  checks.push(
    assert(
      "remaining items aggregate correctly",
      remaining.ok &&
        near(remaining.totals.subtotalCost, 500) &&
        near(remaining.totals.subtotalSell, 650) &&
        near(remaining.totals.grossProfit, 150) &&
        near(remaining.totals.marginPercent, (150 / 650) * 100) &&
        near(remaining.totals.gstAmount, 97.5)
    )
  );

  const empty = calculateAuthoritativeDocumentTotals([], 15);
  checks.push(
    assert(
      "empty document totals are zero",
      empty.ok &&
        empty.totals.subtotalCost === 0 &&
        empty.totals.subtotalSell === 0 &&
        empty.totals.gstAmount === 0 &&
        empty.totals.totalInclGst === 0 &&
        empty.totals.marginPercent === 0 &&
        !Number.isNaN(empty.totals.marginPercent)
    )
  );

  checks.push(
    assert(
      "GST applied once (not per line)",
      remaining.ok && near(remaining.totals.gstAmount, 97.5)
    )
  );

  checks.push(
    assert(
      "aggregate margin from aggregate totals (not averaged)",
      remaining.ok &&
        near(
          remaining.totals.marginPercent,
          Math.round((150 / 650) * 10000) / 100
        )
    )
  );

  checks.push(
    assert(
      "infer unknown cost for 0/positive sell line",
      inferPersistedLineCostKnown({ total_cost: 0, total_sell: 100 }) ===
        false &&
        inferPersistedLineCostKnown({ total_cost: 0, total_sell: 0 }) === true
    )
  );

  // --- Security regression (schemas / auth helpers unchanged) ---
  const unauth = evaluateAuthOrgInputs({
    user: null,
    profile: null,
    organisation: null,
  });
  checks.push(
    assert(
      "auth helper still rejects unauthenticated",
      !unauth.ok &&
        pricingAuthFailure(unauth)?.error ===
          AUTH_ORG_MESSAGES.not_authenticated
    )
  );

  checks.push(
    assert(
      "add schema validates",
      parsePricingInput(addPricingItemInputSchema, {
        pricingDocumentId: DOC_UUID,
        projectId: PROJECT_UUID,
      }).ok
    )
  );
  checks.push(
    assert(
      "update schema validates",
      parsePricingInput(updatePricingItemInputSchema, {
        pricingItemId: ITEM_UUID,
        item: {
          internal_label: "A",
          client_label: "A",
          item_type: "labour",
          delivery_method: "in_house",
          quantity: 1,
          unit_cost: 10,
          unit_sell: 15,
          calculation_mode: "quantity_rate",
        },
      }).ok
    )
  );
  checks.push(
    assert(
      "foreign UUID shape still required",
      !parsePricingInput(deletePricingItemInputSchema, {
        pricingItemId: "not-a-uuid",
      }).ok
    )
  );
  checks.push(
    assert(
      "duplicate schema validates",
      parsePricingInput(duplicatePricingItemInputSchema, {
        pricingItemId: ITEM_UUID,
      }).ok
    )
  );
  checks.push(
    assert(
      "validation runs before mutation (invalid item rejected)",
      !pricingItemInputSchema.safeParse({
        internal_label: "",
        client_label: "x",
        item_type: "labour",
        delivery_method: "in_house",
      }).success
    )
  );

  // --- Compatibility / parity ---
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
  const sellOnlyParity = parity.results.find(
    (r) => r.fixtureId === "PAR-P-SELLONLY-001"
  );
  checks.push(
    assert(
      "approved unknown-cost correction remains",
      sellOnlyParity?.classification === "APPROVED_ENGINE_CORRECTION"
    )
  );

  // --- Static wiring checks ---
  const actionsSrc = readFileSync("lib/pricing/actions.ts", "utf8");
  const adapterSrc = readFileSync(
    "lib/pricing/commercial-engine-adapter.ts",
    "utf8"
  );
  checks.push(
    assert(
      "actions import production adapter (not parity)",
      actionsSrc.includes("commercial-engine-adapter") &&
        !actionsSrc.includes("commercial-engine/parity")
    )
  );
  checks.push(
    assert(
      "adapter does not import parity",
      !adapterSrc.includes("commercial-engine/parity")
    )
  );
  checks.push(
    assert(
      "item CRUD uses computePricingItemMoneyFields / blank / authoritative aggregate",
      actionsSrc.includes("computePricingItemMoneyFields") &&
        actionsSrc.includes("calculateBlankPricingItem") &&
        actionsSrc.includes("calculateAuthoritativeDocumentTotals")
    )
  );
  checks.push(
    assert(
      "createPricingFromEstimate still present (not removed)",
      actionsSrc.includes("export async function createPricingFromEstimate")
    )
  );

  let failed = 0;
  for (const c of checks) {
    const mark = c.ok ? "PASS" : "FAIL";
    if (!c.ok) failed += 1;
    console.log(`${mark}  ${c.name}${c.detail ? ` — ${c.detail}` : ""}`);
  }
  console.log(`\n=== ${checks.length - failed}/${checks.length} checks passed ===`);
  if (failed > 0) process.exit(1);
  console.log("Batch 2B.6A pricing item adoption verification passed.");
}

main();
