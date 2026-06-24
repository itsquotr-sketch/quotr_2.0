import { cleanClientLabel, roundMoney } from "@/lib/pricing/calculations";
import { inferCalculationMode } from "@/lib/pricing/pricing-item-calculation";
import type { PricingItem } from "@/lib/pricing/types";
import type { QuoteItemInput } from "@/lib/quotes/types";
import { sanitizeClientQuoteDescription } from "@/lib/quotes/sanitize";

const INTERNAL_PHRASES = [
  "benchmark",
  "gross profit",
  "margin",
  "productivity",
  "internal",
  "allowance source",
  "rate source",
];

export function sanitizeClientLabel(label: string): string {
  let result = cleanClientLabel(label);

  for (const phrase of INTERNAL_PHRASES) {
    const pattern = new RegExp(`\\b${phrase}\\b`, "gi");
    result = result.replace(pattern, "");
  }

  return result.replace(/\s+/g, " ").replace(/^[-–—:\s]+|[-–—:\s]+$/g, "").trim();
}

export function resolveQuoteItemLabel(item: PricingItem): string {
  const fromClient = item.client_label?.trim();
  if (fromClient) {
    return sanitizeClientLabel(fromClient);
  }
  return sanitizeClientLabel(item.internal_label) || "Item";
}

export function resolveQuoteItemDescription(item: PricingItem): string | null {
  const description =
    item.client_description?.trim() || item.notes_client?.trim() || null;
  return sanitizeClientQuoteDescription(description);
}

function resolveQuoteUnitPrice(item: PricingItem): number | null {
  const mode = inferCalculationMode({
    calculationMode: item.calculation_mode,
    quantity: item.quantity,
    unitCost: item.unit_cost,
    unitSell: item.unit_sell,
    totalCost: item.total_cost,
    totalSell: item.total_sell,
    productivityRate: item.productivity_rate,
    calculatedQuantity: item.calculated_quantity,
    itemType: item.item_type,
  });

  if (mode === "productivity_labour") {
    if (item.quantity != null && item.quantity > 0) {
      return roundMoney(item.total_sell / item.quantity);
    }
    return null;
  }

  return item.unit_sell;
}

export type QuoteItemFromPricing = QuoteItemInput & {
  pricing_item_id: string;
  work_area_id: string | null;
  section_title: string | null;
  section_description: string | null;
  sort_order: number;
};

export function mapPricingItemsToQuoteItems(
  pricingItems: PricingItem[],
  workAreaNames: Map<string, string>,
  workAreaDescriptions: Map<string, string> = new Map()
): QuoteItemFromPricing[] {
  const sectionDescriptionAssigned = new Set<string>();

  return pricingItems
    .filter((item) => item.visible_on_quote)
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((item) => {
      let sectionDescription: string | null = null;

      if (item.work_area_id) {
        const description = workAreaDescriptions.get(item.work_area_id);
        if (
          description &&
          !sectionDescriptionAssigned.has(item.work_area_id)
        ) {
          sectionDescription = description;
          sectionDescriptionAssigned.add(item.work_area_id);
        }
      }

      return {
        pricing_item_id: item.id,
        work_area_id: item.work_area_id,
        section_title: item.work_area_id
          ? (workAreaNames.get(item.work_area_id) ?? null)
          : null,
        section_description: sectionDescription,
        label: resolveQuoteItemLabel(item),
        description: resolveQuoteItemDescription(item),
        quantity: item.quantity,
        unit: item.unit,
        unit_price: resolveQuoteUnitPrice(item),
        total: item.total_sell,
        visible: true,
        optional: item.optional,
        sort_order: item.sort_order,
      };
    });
}

export function buildInclusionsFromPricing(
  pricingItems: PricingItem[],
  workAreaNames: Map<string, string>
): string[] {
  const visibleItems = pricingItems.filter((item) => item.visible_on_quote);
  const inclusions = new Set<string>();

  for (const item of visibleItems) {
    if (item.work_area_id) {
      const workAreaName = workAreaNames.get(item.work_area_id);
      if (workAreaName) {
        inclusions.add(workAreaName);
      }
    }
  }

  if (inclusions.size === 0) {
    for (const item of visibleItems) {
      const label = resolveQuoteItemLabel(item);
      if (label) {
        inclusions.add(label);
      }
    }
  }

  return Array.from(inclusions);
}
