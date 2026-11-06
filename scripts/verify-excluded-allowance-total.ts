/**
 * Saving a quote-visible pile allowance must not turn its sell into the
 * document price. The hosted gap was $6,336.88 stored against a $5,736.88
 * recommendation: the $600 was the excluded allowance, not an applied price.
 *
 * Run: npx tsx scripts/verify-excluded-allowance-total.ts
 */
import { buildPersistedLineItemNotes } from "../lib/estimate/line-item-metadata";
import { calculateAuthoritativeDocumentTotals } from "../lib/pricing/authoritative-document-totals";
import { allocateFinalSell, pricingDecisionSelection } from "../lib/pricing/final-sell";
import { presentPricingSectionTotals } from "../lib/pricing/presentation-section-totals";
import {
  QUOTE_VISIBLE_EXCLUDED_BLOCK,
  pricingLineIncludedInDocumentTotal,
  quoteVisibleExcludedLineBlock,
} from "../lib/pricing/scope-finalisation";
import type { PricingItem } from "../lib/pricing/types";
import { resolveQuoteItemDescription } from "../lib/quotes/from-pricing";

const RECOMMENDED_SELL = 5736.88;
const INCLUDED_COST = 4589.94;
const ALLOWANCE_SELL = 600;
const ALLOWANCE_COST = 400;

let passed = 0;
let failed = 0;

function check(name: string, ok: boolean, detail?: string): void {
  if (ok) {
    passed += 1;
    console.log(`PASS  ${name}`);
    return;
  }
  failed += 1;
  console.log(`FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
}

const excludedNotes = buildPersistedLineItemNotes({
  metadata: { includedInTotal: false },
});

const included = {
  total_cost: INCLUDED_COST,
  total_sell: RECOMMENDED_SELL,
  cost_known: true,
  notes_internal: null,
};
const allowance = {
  total_cost: ALLOWANCE_COST,
  total_sell: ALLOWANCE_SELL,
  cost_known: true,
  notes_internal: excludedNotes,
  included_in_total: false as const,
};

check(
  "excluded allowance stays out of the document total",
  pricingLineIncludedInDocumentTotal(allowance) === false &&
    pricingLineIncludedInDocumentTotal(included) === true
);

const totals = calculateAuthoritativeDocumentTotals(
  [included, allowance],
  15,
  "excluded-allowance-total"
);
check(
  "saving the allowance does not add its sell to the priced total",
  totals.ok &&
    totals.totals.subtotalSell === RECOMMENDED_SELL &&
    totals.totals.subtotalCost === INCLUDED_COST,
  totals.ok
    ? `sell ${totals.totals.subtotalSell} cost ${totals.totals.subtotalCost}`
    : totals.error
);

const section = presentPricingSectionTotals([included, allowance]);
check(
  "work-area header uses the same priced total",
  section.subtotalSell === RECOMMENDED_SELL &&
    section.subtotalCost === INCLUDED_COST,
  `sell ${section.subtotalSell} cost ${section.subtotalCost}`
);

const selection = pricingDecisionSelection({
  storedSell: RECOMMENDED_SELL,
  recommendedSell: RECOMMENDED_SELL,
});
check(
  "a matching stored sell stays the recommendation",
  selection.mode === "recommended" && selection.field === "5736.88"
);

const polluted = pricingDecisionSelection({
  storedSell: RECOMMENDED_SELL + ALLOWANCE_SELL,
  recommendedSell: RECOMMENDED_SELL,
});
check(
  "the $600 gap is what an included allowance sell would look like",
  polluted.mode === "own" && polluted.field === "6336.88"
);

const allocated = allocateFinalSell(
  [
    {
      id: "deck",
      total_sell: RECOMMENDED_SELL,
      total_cost: INCLUDED_COST,
      cost_known: true,
      notes_internal: null,
    },
    {
      id: "allowance",
      total_sell: ALLOWANCE_SELL,
      total_cost: ALLOWANCE_COST,
      cost_known: true,
      notes_internal: excludedNotes,
    },
  ],
  RECOMMENDED_SELL
);
check(
  "applying the recommendation does not rewrite the excluded row",
  allocated.ok &&
    allocated.allocations.length === 1 &&
    allocated.allocations[0]?.itemId === "deck" &&
    allocated.allocations[0]?.totalSell === RECOMMENDED_SELL
);

const blocked = quoteVisibleExcludedLineBlock([
  { visible_on_quote: true, notes_internal: excludedNotes },
]);
check(
  "the quote-visible excluded row still blocks review",
  blocked === QUOTE_VISIBLE_EXCLUDED_BLOCK
);

const projection = resolveQuoteItemDescription({
  client_description: "Removal of existing piles",
  notes_client: null,
  internal_description: "Subcontractor price",
} as PricingItem);
check(
  "client projection uses the client description and not the internal basis",
  projection === "Removal of existing piles" &&
    !String(projection).includes("Subcontractor price")
);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
