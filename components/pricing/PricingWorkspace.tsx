"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { RecalibrationBanner } from "@/components/pricing/RecalibrationBanner";
import { EmptyState } from "@/components/layout/empty-state";
import { PricingBulkToolbar } from "@/components/pricing/PricingBulkToolbar";
import { PricingDecisionCard } from "@/components/pricing/PricingDecisionCard";
import { PricingDetailsCard } from "@/components/pricing/PricingDetailsCard";
import { PricingGroupControl } from "@/components/pricing/PricingGroupControl";
import { PricingHeader } from "@/components/pricing/PricingHeader";
import { PricingMobileActionBar } from "@/components/pricing/PricingMobileActionBar";
import { PricingReviewChecklist } from "@/components/pricing/PricingReviewChecklist";
import { PricingSummaryPanel } from "@/components/pricing/PricingSummaryPanel";
import { PricingTermsCard } from "@/components/pricing/PricingTermsCard";
import { PricingWorkAreaSection } from "@/components/pricing/PricingWorkAreaSection";
import {
  addPricingItem,
  applyPricingFinalSell,
  deleteManualPricingItems,
  deletePricingItem,
  duplicatePricingItem,
  markPricingReviewed,
  setPricingItemsQuoteVisibility,
  updatePricingDocument,
  updatePricingItem,
} from "@/lib/pricing/actions";
import {
  groupPricingItems,
  isManuallyAddedPricingItem,
  type PricingGroupBy,
} from "@/lib/pricing/grouping";
import type {
  PricingDocument,
  PricingDocumentInput,
  PricingItem,
  PricingItemInput,
  PricingWorkspaceData,
} from "@/lib/pricing/types";
import type { QuoteSummary } from "@/lib/quotes/types";

type PricingWorkspaceProps = {
  initialData: PricingWorkspaceData;
  quoteSummary?: QuoteSummary | null;
  pricingChangedAfterQuote?: boolean;
};

