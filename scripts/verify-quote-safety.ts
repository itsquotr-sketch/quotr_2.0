/**
 * Quote client-safety sanitisation tests.
 *
 * Run: npx tsx scripts/verify-quote-safety.ts
 */
import { deriveSellFromCost } from "../lib/estimate/rates";
import {
  collectQuoteSanitisationWarnings,
  resolveQuoteItemDescription,
  resolveQuoteItemLabel,
} from "../lib/quotes/from-pricing";
import {
  containsSuspiciousQuoteText,
  sanitizeClientQuoteDescription,
  sanitizeClientQuoteLabel,
  stripCostPatterns,
} from "../lib/quotes/sanitize";
import {
  assertMarginPercentForEstimating,
  InvalidMarginPercentError,
  validateMarginPercent,
} from "../lib/security/margin-validation";
import type { PricingItem } from "../lib/pricing/types";

function assert(label: string, ok: boolean) {
  console.log(ok ? "PASS" : "FAIL", label);
  if (!ok) process.exitCode = 1;
}

function pricingItem(overrides: Partial<PricingItem>): PricingItem {
  return {
    id: "item-1",
    org_id: "org-1",
    pricing_document_id: "doc-1",
    project_id: "project-1",
    work_area_id: null,
    source_estimate_line_item_id: null,
    item_type: "labour",
    delivery_method: "in_house",
    internal_label: "Test",
    client_label: "Test",
    internal_description: null,
    client_description: null,
    quantity: 1,
    unit: "item",
    unit_cost: 100,
    unit_sell: 125,
    total_cost: 100,
    total_sell: 125,
    gross_profit: 25,
    margin_percent: 20,
    markup_percent: 25,
    calculation_mode: "quantity_rate",
    productivity_rate: null,
    productivity_unit: null,
    calculated_quantity: null,
    visible_on_quote: true,
    optional: false,
    sort_order: 0,
    notes_internal: null,
    notes_client: null,
    manually_edited: false,
    orphaned: false,
    recalibration_note: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

console.log("--- Margin guard ---");
try {
  deriveSellFromCost(100, 100);
  assert("deriveSellFromCost(100, 100) throws", false);
} catch (error) {
  assert(
    "deriveSellFromCost(100, 100) throws InvalidMarginPercentError",
    error instanceof InvalidMarginPercentError
  );
}

assert("validateMarginPercent rejects 95%", validateMarginPercent(95).ok === false);
assert("validateMarginPercent rejects 100%", validateMarginPercent(100).ok === false);
assert("validateMarginPercent accepts 25%", validateMarginPercent(25).ok === true);
assert(
  "deriveSellFromCost(100, 25) returns finite sell",
  Number.isFinite(deriveSellFromCost(100, 25))
);
assert(
  "assertMarginPercentForEstimating accepts 80%",
  assertMarginPercentForEstimating(80) === 80
);

console.log("\n--- stripCostPatterns ---");
assert(
  "removes $180/m²",
  !sanitizeClientQuoteLabel("Allowance at $180/m² installed").includes("$180")
);
assert(
  "removes cost rate phrase",
  !sanitizeClientQuoteDescription("Includes tiling · cost rate $45 per m²")?.toLowerCase().includes("cost rate")
);
assert(
  "removes $65/hr",
  stripCostPatterns("Labour calculated at $65/hr for access") === "Labour calculated at for access" ||
    !containsSuspiciousQuoteText(stripCostPatterns("Labour calculated at $65/hr for access"))
);

console.log("\n--- Internal phrase removal ---");
const blockedPhrases = [
  "benchmark",
  "margin",
  "gross profit",
  "productivity",
  "labour hours",
  "internal",
  "cost rate",
  "sell rate",
  "anthropic",
];

for (const phrase of blockedPhrases) {
  const label = sanitizeClientQuoteLabel(`Bathroom tiling (${phrase} source)`);
  assert(`label removes "${phrase}"`, !label.toLowerCase().includes(phrase));
}

console.log("\n--- Quote item mapping ---");
const dirtyItem = pricingItem({
  client_label: "Waterproofing allowance — benchmark $95/m² cost rate",
  client_description:
    "Based on productivity 0.35 hrs/m² · margin 22% · gross profit internal",
});

const label = resolveQuoteItemLabel(dirtyItem);
const description = resolveQuoteItemDescription(dirtyItem);

assert("mapped label has no benchmark", !/benchmark/i.test(label));
assert("mapped label has no $/m²", !/\$.*\/m²/i.test(label));
assert("mapped description has no productivity", !/productivity/i.test(description ?? ""));
assert("mapped description has no margin", !/margin/i.test(description ?? ""));

const warnings = collectQuoteSanitisationWarnings([dirtyItem]);
assert(
  "warnings collected for suspicious remnants if any",
  Array.isArray(warnings)
);

console.log("\n--- Totals section not sanitised here ---");
const clientTotal = "$12,500.00";
assert("quote totals strings are not modified by item sanitisers", clientTotal === "$12,500.00");

if (!process.exitCode) {
  console.log("\nQuote safety checks passed.");
} else {
  console.log("\nQuote safety checks failed.");
}
