import { QuotePublicViewBeacon } from "@/components/quotes/QuotePublicViewBeacon";
import { QuotePublicShell } from "@/components/quotes/QuotePublicShell";
import { QuoteTemplate } from "@/components/quotes/QuoteTemplate";
import type { Quote, QuoteItem } from "@/lib/quotes/types";

export function QuotePublicDocument({
  quote,
  items,
  superseded,
  token,
}: {
  quote: Quote;
  items: QuoteItem[];
  superseded: boolean;
  token: string;
}) {
  return (
    <div className="mx-auto w-full max-w-[960px] space-y-4 px-3 py-4 sm:px-4 sm:py-6">
      <QuotePublicShell quote={quote} superseded={superseded} />
      <QuoteTemplate quote={quote} quoteItems={items} companySettings={null} />
      <QuotePublicViewBeacon token={token} />
    </div>
  );
}