export function PricingWorkspace({
  initialData,
  quoteSummary = null,
  pricingChangedAfterQuote = false,
}: PricingWorkspaceProps) {
  const [isSaving, startSave] = useTransition();
  const [isBulkPending, startBulk] = useTransition();
  const [saveError, setSaveError] = useState<string | null>(null);
  const [groupBy, setGroupBy] = useState<PricingGroupBy>("work_area");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectionMode, setSelectionMode] = useState(false);
  const documentDraftRef = useRef<PricingDocumentInput>({});
  const [document, setDocument] = useState<PricingDocument>(initialData.document);
  const [items, setItems] = useState<PricingItem[]>(initialData.items);
  const [workAreas, setWorkAreas] = useState(initialData.workAreas);
  const { projectTitle, latestEstimateIsStale, latestEstimateRecommendedSell } =
    initialData;
  const projectId = document.project_id;
  const pricingDocumentId = document.id;

  // Adopt refreshed project-authoritative client/site when those fields are not dirty.
  useEffect(() => {
    const draft = documentDraftRef.current;
    setDocument((prev) => ({
      ...initialData.document,
      client_name:
        draft.client_name !== undefined
          ? draft.client_name
          : initialData.document.client_name,
      site_address:
        draft.site_address !== undefined
          ? draft.site_address
          : initialData.document.site_address,
      // Preserve in-progress non-client draft overlays already applied to prev where useful
      title: draft.title !== undefined ? prev.title : initialData.document.title,
      scope_summary:
        draft.scope_summary !== undefined
          ? prev.scope_summary
          : initialData.document.scope_summary,
      valid_until:
        draft.valid_until !== undefined
          ? prev.valid_until
          : initialData.document.valid_until,
    }));
    setItems(initialData.items);
    setWorkAreas(initialData.workAreas);
  }, [initialData]);

  const groupedSections = useMemo(
    () => groupPricingItems(items, workAreas, groupBy),
    [items, workAreas, groupBy]
  );

  const selectedItems = useMemo(
    () => items.filter((item) => selectedIds.has(item.id)),
    [items, selectedIds]
  );
  const canDeleteCount = selectedItems.filter(isManuallyAddedPricingItem).length;

  const handleToggleSelect = useCallback((itemId: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  }, []);

  const handleDocumentChange = useCallback((updates: PricingDocumentInput) => {
    documentDraftRef.current = {
      ...documentDraftRef.current,
      ...updates,
    };
    setDocument((prev) => ({
      ...prev,
      ...(updates.client_name !== undefined
        ? { client_name: updates.client_name }
        : {}),
      ...(updates.site_address !== undefined
        ? { site_address: updates.site_address }
        : {}),
    }));
  }, []);

  const applyDocumentUpdate = useCallback((updated: PricingDocument) => {
    setDocument(updated);
  }, []);

  const handleQuoteDescriptionSaved = useCallback(
    (workAreaId: string, description: string | null) => {
      setWorkAreas((current) =>
        current.map((workArea) =>
          workArea.id === workAreaId
            ? { ...workArea, quote_description: description }
            : workArea
        )
      );
    },
    []
  );

  const handleSaveDocument = () => {
    setSaveError(null);
    startSave(async () => {
      const draft = documentDraftRef.current;
      const result = await updatePricingDocument(pricingDocumentId, draft);
      if (result.error) {
        setSaveError(result.error);
        return;
      }
      documentDraftRef.current = {};
      setDocument((current) => ({
        ...current,
        ...draft,
        status: "draft",
        reviewed_at: null,
      }));
    });
  };

  const handleMarkReviewed = async () => {
    const result = await markPricingReviewed(pricingDocumentId);
    if (result.error) {
      setSaveError(result.error);
      return;
    }
    setDocument((current) => ({
      ...current,
      status: "reviewed",
      reviewed_at: new Date().toISOString(),
    }));
  };

  const handleSaveItem = useCallback(
    async (itemId: string, input: PricingItemInput) => {
      const result = await updatePricingItem(itemId, input);
      if (!result.error && result.item && result.document) {
        setItems((current) =>
          current.map((item) => (item.id === itemId ? result.item! : item))
        );
        applyDocumentUpdate(result.document);
      }
      return result;
    },
    [applyDocumentUpdate]
  );

  const handleDuplicateItem = useCallback(
    async (itemId: string) => {
      const result = await duplicatePricingItem(itemId);
      if (!result.error && result.item && result.document) {
        setItems((current) => {
          const sourceIndex = current.findIndex((item) => item.id === itemId);
          if (sourceIndex === -1) {
            return [...current, result.item!];
          }
          const next = [...current];
          next.splice(sourceIndex + 1, 0, result.item!);
          return next;
        });
        applyDocumentUpdate(result.document);
      }
      return result;
    },
    [applyDocumentUpdate]
  );

  const handleDeleteItem = useCallback(
    async (itemId: string) => {
      const result = await deletePricingItem(itemId);
      if (!result.error && result.deletedItemId && result.document) {
        setItems((current) =>
          current.filter((item) => item.id !== result.deletedItemId)
        );
        applyDocumentUpdate(result.document);
      }
      return result;
    },
    [applyDocumentUpdate]
  );

  const handleApplyFinalSell = useCallback(
    async (finalSellExGst: number) => {
      const result = await applyPricingFinalSell({
        pricingDocumentId,
        finalSellExGst,
      });
      if (!result.error && result.document) {
        setDocument(result.document);
        if (result.items) {
          setItems(result.items);
        }
      }
      return result;
    },
    [pricingDocumentId]
  );

  const handleAddItem = useCallback(
    async (workAreaId: string | null) => {
      const result = await addPricingItem({
        pricingDocumentId,
        projectId,
        workAreaId,
      });
      if (!result.error && result.item && result.document) {
        setItems((current) => [...current, result.item!]);
        applyDocumentUpdate(result.document);
      }
      return result;
    },
    [applyDocumentUpdate, pricingDocumentId, projectId]
  );

  const handleBulkVisibility = (visibleOnQuote: boolean) => {
    if (selectedIds.size === 0) return;
    setSaveError(null);
    startBulk(async () => {
      const result = await setPricingItemsQuoteVisibility({
        pricingDocumentId,
        itemIds: Array.from(selectedIds),
        visibleOnQuote,
      });
      if (result.error) {
        setSaveError(result.error);
        return;
      }
      const updated = new Set(result.updatedItemIds ?? []);
      setItems((current) =>
        current.map((item) =>
          updated.has(item.id)
            ? { ...item, visible_on_quote: visibleOnQuote }
            : item
        )
      );
      if (result.document) {
        applyDocumentUpdate(result.document);
      }
      setSelectedIds(new Set());
    });
  };

  const handleBulkDelete = () => {
    const manualIds = selectedItems
      .filter(isManuallyAddedPricingItem)
      .map((item) => item.id);
    if (manualIds.length === 0) return;
    if (
      !window.confirm(
        `Delete ${manualIds.length} manually added line${manualIds.length === 1 ? "" : "s"}? Estimate-sourced items will not be deleted.`
      )
    ) {
      return;
    }
    setSaveError(null);
    startBulk(async () => {
      const result = await deleteManualPricingItems({
        pricingDocumentId,
        itemIds: manualIds,
      });
      if (result.error) {
        setSaveError(result.error);
        return;
      }
      const deleted = new Set(result.deletedItemIds ?? []);
      setItems((current) => current.filter((item) => !deleted.has(item.id)));
      if (result.document) {
        applyDocumentUpdate(result.document);
      }
      setSelectedIds(new Set());
    });
  };

  return (
    <div className="space-y-5 pb-[calc(11rem+env(safe-area-inset-bottom))] md:pb-0">
      <PricingHeader
        document={document}
        projectTitle={projectTitle}
        isSaving={isSaving}
        onSaveDocument={handleSaveDocument}
      />

      <PricingDecisionCard
        document={document}
        items={items}
        workAreas={workAreas}
        recommendedSell={latestEstimateRecommendedSell}
        disabled={isSaving}
        onApplyFinalSell={handleApplyFinalSell}
      />

      {quoteSummary != null ? (
        <p className="text-xs leading-relaxed text-muted-foreground">
          A quote already exists. Changing this price does not change a sent
          quote. Create a revision if you need to send an updated quote.
        </p>
      ) : null}

      <div id="recalibration-banner">
        <RecalibrationBanner
          projectId={projectId}
          pricingDocumentId={pricingDocumentId}
          needsRecalibration={document.needs_recalibration}
          quoteExists={quoteSummary != null}
          latestEstimateIsStale={latestEstimateIsStale}
          onApplied={({ document: updatedDocument, items: updatedItems }) => {
            setDocument(updatedDocument);
            setItems(updatedItems);
          }}
          onKeepCurrent={() => {
            setDocument((current) => ({
              ...current,
              needs_recalibration: false,
              recalibration_status: "manually_kept",
            }));
          }}
        />
      </div>

      {document.status !== "reviewed" ? (
        <PricingReviewChecklist
          onMarkReviewed={handleMarkReviewed}
          disabled={isSaving}
        />
      ) : (
        <p className="text-sm text-muted-foreground">
          Pricing reviewed. Further edits will revert status to draft.
        </p>
      )}

      {saveError ? (
        <p className="text-sm text-destructive" role="alert">
          {saveError}
        </p>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_280px]">
        <div className="min-w-0 space-y-5">
          <details
            className="rounded-lg border border-border/60 bg-card"
            open
            data-pricing-work-area-adjustments
          >
            <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium marker:content-none [&::-webkit-details-marker]:hidden">
              Adjust Work Area prices
            </summary>
            <div className="space-y-4 border-t border-border/60 p-3">
            {items.length === 0 ? (
              <EmptyState
                title="No pricing items yet"
                description="Line items appear here after you continue to Pricing from your estimate."
              />
            ) : null}
            {items.length > 0 ? (
              <>
                <PricingGroupControl
                  value={groupBy}
                  onChange={setGroupBy}
                  selectionMode={selectionMode}
                  onSelectionModeChange={setSelectionMode}
                  selectedCount={selectedIds.size}
                />
                <PricingBulkToolbar
                  selectedCount={selectedIds.size}
                  canDeleteCount={canDeleteCount}
                  isPending={isBulkPending}
                  onShowOnQuote={() => handleBulkVisibility(true)}
                  onHideFromQuote={() => handleBulkVisibility(false)}
                  onDeleteManual={handleBulkDelete}
                  onClear={() => setSelectedIds(new Set())}
                />
              </>
            ) : null}
            <div data-pricing-advanced-lines>
            {groupedSections.map((section) => (
              <PricingWorkAreaSection
                key={section.key}
                projectId={projectId}
                title={section.title}
                workArea={groupBy === "work_area" ? section.workArea : null}
                items={section.items}
                selectedIds={selectedIds}
                selectionMode={selectionMode}
                onToggleSelect={handleToggleSelect}
                onQuoteDescriptionSaved={handleQuoteDescriptionSaved}
                onSaveItem={handleSaveItem}
                onDuplicateItem={handleDuplicateItem}
                onDeleteItem={handleDeleteItem}
                onAddItem={handleAddItem}
                showAddItem={groupBy === "work_area"}
              />
            ))}
            </div>
            </div>
          </details>

          <details className="rounded-lg border border-border/60 bg-card" data-pricing-quote-details>
            <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium marker:content-none [&::-webkit-details-marker]:hidden">
              Quote details
            </summary>
            <div className="border-t border-border/60 p-3">
              <PricingDetailsCard
                title={document.title}
                clientName={document.client_name}
                siteAddress={document.site_address}
                pricingDate={document.pricing_date}
                validUntil={document.valid_until}
                scopeSummary={document.scope_summary}
                onChange={handleDocumentChange}
              />
            </div>
          </details>

          <details className="rounded-lg border border-border/60 bg-card">
            <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium marker:content-none [&::-webkit-details-marker]:hidden">
              Terms and exclusions
            </summary>
            <div className="border-t border-border/60">
              <PricingTermsCard
                assumptions={document.assumptions}
                exclusions={document.exclusions}
                terms={document.terms}
                internalNotes={document.internal_notes}
                onChange={handleDocumentChange}
              />
            </div>
          </details>
        </div>

        <PricingSummaryPanel
          className="hidden md:block"
          document={document}
          projectId={projectId}
          quoteSummary={quoteSummary}
          pricingChangedAfterQuote={pricingChangedAfterQuote}
        />
      </div>

      <PricingMobileActionBar
        document={document}
        projectId={projectId}
        quoteSummary={quoteSummary}
        isSaving={isSaving}
        needsRecalibration={document.needs_recalibration}
        onSaveDocument={handleSaveDocument}
        onRecalibrate={() => {
          globalThis.document
            .getElementById("recalibration-banner")
            ?.scrollIntoView({ behavior: "smooth", block: "start" });
        }}
      />
    </div>
  );
}

