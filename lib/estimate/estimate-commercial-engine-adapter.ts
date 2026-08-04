/**
 * Production estimate ↔ commercial-engine adapter — Batch 2B.7.
 *
 * Deterministic money only. Does not import parity.
 * Does not invent quantities, rates, confidence, or low/high drivers.
 */

import {
  buildAggregateRequest,
  buildLineRequest,
  deriveSellFromCost as engineDeriveSellFromCost,
  executeCommercialCalculation,
  type CalculationLineInput,
  type CalculationMode,
} from "@/lib/commercial-engine";
import type { OrganisationSettings } from "@/components/setup/types";
import { isAuthoritativeEstimateCalculation } from "@/lib/estimate/adoption-authority";
import { round2 } from "@/lib/estimate/facts";
import { getRangeFactors } from "@/lib/estimate/rates";
import { persistCommercialMetric } from "@/lib/pricing/commercial-engine-adapter";

export type EstimateMoneyTriad = {
  readonly recommendedCost: number;
  readonly recommendedSell: number;
  readonly grossProfit: number;
  readonly marginPercent: number;
  readonly markupPercent: number;
  readonly costKnown: boolean;
};

export type EstimateLineMoneyResult =
  | {
      readonly ok: true;
      readonly money: EstimateMoneyTriad;
      readonly mode: CalculationMode;
    }
  | { readonly ok: false; readonly error: string };

function mapOutputs(
  totalCost: number,
  totalSell: number,
  grossProfit: number | null,
  marginPercent: number | null,
  markupPercent: number | null,
  costKnown: boolean
): EstimateMoneyTriad {
  return {
    recommendedCost: totalCost,
    recommendedSell: totalSell,
    grossProfit: persistCommercialMetric(grossProfit, costKnown),
    marginPercent: persistCommercialMetric(marginPercent, costKnown),
    markupPercent: persistCommercialMetric(markupPercent, costKnown),
    costKnown,
  };
}

function legacyTriad(cost: number, sell: number): EstimateMoneyTriad {
  const recommendedCost = round2(cost);
  const recommendedSell = round2(sell);
  const costKnown = !(recommendedCost === 0 && recommendedSell > 0);
  if (!costKnown) {
    return {
      recommendedCost,
      recommendedSell,
      grossProfit: 0,
      marginPercent: 0,
      markupPercent: 0,
      costKnown: false,
    };
  }
  const grossProfit = round2(recommendedSell - recommendedCost);
  return {
    recommendedCost,
    recommendedSell,
    grossProfit,
    marginPercent:
      recommendedSell > 0
        ? round2((grossProfit / recommendedSell) * 100)
        : 0,
    markupPercent:
      recommendedCost > 0
        ? round2((grossProfit / recommendedCost) * 100)
        : 0,
    costKnown: true,
  };
}

function executeLine(
  input: CalculationLineInput,
  requestId: string
): EstimateLineMoneyResult {
  const request = buildLineRequest({
    requestId,
    input,
    source: {
      source_references: ["estimate:line"],
      origin: "system",
    },
    commercialSettings: {
      gst_rate_percent: null,
      default_gross_margin_percent: null,
      currency: "NZD",
    },
  });
  const record = executeCommercialCalculation(request);
  if (!record.ok || !record.outputs) {
    return {
      ok: false,
      error:
        record.blockingErrors[0]?.message ??
        "Estimate line calculation failed.",
    };
  }
  const o = record.outputs;
  return {
    ok: true,
    mode: (record.calculationMode === "document_aggregate"
      ? "lump_sum"
      : record.calculationMode) as CalculationMode,
    money: mapOutputs(
      o.totalCost ?? 0,
      o.totalSell ?? 0,
      o.grossProfit,
      o.grossMarginPercent,
      o.markupPercent,
      o.costKnown
    ),
  };
}

function requireMoney(result: EstimateLineMoneyResult): EstimateMoneyTriad {
  if (!result.ok) {
    throw new Error(result.error);
  }
  return result.money;
}

/** Quantity × unit rates (quality/waste already baked into quantity or rates by domain). */
export function calculateEstimateQuantityRateLine(params: {
  quantity: number;
  unitCost: number;
  unitSell: number;
  requestId?: string;
}): EstimateLineMoneyResult {
  if (!isAuthoritativeEstimateCalculation()) {
    return {
      ok: true,
      mode: "quantity_rate",
      money: legacyTriad(
        params.quantity * params.unitCost,
        params.quantity * params.unitSell
      ),
    };
  }
  if (params.quantity <= 0) {
    return executeLine(
      {
        mode: "lump_sum",
        quantity: 1,
        total_cost: 0,
        total_sell: 0,
        source_references: ["estimate:quantity_rate:zero"],
      },
      params.requestId ?? "estimate-qty-rate-zero"
    );
  }
  return executeLine(
    {
      mode: "quantity_rate",
      quantity: params.quantity,
      unit_cost: params.unitCost,
      unit_sell: params.unitSell,
      source_references: ["estimate:quantity_rate"],
    },
    params.requestId ?? "estimate-qty-rate"
  );
}

