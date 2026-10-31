"use client";

import { useState } from "react";
import { AddWorkAreaDialog } from "@/components/assistant/AddWorkAreaDialog";
import { ManualPricingNotice } from "@/components/assistant/ManualPricingNotice";
import { workAreaTypeHasDetailedCalculator } from "@/lib/estimate/calculator-availability";
import {
  MANUAL_ADD_WORK_LABEL,
  WORK_AREA_INTRODUCTION,
} from "@/lib/work-areas/manual-pricing-route";
import { JobPlanWorkAreaCardView } from "@/components/assistant/job-plan/JobPlanWorkAreaCard";
import { PreliminariesSection } from "@/components/assistant/job-plan/PreliminariesSection";
import { PRELIMINARIES_FACT_KEY } from "@/lib/estimate/preliminaries";
import { SaveStatusIndicator } from "@/components/assistant/SaveStatusIndicator";
import { getJobPlanQuickSpecEditor } from "@/components/assistant/job-plan/quick-spec-editors";
import { Button } from "@/components/ui/button";
import type { WorkArea } from "@/components/assistant/types";
import type {
  JobPlanScopeItem,
  JobPlanView,
} from "@/lib/assistant/job-plan/types";
import { ASSISTANT_ACTION_LABELS } from "@/lib/assistant/presentation/action-labels";
import {
  mobileActionFlowClass,
  mobileNavBottomClass,
} from "@/components/layout/mobile-nav-metrics";
import { cn } from "@/lib/utils";
import type { SaveStatus } from "@/lib/assistant/presentation/save-status";
import type { OrganisationRate } from "@/components/setup/types";
import type { EstimateFact } from "@/lib/estimate/types";
import type { JobPlanConstraintWrite } from "@/components/assistant/job-plan/quick-spec-editors";

type JobPlanPanelProps = {
  plan: JobPlanView;
  workAreas: WorkArea[];
  facts: readonly EstimateFact[];
  submitted?: boolean;
  /** Post-estimate workspace: editable without the Looks right interview CTA. */
  workspaceEditing?: boolean;
  isSaving?: boolean;
  isAddingWorkArea?: boolean;
  isRemovingWorkArea?: boolean;
  addWorkAreaError?: string | null;
  scopeSaveStatus?: SaveStatus;
  scopeSaveError?: string | null;
  confirmError?: string | null;
  onContinue?: () => void;
  onContinueManual?: () => void;
  onAddManualWork?: (input: {
    name: string;
    scopeDescription: string;
  }) => Promise<{ success: boolean; error?: string }>;
  manualScopeDefault?: string;
  onAddWorkArea?: (
    workAreaType: string
  ) => Promise<{ success: boolean; error?: string }>;
  onRemoveWorkArea?: (workAreaId: string) => Promise<{ success: boolean; error?: string }> | void;
  /**
   * When entering Edit Job with a contextual target, only render the relevant
   * Work Area card and auto-open its edit controls.
   */
  focusWorkAreaId?: string | null;
  specFocusKey?: string | null;
  scopeFocusItemId?: string | null;
  postHoleFocusId?: string | null;
  onBooleanFact?: (input: {
    workAreaId: string;
    key: string;
    label: string;
    value: boolean;
  }) => void;
  onToggleScope?: (
    item: JobPlanScopeItem,
    presentation: "INCLUDED" | "NOT_INCLUDED"
  ) => void;
  onSpecFact?: (input: {
    workAreaId: string;
    key: string;
    label: string;
    value: string | number;
    valueType: "number" | "select" | "text";
    nestedItemId?: string | null;
  }) => void;
  constraints?: readonly { key: string; value: unknown }[];
  onConstraint?: JobPlanConstraintWrite;
  projectId?: string;
  briefText?: string | null;
  labourRates?: readonly OrganisationRate[];
};

