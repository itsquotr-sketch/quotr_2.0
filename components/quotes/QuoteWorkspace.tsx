"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useRef, useState, useTransition, type ReactNode } from "react";
import { Printer } from "lucide-react";
import { QuoteHeader } from "@/components/quotes/QuoteHeader";
import { QuoteMobileActionBar } from "@/components/quotes/QuoteMobileActionBar";
import { QuotePresentationControl } from "@/components/quotes/QuotePresentationControl";
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
import { quoteDocumentViewModel } from "@/lib/quotes/financial-view-model";
import {
  canIssueQuoteDelivery,
  canMarkQuoteAccepted,
  canMutateQuoteSnapshot,
  canResendQuoteDelivery,
  quoteHasActiveSendLock,
} from "@/lib/quotes/transaction";
import { cn } from "@/lib/utils";
import {
  markQuoteAccepted,
  markQuoteDeclined,
  markQuoteExpired,
  markQuoteSent,
  reviseQuoteFromFinalPricing,
  updateQuote,
} from "@/lib/quotes/actions";
import { REFRESH_FROM_PRICING_STATUSES } from "@/lib/quotes/revision";
import type { QuotePresentationMode } from "@/lib/quotes/presentation";
import type { QuoteInput, QuoteWorkspaceData } from "@/lib/quotes/types";
import { QuoteTransactionHistory } from "@/components/quotes/QuoteTransactionHistory";
import { QuoteDeliveryHistory } from "@/components/quotes/QuoteDeliveryHistory";
import { QuoteAcceptanceDetails } from "@/components/quotes/QuoteAcceptanceDetails";
import { QuoteSendSheet } from "@/components/quotes/QuoteSendSheet";
import { resolveDisplayTimezone } from "@/lib/org/timezone";

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
  const [mobilePreviewOpen, setMobilePreviewOpen] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);
  const quoteDraftRef = useRef<QuoteInput>({});

  const {
    quote,
    projectTitle,
    projectClientEmail = null,
    pricingDocumentUpdatedAt,
    latestRevisionQuoteId,
    threadRevisions = [],
    recentEvents = [],
    deliveries = [],
    acceptance = null,
    companySettings,
  } = initialData;
  const displayTimeZone = resolveDisplayTimezone(companySettings?.timezone);
  const quoteId = quote.id;
  const projectId = quote.project_id;

  const isEditable = canMutateQuoteSnapshot(quote);
  const sendLockActive = quoteHasActiveSendLock(quote);
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

  const handlePresentationModeChange = (mode: QuotePresentationMode) => {
    if (!isEditable) return;
    setSaveError(null);
    startSave(async () => {
      const result = await updateQuote(quoteId, { presentation_mode: mode });
      if (result.error) {
        setSaveError(result.error);
        return;
      }
      router.refresh();
    });
  };

  const quoteFinance = quoteDocumentViewModel(quote);

  const deliveryAndHistory = (
    <>
      {deliveries.length > 0 || quote.viewed_at ? (
        <QuoteDeliveryHistory
          deliveries={deliveries}
          viewedAt={quote.viewed_at}
          timeZone={displayTimeZone}
        />
      ) : null}
      {threadRevisions.length > 0 ? (
        <QuoteTransactionHistory
          projectId={projectId}
          currentQuoteId={quoteId}
          revisions={threadRevisions}
          events={recentEvents}
          timeZone={displayTimeZone}
        />
      ) : null}
    </>
  );

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
              ? "Updating…"
              : isDraftRefresh
                ? "Update from Pricing"
                : "Create revision"}
          </Button>
          <p className="text-xs leading-relaxed text-muted-foreground">
            {isDraftRefresh
              ? "Replace this draft with a new snapshot from reviewed pricing."
              : "Create a new draft revision without changing this quote."}
          </p>
        </div>
      ) : null}

      <QuoteSummaryPanel
        quote={quote}
        onSendQuote={
          canIssueQuoteDelivery(quote.status) ? () => setSendOpen(true) : undefined
        }
        onResendQuote={
          canResendQuoteDelivery(quote.status)
            ? () => setSendOpen(true)
            : undefined
        }
        onMarkSent={
          canIssueQuoteDelivery(quote.status) && !sendLockActive
            ? handleMarkSent
            : undefined
        }
        onMarkAccepted={
          canMarkQuoteAccepted(quote.status) && quote.status !== "accepted"
            ? handleMarkAccepted
            : undefined
        }
        onMarkDeclined={
          quote.status === "sent" || quote.status === "viewed"
            ? handleMarkDeclined
            : undefined
        }
        onMarkExpired={
          quote.status === "sent" || quote.status === "viewed"
            ? handleMarkExpired
            : undefined
        }
      />
      <QuoteAcceptanceDetails
        quote={quote}
        acceptance={acceptance}
        timeZone={displayTimeZone}
      />
      {deliveryAndHistory}
    </div>
  );

  return (
    <div className="space-y-5 pb-[calc(5rem+env(safe-area-inset-bottom))] xl:pb-4">
      <div className="print:hidden">
        <QuoteHeader
          quote={quote}
          projectTitle={projectTitle}
          acceptance={acceptance}
          isSaving={isSaving}
          onSave={isEditable ? handleSaveQuote : undefined}
          timeZone={displayTimeZone}
        />
      </div>

      {sendLockActive ? (
        <div
          className="rounded-lg border border-amber-300/80 bg-amber-50/90 px-4 py-3 text-sm text-amber-950 print:hidden dark:border-amber-800/60 dark:bg-amber-950/30 dark:text-amber-100"
          role="status"
        >
          <p className="font-medium">This quote cannot be edited while it is being sent.</p>
          <p className="mt-1">
            {deliveries.some((row) => row.status === "accepted")
              ? "Email submitted — finalising Quote status."
              : "Wait for send to finish, or try again if the email failed."}
          </p>
        </div>
      ) : isSuperseded && latestRevisionQuoteId ? (
        <div
          className="rounded-lg border border-amber-300/80 bg-amber-50/90 px-4 py-3 text-sm text-amber-950 print:hidden dark:border-amber-800/60 dark:bg-amber-950/30 dark:text-amber-100"
          role="status"
        >
          <p className="font-medium">This quote has been superseded.</p>
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
        <div className="space-y-2 rounded-lg border border-amber-200/80 bg-amber-50/60 px-4 py-2.5 text-sm text-amber-950 print:hidden dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-100">
          <p>Pricing has changed since this quote was created.</p>
          {canRefreshFromPricing ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="border-amber-300 bg-white text-amber-950"
              disabled={isRevising}
              onClick={handleRefreshFromPricing}
            >
              {isRevising ? "Updating…" : "Update quote"}
            </Button>
          ) : null}
        </div>
      ) : (
        <WorkspaceBanner className="print:hidden">
          Client-facing quote — review scope, pricing, exclusions and terms before
          sending.
        </WorkspaceBanner>
      )}

      {saveError ? (
        <p className="text-sm text-destructive print:hidden" role="alert">
          {saveError}
        </p>
      ) : null}

      <Card className="border-border/60 shadow-none print:hidden xl:hidden">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Quote summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <p className="text-[11px] text-muted-foreground">Client total</p>
            <p className="text-2xl font-semibold tabular-nums tracking-tight">
              {quoteFinance.totalInclGstFormatted}
            </p>
            <p className="text-xs text-muted-foreground">
              {quoteFinance.subtotalFormatted} ex GST
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              className="h-11 flex-1"
              onClick={() => {
                setMobilePreviewOpen((open) => !open);
                if (!mobilePreviewOpen) {
                  window.setTimeout(() => {
                    globalThis.document
                      .getElementById("quote-client-preview")
                      ?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }, 50);
                }
              }}
            >
              {mobilePreviewOpen ? "Hide preview" : "Preview quote"}
            </Button>
            {isEditable ? (
              <Button
                type="button"
                variant="outline"
                className="h-11 flex-1"
                onClick={() => {
                  globalThis.document
                    .getElementById("quote-edit-details")
                    ?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
              >
                Edit details
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <div className="space-y-3 print:hidden xl:hidden">{deliveryAndHistory}</div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(280px,320px)] print:block">
        <div className="min-w-0 space-y-5">
          {isEditable ? (
            <Card
              id="quote-edit-details"
              className="border-border/60 shadow-none print:hidden"
            >
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
              <QuotePresentationControl
                value={quote.presentation_mode}
                disabled={isSaving}
                onChange={handlePresentationModeChange}
              />
              </CardContent>
            </Card>
          ) : null}

          <div
            className={cn(
              "rounded-xl border border-border/40 bg-neutral-50 p-2 dark:bg-neutral-950/40",
              !mobilePreviewOpen && "max-xl:hidden"
            )}
            data-quote-customer-preview="true"
            id="quote-client-preview"
          >
            <p className="mb-2 px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Client preview
            </p>
            <div className="mx-auto w-full max-w-[1040px]">{template}</div>
          </div>
          <div className="hidden print:block">{template}</div>

          {isEditable ? (
            <details className="group rounded-lg border border-border/60 bg-card print:hidden">
              <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium marker:content-none [&::-webkit-details-marker]:hidden">
                <span className="flex items-center justify-between gap-2">
                  Terms & exclusions
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

        <aside
          data-quote-sidebar="true"
          className="hidden print:hidden xl:block"
        >
          <div
            data-quote-sidebar-stack="true"
            className="space-y-3 xl:sticky xl:top-[4.5rem] xl:max-h-[calc(100vh-5.5rem)] xl:overflow-y-auto"
          >
            {actionPanel}
          </div>
        </aside>
      </div>

      <QuoteMobileActionBar
        quote={quote}
        canSave={isEditable}
        isSaving={isSaving}
        isRevising={isRevising}
        isStatusPending={isStatusPending}
        onSave={handleSaveQuote}
        onPrint={handlePrint}
        onSendQuote={
          canIssueQuoteDelivery(quote.status)
            ? () => setSendOpen(true)
            : undefined
        }
        onResendQuote={
          canResendQuoteDelivery(quote.status)
            ? () => setSendOpen(true)
            : undefined
        }
        onMarkAccepted={
          quote.status === "sent" || quote.status === "viewed"
            ? () => {
                startStatus(async () => {
                  await handleMarkAccepted();
                });
              }
            : undefined
        }
      />
      {canIssueQuoteDelivery(quote.status) ||
      canResendQuoteDelivery(quote.status) ? (
        <QuoteSendSheet
          key={`${quote.id}:${sendOpen ? "open" : "closed"}`}
          quote={quote}
          projectTitle={projectTitle}
          projectClientEmail={projectClientEmail}
          deliveries={deliveries}
          open={sendOpen}
          onOpenChange={setSendOpen}
          mode={canIssueQuoteDelivery(quote.status) ? "send" : "resend"}
        />
      ) : null}
    </div>
  );
}
