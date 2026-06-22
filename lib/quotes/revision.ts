import type { QuoteStatus } from "@/lib/quotes/types";

export type QuoteSummaryRow = {
  id: string;
  status: QuoteStatus;
  pricing_document_id: string | null;
  created_at: string;
  revision_number: number;
};

export function pickLatestQuoteSummary<T extends QuoteSummaryRow>(
  quotes: T[]
): T | null {
  if (quotes.length === 0) {
    return null;
  }

  const nonArchived = quotes.filter((quote) => quote.status !== "archived");
  if (nonArchived.length === 0) {
    return null;
  }

  const drafts = nonArchived.filter((quote) => quote.status === "draft");
  const pool = drafts.length > 0 ? drafts : nonArchived;

  return [...pool].sort((a, b) => {
    const revisionDiff = b.revision_number - a.revision_number;
    if (revisionDiff !== 0) {
      return revisionDiff;
    }
    return (
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  })[0];
}

export function formatQuoteRevisionLabel(input: {
  quote_number: string | null;
  revision_number: number;
}): string {
  if (input.quote_number) {
    return input.revision_number > 1
      ? `${input.quote_number} Rev ${input.revision_number}`
      : input.quote_number;
  }
  return input.revision_number > 1
    ? `Revision ${input.revision_number}`
    : "Draft quote";
}

export const REVISABLE_QUOTE_STATUSES: QuoteStatus[] = [
  "sent",
  "accepted",
  "declined",
  "expired",
  "revised",
];

/** Quotes that can be refreshed into a new revision from reviewed Final Pricing. */
export const REFRESH_FROM_PRICING_STATUSES: QuoteStatus[] = [
  "draft",
  ...REVISABLE_QUOTE_STATUSES,
];
