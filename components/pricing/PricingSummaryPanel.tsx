"use client";

import {
  pricingDocumentViewModel,
  pricingItemViewModel,
} from "@/lib/pricing/financial-view-model";
import type { PricingDocument, PricingItem } from "@/lib/pricing/types";
import type { QuoteSummary } from "@/lib/quotes/types";
import { CreateQuoteButton } from "@/components/quotes/CreateQuoteButton";
import {
  CEILINGS_QUOTE_PR_BLOCK_MESSAGE,
  nestedCeilingsQuoteIsBlocked,
} from "@/lib/estimate/ceilings-quote-readiness";
import {
  ceilingProvisionalDecision,
  ceilingProvisionalLineFromPricingItem,
} from "@/lib/estimate/ceilings-provisional-package";
import { PricingTaxBasisNotice } from "@/components/pricing/PricingTaxBasisNotice";
import { pricingTaxBasisDecision } from "@/lib/pricing/gst-source";
import { formatPricingMoney } from "@/lib/pricing/format";
import { sellsMatchRecommended } from "@/lib/pricing/final-sell";
import {
  clientPriceBasis,
  clientPriceCopy,
} from "@/lib/pricing/incomplete-price-label";
import {
  presentClientSellForUnresolvedDocument,
  unresolvedManualPricingQuoteBlock,
  unknownMaterialCostQuoteBlock,
} from "@/lib/work-areas/manual-pricing-route";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

type PricingSummaryPanelProps = {
  document: PricingDocument;
  projectId: string;
  items?: PricingItem[];
  quoteSummary?: QuoteSummary | null;
  pricingChangedAfterQuote?: boolean;
  className?: string;
  compact?: boolean;
  canEdit?: boolean;
  scopeQuoteBlock?: string | null;
  gstRegistered?: boolean | null;
  defaultGstRate?: number | null;
  estimateUpdateRequired?: string | null;
  onTaxBasisUpdated?: (document: PricingDocument) => void;
  recommendedSell?: number | null;
  scopeUnresolved?: boolean;
  pricesUnresolved?: boolean;
};

function SummaryRow({
  label,
  value,
  prominent,
}: {
  label: string;
  value: string;
  prominent?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span
        className={
          prominent
            ? "text-right text-lg font-semibold tabular-nums tracking-tight"
            : "text-right text-sm font-medium tabular-nums"
        }
      >
        {value}
      </span>
    </div>
  );
}

