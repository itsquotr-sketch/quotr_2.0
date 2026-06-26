"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useRef, useState, useTransition, type ReactNode } from "react";
import { Printer } from "lucide-react";
import { QuoteHeader } from "@/components/quotes/QuoteHeader";
import { QuoteMobileActionBar } from "@/components/quotes/QuoteMobileActionBar";
import { QuoteSummaryPanel } from "@/components/quotes/QuoteSummaryPanel";
import { QuoteTermsCard } from "@/components/quotes/QuoteTermsCard";
import { WorkspaceBanner } from "@/components/layout/workspace-banner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
  const [isStatusPending, startStatus] = useTransition();
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

  const handlePrint = () => {
    const printUrl = `/app/projects/${projectId}/quotes/${quoteId}/print`;
    window.open(printUrl, "_blank", "noopener,noreferrer");
  };

  const actionPanel = (
    <div className="space-y-3">
      <Button
        type="button"
        variant="outline"
        className="w-full"
        onClick={handlePrint}
      >
        <Printer className="mr-2 size-4" />
        Print / Save as PDF
      </Button>

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
              ? "Update this draft from the latest reviewed final pricing."
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
  );

  return (
    <div className="space-y-5 pb-[calc(5rem+env(safe-area-inset-bottom))] xl:pb-4">
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
      ) : pricingChangedAfterQuote ? (
        <p className="rounded-lg border border-amber-200/80 bg-amber-50/60 px-4 py-2.5 text-sm text-amber-950 print:hidden dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-100">
          Final pricing may have changed since this quote was created. Refresh
          from final pricing if totals should match.
        </p>
      ) : (
        <WorkspaceBanner className="print:hidden">
          Client-facing quote — review scope, pricing, exclusions and terms before
          sending.
        </WorkspaceBanner>
      )}

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

      <div className="xl:hidden print:hidden">{actionPanel}</div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px] print:block">
        <div className="min-w-0 space-y-5">
          {isEditable ? (
            <Card className="border-border/60 shadow-none print:hidden">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Quote settings</CardTitle>
                <CardDescription className="text-xs">
                  Title, dates and scope summary shown on the client preview
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2">
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
              </CardContent>
            </Card>
          ) : null}

          <div className="space-y-2 print:hidden">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Client preview
            </p>
            <div className="mx-auto w-full max-w-[1040px]">{template}</div>
          </div>
          <div className="hidden print:block">{template}</div>

          {isEditable ? (
            <details className="group rounded-lg border border-border/60 bg-card print:hidden">
              <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium marker:content-none [&::-webkit-details-marker]:hidden">
                <span className="flex items-center justify-between gap-2">
                  Terms & client notes
                  <span className="text-xs font-normal text-muted-foreground group-open:hidden">
                    Expand to edit
                  </span>
                </span>
              </summary>
              <div className="border-t border-border/60 px-1 pb-1">
                <QuoteTermsCard
                  assumptions={quote.assumptions}
                  exclusions={quote.exclusions}
                  inclusions={quote.inclusions}
                  terms={quote.terms}
                  notesToClient={quote.notes_to_client}
                  onChange={handleQuoteChange}
                  bare
                />
              </div>
            </details>
          ) : null}
        </div>

        <div className="hidden space-y-3 print:hidden xl:block">
          {actionPanel}
        </div>
      </div>

      <QuoteMobileActionBar
        quote={quote}
        canSave={isEditable}
        isSaving={isSaving}
        isRevising={isRevising}
        isStatusPending={isStatusPending}
        onSave={handleSaveQuote}
        onPrint={handlePrint}
        onMarkSent={
          !isEditable &&
          (quote.status === "draft" || quote.status === "revised")
            ? () => {
                startStatus(async () => {
                  await handleMarkSent();
                });
              }
            : undefined
        }
        onMarkAccepted={
          quote.status === "sent"
            ? () => {
                startStatus(async () => {
                  await handleMarkAccepted();
                });
              }
            : undefined
        }
      />
    </div>
  );
}