export function JobPlanPanel({
  plan,
  workAreas,
  facts,
  submitted,
  workspaceEditing = false,
  isSaving,
  isAddingWorkArea,
  isRemovingWorkArea,
  addWorkAreaError,
  scopeSaveStatus = "idle",
  scopeSaveError,
  confirmError = null,
  onContinue,
  onContinueManual,
  onAddManualWork,
  manualScopeDefault = "",
  onAddWorkArea,
  onRemoveWorkArea,
  focusWorkAreaId = null,
  specFocusKey = null,
  scopeFocusItemId = null,
  postHoleFocusId = null,
  onBooleanFact,
  onToggleScope,
  onSpecFact,
  constraints,
  onConstraint,
  projectId,
  briefText,
  labourRates = [],
}: JobPlanPanelProps) {
  const cardsToRender = focusWorkAreaId
    ? plan.cards.filter((c) => c.workAreaId === focusWorkAreaId)
    : plan.cards;
  const manualCards = cardsToRender.filter(
    (card) => !workAreaTypeHasDetailedCalculator(card.workAreaType)
  );
  const manualOnly =
    cardsToRender.length > 0 && manualCards.length === cardsToRender.length;
  const addingBesideCalculatedWork = cardsToRender.some((card) =>
    workAreaTypeHasDetailedCalculator(card.workAreaType)
  );
  const [addOpen, setAddOpen] = useState(false);
  const interactive = workspaceEditing || !submitted;
  const tradeDescriptions = workAreas
    .map((area) => area.quoteDescription?.trim() ?? "")
    .filter((text) => text.length > 0);
  const preliminariesKey = JSON.stringify({
    plan:
      facts.find(
        (fact) => fact.work_area_id == null && fact.key === PRELIMINARIES_FACT_KEY
      )?.value ?? null,
    brief: briefText ?? "",
    trades: tradeDescriptions,
  });
  const showCtaBar = workspaceEditing ? Boolean(onAddWorkArea) : !submitted;

  if (cardsToRender.length === 0) {
    return (
      <div className="space-y-3 overflow-x-hidden" data-job-plan-panel>
        {projectId ? (
          <PreliminariesSection
            key={preliminariesKey}
            projectId={projectId}
            briefText={briefText}
            facts={facts}
            tradeDescriptions={tradeDescriptions}
            labourRates={labourRates}
          />
        ) : null}
        <p className="text-sm text-muted-foreground">
          {onAddManualWork
            ? "Add a Work Area. If Quotr cannot calculate it, describe the scope and enter your price in Pricing."
            : "Analyse the job first, then confirm the Work Areas."}
        </p>
        {onAddWorkArea ? (
          <Button
            type="button"
            variant="outline"
            size="touch"
            data-job-plan-add-work-area
            onClick={() => setAddOpen(true)}
          >
            + Add another Work Area
          </Button>
        ) : null}
        {onAddWorkArea ? (
          <AddWorkAreaDialog
            open={addOpen}
            onOpenChange={setAddOpen}
            workAreas={workAreas}
            isSaving={isAddingWorkArea}
            error={addWorkAreaError}
            onAdd={async (workAreaType) => {
              const out = await onAddWorkArea(workAreaType);
              if (out.success) setAddOpen(false);
            }}
            showManualPricing={Boolean(onAddManualWork)}
            manualScopeDefault={addingBesideCalculatedWork ? "" : manualScopeDefault}
            manualSubmitLabel={
              addingBesideCalculatedWork ? MANUAL_ADD_WORK_LABEL : undefined
            }
            manualSubmitHint={
              addingBesideCalculatedWork
                ? "Adds a separate area. Quotr will not calculate it; you price it in Pricing."
                : null
            }
            onContinueManual={
              onAddManualWork
                ? async (input) => {
                    const out = await onAddManualWork(input);
                    if (out.success) setAddOpen(false);
                    return out;
                  }
                : undefined
            }
          />
        ) : null}
      </div>
    );
  }

  return (
    <div
      className="space-y-2 overflow-x-hidden"
      data-job-plan-panel
      data-job-plan-primary="true"
    >
      <p className="text-sm leading-5 text-muted-foreground" data-work-area-term>
        {WORK_AREA_INTRODUCTION}
      </p>
      {projectId && !focusWorkAreaId ? (
        <PreliminariesSection
          key={preliminariesKey}
          projectId={projectId}
          briefText={briefText}
          facts={facts}
          tradeDescriptions={tradeDescriptions}
          labourRates={labourRates}
        />
      ) : null}
      <div className="flex flex-col gap-3 max-md:pb-36">
        {cardsToRender.map((card) => (
          <JobPlanWorkAreaCardView
            key={card.workAreaId}
            card={card}
            readOnly={!interactive}
            isRemoving={isRemovingWorkArea}
            onToggleScope={interactive ? onToggleScope : undefined}
            onRemove={interactive ? onRemoveWorkArea : undefined}
            autoEditOpen={Boolean(
              focusWorkAreaId && card.workAreaId === focusWorkAreaId
            )}
            specFocusKey={specFocusKey}
            scopeFocusItemId={scopeFocusItemId}
            specEditor={(() => {
              const Editor = getJobPlanQuickSpecEditor(card.workAreaType);
              return Editor ? (
                <Editor
                  workAreaId={card.workAreaId}
                  facts={facts}
                  onSpecFact={onSpecFact}
                  constraints={constraints}
                  onConstraint={onConstraint}
                  postHoleFocusId={
                    card.workAreaId === focusWorkAreaId ? postHoleFocusId : null
                  }
                  onBooleanFact={onBooleanFact}
                />
              ) : null;
            })()}
          />
        ))}
      </div>

      {showCtaBar ? (
        <div
          className={cn(
            "sticky z-10 -mx-1 border-t border-border bg-background px-3 pt-3 pb-3 md:bottom-0 md:pb-[max(0.75rem,env(safe-area-inset-bottom))]",
            mobileNavBottomClass,
            mobileActionFlowClass
          )}
          data-job-plan-cta-bar
          data-action-footer="true"
        >
          {manualCards.length > 0 ? (
            <div className="mb-3">
              <ManualPricingNotice />
            </div>
          ) : null}
          <div className="flex flex-wrap items-center gap-2">
            {workspaceEditing ? null : manualOnly && onContinueManual ? (
              <Button
                type="button"
                className="min-h-11 flex-1 sm:flex-none"
                data-manual-pricing-continue="true"
                onClick={onContinueManual}
                disabled={isSaving}
              >
                {isSaving ? "Saving…" : "Continue with manual pricing"}
              </Button>
            ) : workspaceEditing ? null : (
              <Button
                type="button"
                className="min-h-11 flex-1 sm:flex-none"
                data-job-plan-primary-cta
                data-saving={isSaving ? "true" : "false"}
                aria-busy={isSaving || undefined}
                onClick={onContinue}
                disabled={plan.cards.length === 0 || isSaving}
              >
                {isSaving
                  ? ASSISTANT_ACTION_LABELS.savingWorkAreas
                  : ASSISTANT_ACTION_LABELS.looksRight}
              </Button>
            )}
            {onAddWorkArea ? (
              <Button
                type="button"
                variant="outline"
                className="min-h-11 flex-1 sm:flex-none"
                data-job-plan-add-work-area
                disabled={isSaving || isAddingWorkArea}
                onClick={() => setAddOpen(true)}
              >
                + Add another Work Area
              </Button>
            ) : null}
          </div>
          {confirmError ? (
            <p className="mt-2 text-sm text-destructive" role="alert" data-work-confirm-error>
              {confirmError}
            </p>
          ) : null}
          <SaveStatusIndicator
            status={scopeSaveStatus}
            isSaving={scopeSaveStatus === "saving"}
            hasError={scopeSaveStatus === "error"}
            errorMessage={scopeSaveError}
            className="mt-2"
          />
        </div>
      ) : null}

      {onAddWorkArea ? (
        <AddWorkAreaDialog
          open={addOpen}
          onOpenChange={setAddOpen}
          workAreas={workAreas}
          isSaving={isAddingWorkArea}
          error={addWorkAreaError}
          showManualPricing={Boolean(onAddManualWork)}
          manualScopeDefault={addingBesideCalculatedWork ? "" : manualScopeDefault}
          manualSubmitLabel={
            addingBesideCalculatedWork ? MANUAL_ADD_WORK_LABEL : undefined
          }
          manualSubmitHint={
            addingBesideCalculatedWork
              ? "Adds a separate area. Quotr will not calculate it; you price it in Pricing."
              : null
          }
          onContinueManual={
            onAddManualWork
              ? async (input) => {
                  const out = await onAddManualWork(input);
                  if (out.success) setAddOpen(false);
                  return out;
                }
              : undefined
          }
          onAdd={async (workAreaType) => {
            const out = await onAddWorkArea(workAreaType);
            if (out.success) setAddOpen(false);
          }}
        />
      ) : null}
    </div>
  );
}