export function PricingSummaryPanel({
  document,
  projectId,
  items = [],
  quoteSummary = null,
  pricingChangedAfterQuote = false,
  className,
  compact = false,
  canEdit = true,
  scopeQuoteBlock = null,
  estimateUpdateRequired = null,
  gstRegistered,
  defaultGstRate = null,
  onTaxBasisUpdated,
  recommendedSell = null,
  scopeUnresolved = false,
  pricesUnresolved = false,
}: PricingSummaryPanelProps) {
  const isReviewed = document.status === "reviewed";
  const view = pricingDocumentViewModel(document, items, gstRegistered);
  const pricingRequiredCount = items.filter(
    (item) => pricingItemViewModel(item).pricingRequired
  ).length;
  const clientSellValue = presentClientSellForUnresolvedDocument({
    pricingRequiredCount,
    subtotalSell: document.subtotal_sell,
    costKnown: view.costKnown,
    formattedSell: view.subtotalSellFormatted,
  });
  const sellIncomplete = clientSellValue === "Pricing required";
  const taxBasis = pricingTaxBasisDecision({
    gstRegistered,
    defaultGstRate,
    documentGstRate: document.gst_rate,
    taxBasis: document.gst_tax_basis,
    status: document.status,
  });
  const taxBasisBlock = taxBasis.quoteBlock;
  const showOverrideGst = taxBasis.override && document.gst_rate > 0;
  const inclGstValue = sellIncomplete
    ? "Pricing required"
    : showOverrideGst
      ? formatPricingMoney(document.total_incl_gst)
      : view.totalInclGstFormatted;
  const gstAmountValue = showOverrideGst
    ? formatPricingMoney(document.gst_amount)
    : view.gstAmountFormatted;
  const costValue = sellIncomplete && document.subtotal_cost <= 0
    ? "Pricing required"
    : view.directCostLabel;
  const provisionalBlock = ceilingProvisionalDecision({
    lines: items.map((item) => ceilingProvisionalLineFromPricingItem(item)),
    confirmation: document.provisional_ceiling_confirmation ?? null,
    documentOrgId: document.org_id,
  }).block;
  const priceCopy = clientPriceCopy(
    clientPriceBasis({
      scopeUnresolved: scopeUnresolved || Boolean(scopeQuoteBlock),
      pricesUnresolved: pricesUnresolved || pricingRequiredCount > 0,
      enteredOverride:
        recommendedSell != null &&
        !sellsMatchRecommended(document.subtotal_sell, recommendedSell),
    })
  );
  const clientSellLabel =
    priceCopy.totalLabel === "Your final price"
      ? view.showGst || showOverrideGst
        ? "Client sell ex GST"
        : "Client sell"
      : priceCopy.totalLabel;
  const quoteBlockedReason = estimateUpdateRequired?.trim()
    || scopeQuoteBlock
    || provisionalBlock
    || taxBasisBlock
    || (nestedCeilingsQuoteIsBlocked({ items })
      ? CEILINGS_QUOTE_PR_BLOCK_MESSAGE
      : unresolvedManualPricingQuoteBlock(items) ??
        unknownMaterialCostQuoteBlock(items));

  return (
    <Card
      className={cn(
        "h-auto rounded-xl border-border/60 shadow-none ring-0 [--card-spacing:--spacing(3)] lg:sticky lg:top-0 lg:self-start",
        className
      )}
      data-pricing-commercial-summary="true"
    >
      <CardHeader className="gap-1 pb-2">
        <CardTitle className="text-base font-semibold">Commercial summary</CardTitle>
        <p className="text-xs leading-4 text-foreground/70">
          Internal pricing. Expected margin is not realised profit.
        </p>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        <div className="space-y-2">
          {showOverrideGst ? null : view.gstRegistration === "unset" ? (
            <p className="text-sm leading-5 text-foreground/80" data-gst-registration="unset">
              GST registration is not decided. No GST is added.
            </p>
          ) : view.gstRegistration === "not_registered" ? (
            <p className="text-sm leading-5 text-foreground/80" data-gst-registration="not-registered">
              Not GST registered. No GST is added.
            </p>
          ) : null}
          <PricingTaxBasisNotice
            document={document}
            gstRegistered={gstRegistered}
            defaultGstRate={defaultGstRate}
            canEdit={canEdit}
            onUpdated={onTaxBasisUpdated}
          />
          <SummaryRow
            label={clientSellLabel}
            value={clientSellValue}
            prominent
          />
          {priceCopy.totalLabel !== "Your final price" ? (
            <p className="text-xs leading-4 text-foreground/75" data-pricing-incomplete-basis>
              {priceCopy.detail}
            </p>
          ) : null}
          {compact && (view.showGst || showOverrideGst) ? (
            <SummaryRow
              label="Client sell incl GST"
              value={inclGstValue}
              prominent
            />
          ) : null}
          {pricingRequiredCount > 0 ? (
            <p className="text-xs leading-4 text-foreground/75" data-pricing-summary-required>
              {pricingRequiredCount} Pricing required
            </p>
          ) : null}
          {compact ? (
            <details className="text-sm">
              <summary className="cursor-pointer py-2 text-xs font-medium leading-4 text-foreground/75">
                Cost, margin and GST
              </summary>
              <div className="space-y-2 pt-1">
                <SummaryRow label="Direct cost" value={costValue} />
                <SummaryRow
                  label="Expected gross margin"
                  value={sellIncomplete ? "—" : view.marginLabel}
                />
                {view.showGst || showOverrideGst ? (
                  <SummaryRow
                    label={showOverrideGst ? `GST (${document.gst_rate}%)` : view.gstLabel}
                    value={sellIncomplete ? "—" : gstAmountValue}
                  />
                ) : null}
              </div>
            </details>
          ) : (
            <>
              <SummaryRow label="Direct cost" value={costValue} />
              <SummaryRow
                label="Expected gross margin"
                value={sellIncomplete ? "—" : view.marginLabel}
              />
              {view.showGst || showOverrideGst ? (
                <>
                  <SummaryRow
                    label={showOverrideGst ? `GST (${document.gst_rate}%)` : view.gstLabel}
                    value={sellIncomplete ? "—" : gstAmountValue}
                  />
                  <SummaryRow label="Client sell incl GST" value={inclGstValue} prominent />
                </>
              ) : null}
            </>
          )}
        </div>

        {compact || (!canEdit && !quoteSummary) ? null : (
          <div
            className={cn(
              isReviewed &&
                !quoteSummary &&
                !quoteBlockedReason &&
                "rounded-lg border border-border bg-muted/30 p-3"
            )}
            data-pricing-desktop-quote-cta={
              quoteSummary
                ? "open"
                : isReviewed && !quoteBlockedReason
                  ? "create"
                  : "blocked"
            }
          >
            {isReviewed && !quoteSummary && !quoteBlockedReason ? (
              <p className="mb-2.5 text-sm font-medium tracking-tight">
                Next: Create quote
              </p>
            ) : null}
            <CreateQuoteButton
              projectId={projectId}
              pricingDocumentId={document.id}
              isReviewed={isReviewed}
              quoteSummary={quoteSummary}
              quoteBlockedReason={quoteBlockedReason}
            />
            {quoteSummary ? (
              <p className="mt-2 text-xs text-muted-foreground">
                The Quote is a separate snapshot. Changes to Pricing will not update it.
              </p>
            ) : isReviewed && !quoteBlockedReason ? (
              <p className="mt-2 text-xs text-muted-foreground">
                Create a client-facing quote from this pricing.
              </p>
            ) : null}
          </div>
        )}
        {pricingChangedAfterQuote ? (
          <p className="text-xs text-amber-800 dark:text-amber-200">
          Existing quotes are not updated automatically. Create a revision if
          you need to send an updated quote.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
