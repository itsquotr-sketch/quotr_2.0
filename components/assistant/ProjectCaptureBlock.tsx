"use client";

import { useEffect, useRef, useState } from "react";
import { AddWorkAreaDialog } from "@/components/assistant/AddWorkAreaDialog";
import type { WorkArea } from "@/components/assistant/types";
import { SiteNotesCaptureCard } from "@/components/project-notes/SiteNotesCaptureCard";
import { ProjectDocumentsSection } from "@/components/projects/information/ProjectDocumentsSection";
import { AnalyseNotesSection } from "@/components/project-notes/AnalyseNotesSection";
import { AnalysisProgressBanner } from "@/components/assistant/AnalysisProgressBanner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ProjectNote } from "@/lib/project-notes/types";
import type { ProjectDocumentCentreModel } from "@/lib/projects/document-model";
import { analyseJobProgressLabel } from "@/lib/assistant/analyse-job-progress";
import { NO_WORK_AREAS_ERROR } from "@/lib/ai/analyse-job-contract";
import {
  ANALYSE_JOB_ROLE,
  MANUAL_CONTINUE_ROLE,
} from "@/lib/work-areas/manual-pricing-route";
import {
  ManualPricingNotice,
  ManualPricingScopeForm,
} from "@/components/assistant/ManualPricingNotice";

type ProjectCaptureBlockProps = {
  briefText: string;
  onBriefChange: (text: string) => void;
  onBriefPersist?: (text: string) => void;
  projectId: string;
  initialNotes: ProjectNote[];
  totalNoteCount?: number;
  pendingAnalysisCount?: number;
  onAnalyse?: () => void;
  disabled?: boolean;
  isAnalysing?: boolean;
  /** After initial analysis — view/edit notes only, no Analyse Job */
  submitted?: boolean;
  analyseError?: string | null;
  onRetryAnalyse?: () => void;
  documents?: ProjectDocumentCentreModel | null;
  canUploadFiles?: boolean;
  workAreas?: WorkArea[];
  onAddWorkArea?: (
    workAreaType: string
  ) => Promise<{ success: boolean; error?: string }>;
  isAddingWorkArea?: boolean;
  addWorkAreaError?: string | null;
  canEditProject?: boolean;
  onContinueManual?: (input: {
    name: string;
    scopeDescription: string;
  }) => Promise<{ success: boolean; error?: string }>;
};

export function buildProjectCaptureSummary(
  briefText: string,
  noteCount: number
): string {
  const briefPart = briefText.trim()
    ? briefText.trim().replace(/\s+/g, " ")
    : "No written brief";
  const truncated =
    briefPart.length > 48 ? `${briefPart.slice(0, 48).trim()}…` : briefPart;
  const notesPart = `${noteCount} site note${noteCount === 1 ? "" : "s"} included`;
  return `${truncated} · ${notesPart}`;
}

