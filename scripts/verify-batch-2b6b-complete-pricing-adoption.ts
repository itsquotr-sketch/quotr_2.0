/**
 * Batch 2B.6B — Complete pricing-domain commercial-engine adoption verification.
 *
 * Pure adapters/helpers + static wiring checks. No live Supabase mutations.
 */

import { readFileSync } from "node:fs";
import { calculateAuthoritativeFieldsFromEstimateLine } from "../lib/pricing/estimate-to-pricing-adapter";
import { calculateAuthoritativeDocumentTotals } from "../lib/pricing/authoritative-document-totals";
import { isAuthoritativePricingItemCalculation } from "../lib/pricing/adoption-authority";
import { mapPricingItem, mapPricingDocument } from "../lib/pricing/mappers";
import { valuesFromEstimateLineItem } from "../lib/pricing/recalibration-helpers";
import {
  parsePricingInput,
  pricingAuthFailure,
} from "../lib/pricing/action-guards";
import {
  createPricingFromEstimateInputSchema,
  updatePricingDocumentInputSchema,
} from "../lib/pricing/schemas";
import {
  AUTH_ORG_MESSAGES,
  evaluateAuthOrgInputs,
} from "../lib/security/auth-org-evaluation";
import { runShadowParitySuite } from "../lib/commercial-engine/parity";

type Check = { name: string; ok: boolean; detail?: string };

function assert(name: string, condition: boolean, detail?: string): Check {
  return { name, ok: condition, detail };
}

function near(a: number, b: number, tol = 0.01): boolean {
  return Math.abs(a - b) <= tol;
}

const DOC_UUID = "44444444-4444-4444-8444-444444444444";
const PROJECT_UUID = "55555555-5555-4555-8555-555555555555";

