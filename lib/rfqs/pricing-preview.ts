import { validateMarginPercent } from "@/lib/security/margin-validation";
import { moneyAmountSchema } from "@/lib/security/numeric-validation";
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

export type RfqSellTreatment = "keep" | "target_margin" | "manual";

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
  grossProfit: number | null;
  marginPercent: number | null;
  gstAmount: number | null;
  totalInclGst: number | null;
};

export type RfqAffectedLine = {
  id: string;
  cost: number | null;
  sell: number | null;
};

export type RfqSellChoice = {
  treatment: RfqSellTreatment;
  available: boolean;
  unavailableReason: string | null;
  sellKnown: boolean;
  cost: number;
  sell: number | null;
  grossProfit: number | null;
  marginPercent: number | null;
  loss: boolean;
  allowance: PersistedPricingItemMoneyFields | null;
  /** The selected lines only, after this sell. Document totals stay on `after`. */
  selectedAfter: RfqPricingMoneyView;
  after: RfqPricingMoneyView;
};

export type RfqSellChoices = {
  affected: RfqAffectedLine[];
  /** Money for the lines the builder selected, before they are replaced. */
  selectedBefore: RfqPricingMoneyView;
  before: RfqPricingMoneyView;
  choices: RfqSellChoice[];
};

function moneyView(input: {
  cost: number | null;
  sell: number | null;
  grossProfit: number | null;
  marginPercent: number | null;
  gstAmount: number | null;
  totalInclGst: number | null;
}): RfqPricingMoneyView {
  return input;
}

function viewFromTotals(totals: {
  subtotalCost: number;
  subtotalSell: number;
  grossProfit: number;
  marginPercent: number;
  gstAmount: number;
  totalInclGst: number;
  costKnown: boolean;
}, sellKnown: boolean): RfqPricingMoneyView {
  if (!totals.costKnown) {
    return moneyView({
      cost: null,
      sell: null,
      grossProfit: null,
      marginPercent: null,
      gstAmount: null,
      totalInclGst: null,
    });
  }
  if (!sellKnown) {
    return moneyView({
      cost: totals.subtotalCost,
      sell: null,
      grossProfit: null,
      marginPercent: null,
      gstAmount: null,
      totalInclGst: null,
    });
  }
  return moneyView({
    cost: totals.subtotalCost,
    sell: totals.subtotalSell,
    grossProfit: totals.grossProfit,
    marginPercent: totals.marginPercent,
    gstAmount: totals.gstAmount,
    totalInclGst: totals.totalInclGst,
  });
}

function storedFits(value: number): boolean {
  return Number.isFinite(value) && Math.abs(value) <= 999.99;
}

function choiceFromAllowance(input: {
  treatment: RfqSellTreatment;
  priceExGst: number;
  sellKnown: boolean;
  fields: PersistedPricingItemMoneyFields;
  selectedAfter: RfqPricingMoneyView;
  after: RfqPricingMoneyView;
}): RfqSellChoice {
  const sell = input.sellKnown ? input.fields.totalSell : null;
  const marginUnknown = !input.sellKnown || (sell != null && sell <= 0 && input.priceExGst > 0);
  const loss = input.sellKnown && sell != null && input.priceExGst > sell;
  return {
    treatment: input.treatment,
    available: true,
    unavailableReason: null,
    sellKnown: input.sellKnown,
    cost: input.fields.totalCost,
    sell,
    grossProfit: input.sellKnown ? input.fields.grossProfit : null,
    marginPercent: marginUnknown ? null : input.fields.marginPercent,
    loss,
    allowance: input.fields,
    selectedAfter: input.selectedAfter,
    after: input.after,
  };
}

function unavailable(
  treatment: RfqSellTreatment,
  priceExGst: number,
  reason: string,
  selectedAfter: RfqPricingMoneyView,
  after: RfqPricingMoneyView
): RfqSellChoice {
  return {
    treatment,
    available: false,
    unavailableReason: reason,
    sellKnown: false,
    cost: priceExGst,
    sell: null,
    grossProfit: null,
    marginPercent: null,
    loss: false,
    allowance: null,
    selectedAfter,
    after,
  };
}

