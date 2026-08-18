"use client";

import { useState } from "react";
import { AddWorkAreaDialog } from "@/components/assistant/AddWorkAreaDialog";
import { JobPlanWorkAreaCardView } from "@/components/assistant/job-plan/JobPlanWorkAreaCard";
import { getJobPlanQuickSpecEditor } from "@/components/assistant/job-plan/quick-spec-editors";
import { Button } from "@/components/ui/button";
import type { WorkArea } from "@/components/assistant/types";
import type {
  JobPlanScopeItem,
  JobPlanView,
} from "@/lib/assistant/job-plan/types";
import { ASSISTANT_ACTION_LABELS } from "@/lib/assistant/presentation/action-labels";
import type { EstimateFact } from "@/lib/estimate/types";

type JobPlanPanelProps = {
  plan: JobPlanView;
  workAreas: WorkArea[];
  facts: readonly EstimateFact[];
  submitted?: boolean;
  isSaving?: boolean;
  isAddingWorkArea?: boolean;
  isRemovingWorkArea?: boolean;
  addWorkAreaError?: string | null;
  onContinue?: () => void;
  onAddWorkArea?: (workAreaType: string) => Promise<void>;
  onRemoveWorkArea?: (workAreaId: string) => void;
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
  isSaving,
  isAddingWorkArea,
  isRemovingWorkArea,
  addWorkAreaError,
  onContinue,
  onAddWorkArea,
  onRemoveWorkArea,
  onToggleScope,
  onSpecFact,
}: JobPlanPanelProps) {
  const [addOpen, setAddOpen] = useState(false);

  if (plan.cards.length === 0) {
    return (
      <div className="space-y-3 overflow-x-hidden" data-job-plan-panel>
        <p className="text-sm text-muted-foreground">
          Analyse Job first, then confirm the Job Plan.
        </p>
        {onAddWorkArea ? (
          <Button type="button" variant="ghost" size="sm" onClick={() => setAddOpen(true)}>
            Add work area
          </Button>
        ) : null}
        {onAddWorkArea ? (
          <AddWorkAreaDialog
            open={addOpen}
            onOpenChange={setAddOpen}
            workAreas={workAreas}
            isSaving={isAddingWorkArea}
            error={addWorkAreaError}
            onAdd={onAddWorkArea}
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
        {plan.cards.map((card) => (
          <JobPlanWorkAreaCardView
            key={card.workAreaId}
            card={card}
            readOnly={submitted}
            isRemoving={isRemovingWorkArea}
            onToggleScope={submitted ? undefined : onToggleScope}
            onRemove={submitted ? undefined : onRemoveWorkArea}
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

      {submitted ? null : (
        <div
          className="sticky bottom-0 z-10 -mx-1 border-t border-border bg-background/95 px-1 pt-3 backdrop-blur pb-[max(0.75rem,env(safe-area-inset-bottom))]"
          data-job-plan-cta-bar
        >
          <Button
            type="button"
            className="w-full sm:w-auto"
            data-job-plan-primary-cta
            onClick={onContinue}
            disabled={plan.cards.length === 0 || isSaving}
          >
            {isSaving
              ? ASSISTANT_ACTION_LABELS.savingWorkAreas
              : ASSISTANT_ACTION_LABELS.looksRight}
          </Button>
          {onAddWorkArea ? (
            <button
              type="button"
              className="mt-2 block text-xs text-muted-foreground underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              data-job-plan-add-work-area
              disabled={isSaving || isAddingWorkArea}
              onClick={() => setAddOpen(true)}
            >
              Add another work area
            </button>
          ) : null}
        </div>
      )}

      {onAddWorkArea ? (
        <AddWorkAreaDialog
          open={addOpen}
          onOpenChange={setAddOpen}
          workAreas={workAreas}
          isSaving={isAddingWorkArea}
          error={addWorkAreaError}
          onAdd={onAddWorkArea}
        />
      ) : null}
    </div>
  );
}
