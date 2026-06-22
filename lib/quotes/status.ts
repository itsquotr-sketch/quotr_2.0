import type { QuoteStatus } from "@/lib/quotes/types";

export type QuoteStatusDefinition = {
  value: QuoteStatus;
  label: string;
  description: string;
  variant: "default" | "secondary" | "outline" | "destructive";
  sortOrder: number;
};

export const QUOTE_STATUSES: QuoteStatusDefinition[] = [
  {
    value: "draft",
    label: "Draft",
    description: "Quote is being prepared.",
    variant: "secondary",
    sortOrder: 10,
  },
  {
    value: "sent",
    label: "Sent",
    description: "Quote has been sent to the client.",
    variant: "default",
    sortOrder: 20,
  },
  {
    value: "accepted",
    label: "Accepted",
    description: "Client accepted the quote.",
    variant: "default",
    sortOrder: 30,
  },
  {
    value: "declined",
    label: "Declined",
    description: "Client declined the quote.",
    variant: "destructive",
    sortOrder: 40,
  },
  {
    value: "expired",
    label: "Expired",
    description: "Quote validity period has passed.",
    variant: "outline",
    sortOrder: 50,
  },
  {
    value: "revised",
    label: "Revised",
    description: "Quote has been superseded by a revision.",
    variant: "outline",
    sortOrder: 60,
  },
  {
    value: "archived",
    label: "Archived",
    description: "Quote is archived.",
    variant: "outline",
    sortOrder: 70,
  },
];

const statusByValue = new Map(
  QUOTE_STATUSES.map((status) => [status.value, status])
);

export function getQuoteStatusDefinition(value: string): QuoteStatusDefinition {
  return (
    statusByValue.get(value as QuoteStatus) ?? QUOTE_STATUSES[0]
  );
}

export function formatQuoteBadgeLabel(status: QuoteStatus): string {
  switch (status) {
    case "draft":
      return "Quote draft";
    case "sent":
      return "Quote sent";
    case "accepted":
      return "Quote accepted";
    case "declined":
      return "Quote declined";
    case "expired":
      return "Quote expired";
    default:
      return getQuoteStatusDefinition(status).label;
  }
}
