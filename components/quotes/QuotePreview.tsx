"use client";

import { formatPricingMoney } from "@/lib/pricing/format";
import { groupQuoteItemsBySection } from "@/lib/quotes/mappers";
import type { Quote, QuoteItem } from "@/lib/quotes/types";
import { cn } from "@/lib/utils";

type QuotePreviewProps = {
  quote: Quote;
  items: QuoteItem[];
};

export function QuotePreview({ quote, items }: QuotePreviewProps) {
  const sections = groupQuoteItemsBySection(items);
  const visibleSections = sections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => item.visible),
    }))
    .filter((section) => section.items.length > 0);

  return (
    <div className="rounded-xl border border-border/60 bg-card p-5 shadow-sm">
      <div className="mb-6 space-y-1 border-b pb-4">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Client preview
        </p>
        <h2 className="text-lg font-semibold">{quote.title}</h2>
        {quote.client_name ? (
          <p className="text-sm">{quote.client_name}</p>
        ) : null}
        {quote.site_address ? (
          <p className="text-sm text-muted-foreground">{quote.site_address}</p>
        ) : null}
      </div>

      {quote.scope_summary ? (
        <div className="mb-5">
          <h3 className="mb-1 text-sm font-semibold">Scope</h3>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">
            {quote.scope_summary}
          </p>
        </div>
      ) : null}

      {quote.inclusions.length > 0 ? (
        <div className="mb-5">
          <h3 className="mb-1 text-sm font-semibold">Inclusions</h3>
          <ul className="list-inside list-disc text-sm text-muted-foreground">
            {quote.inclusions.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mb-5 space-y-4">
        {visibleSections.map((section) => (
          <div key={section.sectionTitle ?? "general"}>
            {section.sectionTitle ? (
              <h3 className="mb-2 text-sm font-semibold">
                {section.sectionTitle}
              </h3>
            ) : null}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="pb-2 pr-3 font-medium">Item</th>
                    <th className="pb-2 pr-3 font-medium text-right">Qty</th>
                    <th className="pb-2 pr-3 font-medium text-right">Rate</th>
                    <th className="pb-2 font-medium text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {section.items.map((item) => (
                    <tr
                      key={item.id}
                      className={cn(
                        "border-b border-border/40 last:border-0",
                        item.optional && "text-muted-foreground"
                      )}
                    >
                      <td className="py-2 pr-3 align-top">
                        <p className="font-medium">
                          {item.label}
                          {item.optional ? (
                            <span className="ml-1 text-xs">(optional)</span>
                          ) : null}
                        </p>
                        {item.description ? (
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {item.description}
                          </p>
                        ) : null}
                      </td>
                      <td className="py-2 pr-3 text-right align-top whitespace-nowrap">
                        {item.quantity != null ? item.quantity : "—"}
                        {item.unit ? ` ${item.unit}` : ""}
                      </td>
                      <td className="py-2 pr-3 text-right align-top whitespace-nowrap">
                        {item.unit_price != null
                          ? formatPricingMoney(item.unit_price)
                          : "—"}
                      </td>
                      <td className="py-2 text-right align-top font-medium whitespace-nowrap">
                        {formatPricingMoney(item.total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>

      {quote.assumptions.length > 0 ? (
        <div className="mb-4">
          <h3 className="mb-1 text-sm font-semibold">Assumptions</h3>
          <ul className="list-inside list-disc text-sm text-muted-foreground">
            {quote.assumptions.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {quote.exclusions.length > 0 ? (
        <div className="mb-4">
          <h3 className="mb-1 text-sm font-semibold">Exclusions</h3>
          <ul className="list-inside list-disc text-sm text-muted-foreground">
            {quote.exclusions.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {quote.terms ? (
        <div className="mb-4">
          <h3 className="mb-1 text-sm font-semibold">Terms</h3>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">
            {quote.terms}
          </p>
        </div>
      ) : null}

      {quote.notes_to_client ? (
        <div className="mb-4">
          <h3 className="mb-1 text-sm font-semibold">Notes</h3>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">
            {quote.notes_to_client}
          </p>
        </div>
      ) : null}

      <div className="mt-6 space-y-1 border-t pt-4 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Subtotal</span>
          <span>{formatPricingMoney(quote.subtotal)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">GST {quote.gst_rate}%</span>
          <span>{formatPricingMoney(quote.gst_amount)}</span>
        </div>
        <div className="flex justify-between font-semibold">
          <span>Total incl. GST</span>
          <span>{formatPricingMoney(quote.total_incl_gst)}</span>
        </div>
      </div>
    </div>
  );
}
