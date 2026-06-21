"use client";

import { useRouter } from "next/navigation";
import { useCallback, useMemo, useRef, useState, useTransition } from "react";
import { PricingDetailsCard } from "@/components/pricing/PricingDetailsCard";
import { PricingHeader } from "@/components/pricing/PricingHeader";
import { PricingSummaryPanel } from "@/components/pricing/PricingSummaryPanel";
import { PricingTermsCard } from "@/components/pricing/PricingTermsCard";
import { PricingWorkAreaSection } from "@/components/pricing/PricingWorkAreaSection";
import { Checkbox } from "@/components/ui/checkbox";
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
  PricingDocumentInput,
  PricingItemInput,
  PricingWorkspaceData,
} from "@/lib/pricing/types";

type PricingWorkspaceProps = {
  initialData: PricingWorkspaceData;
};

export function PricingWorkspace({ initialData }: PricingWorkspaceProps) {
  const router = useRouter();
  const [isSaving, startSave] = useTransition();
  const [saveError, setSaveError] = useState<string | null>(null);
  const [reviewChecks, setReviewChecks] = useState({
    scope: false,
    quantities: false,
    subcontractors: false,
    terms: false,
  });
  const documentDraftRef = useRef<PricingDocumentInput>({});

  const { document, items, workAreas, projectTitle } = initialData;
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

  const refresh = () => router.refresh();

  const handleSaveDocument = () => {
    setSaveError(null);
    startSave(async () => {
      const result = await updatePricingDocument(
        pricingDocumentId,
        documentDraftRef.current
      );
      if (result.error) {
        setSaveError(result.error);
        return;
      }
      documentDraftRef.current = {};
      refresh();
    });
  };

  const handleMarkReviewed = async () => {
    const result = await markPricingReviewed(pricingDocumentId);
    if (result.error) {
      setSaveError(result.error);
    }
  };

  const handleSaveItem = async (itemId: string, input: PricingItemInput) => {
    const result = await updatePricingItem(itemId, input);
    if (!result.error) refresh();
    return result;
  };

  const handleDuplicateItem = async (itemId: string) => {
    const result = await duplicatePricingItem(itemId);
    if (!result.error) refresh();
    return result;
  };

  const handleDeleteItem = async (itemId: string) => {
    const result = await deletePricingItem(itemId);
    if (!result.error) refresh();
    return result;
  };

  const handleAddItem = async (workAreaId: string | null) => {
    const result = await addPricingItem({
      pricingDocumentId,
      projectId,
      workAreaId,
    });
    if (!result.error) refresh();
    return result;
  };

  const allReviewChecksComplete = Object.values(reviewChecks).every(Boolean);

  return (
    <div className="space-y-6">
      <PricingHeader
        projectId={projectId}
        projectTitle={projectTitle}
        document={document}
        isSaving={isSaving}
        onSaveDocument={handleSaveDocument}
        onMarkReviewed={
          document.status !== "reviewed" && allReviewChecksComplete
            ? handleMarkReviewed
            : undefined
        }
      />

      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
        Review all pricing before issuing a quote. Quotr has prepared this draft
        from your estimate, but you remain responsible for confirming scope,
        quantities, subcontractor allowances, terms and final pricing.
      </div>

      {document.status !== "reviewed" ? (
        <div className="rounded-xl border px-4 py-3">
          <p className="mb-3 text-sm font-medium">Before marking reviewed</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {(
              [
                ["scope", "Scope reviewed"],
                ["quantities", "Quantities checked"],
                ["subcontractors", "Subcontractor allowances checked"],
                ["terms", "Terms/exclusions reviewed"],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={reviewChecks[key]}
                  onCheckedChange={(checked) =>
                    setReviewChecks((current) => ({
                      ...current,
                      [key]: checked === true,
                    }))
                  }
                />
                {label}
              </label>
            ))}
          </div>
        </div>
      ) : null}

      {saveError ? (
        <p className="text-sm text-destructive" role="alert">
          {saveError}
        </p>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0 space-y-6">
          <PricingDetailsCard
            title={document.title}
            clientName={document.client_name}
            siteAddress={document.site_address}
            pricingDate={document.pricing_date}
            validUntil={document.valid_until}
            scopeSummary={document.scope_summary}
            onChange={handleDocumentChange}
          />

          <div className="space-y-6">
            {groupedSections.map((section) => (
              <PricingWorkAreaSection
                key={section.workArea?.id ?? "general"}
                workArea={section.workArea}
                items={section.items}
                pricingDocumentId={pricingDocumentId}
                projectId={projectId}
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

        <PricingSummaryPanel document={document} />
      </div>
    </div>
  );
}
