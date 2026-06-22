"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useRef, useState, useTransition } from "react";
import { QuoteHeader } from "@/components/quotes/QuoteHeader";
import { QuoteItemsTable } from "@/components/quotes/QuoteItemsTable";
import { QuotePreview } from "@/components/quotes/QuotePreview";
import { QuoteSummaryPanel } from "@/components/quotes/QuoteSummaryPanel";
import { QuoteTermsCard } from "@/components/quotes/QuoteTermsCard";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  deleteQuoteItem,
  markQuoteAccepted,
  markQuoteDeclined,
  markQuoteExpired,
  markQuoteSent,
  reviseQuote,
  setQuoteItemVisible,
  updateQuote,
  updateQuoteItem,
} from "@/lib/quotes/actions";
import { groupQuoteItemsBySection } from "@/lib/quotes/mappers";
import { REVISABLE_QUOTE_STATUSES } from "@/lib/quotes/revision";
import type { QuoteInput, QuoteWorkspaceData } from "@/lib/quotes/types";

type QuoteWorkspaceProps = {
  initialData: QuoteWorkspaceData;
};

export function QuoteWorkspace({ initialData }: QuoteWorkspaceProps) {
  const router = useRouter();
  const [isSaving, startSave] = useTransition();
  const [isRevising, startRevise] = useTransition();
  const [saveError, setSaveError] = useState<string | null>(null);
  const quoteDraftRef = useRef<QuoteInput>({});

  const { quote, items, projectTitle, pricingDocumentUpdatedAt, latestRevisionQuoteId } =
    initialData;
  const quoteId = quote.id;
  const projectId = quote.project_id;

  const sections = useMemo(
    () => groupQuoteItemsBySection(items),
    [items]
  );

  const isEditable =
    quote.status === "draft" && quote.superseded_by_quote_id == null;
  const isSuperseded = quote.superseded_by_quote_id != null;
  const canRevise = REVISABLE_QUOTE_STATUSES.includes(quote.status) && !isSuperseded;

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

  const handleSaveItem = async (
    itemId: string,
    input: Parameters<typeof updateQuoteItem>[1]
  ) => {
    if (!isEditable) {
      return { error: "Only draft quotes can be edited." };
    }
    const result = await updateQuoteItem(itemId, input);
    if (!result.error) router.refresh();
    return result;
  };

  const handleToggleVisible = async (itemId: string, visible: boolean) => {
    if (!isEditable) {
      return { error: "Only draft quotes can be edited." };
    }
    const result = await setQuoteItemVisible(itemId, visible);
    if (!result.error) router.refresh();
    return result;
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!isEditable) {
      return { error: "Only draft quotes can be edited." };
    }
    const result = await deleteQuoteItem(itemId);
    if (!result.error) router.refresh();
    return result;
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

  const handleReviseQuote = () => {
    setSaveError(null);
    startRevise(async () => {
      const result = await reviseQuote({ projectId, quoteId });
      if (result.error) {
        setSaveError(result.error);
      }
    });
  };

  return (
    <div className="space-y-5">
      <QuoteHeader
        quote={quote}
        projectTitle={projectTitle}
        isSaving={isSaving}
        onSave={isEditable ? handleSaveQuote : undefined}
      />

      {isSuperseded && latestRevisionQuoteId ? (
        <div
          className="rounded-lg border border-amber-300/80 bg-amber-50/90 px-4 py-3 text-sm text-amber-950 dark:border-amber-800/60 dark:bg-amber-950/30 dark:text-amber-100"
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

      <div className="rounded-lg border border-amber-200/80 bg-amber-50/80 px-4 py-2.5 text-sm text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/25 dark:text-amber-100">
        Review this quote before sending. Quotr has prepared this draft from
        your reviewed pricing, but your business is responsible for the final
        scope, price, exclusions and terms.
      </div>

      {pricingChangedAfterQuote ? (
        <p className="text-sm text-amber-800 dark:text-amber-200">
          Final pricing has changed since this quote was created. Create a
          revision to update the quote.
        </p>
      ) : null}

      {quote.revision_number > 1 || quote.revised_from_quote_id ? (
        <p className="text-sm text-muted-foreground">
          {quote.revision_number > 1 ? `Revision ${quote.revision_number}.` : null}
          {quote.revised_from_quote_id ? " Revised from a previous quote." : null}
        </p>
      ) : null}

      {saveError ? (
        <p className="text-sm text-destructive" role="alert">
          {saveError}
        </p>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_280px]">
        <div className="min-w-0 space-y-5">
          {isEditable ? (
            <div className="grid gap-3 sm:grid-cols-2">
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

          <QuotePreview quote={quote} items={items} />

          {isEditable ? (
            <div className="space-y-4">
              <h2 className="text-base font-semibold">Edit line items</h2>
              {sections.map((section) => (
                <QuoteItemsTable
                  key={section.sectionTitle ?? "general"}
                  sectionTitle={section.sectionTitle}
                  items={section.items}
                  onSaveItem={handleSaveItem}
                  onToggleVisible={handleToggleVisible}
                  onDeleteItem={handleDeleteItem}
                />
              ))}
            </div>
          ) : null}

          {isEditable ? (
            <QuoteTermsCard
              assumptions={quote.assumptions}
              exclusions={quote.exclusions}
              inclusions={quote.inclusions}
              terms={quote.terms}
              notesToClient={quote.notes_to_client}
              onChange={handleQuoteChange}
            />
          ) : null}
        </div>

        <div className="space-y-3">
          {canRevise ? (
            <Button
              type="button"
              className="w-full"
              variant="outline"
              disabled={isRevising}
              onClick={handleReviseQuote}
            >
              {isRevising ? "Creating revision…" : "Revise quote"}
            </Button>
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
