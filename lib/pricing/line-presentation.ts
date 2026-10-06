import { parseLineItemNotes } from "@/lib/estimate/line-item-metadata";
import {
  APPRENTICE_LABOUR_RATE_KEY,
  CARPENTER_LABOUR_RATE_KEY,
  GENERAL_LABOUR_RATE_KEY,
  LABOURER_LABOUR_RATE_KEY,
} from "@/lib/estimate/labour-trade-mapping";
import { getRateSourceLabel } from "@/lib/estimate/rate-source-labels";
import { pricingItemViewModel } from "@/lib/pricing/financial-view-model";
import { isReplacedSubcontractPlaceholder } from "@/lib/pricing/replaced-subcontract-line";
import { formatPricingMoney } from "@/lib/pricing/format";
import { PRICING_ITEM_TYPES } from "@/lib/pricing/status";
import type { PricingItem } from "@/lib/pricing/types";

export type PricingLinePresentation = {
  title: string;
  supporting: string | null;
  specification: string | null;
  category: string;
  quantityLabel: string;
  costLabel: string;
  sellLabel: string;
  pricingRequired: boolean;
  source: string;
  manual: boolean;
  workerType: string | null;
  pricingBasis: string | null;
  hoursLabel: string | null;
  hourlyCostLabel: string | null;
  productivitySource: string | null;
  visibleOnQuote: boolean;
};

function isProcurementPhrase(text: string): boolean {
  return /\b(required|purchased|waste)\b/i.test(text) || /×/.test(text) || /\bh\//.test(text);
}

function isMeasurementOnly(text: string): boolean {
  return /^\d+(\.\d+)?\s*(mm|m|m2|m²|lm)$/i.test(text.trim());
}

/** Splits a stored identity summary or an already stored "product — use" label. */
function splitStoredIdentity(
  label: string,
  identitySummary: string | null
): { product: string | null; materialUse: string; specification: string | null } {
  const summary = identitySummary?.trim() ?? "";
  const parts = summary
    .split(" · ")
    .map((part) => part.trim())
    .filter(Boolean);
  const first = parts[0] ?? "";
  const firstIsProduct =
    first.length > 0 &&
    first.toLowerCase() !== label.trim().toLowerCase() &&
    !isProcurementPhrase(first) &&
    !isMeasurementOnly(first);
  if (firstIsProduct) {
    return {
      product: first,
      materialUse: label,
      specification: parts.slice(1).join(" · ") || null,
    };
  }
  const dash = label.match(/^(.+?)\s+—\s+(.+)$/);
  if (dash) {
    const product = dash[1]?.trim() ?? "";
    const use = dash[2]?.trim() ?? label;
    if (product && !isProcurementPhrase(product) && !isMeasurementOnly(product)) {
      return {
        product,
        materialUse: use,
        specification: summary && summary !== label ? summary : null,
      };
    }
  }
  return {
    product: null,
    materialUse: label,
    specification: summary && summary !== label ? summary : null,
  };
}

function labourRateIdentity(itemKey: string | null | undefined): {
  workerType: string | null;
  pricedUsing: string | null;
} {
  if (itemKey === LABOURER_LABOUR_RATE_KEY) {
    return { workerType: "Labourer", pricedUsing: null };
  }
  if (itemKey === APPRENTICE_LABOUR_RATE_KEY) {
    return { workerType: "Apprentice", pricedUsing: null };
  }
  if (itemKey === CARPENTER_LABOUR_RATE_KEY) {
    return { workerType: null, pricedUsing: "Priced using Carpenter labour cost" };
  }
  if (itemKey === GENERAL_LABOUR_RATE_KEY) {
    return { workerType: null, pricedUsing: "Priced using General labour cost" };
  }
  return { workerType: null, pricedUsing: null };
}

function formatHours(hours: number): string {
  const rounded = Math.round(hours * 100) / 100;
  return `${rounded} h`;
}

export function presentPricingLine(item: PricingItem): PricingLinePresentation {
  const view = pricingItemViewModel(item);
  const { metadata } = parseLineItemNotes(item.notes_internal);
  const manual = item.source_estimate_line_item_id == null;
  const labour =
    item.item_type === "labour" || item.calculation_mode === "productivity_labour";
  const category =
    PRICING_ITEM_TYPES.find((type) => type.value === item.item_type)?.label ??
    item.item_type;
  const rateSource = metadata.materialRateResolution?.display
    ? metadata.materialRateResolution.display
    : metadata.rateSourceType
      ? getRateSourceLabel(metadata.rateSourceType)
      : null;
  const productivitySource = metadata.productivitySourceType
    ? getRateSourceLabel(metadata.productivitySourceType)
    : null;
  const identity = labour
    ? null
    : splitStoredIdentity(item.client_label, metadata.identitySummary ?? null);
  const labourIdentity = labour ? labourRateIdentity(metadata.itemKey) : null;
  const generic =
    identity != null &&
    identity.product == null &&
    /package|allowance/i.test(item.client_label);
  const title = labour
    ? item.client_label
    : identity?.product ?? item.client_label;
  const supporting = labour
    ? labourIdentity?.workerType ?? labourIdentity?.pricedUsing ?? null
    : generic
      ? "Estimated material allowance"
      : identity && identity.materialUse !== title
        ? identity.materialUse
        : item.internal_label !== item.client_label
          ? item.internal_label
          : null;
  const storedHours = item.calculated_quantity ?? metadata.labourHours ?? null;
  const hours = labour && storedHours != null && storedHours > 0 ? storedHours : null;
  const hourlyCost = item.unit_cost ?? 0;
  const hourlyKnown = labour && item.cost_known && hourlyCost > 0;
  const quantityLabel =
    item.quantity != null
      ? `${item.quantity}${item.unit ? ` ${item.unit}` : ""}`
      : "—";

  if (isReplacedSubcontractPlaceholder(item)) {
    return {
      title,
      supporting: "Original price is kept internally. This line is not on the quote.",
      specification: null,
      category,
      quantityLabel,
      costLabel: "Replaced",
      sellLabel: "Not on the quote",
      pricingRequired: false,
      source: manual ? "Manual" : rateSource ?? "Estimate",
      manual,
      workerType: null,
      pricingBasis: null,
      hoursLabel: null,
      hourlyCostLabel: null,
      productivitySource: null,
      visibleOnQuote: false,
    };
  }

  return {
    title,
    supporting,
    specification: identity?.specification ?? metadata.identitySummary ?? null,
    category,
    quantityLabel: hours != null ? formatHours(hours) : quantityLabel,
    costLabel: view.pricingRequired ? "—" : view.totalCostFormatted,
    sellLabel: view.pricingRequired ? "Pricing required" : view.totalSellFormatted,
    pricingRequired: view.pricingRequired,
    source: manual ? "Manual" : rateSource ?? "Estimate",
    manual,
    workerType: labourIdentity?.workerType ?? null,
    pricingBasis: labourIdentity?.pricedUsing ?? null,
    hoursLabel: hours != null && hours > 0 ? formatHours(hours) : null,
    hourlyCostLabel: hourlyKnown ? `${formatPricingMoney(hourlyCost)}/h` : null,
    productivitySource,
    visibleOnQuote: item.visible_on_quote,
  };
}