/** Labour hours (domain-shaped) × hourly rates via productivity_labour. */
export function calculateEstimateLabourLine(params: {
  labourHours: number;
  labourCostRate: number;
  labourSellRate: number;
  requestId?: string;
}): EstimateLineMoneyResult {
  if (!isAuthoritativeEstimateCalculation()) {
    return {
      ok: true,
      mode: "productivity_labour",
      money: legacyTriad(
        params.labourHours * params.labourCostRate,
        params.labourHours * params.labourSellRate
      ),
    };
  }
  // Engine productivity_labour requires hours > 0; zero-value uses lump.
  if (params.labourHours <= 0) {
    return executeLine(
      {
        mode: "lump_sum",
        quantity: 1,
        total_cost: 0,
        total_sell: 0,
        source_references: ["estimate:labour:zero"],
      },
      params.requestId ?? "estimate-labour-zero"
    );
  }
  return executeLine(
    {
      mode: "productivity_labour",
      quantity: params.labourHours,
      calculated_quantity: params.labourHours,
      productivity_rate: 1,
      unit_cost: params.labourCostRate,
      unit_sell: params.labourSellRate,
      source_references: ["estimate:labour"],
    },
    params.requestId ?? "estimate-labour"
  );
}

/** Lump-sum estimate allowance / package. */
export function calculateEstimateLumpLine(params: {
  totalCost: number;
  totalSell: number;
  requestId?: string;
}): EstimateLineMoneyResult {
  if (!isAuthoritativeEstimateCalculation()) {
    return {
      ok: true,
      mode: "lump_sum",
      money: legacyTriad(params.totalCost, params.totalSell),
    };
  }
  return executeLine(
    {
      mode: "lump_sum",
      quantity: 1,
      total_cost: params.totalCost,
      total_sell: params.totalSell,
      source_references: ["estimate:lump"],
    },
    params.requestId ?? "estimate-lump"
  );
}

/** Profit triad for already-known expected cost/sell (ranges applied separately). */
export function calculateEstimateProfitFromTotals(params: {
  totalCost: number;
  totalSell: number;
  requestId?: string;
}): EstimateLineMoneyResult {
  return calculateEstimateLumpLine(params);
}

/**
 * Expected commercial values + domain range factors.
 * Engine owns expected cost/sell/GP/margin; low/high are org factors × expected.
 */
export function buildAuthoritativeEstimateAmounts(
  recommendedCost: number,
  recommendedSell: number,
  organisationSettings: OrganisationSettings | null,
  requestId = "estimate-amounts"
): Pick<
  EstimateMoneyTriad,
  | "recommendedCost"
  | "recommendedSell"
  | "grossProfit"
  | "marginPercent"
  | "markupPercent"
> & {
  costLow: number;
  costHigh: number;
  sellLow: number;
  sellHigh: number;
  costKnown: boolean;
} {
  const money = requireMoney(
    calculateEstimateProfitFromTotals({
      totalCost: recommendedCost,
      totalSell: recommendedSell,
      requestId,
    })
  );
  const { low, high } = getRangeFactors(organisationSettings);
  return {
    recommendedCost: money.recommendedCost,
    recommendedSell: money.recommendedSell,
    grossProfit: money.grossProfit,
    marginPercent: money.marginPercent,
    markupPercent: money.markupPercent,
    costKnown: money.costKnown,
    costLow: round2(money.recommendedCost * low),
    costHigh: round2(money.recommendedCost * high),
    sellLow: round2(money.recommendedSell * low),
    sellHigh: round2(money.recommendedSell * high),
  };
}

/** Sell-from-margin (F-SFM) for estimate margin overrides. */
export function calculateEstimateSellFromCost(
  cost: number,
  marginPercent: number
): { ok: true; sell: number } | { ok: false; error: string } {
  if (!isAuthoritativeEstimateCalculation()) {
    try {
      const divisor = 1 - marginPercent / 100;
      if (divisor <= 0 || !Number.isFinite(marginPercent)) {
        return { ok: false, error: "Invalid gross margin percent." };
      }
      return { ok: true, sell: round2(cost / divisor) };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : "Invalid margin.",
      };
    }
  }
  try {
    const sell = engineDeriveSellFromCost(cost, marginPercent);
    return { ok: true, sell };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Invalid margin.",
    };
  }
}

