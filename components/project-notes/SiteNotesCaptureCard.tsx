"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { SiteNoteCard } from "@/components/project-notes/SiteNoteCard";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  createProjectNote,
  deleteProjectNote,
  updateProjectNote,
} from "@/lib/project-notes/actions";
import {
  PROJECT_NOTE_TYPE_LABELS,
  PROJECT_NOTE_TYPE_OPTIONS,
  type ProjectNote,
  type ProjectNoteType,
} from "@/lib/project-notes/types";
import { cn } from "@/lib/utils";

const COMPACT_NOTE_LIMIT = 3;

type SiteNotesCaptureCardProps = {
  projectId: string;
  initialNotes: ProjectNote[];
  variant?: "compact" | "full";
  showHeading?: boolean;
};

export function SiteNotesCaptureCard({
  projectId,
  initialNotes,
  variant = "compact",
  showHeading = true,
}: SiteNotesCaptureCardProps) {
  const router = useRouter();
  const [content, setContent] = useState("");
  const [noteType, setNoteType] = useState<ProjectNoteType>("general");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [savingNoteId, setSavingNoteId] = useState<string | null>(null);
  const [deletingNoteId, setDeletingNoteId] = useState<string | null>(null);
  const [showAllNotes, setShowAllNotes] = useState(false);

  const isCompact = variant === "compact";
  const visibleNotes =
    isCompact && !showAllNotes
      ? initialNotes.slice(0, COMPACT_NOTE_LIMIT)
      : initialNotes;
  const hiddenCount = initialNotes.length - COMPACT_NOTE_LIMIT;

  async function handleCreateNote() {
    const trimmed = content.trim();
    if (!trimmed) {
      setSaveError("Add a note before saving.");
      return;
    }

    setSaveError(null);
    setIsSaving(true);

    const result = await createProjectNote({
      projectId,
      content: trimmed,
      noteType,
      source: "site_walk",
    });

    setIsSaving(false);

    if ("error" in result) {
      setSaveError(result.error);
      return;
    }

    setContent("");
    setNoteType("general");
    router.refresh();
  }

  async function handleUpdateNote(input: {
    noteId: string;
    content: string;
    noteType: ProjectNoteType;
  }) {
    setSavingNoteId(input.noteId);

    const result = await updateProjectNote({
      noteId: input.noteId,
      projectId,
      content: input.content,
      noteType: input.noteType,
    });

    setSavingNoteId(null);

    if ("error" in result) {
      throw new Error(result.error);
    }

    router.refresh();
  }

  async function handleDeleteNote(noteId: string) {
    setDeletingNoteId(noteId);

    const result = await deleteProjectNote({ noteId, projectId });

    setDeletingNoteId(null);

    if ("error" in result) {
      setSaveError(result.error);
      return;
    }

    router.refresh();
  }

  return (
    <div className="space-y-4">
      {showHeading ? (
        <div className="space-y-1">
          <h3 className="text-sm font-medium">Site notes</h3>
          <p className="text-xs text-muted-foreground">
            Add details as you inspect the job. Notes can include measurements,
            access, existing conditions or client requests.
          </p>
        </div>
      ) : null}

      <div
        className={cn(
          "space-y-3 rounded-xl border border-dashed bg-muted/20 p-4",
          isCompact && "p-3"
        )}
      >
        <div className="space-y-2">
          <Label htmlFor={`site-note-type-${projectId}`}>Note type</Label>
          <div className="flex flex-wrap gap-1.5">
            {PROJECT_NOTE_TYPE_OPTIONS.map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setNoteType(type)}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-xs transition-colors",
                  noteType === type
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-transparent bg-muted/60 text-muted-foreground hover:bg-muted"
                )}
              >
                {PROJECT_NOTE_TYPE_LABELS[type]}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor={`site-note-content-${projectId}`}>Note</Label>
          <Textarea
            id={`site-note-content-${projectId}`}
            value={content}
            onChange={(event) => setContent(event.target.value)}
            placeholder="Capture measurements, client comments, access issues…"
            rows={isCompact ? 3 : 4}
            className={cn(
              "text-base md:text-sm",
              isCompact ? "min-h-20" : "min-h-28"
            )}
          />
        </div>

        {saveError ? (
          <p className="text-sm text-destructive" role="alert">
            {saveError}
          </p>
        ) : null}

        <Button
          type="button"
          onClick={handleCreateNote}
          disabled={isSaving}
          size={isCompact ? "sm" : "default"}
          className="w-full sm:w-auto"
        >
          {isSaving ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Saving note…
            </>
          ) : (
            "Save note"
          )}
        </Button>
      </div>

      {initialNotes.length === 0 ? (
        isCompact ? (
          <p className="text-xs text-muted-foreground">
            No site notes yet. Add measurements or observations above.
          </p>
        ) : (
          <div className="rounded-xl border border-dashed bg-muted/10 px-4 py-8 text-center">
            <p className="text-sm font-medium">No site notes yet.</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Add measurements, client comments, access issues or reminders as
              you inspect the job.
            </p>
          </div>
        )
      ) : (
        <div className="space-y-3">
          <ul className="space-y-2">
            {visibleNotes.map((note) => (
              <li key={note.id}>
                <SiteNoteCard
                  note={note}
                  isSaving={savingNoteId === note.id}
                  isDeleting={deletingNoteId === note.id}
                  onSave={handleUpdateNote}
                  onDelete={handleDeleteNote}
                />
              </li>
            ))}
          </ul>
          {isCompact && hiddenCount > 0 && !showAllNotes ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 text-xs text-muted-foreground"
              onClick={() => setShowAllNotes(true)}
            >
              View all {initialNotes.length} notes
            </Button>
          ) : null}
        </div>
      )}
    </div>
  );
}
