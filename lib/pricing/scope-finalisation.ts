import type { SupabaseClient } from "@supabase/supabase-js";
import {
  scopeGapCountFromNotices,
  specificationCountFromNotices,
} from "@/lib/assistant/presentation/estimate-issues";
import { parseLineItemNotes } from "@/lib/estimate/line-item-metadata";

export const QUOTE_VISIBLE_EXCLUDED_BLOCK =
  "A row that is not in this total is still on the quote. Take it off the quote before review. Hiding it does not price the task or mark it excluded.";

export const UNRESOLVED_SCOPE_REVIEW_BLOCK =
  "Requested tasks still have no priced line. This pricing cannot be marked reviewed as a complete price.";

export const UNRESOLVED_SPECIFICATION_REVIEW_BLOCK =
  "Open specifications are still unresolved. This pricing cannot be marked reviewed as a complete price.";

export const MISSING_GENERATED_RATE_REVIEW_BLOCK =
  "Add the missing rate. This pricing cannot be marked reviewed as a complete price.";

/**
 * A generated line with no known cost and no sell is the same missing rate
 * the estimate shows. Manual scope notes keep their own block. GST is not
 * part of this decision.
 */
export function missingGeneratedRateReviewBlock(
  items: readonly {
    cost_known?: boolean | null;
    total_sell?: number | null;
    visible_on_quote?: boolean | null;
    notes_internal?: string | null;
  }[]
): string | null {
  const blocked = items.some((item) => {
    if (item.visible_on_quote === false) return false;
    const sell = Number(item.total_sell ?? 0);
    return item.cost_known === false && (!Number.isFinite(sell) || sell <= 0);
  });
  return blocked ? MISSING_GENERATED_RATE_REVIEW_BLOCK : null;
}

/** Same rule for a new pricing row and a recalibrated row. */
export function estimateLineIsQuoteVisible(values: {
  includedInTotal?: boolean;
  clientVisible?: boolean;
}): boolean {
  return values.includedInTotal !== false && values.clientVisible !== false;
}

type QuoteVisibilityItem = {
  visible_on_quote?: boolean | null;
  notes_internal?: string | null;
};

/**
 * A quote-visible row whose estimate metadata says it is outside the total
 * would appear as free included work. Hiding the row only changes visibility.
 */
export function quoteVisibleExcludedLineBlock(
  items: readonly QuoteVisibilityItem[]
): string | null {
  const exposed = items.some((item) => {
    if (item.visible_on_quote === false) return false;
    return parseLineItemNotes(item.notes_internal).metadata.includedInTotal === false;
  });
  return exposed ? QUOTE_VISIBLE_EXCLUDED_BLOCK : null;
}

/** Coverage gaps stay unresolved until the estimate itself changes. */
export function unresolvedScopeReviewBlock(missingInfo: unknown): string | null {
  if (scopeGapCountFromNotices(missingInfo) > 0) return UNRESOLVED_SCOPE_REVIEW_BLOCK;
  if (specificationCountFromNotices(missingInfo) > 0) {
    return UNRESOLVED_SPECIFICATION_REVIEW_BLOCK;
  }
  return null;
}

export async function unresolvedScopeReviewBlockForEstimate(
  supabase: SupabaseClient,
  orgId: string,
  estimateId: string | null
): Promise<string | null> {
  if (!estimateId) return null;
  const { data } = await supabase
    .from("estimates")
    .select("missing_info")
    .eq("id", estimateId)
    .eq("org_id", orgId)
    .maybeSingle();
  return unresolvedScopeReviewBlock(data?.missing_info);
}