/**
 * Apply target margin to known cost → sell + ranges (authoritative when switch on).
 */
export function applyAuthoritativeMarginToAmounts(
  recommendedCost: number,
  marginPercent: number,
  organisationSettings: OrganisationSettings | null
) {
  const sellResult = calculateEstimateSellFromCost(
    recommendedCost,
    marginPercent
  );
  if (!sellResult.ok) {
    throw new Error(sellResult.error);
  }
  return buildAuthoritativeEstimateAmounts(
    recommendedCost,
    sellResult.sell,
    organisationSettings,
    "estimate-margin-override"
  );
}

export type EstimateAggregateLine = {
  readonly recommendedCost: number;
  readonly recommendedSell: number;
  readonly costLow: number;
  readonly costHigh: number;
  readonly sellLow: number;
  readonly sellHigh: number;
  readonly includedInTotal?: boolean;
  readonly costKnown?: boolean;
};

export type EstimateAggregateResult = {
  readonly recommendedCost: number;
  readonly recommendedSell: number;
  readonly grossProfit: number;
  readonly marginPercent: number;
  readonly markupPercent: number;
  readonly costLow: number;
  readonly costHigh: number;
  readonly sellLow: number;
  readonly sellHigh: number;
  readonly costKnown: boolean;
};

/**
 * Aggregate included estimate lines. No GST.
 * Ranges remain sum of line ranges (domain uncertainty), not invented by engine.
 */
export function aggregateEstimateLines(
  lines: readonly EstimateAggregateLine[],
  requestId = "estimate-aggregate"
): EstimateAggregateResult {
  const included = lines.filter((l) => l.includedInTotal !== false);

  const costLow = round2(included.reduce((s, l) => s + l.costLow, 0));
  const costHigh = round2(included.reduce((s, l) => s + l.costHigh, 0));
  const sellLow = round2(included.reduce((s, l) => s + l.sellLow, 0));
  const sellHigh = round2(included.reduce((s, l) => s + l.sellHigh, 0));

  if (!isAuthoritativeEstimateCalculation()) {
    const recommendedCost = round2(
      included.reduce((s, l) => s + l.recommendedCost, 0)
    );
    const recommendedSell = round2(
      included.reduce((s, l) => s + l.recommendedSell, 0)
    );
    const triad = legacyTriad(recommendedCost, recommendedSell);
    return {
      ...triad,
      costLow,
      costHigh,
      sellLow,
      sellHigh,
    };
  }

  const request = buildAggregateRequest({
    requestId,
    inclusionRule: "all",
    // Omit gstRatePercent — GST-exclusive estimate totals (engine cost/sell only).
    lines: included.map((l) => ({
      total_cost: l.recommendedCost,
      total_sell: l.recommendedSell,
      visible: true,
      included_in_total: true,
      cost_known:
        l.costKnown ??
        !(l.recommendedCost === 0 && l.recommendedSell > 0),
    })),
    source: {
      source_references: ["estimate:aggregate"],
      origin: "system",
    },
    commercialSettings: {
      gst_rate_percent: null,
      default_gross_margin_percent: null,
      currency: "NZD",
    },
  });

  const record = executeCommercialCalculation(request);
  if (!record.ok || !record.outputs) {
    throw new Error(
      record.blockingErrors[0]?.message ??
        "Estimate aggregate calculation failed."
    );
  }

  const o = record.outputs;
  const costKnown = o.costKnown;
  return {
    recommendedCost: o.totalCost ?? 0,
    recommendedSell: o.totalSell ?? 0,
    grossProfit: persistCommercialMetric(o.grossProfit, costKnown),
    marginPercent: persistCommercialMetric(o.grossMarginPercent, costKnown),
    markupPercent: persistCommercialMetric(o.markupPercent, costKnown),
    costKnown,
    costLow,
    costHigh,
    sellLow,
    sellHigh,
  };
}

/** Throw-on-fail wrappers for line factories. */
export function requireEstimateQuantityRateMoney(params: {
  quantity: number;
  unitCost: number;
  unitSell: number;
}): EstimateMoneyTriad {
  return requireMoney(calculateEstimateQuantityRateLine(params));
}

export function requireEstimateLabourMoney(params: {
  labourHours: number;
  labourCostRate: number;
  labourSellRate: number;
}): EstimateMoneyTriad {
  return requireMoney(calculateEstimateLabourLine(params));
}

export function requireEstimateLumpMoney(params: {
  totalCost: number;
  totalSell: number;
}): EstimateMoneyTriad {
  return requireMoney(calculateEstimateLumpLine(params));
}
