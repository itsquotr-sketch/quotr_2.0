"use client";

import { AssistantMessage } from "@/components/assistant/AssistantMessage";
import { AnalyseNotesSection } from "@/components/project-notes/AnalyseNotesSection";
import { SiteNotesCaptureCard } from "@/components/project-notes/SiteNotesCaptureCard";
import type { ProjectNote } from "@/lib/project-notes/types";

type SiteNotesPanelProps = {
  projectId: string;
  initialNotes: ProjectNote[];
  showAnalyseNotes?: boolean;
  className?: string;
  /** Render inner content only — parent supplies stage wrapper */
  contentOnly?: boolean;
};

export function SiteNotesPanel({
  projectId,
  initialNotes,
  showAnalyseNotes = false,
  className,
  contentOnly = false,
}: SiteNotesPanelProps) {
  const inner = (
    <div className="space-y-4">
      {showAnalyseNotes ? (
        <AnalyseNotesSection projectId={projectId} notes={initialNotes} />
      ) : null}

      <SiteNotesCaptureCard
        projectId={projectId}
        initialNotes={initialNotes}
        variant="full"
        showHeading={false}
      />
    </div>
  );

  if (contentOnly) {
    return <div className={className}>{inner}</div>;
  }

  return (
    <AssistantMessage
      title="Site notes"
      subtitle="Add notes as you inspect the job. Saved notes stay separate from the estimate until you analyse and apply them."
      status="submitted"
      className={className}
    >
      {inner}
    </AssistantMessage>
  );
}
