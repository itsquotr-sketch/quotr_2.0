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
        className="space-y-3 rounded-lg border border-border/60 bg-muted/25 px-3 py-3 sm:px-4"
      >
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <Label
              id="project-brief-heading"
              htmlFor="project-brief"
              className="text-sm font-semibold text-foreground"
            >
              Project Brief — Job overview
            </Label>
            {briefIncluded ? (
              <span className="rounded-md border border-border/60 bg-background px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                Included in analysis
              </span>
            ) : null}
          </div>
          <p className="text-xs text-muted-foreground">
            Describe the overall job. Quotr uses this when analysing the
            project.
          </p>
        </div>
        <Textarea
          id="project-brief"
          value={briefText}
          onChange={(event) => onBriefChange(event.target.value)}
          placeholder="Describe the job… e.g. 3m wide by 6m long hardwood deck with stairs and a pergola"
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
            <span className="sm:hidden">Site notes</span>
            <span className="hidden sm:inline">
              Site Notes — Ongoing observations
            </span>
          </h4>
          <p className="hidden text-xs text-muted-foreground sm:block">
            Add individual measurements, access issues, client requests and site
            conditions as you inspect the job.
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
          <Button
            type="button"
            onClick={onAnalyse}
            disabled={disabled || isAnalysing}
            className="w-full sm:w-auto"
          >
            {isAnalysing ? "Analysing job…" : "Analyse job"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
