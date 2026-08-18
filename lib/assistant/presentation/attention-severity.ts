/**
 * DECK-2B-R2 — product-level attention severity (presentation only).
 * Does not persist new enums. Does not change estimate money.
 */

import type { QuickEstimateAttentionItem } from "@/lib/assistant/presentation/quick-estimate-view-model";

export type AttentionProductSeverity =
  | "assumption"
  | "check"
  | "attention"
  | "blocker";

export type SeverityTaggedAttentionItem = QuickEstimateAttentionItem & {
  readonly productSeverity: AttentionProductSeverity;
};

const FASCIA_LABEL = /fascia|face board/i;
const FASCIA_FACT_KEY = "deck.vertical_face_boards_required";

export function isFasciaLevel1CheckLabel(label: string): boolean {
  return FASCIA_LABEL.test(label.trim());
}

export function defaultProductSeverity(
  item: Pick<QuickEstimateAttentionItem, "attentionKind">
): AttentionProductSeverity {
  switch (item.attentionKind) {
    case "ASSUMPTION":
      return "assumption";
    case "QUESTION":
      return "check";
    case "PRICING_REQUIRED":
      return "attention";
    case "SCOPE":
      return "attention";
    default:
      return "check";
  }
}

export function remapLevel1AttentionItem(
  item: QuickEstimateAttentionItem
): SeverityTaggedAttentionItem {
  if (isFasciaLevel1CheckLabel(item.label)) {
    return {
      ...item,
      attentionKind: "ASSUMPTION",
      factKey: item.factKey ?? FASCIA_FACT_KEY,
      reviewTarget: "estimateReview",
      detail: "Confirm fascia / edge finish. Not included unless confirmed.",
      productSeverity: "check",
    };
  }

  return {
    ...item,
    productSeverity: defaultProductSeverity(item),
  };
}

export function applyLevel1AttentionPresentation(
  items: readonly QuickEstimateAttentionItem[]
): SeverityTaggedAttentionItem[] {
  return items.map(remapLevel1AttentionItem);
}
