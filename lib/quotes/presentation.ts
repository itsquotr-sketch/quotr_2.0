import { roundMoney } from "@/lib/pricing/calculations";
import { groupQuoteItemsBySection } from "@/lib/quotes/mappers";
import type { Quote, QuoteItem } from "@/lib/quotes/types";

export const QUOTE_PRESENTATION_MODES = [
  "grouped",
  "detailed",
  "lump_sum",
] as const;

export type QuotePresentationMode = (typeof QUOTE_PRESENTATION_MODES)[number];

export const DEFAULT_QUOTE_PRESENTATION_MODE: QuotePresentationMode = "grouped";

export function parseQuotePresentationMode(
  value: unknown
): QuotePresentationMode {
  if (value === "detailed" || value === "lump_sum" || value === "grouped") {
    return value;
  }
  return DEFAULT_QUOTE_PRESENTATION_MODE;
}

export function isIncludedInQuoteBaseTotal(item: {
  visible?: boolean;
  optional?: boolean;
}): boolean {
  return item.visible !== false && item.optional !== true;
}

export function quoteItemsForBaseTotal<T extends { visible?: boolean; optional?: boolean }>(
  items: readonly T[]
): T[] {
  return items.filter(isIncludedInQuoteBaseTotal);
}

export function quoteItemsForOptionalDisplay<T extends { visible?: boolean; optional?: boolean }>(
  items: readonly T[]
): T[] {
  return items.filter((item) => item.visible !== false && item.optional === true);
}

export type QuoteGroupedSection = {
  sectionTitle: string | null;
  sectionDescription: string | null;
  total: number;
  itemCount: number;
};

export type QuoteClientPresentation = {
  mode: QuotePresentationMode;
  includedItems: QuoteItem[];
  optionalItems: QuoteItem[];
  groupedSections: QuoteGroupedSection[];
  includedSell: number;
};

/**
 * Client layout over snapshotted sell lines. Does not recompute GST or
 * document totals — callers must display stored quote.subtotal / gst / incl.
 */
export function presentQuoteClientDocument(
  quote: Pick<Quote, "presentation_mode" | "subtotal">,
  items: QuoteItem[]
): QuoteClientPresentation {
  const mode = parseQuotePresentationMode(quote.presentation_mode);
  const includedItems = quoteItemsForBaseTotal(items);
  const optionalItems = quoteItemsForOptionalDisplay(items);
  const groupedSections = groupQuoteItemsBySection(includedItems).map(
    (section) => ({
      sectionTitle: section.sectionTitle,
      sectionDescription: section.sectionDescription,
      itemCount: section.items.length,
      total: roundMoney(
        section.items.reduce((sum, item) => sum + (item.total ?? 0), 0)
      ),
    })
  );
  const includedSell = roundMoney(
    includedItems.reduce((sum, item) => sum + (item.total ?? 0), 0)
  );

  return {
    mode,
    includedItems,
    optionalItems,
    groupedSections,
    includedSell,
  };
}

export function groupedSectionLabel(sectionTitle: string | null): string {
  const name = sectionTitle?.trim();
  if (!name) {
    return "Works";
  }
  if (/works$/i.test(name)) {
    return name;
  }
  return `${name} works`;
}

export const OPTIONAL_ITEMS_CLIENT_NOTE =
  "These items are optional and are not included in the quote total.";

export function lumpSumScopeNarrative(
  scopeSummary: string | null | undefined,
  presentation: QuoteClientPresentation
): string | null {
  const scope = scopeSummary?.trim();
  if (scope) {
    return scope;
  }

  const fromAreas = presentation.groupedSections
    .map((section) => {
      const title = section.sectionTitle?.trim();
      const description = section.sectionDescription?.trim();
      if (title && description) {
        return `${title}\n${description}`;
      }
      return description || title || "";
    })
    .filter(Boolean)
    .join("\n\n");

  return fromAreas || null;
}
