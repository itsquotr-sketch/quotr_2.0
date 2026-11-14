import type { SupabaseClient } from "@supabase/supabase-js";
import {
  classifyReviewNotice,
  missingRateReviewBlockFromLines,
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

/**
 * A saved allowance can carry a cost and sell while its estimate metadata
 * keeps it outside the priced total. That money stays off the document total.
 */
export function pricingLineIncludedInDocumentTotal(item: {
  notes_internal?: string | null;
  included_in_total?: boolean | null;
}): boolean {
  if (item.included_in_total === false) return false;
  return parseLineItemNotes(item.notes_internal).metadata.includedInTotal !== false;
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

/**
 * Pricing names each unresolved requested task. A manual Pricing line does
 * not remove the estimate notice, so the task text is the next step.
 */
export function namedUnresolvedScopeReviewBlock(missingInfo: unknown): string | null {
  const block = unresolvedScopeReviewBlock(missingInfo);
  if (block !== UNRESOLVED_SCOPE_REVIEW_BLOCK || !Array.isArray(missingInfo)) return block;
  const named = missingInfo.filter(
    (item): item is string =>
      typeof item === "string" && classifyReviewNotice(item) === "scope_gap"
  );
  if (named.length === 0) return block;
  return `${named.join(" ")} ${block}`;
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

/** The latest estimate can name a missing rate before Pricing is recalibrated. */
export async function missingRateReviewBlockForProject(
  supabase: SupabaseClient,
  orgId: string,
  projectId: string
): Promise<string | null> {
  const { data } = await supabase
    .from("estimate_line_items")
    .select("rate_source, notes")
    .eq("project_id", projectId)
    .eq("org_id", orgId)
    .or(
      "rate_source.eq.missing,rate_source.ilike.%pricing required%,rate_source.ilike.%rate required%"
    );
  return missingRateReviewBlockFromLines(data ?? []);
}
