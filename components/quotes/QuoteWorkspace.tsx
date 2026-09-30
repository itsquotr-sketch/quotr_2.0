"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useRef, useState, useTransition, type ReactNode } from "react";
import { Printer } from "lucide-react";
import { QuoteHeader } from "@/components/quotes/QuoteHeader";
import { QuoteMobileActionBar } from "@/components/quotes/QuoteMobileActionBar";
import { QuoteDisplayControl } from "@/components/quotes/QuoteDisplayControl";
import { QuotePresentationControl } from "@/components/quotes/QuotePresentationControl";
import { QuoteSummaryPanel } from "@/components/quotes/QuoteSummaryPanel";
import { QuoteTermsCard } from "@/components/quotes/QuoteTermsCard";
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
  canIssueQuoteDelivery,
  canMarkQuoteAccepted,
  canMutateQuoteSnapshot,
  canResendQuoteDelivery,
  quoteHasActiveSendLock,
  assertQuoteSnapshotMutable,
} from "@/lib/quotes/transaction";
import {
  markQuoteAccepted,
  markQuoteDeclined,
  markQuoteExpired,
  markQuoteSent,
  reviseQuoteFromFinalPricing,
  updateQuote,
} from "@/lib/quotes/actions";
import { REFRESH_FROM_PRICING_STATUSES } from "@/lib/quotes/revision";
import type { QuoteDisplayOptions } from "@/lib/quotes/display-options";
import {
  formatQuoteDisplayPreview,
  resolveQuoteDisplayOptions,
} from "@/lib/quotes/display-options";
import type { QuotePresentationMode } from "@/lib/quotes/presentation";
import type { QuoteInput, QuoteWorkspaceData } from "@/lib/quotes/types";
import { QuoteTransactionHistory } from "@/components/quotes/QuoteTransactionHistory";
import { QuoteDeliveryHistory } from "@/components/quotes/QuoteDeliveryHistory";
import { QuoteAcceptanceDetails } from "@/components/quotes/QuoteAcceptanceDetails";
import { QuoteSendSheet } from "@/components/quotes/QuoteSendSheet";
import { resolveDisplayTimezone } from "@/lib/org/timezone";
import { formatQuoteDateTime } from "@/lib/quotes/display";

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
  const [sendOpen, setSendOpen] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);
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
    setHasUnsavedChanges(true);
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
      setHasUnsavedChanges(false);
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

  const handleDisplayOptionsChange = (options: QuoteDisplayOptions) => {
    if (!isEditable) return;
    setSaveError(null);
    startSave(async () => {
      const result = await updateQuote(quoteId, { display_options: options });
      if (result.error) {
        setSaveError(result.error);
        return;
      }
      router.refresh();
    });
  };

  const clientDisplaySummary = formatQuoteDisplayPreview(
    resolveQuoteDisplayOptions(quote)
  );

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
        showActions
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
    <div className="min-w-0 space-y-4 overflow-x-hidden pb-[calc(6.5rem+env(safe-area-inset-bottom))] xl:pb-4">
      <div className="print:hidden">
        <QuoteHeader
          quote={quote}
          projectTitle={projectTitle}
          acceptance={acceptance}
          isSaving={isSaving}
          hasUnsavedChanges={hasUnsavedChanges}
          onSave={isEditable ? handleSaveQuote : undefined}
          timeZone={displayTimeZone}
        />
        {quote.pricing_document_id ? (
          <p className="mt-2">
            <Link
              href={`/app/projects/${projectId}/pricing/${quote.pricing_document_id}`}
              className="text-sm font-medium text-muted-foreground underline-offset-4 hover:underline"
            >
              Back to Pricing
            </Link>
          </p>
        ) : null}
      </div>

      {sendLockActive ? (
        <div
          className="rounded-lg border border-border bg-card px-4 py-3 text-sm print:hidden"
          role="status"
        >
          <p className="font-medium">This quote cannot be edited while it is being sent.</p>
          <p className="mt-1 text-muted-foreground">
            {deliveries.some((row) => row.status === "accepted")
              ? "Email submitted — finalising Quote status."
              : "Wait for send to finish, or try again if the email failed."}
          </p>
        </div>
      ) : isSuperseded && latestRevisionQuoteId ? (
        <div
          className="rounded-lg border border-border bg-card px-4 py-3 text-sm print:hidden"
          role="status"
        >
          <p className="font-medium">This quote has been superseded.</p>
          <p className="mt-1 text-muted-foreground">
            View the{" "}
            <Link
              href={`/app/projects/${projectId}/quotes/${latestRevisionQuoteId}`}
              className="font-medium underline underline-offset-2"
            >
              latest revision
            </Link>
            . This snapshot stays as issued.
          </p>
        </div>
      ) : (quote.status === "sent" || quote.status === "viewed") &&
        deliveries[0] ? (
        <div
          className="rounded-lg border border-border bg-card px-4 py-3 text-sm print:hidden"
          data-quote-send-success
          role="status"
        >
          <p>
            {quote.status === "viewed" ? "The client has viewed this quote." : "Sent and awaiting a response."}{" "}
            {deliveries[0].recipient_email}
            {deliveries[0].submitted_at
              ? ` · ${formatQuoteDateTime(deliveries[0].submitted_at, displayTimeZone)}`
              : ""}
            {" "}This issued snapshot is not rewritten when Pricing changes.
          </p>
        </div>
      ) : !isEditable ? (
        <div
          className="rounded-lg border border-border bg-card px-4 py-3 text-sm print:hidden"
          role="status"
          data-quote-readonly-reason
        >
          <p>{assertQuoteSnapshotMutable(quote)}</p>
        </div>
      ) : pricingChangedAfterQuote ? (
        <div className="space-y-2 rounded-lg border border-border bg-card px-4 py-3 text-sm print:hidden" role="status">
          <p>
            Pricing has changed since this quote was created. This snapshot stays unchanged until you update it.
          </p>
          {canRefreshFromPricing ? (
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              disabled={isRevising}
              onClick={handleRefreshFromPricing}
            >
              {isRevising ? "Updating…" : "Update quote"}
            </Button>
          ) : null}
        </div>
      ) : null}

      {saveError ? (
        <p className="text-sm text-destructive print:hidden" role="alert">
          {saveError}
        </p>
      ) : null}

      <div className="print:hidden xl:hidden">
        <QuoteSummaryPanel quote={quote} showActions={false} />
      </div>

      <div className="space-y-3 print:hidden xl:hidden">{deliveryAndHistory}</div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(280px,320px)] print:block">
        <div className="min-w-0 space-y-5">
          <div
            className="rounded-xl border border-border bg-card p-3 shadow-sm print:hidden sm:p-4"
            data-quote-customer-preview="true"
            id="quote-client-preview"
          >
            <p className="mb-2 text-xs font-medium text-muted-foreground">
              What the client will see
            </p>
            <p className="mb-3 text-xs text-muted-foreground">
              Client will see: {clientDisplaySummary}
            </p>
            <div className="mx-auto w-full max-w-[1040px] overflow-x-hidden">{template}</div>
          </div>
          <div className="hidden print:block">{template}</div>

          {isEditable ? (
            <Card
              id="quote-edit-details"
              className="border-border/60 shadow-none print:hidden"
            >
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Quote details</CardTitle>
                <CardDescription className="hidden text-xs md:block">
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
                  className="min-h-11 text-base md:text-sm"
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
                  className="min-h-11 text-base md:text-sm"
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
                  className="min-h-11 text-base md:text-sm"
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
                  className="text-base md:text-sm"
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
              <QuoteDisplayControl
                quote={quote}
                disabled={isSaving}
                onChange={handleDisplayOptionsChange}
              />
              </CardContent>
            </Card>
          ) : null}

          {isEditable ? (
            <details
              className="group rounded-lg border border-border/60 bg-card print:hidden"
              onToggle={(event) =>
                setTermsOpen((event.currentTarget as HTMLDetailsElement).open)
              }
            >
              <summary
                className="min-h-11 cursor-pointer list-none px-4 py-3 text-sm font-medium marker:content-none [&::-webkit-details-marker]:hidden"
                aria-expanded={termsOpen}
              >
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
        hasUnsavedChanges={hasUnsavedChanges}
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
