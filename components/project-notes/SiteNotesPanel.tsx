"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AssistantMessage } from "@/components/assistant/AssistantMessage";
import { SiteNotesCaptureCard } from "@/components/project-notes/SiteNotesCaptureCard";
import { analyseProjectNotes } from "@/lib/project-notes/proposals/actions";
import type { ProjectNote } from "@/lib/project-notes/types";
import { Button } from "@/components/ui/button";

type SiteNotesPanelProps = {
  projectId: string;
  initialNotes: ProjectNote[];
  showAnalyseNotes?: boolean;
  className?: string;
};

export function SiteNotesPanel({
  projectId,
  initialNotes,
  showAnalyseNotes = false,
  className,
}: SiteNotesPanelProps) {
  const router = useRouter();
  const [isAnalysing, setIsAnalysing] = useState(false);
  const [analyseError, setAnalyseError] = useState<string | null>(null);

  const pendingNoteCount = initialNotes.filter(
    (note) => note.analysisStatus === "pending"
  ).length;

  async function handleAnalyseNotes() {
    setAnalyseError(null);
    setIsAnalysing(true);

    const result = await analyseProjectNotes({ projectId });

    setIsAnalysing(false);

    if ("error" in result) {
      setAnalyseError(result.error);
      return;
    }

    router.refresh();
  }

  return (
    <AssistantMessage
      title="Site notes"
      subtitle="Add notes as you inspect the job. Saved notes stay separate from the estimate until you analyse and apply them."
      status="submitted"
      className={className}
    >
      <div className="space-y-4">
        {showAnalyseNotes ? (
          <div className="space-y-2 rounded-xl border border-dashed bg-muted/10 p-4">
            <p className="text-xs text-muted-foreground">
              Quotr will look for new measurements, scope changes, access issues
              and client requests. You choose what to apply.
            </p>
            {pendingNoteCount === 0 ? (
              <p className="text-xs text-muted-foreground">
                No new notes to analyse.
              </p>
            ) : (
              <Button
                type="button"
                size="sm"
                onClick={handleAnalyseNotes}
                disabled={isAnalysing || pendingNoteCount === 0}
              >
                {isAnalysing ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Analysing notes…
                  </>
                ) : (
                  "Analyse notes"
                )}
              </Button>
            )}
            {analyseError ? (
              <p className="text-sm text-destructive" role="alert">
                {analyseError}
              </p>
            ) : null}
          </div>
        ) : null}

        <SiteNotesCaptureCard
          projectId={projectId}
          initialNotes={initialNotes}
          variant="full"
          showHeading={false}
        />
      </div>
    </AssistantMessage>
  );
}