export function ProjectCaptureBlock({
  briefText,
  onBriefChange,
  onBriefPersist,
  projectId,
  initialNotes,
  totalNoteCount,
  pendingAnalysisCount = 0,
  onAnalyse,
  disabled,
  isAnalysing,
  submitted = false,
  analyseError = null,
  onRetryAnalyse,
  documents = null,
  canUploadFiles = false,
  workAreas = [],
  onAddWorkArea,
  isAddingWorkArea = false,
  addWorkAreaError = null,
  canEditProject = false,
  onContinueManual,
}: ProjectCaptureBlockProps) {
  const [addWorkAreaOpen, setAddWorkAreaOpen] = useState(false);
  const manualRecovery = analyseError === NO_WORK_AREAS_ERROR;
  const briefIncluded = briefText.trim().length > 0;
  const [progressElapsedMs, setProgressElapsedMs] = useState(0);
  const analyseStartedAt = useRef<number | null>(null);

  useEffect(() => {
    if (!isAnalysing) {
      analyseStartedAt.current = null;
      return;
    }
    analyseStartedAt.current = Date.now();
    const timer = window.setInterval(() => {
      const started = analyseStartedAt.current ?? Date.now();
      setProgressElapsedMs(Date.now() - started);
    }, 400);
    return () => window.clearInterval(timer);
  }, [isAnalysing]);

  const progressLabel = isAnalysing
    ? analyseJobProgressLabel(progressElapsedMs)
    : "";

  return (
    <div className="space-y-4">
      <section
        aria-labelledby="project-brief-heading"
        className="space-y-3 rounded-xl border border-border/60 bg-card px-3 py-3.5 sm:px-4"
      >
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <Label
              id="project-brief-heading"
              htmlFor="project-brief"
              className="text-sm font-semibold text-foreground"
            >
              Job description
            </Label>
            {briefIncluded ? (
              <span className="rounded-md border border-border/60 bg-background px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                Included in analysis
              </span>
            ) : null}
          </div>
          <p className="text-xs text-muted-foreground">
            Describe the work the client wants.
          </p>
        </div>
        <Textarea
          id="project-brief"
          value={briefText}
          onChange={(event) => onBriefChange(event.target.value)}
          onBlur={(event) => {
            if (disabled || submitted) return;
            onBriefPersist?.(event.target.value);
          }}
          placeholder="e.g. Replace existing 6 × 3m deck. About 1m high. Kwila decking. Access down side of house."
          rows={4}
          disabled={disabled || submitted}
          readOnly={submitted}
          className="min-h-24 bg-background text-base md:text-sm"
        />
      </section>

      <section
        aria-labelledby="site-notes-heading"
        className="space-y-2 sm:space-y-3 sm:rounded-lg sm:border sm:border-border/60 sm:bg-background sm:px-4 sm:py-3"
        data-site-notes-section
      >
        <div className="space-y-1">
          <h4
            id="site-notes-heading"
            className="text-sm font-semibold text-foreground"
          >
            Site notes
          </h4>
          <p className="text-xs text-muted-foreground">
            Add measurements, access details or existing conditions.
          </p>
        </div>
        <div
          className="sm:rounded-md sm:border sm:border-dashed sm:border-border/70 sm:bg-muted/10 sm:px-3 sm:py-2.5"
          data-site-notes-nesting="responsive"
        >
          <SiteNotesCaptureCard
            projectId={projectId}
            initialNotes={initialNotes}
            totalNoteCount={totalNoteCount}
            variant="compact"
            showHeading={false}
          />
        </div>
      </section>

      {documents ? (
        <ProjectDocumentsSection
          projectId={projectId}
          centre={documents}
          variant="capture"
          canUpload={canUploadFiles}
        />
      ) : null}

      {submitted ? (
        <AnalyseNotesSection
          projectId={projectId}
          pendingAnalysisCount={pendingAnalysisCount}
        />
      ) : null}

      {!submitted && onAnalyse ? (
        <div className="space-y-3 pt-1">
          {isAnalysing ? (
            <AnalysisProgressBanner label={progressLabel} />
          ) : null}
          {analyseError && !isAnalysing && !manualRecovery ? (
            <div
              className="space-y-2 rounded-xl border border-destructive/30 bg-destructive/5 px-3.5 py-3"
              role="alert"
              data-analyse-error
            >
              <p className="text-sm text-destructive">{analyseError}</p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  type="button"
                  className="h-11 min-h-11 w-full sm:w-auto"
                  data-analyse-retry
                  onClick={onRetryAnalyse ?? onAnalyse}
                  disabled={disabled}
                >
                  Try again
                </Button>
                <p className="self-center text-xs text-muted-foreground">
                  Your job details are still here.
                </p>
              </div>
            </div>
          ) : null}
          {manualRecovery && !isAnalysing ? (
            <div
              className="space-y-3 rounded-xl border border-border/60 bg-card px-3.5 py-3"
              data-manual-work-area-recovery="true"
            >
              {canEditProject && onContinueManual ? (
                <ManualPricingScopeForm
                  initialScope={briefText}
                  disabled={disabled}
                  isSaving={isAddingWorkArea}
                  error={addWorkAreaError}
                  submitHint={MANUAL_CONTINUE_ROLE}
                  onContinue={onContinueManual}
                />
              ) : (
                <>
                  <ManualPricingNotice />
                  <p className="text-sm text-muted-foreground">
                    You can read this job. Editing and pricing need project access.
                  </p>
                </>
              )}
              {canEditProject && onAddWorkArea ? (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 min-h-11 w-full sm:w-auto"
                    onClick={() => setAddWorkAreaOpen(true)}
                    disabled={disabled || isAddingWorkArea}
                  >
                    Add a supported work area
                  </Button>
                  <AddWorkAreaDialog
                    open={addWorkAreaOpen}
                    onOpenChange={setAddWorkAreaOpen}
                    workAreas={workAreas}
                    isSaving={isAddingWorkArea}
                    error={addWorkAreaError}
                    showManualPricing={false}
                    onAdd={async (workAreaType) => {
                      const out = await onAddWorkArea(workAreaType);
                      if (out.success) setAddWorkAreaOpen(false);
                    }}
                  />
                </>
              ) : null}
            </div>
          ) : null}
          {manualRecovery && !isAnalysing ? (
            <p className="text-xs leading-5 text-muted-foreground" data-analyse-job-role>
              {ANALYSE_JOB_ROLE}
            </p>
          ) : null}
          <Button
            type="button"
            onClick={onAnalyse}
            disabled={disabled || isAnalysing}
            className="h-11 min-h-11 w-full sm:w-auto"
          >
            {isAnalysing ? "Analysing job…" : "Analyse job"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
