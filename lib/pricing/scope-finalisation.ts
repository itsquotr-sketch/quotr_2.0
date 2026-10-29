import type { SupabaseClient } from "@supabase/supabase-js";
import { scopeGapCountFromNotices } from "@/lib/assistant/presentation/estimate-issues";
import { parseLineItemNotes } from "@/lib/estimate/line-item-metadata";

export const QUOTE_VISIBLE_EXCLUDED_BLOCK =
  "A row that is not in this total is still on the quote. Take it off the quote before review. Hiding it does not price the task or mark it excluded.";

export const UNRESOLVED_SCOPE_REVIEW_BLOCK =
  "Requested tasks still have no priced line. This pricing cannot be marked reviewed as a complete price.";

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
  return scopeGapCountFromNotices(missingInfo) > 0
    ? UNRESOLVED_SCOPE_REVIEW_BLOCK
    : null;
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
