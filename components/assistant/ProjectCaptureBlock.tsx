"use client";

import { useEffect, useRef, useState } from "react";
import { SiteNotesCaptureCard } from "@/components/project-notes/SiteNotesCaptureCard";
import { AnalyseNotesSection } from "@/components/project-notes/AnalyseNotesSection";
import { AnalysisProgressBanner } from "@/components/assistant/AnalysisProgressBanner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ProjectNote } from "@/lib/project-notes/types";
import { analyseJobProgressLabel } from "@/lib/assistant/analyse-job-progress";

type ProjectCaptureBlockProps = {
  briefText: string;
  onBriefChange: (text: string) => void;
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
}: ProjectCaptureBlockProps) {
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
        className="space-y-3 rounded-xl border border-border/70 bg-card px-3 py-3.5 sm:px-4"
      >
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <Label
              id="project-brief-heading"
              htmlFor="project-brief"
              className="text-sm font-semibold text-foreground"
            >
              Tell Quotr about the job
            </Label>
            {briefIncluded ? (
              <span className="rounded-md border border-border/60 bg-background px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                Included in analysis
              </span>
            ) : null}
          </div>
          <p className="text-xs text-muted-foreground">
            Write it the way you would tell a leading hand — not a specification.
          </p>
        </div>
        <Textarea
          id="project-brief"
          value={briefText}
          onChange={(event) => onBriefChange(event.target.value)}
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
            <span className="sm:hidden">Site notes (optional)</span>
            <span className="hidden sm:inline">
              Site notes — optional extras
            </span>
          </h4>
          <p className="hidden text-xs text-muted-foreground sm:block">
            Extra measurements, access, or client requests. The job description
            above is the main place to tell Quotr about the work.
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
          {analyseError && !isAnalysing ? (
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
          <p className="text-xs text-muted-foreground">
            Quotr will identify the work involved and what it still needs to
            know.
          </p>
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
