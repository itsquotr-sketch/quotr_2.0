"use client";

import { useCallback, useMemo, useRef, useState, useTransition } from "react";
import { RecalibrationBanner } from "@/components/pricing/RecalibrationBanner";
import { EmptyState } from "@/components/layout/empty-state";
import { WorkspaceBanner } from "@/components/layout/workspace-banner";
import { PricingDetailsCard } from "@/components/pricing/PricingDetailsCard";
import { PricingHeader } from "@/components/pricing/PricingHeader";
import { PricingMobileActionBar } from "@/components/pricing/PricingMobileActionBar";
import { PricingReviewChecklist } from "@/components/pricing/PricingReviewChecklist";
import { PricingSummaryPanel } from "@/components/pricing/PricingSummaryPanel";
import { PricingTermsCard } from "@/components/pricing/PricingTermsCard";
import { PricingWorkAreaSection } from "@/components/pricing/PricingWorkAreaSection";
import {
  addPricingItem,
  deletePricingItem,
  duplicatePricingItem,
  markPricingReviewed,
  updatePricingDocument,
  updatePricingItem,
} from "@/lib/pricing/actions";
import { groupItemsByWorkArea } from "@/lib/pricing/mappers";
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
  const [saveError, setSaveError] = useState<string | null>(null);
  const documentDraftRef = useRef<PricingDocumentInput>({});
  const [document, setDocument] = useState<PricingDocument>(initialData.document);
  const [items, setItems] = useState<PricingItem[]>(initialData.items);
  const [workAreas, setWorkAreas] = useState(initialData.workAreas);
  const { projectTitle, latestEstimateIsStale } = initialData;
  const projectId = document.project_id;
  const pricingDocumentId = document.id;

  const groupedSections = useMemo(
    () => groupItemsByWorkArea(items, workAreas),
    [items, workAreas]
  );

  const handleDocumentChange = useCallback((updates: PricingDocumentInput) => {
    documentDraftRef.current = {
      ...documentDraftRef.current,
      ...updates,
    };
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

  return (
    <div className="space-y-5 pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-0">
      <PricingHeader
        document={document}
        projectTitle={projectTitle}
        isSaving={isSaving}
        onSaveDocument={handleSaveDocument}
      />

      <div className="md:hidden">
        <PricingSummaryPanel
          document={document}
          projectId={projectId}
          quoteSummary={quoteSummary}
          pricingChangedAfterQuote={pricingChangedAfterQuote}
          compact
        />
      </div>

      <WorkspaceBanner>
        Review and adjust pricing before creating a client quote. You remain
        responsible for confirming scope, quantities, subcontractor allowances,
        terms and final pricing.
      </WorkspaceBanner>

      {quoteSummary != null ? (
        <p className="text-xs leading-relaxed text-muted-foreground">
          A quote exists for this project. Work area description or pricing
          changes may require a quote revision.
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
          <PricingDetailsCard
            title={document.title}
            clientName={document.client_name}
            siteAddress={document.site_address}
            pricingDate={document.pricing_date}
            validUntil={document.valid_until}
            scopeSummary={document.scope_summary}
            onChange={handleDocumentChange}
          />

          <div className="space-y-4">
            {items.length === 0 ? (
              <EmptyState
                title="No pricing items yet"
                description="Line items appear here after you prepare final pricing from your estimate. Check each work area section below or add items manually."
              />
            ) : null}
            {groupedSections.map((section) => (
              <PricingWorkAreaSection
                key={section.workArea?.id ?? "general"}
                projectId={projectId}
                workArea={section.workArea}
                items={section.items}
                onQuoteDescriptionSaved={handleQuoteDescriptionSaved}
                onSaveItem={handleSaveItem}
                onDuplicateItem={handleDuplicateItem}
                onDeleteItem={handleDeleteItem}
                onAddItem={handleAddItem}
              />
            ))}
          </div>

          <PricingTermsCard
            assumptions={document.assumptions}
            exclusions={document.exclusions}
            terms={document.terms}
            internalNotes={document.internal_notes}
            onChange={handleDocumentChange}
          />
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
