"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { analyseProjectNotes } from "@/lib/project-notes/proposals/actions";
import { Button } from "@/components/ui/button";

type AnalyseNotesSectionProps = {
  projectId: string;
  pendingAnalysisCount: number;
};

export function AnalyseNotesSection({
  projectId,
  pendingAnalysisCount,
}: AnalyseNotesSectionProps) {
  const router = useRouter();
  const [isAnalysing, setIsAnalysing] = useState(false);
  const [analyseError, setAnalyseError] = useState<string | null>(null);

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
    <div className="space-y-2 rounded-xl border border-dashed bg-muted/10 p-4">
      <p className="text-xs text-muted-foreground">
        Quotr will look for measurements, scope changes, access issues and
        client requests. You choose what to apply.
      </p>
      {pendingAnalysisCount === 0 ? (
        <p className="text-xs text-muted-foreground">No new notes to analyse.</p>
      ) : (
        <Button
          type="button"
          size="sm"
          onClick={handleAnalyseNotes}
          disabled={isAnalysing || pendingAnalysisCount === 0}
        >
          {isAnalysing ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Analysing notes…
            </>
          ) : (
            `Analyse ${pendingAnalysisCount} note${pendingAnalysisCount === 1 ? "" : "s"}`
          )}
        </Button>
      )}
      {analyseError ? (
        <p className="text-sm text-destructive" role="alert">
          {analyseError}
        </p>
      ) : null}
    </div>
  );
}
