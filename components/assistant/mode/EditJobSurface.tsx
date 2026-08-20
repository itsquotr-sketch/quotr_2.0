"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { EditJobSection } from "@/lib/assistant/mode/types";
import { ASSISTANT_ACTION_LABELS } from "@/lib/assistant/presentation/action-labels";
import { cn } from "@/lib/utils";

type EditJobSurfaceProps = {
  focusSection: EditJobSection | null;
  isStale?: boolean;
  isRegenerating?: boolean;
  onDone: () => void;
  onUpdateEstimate?: () => void;
  jobPlan: ReactNode;
  projectConditions: ReactNode;
  details: ReactNode;
  advanced?: ReactNode | null;
};

function sectionOpen(
  id: EditJobSection,
  focusSection: EditJobSection | null,
  manual: Partial<Record<EditJobSection, boolean>>
): boolean {
  if (manual[id] != null) return Boolean(manual[id]);
  if (focusSection) return focusSection === id;
  // General Edit Job starts compact: all sections collapsed until targeted.
  return false;
}

function EditSection({
  id,
  title,
  hint,
  open,
  onToggle,
  children,
}: {
  id: EditJobSection;
  title: string;
  hint?: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <section
      className="rounded-xl border border-border/50 bg-card"
      data-edit-job-section={id}
      data-edit-job-section-open={open ? "true" : "false"}
    >
      <button
        type="button"
        className="flex w-full min-h-11 items-center justify-between gap-3 px-3.5 py-3 text-left"
        onClick={onToggle}
        aria-expanded={open}
      >
        <span>
          <span className="block text-sm font-medium text-foreground">{title}</span>
          {hint && !open ? (
            <span className="mt-0.5 block text-xs text-muted-foreground">{hint}</span>
          ) : null}
        </span>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180"
          )}
          aria-hidden
        />
      </button>
      {open ? (
        <div className="border-t border-border/40 px-3.5 py-3">{children}</div>
      ) : null}
    </section>
  );
}

export function EditJobSurface({
  focusSection,
  isStale = false,
  isRegenerating = false,
  onDone,
  onUpdateEstimate,
  jobPlan,
  projectConditions,
  details,
  advanced = null,
}: EditJobSurfaceProps) {
  const [manual, setManual] = useState<Partial<Record<EditJobSection, boolean>>>(
    {}
  );

  const toggle = (id: EditJobSection) => {
    setManual((prev) => ({
      ...prev,
      [id]: !sectionOpen(id, focusSection, prev),
    }));
  };

  return (
    <div
      className="space-y-3 overflow-x-hidden pb-[max(1rem,env(safe-area-inset-bottom))]"
      data-assistant-surface="edit_job"
      data-edit-job-focus={focusSection ?? "job_plan"}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Edit job
          </p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Change what you need. This is not a step-by-step interview. Job
            changes save as you go — Done returns to the estimate.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          className="h-11 min-h-11 shrink-0 px-4"
          data-edit-job-done
          data-edit-job-exit="done"
          onClick={onDone}
        >
          {ASSISTANT_ACTION_LABELS.done}
        </Button>
      </div>

      {isStale ? (
        <div
          className="rounded-xl border border-amber-300/80 bg-amber-50/80 px-3.5 py-3 dark:border-amber-800/60 dark:bg-amber-950/30"
          role="status"
          data-edit-job-stale="true"
        >
          <p className="text-sm font-medium text-amber-950 dark:text-amber-100">
            Estimate needs updating
          </p>
          <p className="mt-0.5 text-xs text-amber-900/90 dark:text-amber-200/90">
            Job changes are saved. Update the estimate when you are ready.
          </p>
          {onUpdateEstimate ? (
            <Button
              type="button"
              className="mt-3 h-11 w-full min-h-11 sm:w-auto"
              data-edit-job-update-estimate
              onClick={onUpdateEstimate}
              disabled={isRegenerating}
            >
              {isRegenerating
                ? ASSISTANT_ACTION_LABELS.updatingEstimate
                : ASSISTANT_ACTION_LABELS.updateEstimate}
            </Button>
          ) : null}
        </div>
      ) : null}

      <EditSection
        id="job_plan"
        title="Work Areas"
        hint="Scope, measurements, and materials"
        open={sectionOpen("job_plan", focusSection, manual)}
        onToggle={() => toggle("job_plan")}
      >
        {jobPlan}
      </EditSection>

      <EditSection
        id="project_conditions"
        title="Site & Project Conditions"
        hint="Access, site, and constraints"
        open={sectionOpen("project_conditions", focusSection, manual)}
        onToggle={() => toggle("project_conditions")}
      >
        {projectConditions}
      </EditSection>

      <EditSection
        id="details"
        title="Additional Details"
        hint="Finish level and other project inputs"
        open={sectionOpen("details", focusSection, manual)}
        onToggle={() => toggle("details")}
      >
        {details}
      </EditSection>

      {advanced ? (
        <EditSection
          id="advanced"
          title="Advanced"
          hint="Proposals and specialist inputs"
          open={sectionOpen("advanced", focusSection, manual)}
          onToggle={() => toggle("advanced")}
        >
          {advanced}
        </EditSection>
      ) : null}
    </div>
  );
}
