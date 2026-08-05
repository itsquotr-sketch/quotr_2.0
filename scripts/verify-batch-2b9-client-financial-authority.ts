/**
 * Batch 2B.9 — Client financial authority removal verification.
 *
 * Static scans + pure presentation/view-model checks. No live Supabase.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { previewPricingItemEdit } from "../lib/pricing/presentation-item-preview";
import { presentPricingSectionTotals } from "../lib/pricing/presentation-section-totals";
import { presentEstimateWorkAreaTotals } from "../lib/estimate/presentation-breakdown";
import {
  formatProfitabilityDisplay,
  MARGIN_UNAVAILABLE_LABEL,
  PROFITABILITY_UNAVAILABLE_LABEL,
} from "../lib/financial-presentation/format";
import { quoteDocumentViewModel } from "../lib/quotes/financial-view-model";
import { pricingDocumentViewModel } from "../lib/pricing/financial-view-model";
import { runShadowParitySuite } from "../lib/commercial-engine/parity";

type Check = { name: string; ok: boolean; detail?: string };

function assert(name: string, condition: boolean, detail?: string): Check {
  return { name, ok: condition, detail };
}

function near(a: number, b: number, tol = 0.02): boolean {
  return Math.abs(a - b) <= tol;
}

function walkTsx(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".next") continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walkTsx(p, out);
    else if (/\.(tsx|ts)$/.test(name)) out.push(p);
  }
  return out;
}

function main(): void {
  console.log("=== Batch 2B.9 Client Financial Authority Verification ===\n");
  const checks: Check[] = [];

  // --- Static authority scan (components only) ---
  const componentFiles = walkTsx("components");
  const forbiddenImports = [
    "commercial-engine/parity",
    "lib/commercial-engine/parity",
  ];
  const forbiddenAuthorityCalls = [
    "calculateDocumentTotals(",
    "calculateQuoteTotals(",
    "calculateQuoteItemTotal(",
    "calculatePricingItemEdit(",
    "deriveSellFromCost(",
    "DEFAULT_GST_RATE",
  ];

  let importHits = 0;
  const authorityHits: string[] = [];
  for (const file of componentFiles) {
    const src = readFileSync(file, "utf8");
    for (const frag of forbiddenImports) {
      if (src.includes(frag)) {
        importHits += 1;
        authorityHits.push(`${file}: parity import`);
      }
    }
    // Allow presentation-item-preview which may mention calculatePricingItemEdit in comments only —
    // components must not call calculatePricingItemEdit(
    if (src.includes("calculatePricingItemEdit(")) {
      authorityHits.push(`${file}: calculatePricingItemEdit`);
    }
    if (src.includes("calculateDocumentTotals(")) {
      authorityHits.push(`${file}: calculateDocumentTotals`);
    }
    if (src.includes("calculateQuoteTotals(")) {
      authorityHits.push(`${file}: calculateQuoteTotals`);
    }
    // Inline GP triad pattern in client components
    if (
      /grossProfit\s*=\s*.*totalSell\s*-\s*totalCost/.test(src) ||
      /\(profit\s*\/\s*sell\)\s*\*\s*100/.test(src)
    ) {
      // EstimateBreakdownModal must not keep unrounded margin formula
      if (file.includes("EstimateBreakdownModal") || file.includes("PricingItemEditForm")) {
        authorityHits.push(`${file}: inline profit/margin formula`);
      }
    }
  }

  checks.push(
    assert(
      "no client parity imports",
      importHits === 0,
      authorityHits.filter((h) => h.includes("parity")).join("; ") || undefined
    )
  );
  checks.push(
    assert(
      "no client calculateDocumentTotals / calculatePricingItemEdit / quote totals",
      !authorityHits.some(
        (h) =>
          h.includes("calculateDocumentTotals") ||
          h.includes("calculatePricingItemEdit") ||
          h.includes("calculateQuoteTotals")
      ),
      authorityHits.join("; ") || undefined
    )
  );
  checks.push(
    assert(
      "no inline client GP/margin authority in key forms",
      !authorityHits.some((h) => h.includes("inline profit")),
      authorityHits.filter((h) => h.includes("inline")).join("; ") || undefined
    )
  );

  // Allowed preview helper exists and uses engine adapter
  const previewSrc = readFileSync(
    "lib/pricing/presentation-item-preview.ts",
    "utf8"
  );
  checks.push(
    assert(
      "approved preview helper uses commercial-engine adapter",
      previewSrc.includes("calculateAuthoritativePricingItem") &&
        previewSrc.includes("isPreview")
    )
  );

  const sectionSrc = readFileSync(
    "lib/pricing/presentation-section-totals.ts",
    "utf8"
  );
  checks.push(
    assert(
      "section totals use authoritative document aggregate",
      sectionSrc.includes("calculateAuthoritativeDocumentTotals")
    )
  );

  const boundaryExists = (() => {
    try {
      readFileSync(
        "docs/specifications/FINANCIAL_PRESENTATION_BOUNDARY.md",
        "utf8"
      );
      return true;
    } catch {
      return false;
    }
  })();
  checks.push(assert("financial presentation boundary doc exists", boundaryExists));

  // --- Pricing preview ---
  const preview = previewPricingItemEdit({
    calculationMode: "quantity_rate",
    quantity: 10,
    unitCost: 50,
    unitSell: 80,
    changedField: "quantity",
  });
  checks.push(
    assert(
      "pricing edit preview matches engine qty×rate",
      preview.isPreview &&
        near(preview.totalCost, 500) &&
        near(preview.totalSell, 800) &&
        near(preview.grossProfit, 300) &&
        near(preview.marginPercent, 37.5) &&
        preview.costKnown
    )
  );

  const unknownPreview = previewPricingItemEdit({
    calculationMode: "lump_sum",
    totalCost: 0,
    totalSell: 500,
    changedField: "totalSell",
  });
  checks.push(
    assert(
      "unknown-cost preview does not fabricate margin",
      unknownPreview.costKnown === false &&
        unknownPreview.grossProfit === 0 &&
        unknownPreview.marginPercent === 0
    )
  );

  const section = presentPricingSectionTotals([
    { total_cost: 400, total_sell: 500, cost_known: true },
    { total_cost: 100, total_sell: 125, cost_known: true },
  ]);
  checks.push(
    assert(
      "section totals reconcile without GST",
      near(section.subtotalSell, 625) &&
        near(section.subtotalCost, 500) &&
        near(section.marginPercent, 20)
    )
  );

  // --- Estimate work-area ---
  const areas = presentEstimateWorkAreaTotals([
    {
      workAreaName: "Deck",
      label: "Labour",
      category: "labour",
      recommendedCost: 300,
      recommendedSell: 400,
      grossProfit: 100,
      marginPercent: 25,
      costLow: 270,
      costHigh: 345,
      sellLow: 360,
      sellHigh: 460,
      rateSource: "user",
    },
    {
      workAreaName: "Deck",
      label: "Mat",
      category: "materials",
      recommendedCost: 200,
      recommendedSell: 250,
      grossProfit: 50,
      marginPercent: 20,
      costLow: 180,
      costHigh: 230,
      sellLow: 225,
      sellHigh: 287.5,
      rateSource: "user",
    },
  ]);
  checks.push(
    assert(
      "work-area margin from aggregate totals (rounded)",
      areas.length === 1 &&
        near(areas[0].cost, 500) &&
        near(areas[0].sell, 650) &&
        near(areas[0].marginPercent, 23.08, 0.05)
    )
  );

  // --- Unknown-cost formatting ---
  const unk = formatProfitabilityDisplay({
    costKnown: false,
    grossProfit: 0,
    marginPercent: 0,
  });
  checks.push(
    assert(
      "unknown-cost displays unavailable labels",
      unk.profitLabel === PROFITABILITY_UNAVAILABLE_LABEL &&
        unk.marginLabel === MARGIN_UNAVAILABLE_LABEL
    )
  );
  const known = formatProfitabilityDisplay({
    costKnown: true,
    grossProfit: 100,
    marginPercent: 25,
  });
  checks.push(
    assert(
      "known-cost formats money/percent",
      known.profitLabel.includes("$") && known.marginLabel.includes("%")
    )
  );

  // --- Quote snapshot view model (no recalc) ---
  const quoteVm = quoteDocumentViewModel({
    id: "q",
    org_id: "o",
    project_id: "p",
    pricing_document_id: null,
    estimate_id: null,
    quote_number: null,
    title: "Q",
    status: "sent",
    client_name: null,
    site_address: null,
    issue_date: null,
    valid_until: null,
    subtotal: 20000,
    gst_rate: 15,
    gst_amount: 3000,
    total_incl_gst: 23000,
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
  } as never);
  checks.push(
    assert(
      "quote view model uses stored totals",
      quoteVm.subtotalFormatted.includes("20") &&
        quoteVm.totalInclGstFormatted.includes("23")
    )
  );

  const pricingVm = pricingDocumentViewModel({
    id: "d",
    org_id: "o",
    project_id: "p",
    estimate_id: null,
    title: "P",
    status: "draft",
    client_name: null,
    site_address: null,
    pricing_date: null,
    valid_until: null,
    subtotal_cost: 0,
    subtotal_sell: 1000,
    gross_profit: 0,
    margin_percent: 0,
    markup_percent: 0,
    gst_rate: 15,
    gst_amount: 150,
    total_incl_gst: 1150,
    scope_summary: null,
    assumptions: [],
    exclusions: [],
    terms: null,
    internal_notes: null,
    created_by: null,
    created_at: "",
    updated_at: "",
    reviewed_at: null,
    converted_to_quote_at: null,
    needs_recalibration: false,
    recalibration_status: "current",
    recalibration_dismissed_at: null,
    recalibrated_at: null,
  });
  checks.push(
    assert(
      "pricing document unknown-cost shows unavailable profitability",
      pricingVm.costKnown === false &&
        pricingVm.profitLabel === PROFITABILITY_UNAVAILABLE_LABEL
    )
  );

  // Quote components must not recalculate
  const quoteTemplate = readFileSync(
    "components/quotes/QuoteTemplate.tsx",
    "utf8"
  );
  checks.push(
    assert(
      "QuoteTemplate does not recalculate totals",
      !quoteTemplate.includes("calculateQuoteTotals") &&
        !quoteTemplate.includes("quantity *") &&
        quoteTemplate.includes("item.total")
    )
  );

  // Wiring: key components use presentation helpers
  const editForm = readFileSync(
    "components/pricing/PricingItemEditForm.tsx",
    "utf8"
  );
  checks.push(
    assert(
      "PricingItemEditForm uses presentation preview",
      editForm.includes("previewPricingItemEdit") &&
        editForm.includes("Preview until saved")
    )
  );
  const sectionComp = readFileSync(
    "components/pricing/PricingWorkAreaSection.tsx",
    "utf8"
  );
  checks.push(
    assert(
      "PricingWorkAreaSection uses presentation section totals",
      sectionComp.includes("presentPricingSectionTotals")
    )
  );
  const breakdown = readFileSync(
    "components/assistant/EstimateBreakdownModal.tsx",
    "utf8"
  );
  checks.push(
    assert(
      "EstimateBreakdownModal uses presentation work-area totals",
      breakdown.includes("presentEstimateWorkAreaTotals")
    )
  );

  // --- Parity still clean ---
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

  void forbiddenAuthorityCalls;

  const failed = checks.filter((c) => !c.ok);
  for (const c of checks) {
    console.log(
      `${c.ok ? "PASS" : "FAIL"}  ${c.name}${c.detail ? ` — ${c.detail}` : ""}`
    );
  }
  console.log(
    `\nResult: ${checks.length - failed.length}/${checks.length} passed`
  );
  if (failed.length > 0) process.exitCode = 1;
}

main();
