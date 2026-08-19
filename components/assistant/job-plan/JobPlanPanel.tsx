"use client";

import { useState } from "react";
import { AddWorkAreaDialog } from "@/components/assistant/AddWorkAreaDialog";
import { JobPlanWorkAreaCardView } from "@/components/assistant/job-plan/JobPlanWorkAreaCard";
import { SaveStatusIndicator } from "@/components/assistant/SaveStatusIndicator";
import { getJobPlanQuickSpecEditor } from "@/components/assistant/job-plan/quick-spec-editors";
import { Button } from "@/components/ui/button";
import type { WorkArea } from "@/components/assistant/types";
import type {
  JobPlanScopeItem,
  JobPlanView,
} from "@/lib/assistant/job-plan/types";
import { ASSISTANT_ACTION_LABELS } from "@/lib/assistant/presentation/action-labels";
import type { SaveStatus } from "@/lib/assistant/presentation/save-status";
import type { EstimateFact } from "@/lib/estimate/types";

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
  onContinue?: () => void;
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
  onToggleScope?: (
    item: JobPlanScopeItem,
    presentation: "INCLUDED" | "NOT_INCLUDED"
  ) => void;
  onSpecFact?: (input: {
    workAreaId: string;
    key: string;
    label: string;
    value: string | number;
    valueType: "number" | "select";
  }) => void;
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
  onContinue,
  onAddWorkArea,
  onRemoveWorkArea,
  focusWorkAreaId = null,
  specFocusKey = null,
  scopeFocusItemId = null,
  onToggleScope,
  onSpecFact,
}: JobPlanPanelProps) {
  const cardsToRender = focusWorkAreaId
    ? plan.cards.filter((c) => c.workAreaId === focusWorkAreaId)
    : plan.cards;
  const [addOpen, setAddOpen] = useState(false);
  const interactive = workspaceEditing || !submitted;
  const showCtaBar = workspaceEditing ? Boolean(onAddWorkArea) : !submitted;

  if (cardsToRender.length === 0) {
    return (
      <div className="space-y-3 overflow-x-hidden" data-job-plan-panel>
        <p className="text-sm text-muted-foreground">
          Analyse Job first, then confirm the Job Plan.
        </p>
        {onAddWorkArea ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="min-h-11"
            data-job-plan-add-work-area
            onClick={() => setAddOpen(true)}
          >
            + Add work area
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
          />
        ) : null}
      </div>
    );
  }

  return (
    <div
      className="space-y-3 overflow-x-hidden"
      data-job-plan-panel
      data-job-plan-primary="true"
    >
      <div className="flex flex-col gap-3">
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
                />
              ) : null;
            })()}
          />
        ))}
      </div>

      {showCtaBar ? (
        <div
          className="sticky bottom-0 z-10 -mx-1 border-t border-border bg-background/95 px-3 pt-3 backdrop-blur pb-[max(0.75rem,env(safe-area-inset-bottom))]"
          data-job-plan-cta-bar
        >
          <div className="flex flex-wrap items-center gap-2">
            {workspaceEditing ? null : (
              <Button
                type="button"
                className="min-h-11 flex-1 sm:flex-none"
                data-job-plan-primary-cta
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
                + Add work area
              </Button>
            ) : null}
          </div>
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
          onAdd={async (workAreaType) => {
            const out = await onAddWorkArea(workAreaType);
            if (out.success) setAddOpen(false);
          }}
        />
      ) : null}
    </div>
  );
}
