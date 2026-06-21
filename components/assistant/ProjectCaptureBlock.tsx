"use client";

import { SiteNotesCaptureCard } from "@/components/project-notes/SiteNotesCaptureCard";
import { AnalyseNotesSection } from "@/components/project-notes/AnalyseNotesSection";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ProjectNote } from "@/lib/project-notes/types";

type ProjectCaptureBlockProps = {
  briefText: string;
  onBriefChange: (text: string) => void;
  projectId: string;
  initialNotes: ProjectNote[];
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
  onAnalyse,
  disabled,
  isAnalysing,
  submitted = false,
}: ProjectCaptureBlockProps) {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="project-brief">Project brief</Label>
        <Textarea
          id="project-brief"
          value={briefText}
          onChange={(event) => onBriefChange(event.target.value)}
          placeholder="Describe the job… e.g. 3m wide by 6m long hardwood deck with stairs and a pergola"
          rows={4}
          disabled={disabled || submitted}
          readOnly={submitted}
          className="min-h-24 text-base md:text-sm"
        />
      </div>

      <SiteNotesCaptureCard
        projectId={projectId}
        initialNotes={initialNotes}
        variant="compact"
      />

      {submitted ? (
        <AnalyseNotesSection projectId={projectId} notes={initialNotes} />
      ) : null}

      <div className="space-y-3 border-t pt-4">
        <p className="text-xs text-muted-foreground">
          {submitted
            ? "Brief and site notes are source material. Later notes can be analysed into proposed updates."
            : "Quotr will use the brief and saved site notes."}
        </p>
        {!submitted && onAnalyse ? (
          <Button
            type="button"
            onClick={onAnalyse}
            disabled={disabled || isAnalysing}
            className="w-full sm:w-auto"
          >
            {isAnalysing ? "Analysing job…" : "Analyse job"}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
