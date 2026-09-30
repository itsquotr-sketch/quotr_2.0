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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
import { quoteDocumentViewModel, quoteItemViewModel } from "@/lib/quotes/financial-view-model";
import { arrayToTextList } from "@/lib/pricing/calculations";
import { useIsDesktop } from "@/lib/hooks/use-media-query";
import { formatPricingMoney } from "@/lib/pricing/format";
import { groupQuoteItemsBySection } from "@/lib/quotes/mappers";
import {
  parseQuotePresentationMode,
  presentQuoteClientDocument,
} from "@/lib/quotes/presentation";
import { cn } from "@/lib/utils";

type QuoteWorkspaceProps = {
  initialData: QuoteWorkspaceData;
  template: ReactNode;
  projectClientName?: string | null;
  projectSiteAddress?: string | null;
};

function excerpt(value: string | null | undefined): string | null {
  const text = value?.replace(/\s+/g, " ").trim() ?? "";
  if (!text) return null;
  return text.length > 90 ? `${text.slice(0, 90)}…` : text;
}

function sameText(left: string | null | undefined, right: string | null | undefined) {
  return (left?.trim() ?? "") === (right?.trim() ?? "");
}

export function QuoteWorkspace({
  initialData,
  template,
  projectClientName = null,
  projectSiteAddress = null,
}: QuoteWorkspaceProps) {
  const router = useRouter();
  const isDesktop = useIsDesktop();
  const initiallyEditable = canMutateQuoteSnapshot(initialData.quote);
  const [viewMode, setViewMode] = useState<"review" | "preview">(
    initiallyEditable ? "review" : "preview"
  );
  const [trackedEditable, setTrackedEditable] = useState(initiallyEditable);
  const [isSaving, startSave] = useTransition();
  const [isRevising, startRevise] = useTransition();
  const [isStatusPending, startStatus] = useTransition();
  const [saveError, setSaveError] = useState<string | null>(null);
  const [sendOpen, setSendOpen] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);
  const [assumptionText, setAssumptionText] = useState(() =>
    arrayToTextList(initialData.quote.assumptions)
  );
  const [exclusionText, setExclusionText] = useState(() =>
    arrayToTextList(initialData.quote.exclusions)
  );
  const [termsText, setTermsText] = useState(initialData.quote.terms ?? "");
  const [notesText, setNotesText] = useState(initialData.quote.notes_to_client ?? "");
  const [openWorkAreas, setOpenWorkAreas] = useState<Record<string, boolean>>({});
  const quoteDraftRef = useRef<QuoteInput>({});

  const {
    quote,
    items,
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
  if (trackedEditable !== isEditable) {
    setTrackedEditable(isEditable);
    setViewMode(isEditable ? "review" : "preview");
  }
  const showReview = viewMode === "review";
  const reviewLabel = isEditable ? "Finalise" : "Details";
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
  const clientMissing = !quote.client_name?.trim();
  const siteMissing = !quote.site_address?.trim();
  const clientContextMissing = clientMissing || siteMissing;
  const projectDetailsDiffer =
    isEditable &&
    (!sameText(projectClientName, quote.client_name) ||
      !sameText(projectSiteAddress, quote.site_address));
  const quoteFinance = quoteDocumentViewModel(quote);
  const presentation = presentQuoteClientDocument(quote, items);
  const workAreas = groupQuoteItemsBySection(items);
  const visibleItemCount = items.filter((item) => item.visible !== false).length;
  const presentationLabel =
    parseQuotePresentationMode(quote.presentation_mode) === "detailed"
      ? "Detailed"
      : parseQuotePresentationMode(quote.presentation_mode) === "lump_sum"
        ? "Lump sum"
        : "Grouped";

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
        figures={showReview ? "full" : "total"}
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
    <div className="min-w-0 space-y-4 overflow-x-hidden pb-[calc(8rem+env(safe-area-inset-bottom))] xl:pb-4">
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

      <div
        className="print:hidden"
        role="tablist"
        aria-label="Quote workspace view"
        data-quote-view-control="true"
      >
        <div className="grid grid-cols-2 gap-2 rounded-lg border border-border bg-card p-1">
          <button
            type="button"
            role="tab"
            aria-selected={showReview}
            className={cn(
              "min-h-11 rounded-md px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              showReview
                ? "bg-background font-semibold text-foreground shadow-sm"
                : "text-muted-foreground"
            )}
            onClick={() => setViewMode("review")}
          >
            {reviewLabel}
            {showReview ? <span className="sr-only"> selected</span> : null}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={!showReview}
            className={cn(
              "min-h-11 rounded-md px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              !showReview
                ? "bg-background font-semibold text-foreground shadow-sm"
                : "text-muted-foreground"
            )}
            onClick={() => setViewMode("preview")}
          >
            Client preview
            {!showReview ? <span className="sr-only"> selected</span> : null}
          </button>
        </div>
      </div>

      <div className="space-y-3 print:hidden xl:hidden">{deliveryAndHistory}</div>

      <div
        className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(280px,320px)] print:block"
        data-quote-view={showReview ? (isEditable ? "finalise" : "details") : "preview"}
      >
        <div className="min-w-0 space-y-5">
          <div
            className={cn(
              "divide-y divide-border/70 rounded-xl border border-border bg-card print:hidden",
              !showReview && "hidden"
            )}
          >
            <section id="quote-readiness" className="scroll-mt-24 px-4 py-4">
              <h2 className="text-base font-semibold">
                {isEditable ? "Before sending" : "Details"}
              </h2>
              {isEditable ? (
                <>
                  <dl className="mt-3 space-y-2 text-sm">
                    <div className="flex justify-between gap-3">
                      <dt>Quote document</dt>
                      <dd>{visibleItemCount === 0 ? "Needs attention" : "Ready"}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt>Client on Quote</dt>
                      <dd>{quote.client_name?.trim() || "Not added"}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt>Site on Quote</dt>
                      <dd>{quote.site_address?.trim() || "Not added"}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt>Recipient</dt>
                      <dd>Chosen when sending</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt>Terms</dt>
                      <dd>{quote.terms?.trim() ? "Complete" : "Optional"}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt>Total</dt>
                      <dd className="font-semibold tabular-nums">
                        {quoteFinance.showGst
                          ? `${quoteFinance.totalInclGstFormatted} incl. GST`
                          : quoteFinance.totalInclGstFormatted}
                      </dd>
                    </div>
                  </dl>
                  <p className="mt-3 text-sm text-muted-foreground">
                    You choose the client name and email when you send.
                    {projectClientEmail
                      ? " The project email only fills that step."
                      : ""}
                  </p>
                  {clientContextMissing ? (
                    <div className="mt-3 text-sm" role="status" data-quote-client-warning="true">
                      <p>
                        This Quote can be sent. Review how missing client or site details will appear to the recipient. You can still send this Quote.
                      </p>
                      <Link
                        href={`/app/projects/${projectId}/information#project-client-site`}
                        className="mt-2 inline-flex min-h-11 items-center font-medium underline-offset-4 hover:underline"
                      >
                        Edit project client and site
                      </Link>
                    </div>
                  ) : null}
                  {projectDetailsDiffer ? (
                    <p className="mt-3 text-sm text-muted-foreground" role="status">
                      Project details have changed since this Quote was created. Update the Draft to use the latest details.
                    </p>
                  ) : null}
                  {visibleItemCount === 0 ? (
                    <p className="mt-3 text-sm">
                      <a className="underline-offset-4 hover:underline" href="#quote-work-review">
                        Visible items · Needs attention
                      </a>
                    </p>
                  ) : null}
                </>
              ) : (
                <p className="mt-1 text-sm text-muted-foreground">
                  This issued snapshot is not edited here. Client preview shows the document that was sent.
                </p>
              )}
            </section>

            <section id="quote-edit-details" className="scroll-mt-24 px-4 py-4">
              <h2 className="text-base font-semibold">Quote details</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Shown on the client document. Dates and scope are optional.
              </p>
              {isEditable ? (
                <div className="mt-3 grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="quote-title">Quote title</Label>
                    <p className="min-h-8 text-xs text-muted-foreground">Optional label on the quote.</p>
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
                    <Label htmlFor="quote-issue-date">Issue date</Label>
                    <p className="min-h-8 text-xs text-muted-foreground">Shown on the client Quote.</p>
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
                  <div className="space-y-1.5">
                    <Label htmlFor="quote-valid-until">Valid until</Label>
                    <p className="min-h-8 text-xs text-muted-foreground">
                      Shown to the client. Does not block sending.
                    </p>
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
                    <Label htmlFor="quote-scope">Scope summary</Label>
                    <p className="min-h-8 text-xs text-muted-foreground">Optional client-facing summary.</p>
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
                </div>
              ) : (
                <dl className="mt-3 space-y-2 text-sm">
                  <div>
                    <dt className="text-muted-foreground">Quote title</dt>
                    <dd>{quote.title || "Not set"}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Scope summary</dt>
                    <dd>{quote.scope_summary?.trim() || "Optional · not added"}</dd>
                  </div>
                </dl>
              )}
            </section>

            <section className="px-4 py-4">
              <h2 className="text-base font-semibold">Client presentation</h2>
              <div className="mt-3 grid gap-4">
                {isEditable ? (
                  <>
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
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {presentationLabel}. Client will see: {clientDisplaySummary}
                  </p>
                )}
              </div>
            </section>

            <section id="quote-work-review" className="scroll-mt-24 space-y-2 px-4 py-4">
              <h2 className="text-base font-semibold">Scope and Work Areas</h2>
              <p className="text-sm text-muted-foreground">
                {presentationLabel}. Hidden lines stay on the quote. They are not deleted.
              </p>
              {workAreas.length === 0 ? (
                <p className="text-sm text-muted-foreground">No Work Areas on this quote.</p>
              ) : (
                workAreas.map((section) => {
                  const visible = section.items.filter((item) => item.visible !== false);
                  const hidden = section.items.filter((item) => item.visible === false);
                  const grouped = presentation.groupedSections.find(
                    (row) => row.sectionTitle === section.sectionTitle
                  );
                  const areaKey = section.sectionTitle ?? "general";
                  return (
                    <details
                      key={areaKey}
                      className="rounded-lg border border-border/60 bg-card"
                      onToggle={(event) => {
                        const open = (event.currentTarget as HTMLDetailsElement).open;
                        setOpenWorkAreas((current) =>
                          current[areaKey] === open
                            ? current
                            : { ...current, [areaKey]: open }
                        );
                      }}
                    >
                      <summary
                        className="min-h-11 cursor-pointer list-none px-4 py-3 marker:content-none [&::-webkit-details-marker]:hidden"
                        aria-expanded={openWorkAreas[areaKey] === true}
                      >
                        <span className="flex items-start justify-between gap-3 text-sm">
                          <span>
                            <span className="font-medium">
                              {section.sectionTitle?.trim() || "Work"}
                            </span>
                            <span className="mt-0.5 block text-xs text-muted-foreground">
                              {section.sectionDescription?.trim()
                                ? "Client description added"
                                : "No client description · optional"}
                              {" · "}
                              {visible.length} visible
                              {hidden.length > 0 ? ` · ${hidden.length} hidden from the client` : ""}
                              {" · Review"}
                            </span>
                          </span>
                          {presentation.mode === "grouped" && grouped ? (
                            <span className="shrink-0 tabular-nums">
                              {formatPricingMoney(grouped.total)}
                            </span>
                          ) : null}
                        </span>
                      </summary>
                      <div className="space-y-2 border-t border-border/60 px-4 py-3 text-sm">
                        <p>
                          {section.sectionDescription?.trim() ||
                            "No client description. Optional. Update this draft from Pricing to bring in the latest client wording."}
                        </p>
                        <p className="text-muted-foreground">
                          Hidden lines stay on the quote. They are not deleted.
                        </p>
                      <ul className="space-y-2">
                        {section.items.map((item) => {
                          const line = quoteItemViewModel(item);
                          return (
                            <li key={item.id} className="flex justify-between gap-3">
                              <span>
                                {item.label}
                                {item.visible === false ? " · Hidden from the client" : ""}
                              </span>
                              <span className="tabular-nums">{line.totalFormatted}</span>
                            </li>
                          );
                        })}
                      </ul>
                      </div>
                    </details>
                  );
                })
              )}
            </section>

            <section id="quote-terms" className="scroll-mt-24 px-4 py-4">
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-base font-semibold">Terms, assumptions and exclusions</h2>
                {isEditable ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-11 shrink-0"
                    aria-expanded={termsOpen}
                    onClick={() => setTermsOpen(true)}
                  >
                    Edit
                  </Button>
                ) : null}
              </div>
              <ul className="mt-3 space-y-2 text-sm">
                <li className="flex justify-between gap-3">
                  <span>Validity</span>
                  <span>{quote.valid_until ? "Complete" : "Optional"}</span>
                </li>
                <li className="flex justify-between gap-3">
                  <span>Assumptions</span>
                  <span>
                    {quote.assumptions.length > 0 ? `${quote.assumptions.length} added` : "Optional"}
                    {excerpt(quote.assumptions[0]) ? ` · ${excerpt(quote.assumptions[0])}` : ""}
                  </span>
                </li>
                <li className="flex justify-between gap-3">
                  <span>Exclusions</span>
                  <span>{quote.exclusions.length > 0 ? `${quote.exclusions.length} added` : "Optional"}</span>
                </li>
                <li className="flex justify-between gap-3">
                  <span>Quote terms</span>
                  <span>{quote.terms?.trim() ? "Complete" : "Optional"}</span>
                </li>
                <li className="flex justify-between gap-3">
                  <span>Notes to client</span>
                  <span>{quote.notes_to_client?.trim() ? "Complete" : "Optional"}</span>
                </li>
                {quote.inclusions.length > 0 ? (
                  <li className="flex justify-between gap-3">
                    <span>Inclusions</span>
                    <span>{quote.inclusions.length} added</span>
                  </li>
                ) : null}
              </ul>
            </section>
          </div>

          <div
            className={cn(
              "rounded-xl border border-border bg-card p-3 shadow-sm sm:p-4",
              showReview ? "hidden print:block print:border-0 print:bg-transparent print:p-0 print:shadow-none" : "print:border-0 print:bg-transparent print:p-0 print:shadow-none"
            )}
            data-quote-customer-preview="true"
            id="quote-client-preview"
          >
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 print:hidden">
              <div>
                <p className="text-sm font-medium">What the client will see</p>
                <p className="text-sm text-muted-foreground">
                  Client will see: {clientDisplaySummary}
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                className="min-h-11"
                onClick={() => setViewMode("review")}
              >
                {reviewLabel}
              </Button>
            </div>
            <div className="mx-auto w-full max-w-[760px] overflow-x-hidden">{template}</div>
          </div>
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
        viewMode={viewMode}
        reviewLabel={reviewLabel}
        onShowReview={() => setViewMode("review")}
        onShowPreview={() => setViewMode("preview")}
        onRefreshFromPricing={
          canRefreshFromPricing ? handleRefreshFromPricing : undefined
        }
        refreshLabel={
          canRefreshFromPricing
            ? isDraftRefresh
              ? "Update from Pricing"
              : "Create revision"
            : undefined
        }
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
      {isEditable ? (
        isDesktop ? (
          <Dialog open={termsOpen} onOpenChange={setTermsOpen}>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Terms, assumptions and exclusions</DialogTitle>
              </DialogHeader>
              {saveError ? (
                <p className="text-sm text-destructive" role="alert">
                  {saveError}
                </p>
              ) : null}
              <QuoteTermsCard
                assumptions={quote.assumptions}
                exclusions={quote.exclusions}
                inclusions={quote.inclusions}
                terms={quote.terms}
                notesToClient={quote.notes_to_client}
                assumptionText={assumptionText}
                exclusionText={exclusionText}
                termsText={termsText}
                notesText={notesText}
                onAssumptionTextChange={setAssumptionText}
                onExclusionTextChange={setExclusionText}
                onTermsTextChange={setTermsText}
                onNotesTextChange={setNotesText}
                onChange={handleQuoteChange}
                bare
              />
            </DialogContent>
          </Dialog>
        ) : (
          <Sheet open={termsOpen} onOpenChange={setTermsOpen}>
            <SheetContent side="bottom" className="max-h-[90dvh] overflow-y-auto">
              <SheetHeader>
                <SheetTitle>Terms, assumptions and exclusions</SheetTitle>
              </SheetHeader>
              {saveError ? (
                <p className="text-sm text-destructive" role="alert">
                  {saveError}
                </p>
              ) : null}
              <QuoteTermsCard
                assumptions={quote.assumptions}
                exclusions={quote.exclusions}
                inclusions={quote.inclusions}
                terms={quote.terms}
                notesToClient={quote.notes_to_client}
                assumptionText={assumptionText}
                exclusionText={exclusionText}
                termsText={termsText}
                notesText={notesText}
                onAssumptionTextChange={setAssumptionText}
                onExclusionTextChange={setExclusionText}
                onTermsTextChange={setTermsText}
                onNotesTextChange={setNotesText}
                onChange={handleQuoteChange}
                bare
              />
            </SheetContent>
          </Sheet>
        )
      ) : null}
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
