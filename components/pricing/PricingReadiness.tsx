"use client";

import Link from "next/link";
import { pricingItemViewModel } from "@/lib/pricing/financial-view-model";
import type { PricingDocument, PricingItem } from "@/lib/pricing/types";
import type { QuoteSummary } from "@/lib/quotes/types";

export function pricingWorkAreaDomId(workAreaId: string | null): string {
  return `pricing-work-area-${workAreaId ?? "none"}`;
}

export function pricingRequiredItems(items: readonly PricingItem[]): PricingItem[] {
  return items.filter((item) => pricingItemViewModel(item).pricingRequired);
}

type PricingAttentionProps = {
  items: readonly PricingItem[];
  onJump: (sectionId: string) => void;
};

export function PricingAttention({ items, onJump }: PricingAttentionProps) {
  const required = pricingRequiredItems(items);
  if (required.length === 0) return null;
  const first = required[0];
  const sectionId = pricingWorkAreaDomId(first?.work_area_id ?? null);

  return (
    <section className="rounded-xl border border-border/60 bg-card px-4 py-3 shadow-none" data-pricing-attention="true">
      <h2 className="text-base font-semibold leading-snug">Pricing required</h2>
      <p className="mt-1 text-sm leading-5 text-foreground/80">
        {required.length === 1
          ? "1 line still needs a price. Review it before creating the Quote."
          : `${required.length} lines still need prices. Review them before creating the Quote.`}
      </p>
      <button
        type="button"
        className="mt-2 inline-flex min-h-11 items-center text-sm font-medium text-foreground underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-orange)]"
        onClick={() => onJump(sectionId)}
      >
        Go to the first unresolved Work Area
      </button>
    </section>
  );
}

type PricingStatusNoteProps = {
  document: PricingDocument;
  items: readonly PricingItem[];
  latestEstimateIsStale: boolean;
  quoteSummary?: QuoteSummary | null;
  projectId: string;
};

export function PricingStatusNote({
  document,
  items,
  latestEstimateIsStale,
  quoteSummary = null,
  projectId,
}: PricingStatusNoteProps) {
  const requiredCount = pricingRequiredItems(items).length;
  const quoteHref = quoteSummary
    ? `/app/projects/${projectId}/quotes/${quoteSummary.id}`
    : null;

  if (document.status === "archived") {
    return (
      <p className="text-sm leading-5 text-foreground/75" data-pricing-readonly-reason="archived">
        Archived. This pricing is kept for history.
      </p>
    );
  }

  if (document.status === "converted_to_quote") {
    return (
      <p className="text-sm leading-5 text-foreground/75" data-pricing-readonly-reason="converted">
        Converted to a quote.
        {quoteHref ? (
          <>
            {" "}
            <Link href={quoteHref} className="font-medium text-foreground underline-offset-4 hover:underline">
              Open quote
            </Link>
          </>
        ) : null}
      </p>
    );
  }

  if (document.status === "reviewed") {
    return (
      <p className="text-sm leading-5 text-foreground/75" data-pricing-status-note="reviewed">
        Reviewed. Create a quote when this pricing should go to the client.
      </p>
    );
  }

  if (document.needs_recalibration) return null;

  if (latestEstimateIsStale) {
    return (
      <p className="text-sm leading-5 text-foreground/75" data-pricing-status-note="previous-estimate">
        Previous estimate. This pricing stays available.
      </p>
    );
  }

  if (requiredCount > 0) return null;

  return (
    <p className="text-sm leading-5 text-foreground/75" data-pricing-status-note="ready">
      Ready to confirm. Mark this pricing as reviewed when the prices are right.
    </p>
  );
}
