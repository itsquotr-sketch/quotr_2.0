"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useRef, useState, useTransition, type ReactNode } from "react";
import { QuoteHeader } from "@/components/quotes/QuoteHeader";
import { QuotePrintActions } from "@/components/quotes/QuotePrintActions";
import { QuoteSummaryPanel } from "@/components/quotes/QuoteSummaryPanel";
import { QuoteTermsCard } from "@/components/quotes/QuoteTermsCard";
import { WorkspaceBanner } from "@/components/layout/workspace-banner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  markQuoteAccepted,
  markQuoteDeclined,
  markQuoteExpired,
  markQuoteSent,
  reviseQuoteFromFinalPricing,
  updateQuote,
} from "@/lib/quotes/actions";
import { REFRESH_FROM_PRICING_STATUSES } from "@/lib/quotes/revision";
import type { QuoteInput, QuoteWorkspaceData } from "@/lib/quotes/types";

type QuoteWorkspaceProps = {
  initialData: QuoteWorkspaceData;
  template: ReactNode;
};

export function QuoteWorkspace({ initialData, template }: QuoteWorkspaceProps) {
  const router = useRouter();
  const [isSaving, startSave] = useTransition();
  const [isRevising, startRevise] = useTransition();
  const [saveError, setSaveError] = useState<string | null>(null);
  const quoteDraftRef = useRef<QuoteInput>({});

  const {
    quote,
    projectTitle,
    pricingDocumentUpdatedAt,
    latestRevisionQuoteId,
  } = initialData;
  const quoteId = quote.id;
  const projectId = quote.project_id;

  const isEditable =
    quote.status === "draft" && quote.superseded_by_quote_id == null;
  const isSuperseded = quote.superseded_by_quote_id != null;
  const canRefreshFromPricing =
    REFRESH_FROM_PRICING_STATUSES.includes(quote.status) && !isSuperseded;
  const isDraftRefresh = quote.status === "draft";

  const pricingChangedAfterQuote =
    pricingDocumentUpdatedAt != null &&
    new Date(pricingDocumentUpdatedAt).getTime() >
      new Date(quote.created_at).getTime();

  const handleQuoteChange = useCallback((updates: QuoteInput) => {
    quoteDraftRef.current = {
      ...quoteDraftRef.current,
      ...updates,
    };
  }, []);

  const handleSaveQuote = () => {
    if (!isEditable) return;
    setSaveError(null);
    startSave(async () => {
      const result = await updateQuote(quoteId, quoteDraftRef.current);
      if (result.error) {
        setSaveError(result.error);
        return;
      }
      quoteDraftRef.current = {};
      router.refresh();
    });
  };

  const handleMarkSent = async () => {
    const result = await markQuoteSent(quoteId);
    if (!result.error) router.refresh();
    return result;
  };

  const handleMarkAccepted = async () => {
    const result = await markQuoteAccepted(quoteId);
    if (!result.error) router.refresh();
    return result;
  };

  const handleMarkDeclined = async () => {
    const result = await markQuoteDeclined(quoteId);
    if (!result.error) router.refresh();
    return result;
  };

  const handleMarkExpired = async () => {
    const result = await markQuoteExpired(quoteId);
    if (!result.error) router.refresh();
    return result;
  };

  const handleRefreshFromPricing = () => {
    setSaveError(null);
    startRevise(async () => {
      const result = await reviseQuoteFromFinalPricing({ projectId, quoteId });
      if (result.error) {
        setSaveError(result.error);
      }
    });
  };

  return (
    <div className="space-y-5">
      <div className="print:hidden">
        <QuoteHeader
          quote={quote}
          projectTitle={projectTitle}
          isSaving={isSaving}
          onSave={isEditable ? handleSaveQuote : undefined}
        />
      </div>

      {isSuperseded && latestRevisionQuoteId ? (
        <div
          className="rounded-lg border border-amber-300/80 bg-amber-50/90 px-4 py-3 text-sm text-amber-950 print:hidden dark:border-amber-800/60 dark:bg-amber-950/30 dark:text-amber-100"
          role="status"
        >
          <p className="font-medium">This quote has been revised.</p>
          <p className="mt-1">
            View the{" "}
            <Link
              href={`/app/projects/${projectId}/quotes/${latestRevisionQuoteId}`}
              className="font-medium underline underline-offset-2"
            >
              latest revision
            </Link>
            .
          </p>
        </div>
      ) : null}

      <WorkspaceBanner className="print:hidden">
        Client-facing quote — review scope, pricing, exclusions and terms before
        sending. Use Final Pricing to change line items, then refresh this quote
        if needed.
      </WorkspaceBanner>

      {pricingChangedAfterQuote ? (
        <p className="text-sm text-amber-800 print:hidden dark:text-amber-200">
          Final pricing may have changed since this quote was created.
        </p>
      ) : null}

      {quote.revision_number > 1 || quote.revised_from_quote_id ? (
        <p className="text-sm text-muted-foreground print:hidden">
          {quote.revision_number > 1 ? `Revision ${quote.revision_number}.` : null}
          {quote.revised_from_quote_id ? " Revised from a previous quote." : null}
        </p>
      ) : null}

      {saveError ? (
        <p className="text-sm text-destructive print:hidden" role="alert">
          {saveError}
        </p>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_280px] print:block">
        <div className="min-w-0 space-y-5">
          {isEditable ? (
            <div className="grid gap-3 print:hidden sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="quote-title" className="text-xs">
                  Quote title
                </Label>
                <Input
                  id="quote-title"
                  defaultValue={quote.title}
                  onChange={(event) =>
                    handleQuoteChange({ title: event.target.value })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="quote-issue-date" className="text-xs">
                  Issue date
                </Label>
                <Input
                  id="quote-issue-date"
                  type="date"
                  defaultValue={quote.issue_date ?? ""}
                  onChange={(event) =>
                    handleQuoteChange({
                      issue_date: event.target.value || null,
                    })
                  }
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="quote-valid-until" className="text-xs">
                  Valid until
                </Label>
                <Input
                  id="quote-valid-until"
                  type="date"
                  defaultValue={quote.valid_until ?? ""}
                  onChange={(event) =>
                    handleQuoteChange({
                      valid_until: event.target.value || null,
                    })
                  }
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="quote-scope" className="text-xs">
                  Scope summary
                </Label>
                <Textarea
                  id="quote-scope"
                  rows={3}
                  defaultValue={quote.scope_summary ?? ""}
                  onChange={(event) =>
                    handleQuoteChange({
                      scope_summary: event.target.value || null,
                    })
                  }
                />
              </div>
            </div>
          ) : null}

          {template}

          {isEditable ? (
            <div className="print:hidden">
              <QuoteTermsCard
              assumptions={quote.assumptions}
              exclusions={quote.exclusions}
              inclusions={quote.inclusions}
              terms={quote.terms}
              notesToClient={quote.notes_to_client}
              onChange={handleQuoteChange}
            />
            </div>
          ) : null}
        </div>

        <div className="space-y-3 print:hidden">
          <QuotePrintActions projectId={projectId} quoteId={quoteId} />

          {canRefreshFromPricing ? (
            <div className="space-y-2">
              <Button
                type="button"
                className="w-full"
                variant="outline"
                disabled={isRevising}
                onClick={handleRefreshFromPricing}
              >
                {isRevising
                  ? "Creating revision…"
                  : isDraftRefresh
                    ? "Refresh from final pricing"
                    : "Create revision"}
              </Button>
              <p className="text-xs leading-relaxed text-muted-foreground">
                {isDraftRefresh
                  ? "Create a new draft revision using the latest reviewed final pricing."
                  : "Create a new draft revision without changing this quote."}
              </p>
            </div>
          ) : null}

          <QuoteSummaryPanel
            quote={quote}
            onMarkSent={isEditable ? handleMarkSent : undefined}
            onMarkAccepted={
              quote.status === "sent" || isEditable
                ? handleMarkAccepted
                : undefined
            }
            onMarkDeclined={
              quote.status === "sent" || isEditable
                ? handleMarkDeclined
                : undefined
            }
            onMarkExpired={
              quote.status === "sent" ? handleMarkExpired : undefined
            }
          />
        </div>
      </div>
    </div>
  );
}