export function buildRfqSellChoices(input: {
  responseId: string;
  priceExGst: number;
  gstRate: number;
  items: readonly RfqPricingSourceLine[];
  replacedIds: readonly string[];
  existingAllowanceId: string | null;
  /** Original line money when a newer response replaces an already applied offer. */
  sellLines?: readonly RfqPricingSourceLine[];
  targetMarginPercent: number | null;
  manualSell: number | null;
}): { ok: true; preview: RfqSellChoices } | { ok: false; error: string } {
  const basis = input.sellLines ?? input.items;
  const replaced = basis.filter((item) => input.replacedIds.includes(item.id));
  if (replaced.length !== input.replacedIds.length) {
    return { ok: false, error: "Choose pricing lines from this work area." };
  }
  const current = rfqAllowanceSell(replaced);
  const affected = replaced.map((line) => {
    const known = rfqLineSellKnown(line);
    return {
      id: line.id,
      cost: known ? line.totalCost : null,
      sell: known ? line.totalSell : null,
    };
  });

  const beforeLines = input.items.map((item) => ({
    total_cost: item.totalCost,
    total_sell: item.totalSell,
    visible: true,
  }));
  const beforeTotals = calculateAuthoritativeDocumentTotals(beforeLines, input.gstRate, `rfq-before-${input.responseId}`);
  if (!beforeTotals.ok) return { ok: false, error: "Pricing totals could not be previewed." };
  const before = viewFromTotals(beforeTotals.totals, true);
  const selectedTotals = calculateAuthoritativeDocumentTotals(
    replaced.map((line) => {
      const known = rfqLineSellKnown(line);
      return {
        total_cost: known ? line.totalCost : 0,
        total_sell: known ? line.totalSell : 0,
        cost_known: known,
      };
    }),
    input.gstRate,
    `rfq-selected-before-${input.responseId}`
  );
  if (!selectedTotals.ok) return { ok: false, error: "Pricing totals could not be previewed." };
  const selectedBefore = viewFromTotals(selectedTotals.totals, replaced.length === 0 || current.known);

  function afterFor(fields: PersistedPricingItemMoneyFields | null, sellKnown: boolean): RfqPricingMoneyView | null {
    const remaining = input.items.filter((item) => item.id !== input.existingAllowanceId);
    const afterLines = [
      ...remaining.map((item) => ({
        total_cost: input.replacedIds.includes(item.id) ? 0 : item.totalCost,
        total_sell: input.replacedIds.includes(item.id) ? 0 : item.totalSell,
        visible: true,
      })),
      ...(fields
        ? [{
            total_cost: fields.totalCost,
            total_sell: sellKnown ? fields.totalSell : 0,
            visible: true,
            cost_known: true,
          }]
        : []),
    ];
    const after = calculateAuthoritativeDocumentTotals(afterLines, input.gstRate, `rfq-after-${input.responseId}`);
    if (!after.ok) return null;
    return viewFromTotals(after.totals, sellKnown);
  }

  const emptyAfter = before;

  function pricedChoice(
    treatment: RfqSellTreatment,
    sellKnown: boolean,
    amount: number,
    manual: boolean,
    margin: number | null
  ): RfqSellChoice {
    const allowance = margin != null
      ? calculateAuthoritativePricingItem(
          {
            quantity: 1,
            unit: "allowance",
            unitCost: input.priceExGst,
            itemType: "allowance",
            calculationMode: "quantity_rate",
            requestId: `rfq-apply-${input.responseId}-${treatment}`,
            sourceReferences: ["rfq:pricing_apply"],
          },
          { default_gross_margin_percent: margin }
        )
      : calculateAuthoritativePricingItem({
          quantity: 1,
          unit: "allowance",
          totalCost: input.priceExGst,
          totalSell: amount,
          itemType: "allowance",
          calculationMode: "lump_sum",
          manualSellOverride: manual,
          requestId: `rfq-apply-${input.responseId}-${treatment}`,
          sourceReferences: ["rfq:pricing_apply"],
        });
    if (!allowance.ok) return unavailable(treatment, input.priceExGst, allowance.error, selectedBefore, emptyAfter);
    if (Math.abs(allowance.fields.totalCost - input.priceExGst) > 0.001) {
      return unavailable(treatment, input.priceExGst, "The subcontract cost could not be kept as entered.", selectedBefore, emptyAfter);
    }
    if (!storedFits(allowance.fields.marginPercent) || !storedFits(allowance.fields.markupPercent)) {
      return unavailable(treatment, input.priceExGst, "That sell cannot be stored on a pricing line.", selectedBefore, emptyAfter);
    }
    const selectedAfterTotals = calculateAuthoritativeDocumentTotals(
      [{
        total_cost: allowance.fields.totalCost,
        total_sell: sellKnown ? allowance.fields.totalSell : 0,
        cost_known: true,
      }],
      input.gstRate,
      `rfq-selected-after-${input.responseId}-${treatment}`
    );
    if (!selectedAfterTotals.ok) {
      return unavailable(treatment, input.priceExGst, "Pricing totals could not be previewed.", selectedBefore, emptyAfter);
    }
    const after = afterFor(allowance.fields, sellKnown);
    if (!after) return unavailable(treatment, input.priceExGst, "Pricing totals could not be previewed.", selectedBefore, emptyAfter);
    return choiceFromAllowance({
      treatment,
      priceExGst: input.priceExGst,
      sellKnown,
      fields: allowance.fields,
      selectedAfter: viewFromTotals(selectedAfterTotals.totals, sellKnown),
      after,
    });
  }

  const keep = replaced.length === 0
    ? unavailable("keep", input.priceExGst, "No existing sell is selected. Choose a target margin or enter a sell.", selectedBefore, emptyAfter)
    : current.known
      ? pricedChoice("keep", true, current.amount, true, null)
      : unavailable("keep", input.priceExGst, "The current sell is unknown. That line is Pricing Required.", selectedBefore, emptyAfter);

  const marginCheck = input.targetMarginPercent == null ? null : validateMarginPercent(input.targetMarginPercent);
  const target = marginCheck?.ok
    ? pricedChoice("target_margin", true, 0, false, input.targetMarginPercent)
    : unavailable(
        "target_margin",
        input.priceExGst,
        input.targetMarginPercent == null
          ? "This job has no target margin."
          : marginCheck?.ok === false
            ? marginCheck.message
            : "This job has no target margin.",
        selectedBefore,
        emptyAfter
      );

  const manualParsed = input.manualSell == null ? null : moneyAmountSchema.safeParse(input.manualSell);
  const manual = manualParsed?.success
    ? pricedChoice("manual", true, manualParsed.data, true, null)
    : unavailable(
        "manual",
        input.priceExGst,
        input.manualSell == null ? "Enter a sell ex GST." : "Sell must be zero or greater.",
        selectedBefore,
        emptyAfter
      );

  return {
    ok: true,
    preview: { affected, selectedBefore, before, choices: [keep, target, manual] },
  };
}
