import { calculateAuthoritativeDocumentTotals } from "@/lib/pricing/authoritative-document-totals";
import {
  calculateAuthoritativePricingItem,
  type PersistedPricingItemMoneyFields,
} from "@/lib/pricing/commercial-engine-adapter";

export type RfqPricingSourceLine = {
  id: string;
  totalCost: number;
  totalSell: number;
};

/** A zero cost and zero sell is unknown. A stated zero sell on a known cost stays zero. */
export function rfqLineSellKnown(line: RfqPricingSourceLine): boolean {
  return line.totalCost > 0 || line.totalSell > 0;
}

export function rfqAllowanceSell(lines: readonly RfqPricingSourceLine[]): {
  known: boolean;
  amount: number;
} {
  if (lines.length === 0 || lines.some((line) => !rfqLineSellKnown(line))) {
    return { known: false, amount: 0 };
  }
  const amount = Math.round(lines.reduce((sum, line) => sum + line.totalSell, 0) * 100) / 100;
  return { known: true, amount };
}

export function rfqAllowanceLabel(structure: string | null, scopeLabel: string): string {
  const scope = scopeLabel.trim() || "Requested work";
  return structure === "itemised" ? `Subcontract — ${scope}` : `Subcontract allowance — ${scope}`;
}

export type RfqPricingMoneyView = {
  cost: number | null;
  sell: number | null;
  marginPercent: number | null;
  gstAmount: number | null;
  totalInclGst: number | null;
};

export type RfqPricingPreview = {
  sellKnown: boolean;
  allowance: PersistedPricingItemMoneyFields;
  before: RfqPricingMoneyView;
  after: RfqPricingMoneyView;
};

function viewFromTotals(totals: {
  subtotalCost: number;
  subtotalSell: number;
  marginPercent: number;
  gstAmount: number;
  totalInclGst: number;
  costKnown: boolean;
}): RfqPricingMoneyView {
  return {
    cost: totals.costKnown ? totals.subtotalCost : null,
    sell: totals.costKnown ? totals.subtotalSell : null,
    marginPercent: totals.costKnown ? totals.marginPercent : null,
    gstAmount: totals.costKnown ? totals.gstAmount : null,
    totalInclGst: totals.costKnown ? totals.totalInclGst : null,
  };
}

export function buildRfqPricingPreview(input: {
  responseId: string;
  priceExGst: number;
  gstRate: number;
  items: readonly RfqPricingSourceLine[];
  replacedIds: readonly string[];
  existingAllowanceId: string | null;
  /** Original line money when a newer response replaces an already applied offer. */
  sellLines?: readonly RfqPricingSourceLine[];
}): { ok: true; preview: RfqPricingPreview } | { ok: false; error: string } {
  const basis = input.sellLines ?? input.items;
  const replaced = basis.filter((item) => input.replacedIds.includes(item.id));
  if (replaced.length !== input.replacedIds.length) {
    return { ok: false, error: "Choose pricing lines from this work area." };
  }
  const sell = rfqAllowanceSell(replaced);
  const allowance = calculateAuthoritativePricingItem({
    quantity: 1,
    unit: "allowance",
    totalCost: input.priceExGst,
    totalSell: sell.amount,
    itemType: "allowance",
    calculationMode: "lump_sum",
    manualSellOverride: sell.known,
    requestId: `rfq-apply-${input.responseId}`,
    sourceReferences: ["rfq:pricing_apply"],
  });
  if (!allowance.ok) return { ok: false, error: allowance.error };
  if (Math.abs(allowance.fields.totalCost - input.priceExGst) > 0.001) {
    return { ok: false, error: "The subcontract cost could not be kept as entered." };
  }
  if (Math.abs(allowance.fields.totalSell - sell.amount) > 0.001) {
    return { ok: false, error: "The existing sell could not be kept." };
  }

  const beforeLines = input.items.map((item) => ({
    total_cost: item.totalCost,
    total_sell: item.totalSell,
    visible: true,
  }));
  const remaining = input.items.filter((item) => item.id !== input.existingAllowanceId);
  const afterLines = [
    ...remaining.map((item) => ({
      total_cost: input.replacedIds.includes(item.id) ? 0 : item.totalCost,
      total_sell: input.replacedIds.includes(item.id) ? 0 : item.totalSell,
      visible: true,
    })),
    {
      total_cost: allowance.fields.totalCost,
      total_sell: allowance.fields.totalSell,
      visible: true,
    },
  ];
  const before = calculateAuthoritativeDocumentTotals(beforeLines, input.gstRate, `rfq-before-${input.responseId}`);
  const after = calculateAuthoritativeDocumentTotals(afterLines, input.gstRate, `rfq-after-${input.responseId}`);
  if (!before.ok || !after.ok) {
    return { ok: false, error: "Pricing totals could not be previewed." };
  }
  return {
    ok: true,
    preview: {
      sellKnown: sell.known,
      allowance: allowance.fields,
      before: viewFromTotals(before.totals),
      after: viewFromTotals(after.totals),
    },
  };
}