function main(): void {
  console.log("=== Batch 2B.6B Complete Pricing Adoption Verification ===\n");
  const checks: Check[] = [];

  checks.push(
    assert(
      "authority default is authoritative",
      isAuthoritativePricingItemCalculation()
    )
  );

  // --- updatePricingDocument (GST-only commercial behaviour) ---
  for (const gst of [0, 12.5, 15, 20] as const) {
    const lines = [
      { total_cost: 400, total_sell: 500, cost_known: true },
      { total_cost: 100, total_sell: 100, cost_known: true },
    ];
    const beforeExcl = 600;
    const agg = calculateAuthoritativeDocumentTotals(lines, gst);
    checks.push(
      assert(
        `GST ${gst}% — excl totals unchanged, GST once`,
        agg.ok &&
          near(agg.totals.subtotalSell, beforeExcl) &&
          near(agg.totals.subtotalCost, 500) &&
          near(agg.totals.gstAmount, Math.round(beforeExcl * (gst / 100) * 100) / 100) &&
          near(
            agg.totals.totalInclGst,
            beforeExcl + Math.round(beforeExcl * (gst / 100) * 100) / 100
          )
      )
    );
  }

  checks.push(
    assert(
      "updatePricingDocument accepts GST metadata update shape",
      updatePricingDocumentInputSchema.safeParse({
        pricingDocumentId: DOC_UUID,
        document: { gst_rate: 0, title: "Final" },
      }).success
    )
  );
  checks.push(
    assert(
      "invalid GST rejected before persistence",
      !updatePricingDocumentInputSchema.safeParse({
        pricingDocumentId: DOC_UUID,
        document: { gst_rate: -1 },
      }).success
    )
  );

  // --- createPricingFromEstimate mapping ---
  const knownLine = calculateAuthoritativeFieldsFromEstimateLine({
    id: "e1",
    category: "materials",
    recommended_cost: 1000,
    recommended_sell: 1250,
    notes: null,
  });
  checks.push(
    assert(
      "estimate line maps to authoritative known-cost lump",
      knownLine.ok &&
        near(knownLine.fields.totalCost, 1000) &&
        near(knownLine.fields.totalSell, 1250) &&
        knownLine.fields.costKnown &&
        near(knownLine.fields.marginPercent, 20)
    )
  );

  const unknownLine = calculateAuthoritativeFieldsFromEstimateLine({
    id: "e2",
    category: "allowance",
    recommended_cost: 0,
    recommended_sell: 5000,
    notes: null,
  });
  checks.push(
    assert(
      "unknown-cost estimate line remains honest (no fabricated margin)",
      unknownLine.ok &&
        !unknownLine.fields.costKnown &&
        unknownLine.fields.marginPercent === 0 &&
        unknownLine.fields.totalSell === 5000
    )
  );

  const qtyNotes =
    'Timber\n__quotr_meta__:' +
    JSON.stringify({
      quantity: 10,
      unit: "m2",
      costRate: 50,
      sellRate: 80,
    });
  const qtyLine = calculateAuthoritativeFieldsFromEstimateLine({
    id: "e3",
    category: "materials",
    recommended_cost: 9999,
    recommended_sell: 9999,
    notes: qtyNotes,
  });
  checks.push(
    assert(
      "qty-rate estimate ignores stale recommended totals",
      qtyLine.ok &&
        near(qtyLine.fields.totalCost, 500) &&
        near(qtyLine.fields.totalSell, 800)
    )
  );

  const mappedValues = valuesFromEstimateLineItem({
    id: PROJECT_UUID,
    work_area_id: null,
    label: "Allowance",
    category: "allowance",
    recommended_cost: 200,
    recommended_sell: 250,
    notes: null,
    sort_order: 0,
  });
  const createAgg = calculateAuthoritativeDocumentTotals(
    [
      {
        total_cost: mappedValues.totalCost,
        total_sell: mappedValues.totalSell,
        cost_known: mappedValues.costKnown,
      },
    ],
    15
  );
  checks.push(
    assert(
      "create aggregate equals authoritative helper",
      createAgg.ok &&
        near(createAgg.totals.subtotalSell, 250) &&
        near(createAgg.totals.gstAmount, 37.5)
    )
  );

  checks.push(
    assert(
      "createPricingFromEstimate schema requires project UUID",
      parsePricingInput(createPricingFromEstimateInputSchema, {
        projectId: PROJECT_UUID,
      }).ok &&
        !parsePricingInput(createPricingFromEstimateInputSchema, {
          projectId: "bad",
        }).ok
    )
  );

  // --- recalibration adopted (wiring) ---
  const recalSrc = readFileSync("lib/pricing/recalibration.ts", "utf8");
  checks.push(
    assert(
      "recalibration uses authoritative document totals",
      recalSrc.includes("calculateAuthoritativeDocumentTotals")
    )
  );
  checks.push(
    assert(
      "recalibration preserves manually_edited branch",
      recalSrc.includes("manually_edited") &&
        recalSrc.includes("MANUAL_PRESERVED_NOTE")
    )
  );
  const helpersSrc = readFileSync(
    "lib/pricing/recalibration-helpers.ts",
    "utf8"
  );
  checks.push(
    assert(
      "recalibration helpers use estimate-to-pricing adapter",
      helpersSrc.includes("calculateAuthoritativeFieldsFromEstimateLine")
    )
  );

  // --- reviewed / read paths ---
  const actionsSrc = readFileSync("lib/pricing/actions.ts", "utf8");
  const markSlice = actionsSrc.slice(
    actionsSrc.indexOf("export async function markPricingReviewed")
  );
  checks.push(
    assert(
      "markPricingReviewed does not call calculateDocumentTotals/legacy recalc",
      !markSlice.includes("calculateDocumentTotals") &&
        !markSlice.includes("recalculateAndPersistDocumentTotals") &&
        markSlice.includes('status: "reviewed"')
    )
  );

  const mappedUnknown = mapPricingItem({
    id: "1",
    org_id: "o",
    pricing_document_id: "d",
    project_id: "p",
    work_area_id: null,
    source_estimate_line_item_id: null,
    item_type: "allowance",
    delivery_method: "allowance",
    internal_label: "Sell only",
    client_label: "Sell only",
    internal_description: null,
    client_description: null,
    quantity: 1,
    unit: null,
    unit_cost: null,
    unit_sell: null,
    total_cost: 0,
    total_sell: 5000,
    gross_profit: 0,
    margin_percent: 0,
    markup_percent: 0,
    visible_on_quote: true,
    optional: false,
    sort_order: 0,
    notes_internal: null,
    notes_client: null,
    created_at: "t",
    updated_at: "t",
    manually_edited: false,
    orphaned: false,
    recalibration_note: null,
    calculation_mode: "lump_sum",
    productivity_rate: null,
    productivity_unit: null,
    calculated_quantity: null,
  });
  checks.push(
    assert(
      "read mapper flags unknown-cost (cost_known=false)",
      mappedUnknown.cost_known === false &&
        mappedUnknown.margin_percent === 0 &&
        mappedUnknown.total_sell === 5000
    )
  );

  const mappedDoc = mapPricingDocument({
    id: "d",
    org_id: "o",
    project_id: "p",
    estimate_id: null,
    title: "T",
    status: "draft",
    client_name: null,
    site_address: null,
    pricing_date: null,
    valid_until: null,
    subtotal_cost: 100,
    subtotal_sell: 125,
    gross_profit: 25,
    margin_percent: 20,
    markup_percent: 25,
    gst_rate: 0,
    gst_amount: 0,
    total_incl_gst: 125,
    scope_summary: null,
    assumptions: [],
    exclusions: [],
    terms: null,
    internal_notes: null,
    created_by: null,
    created_at: "t",
    updated_at: "t",
    reviewed_at: null,
    converted_to_quote_at: null,
    needs_recalibration: false,
    recalibration_status: "current",
    recalibration_dismissed_at: null,
    recalibrated_at: null,
  });
  checks.push(
    assert(
      "document read returns persisted totals (incl 0% GST)",
      mappedDoc.gst_rate === 0 &&
        mappedDoc.gst_amount === 0 &&
        mappedDoc.subtotal_sell === 125
    )
  );

  // --- Domain authority wiring ---
  checks.push(
    assert(
      "createPricingFromEstimate maps before insert / uses authoritative aggregate",
      actionsSrc.includes("aggregateLines") &&
        actionsSrc.includes("calculateAuthoritativeDocumentTotals") &&
        actionsSrc.includes("valuesFromEstimateLineItem")
    )
  );
  checks.push(
    assert(
      "no production parity imports in pricing lib",
      !actionsSrc.includes("commercial-engine/parity") &&
        !helpersSrc.includes("commercial-engine/parity") &&
        !recalSrc.includes("commercial-engine/parity")
    )
  );
  checks.push(
    assert(
      "create path does not hardcode DEFAULT_GST_RATE",
      !actionsSrc.includes("DEFAULT_GST_RATE")
    )
  );
  checks.push(
    assert(
      "create still uses createGst.recalculationGstRate",
      actionsSrc.includes("createGst.recalculationGstRate")
    )
  );
  checks.push(
    assert(
      "rollback authority switch still present",
      readFileSync("lib/pricing/adoption-authority.ts", "utf8").includes(
        'PRICING_ITEM_CALCULATION_AUTHORITY'
      )
    )
  );

  // Security
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

  // Parity unchanged
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

  // Legacy helpers retained (UI / quotes / rollback) — not deleted
  const calcSrc = readFileSync("lib/pricing/calculations.ts", "utf8");
  checks.push(
    assert(
      "legacy calculateDocumentTotals retained for UI/quote/rollback",
      calcSrc.includes("export function calculateDocumentTotals")
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
  console.log("Batch 2B.6B complete pricing adoption verification passed.");
}

main();
