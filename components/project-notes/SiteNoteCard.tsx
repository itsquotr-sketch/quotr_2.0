"use client";

import { Loader2, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  PROJECT_NOTE_TYPE_LABELS,
  PROJECT_NOTE_TYPE_OPTIONS,
  type ProjectNote,
  type ProjectNoteType,
} from "@/lib/project-notes/types";
import { cn } from "@/lib/utils";

type SiteNoteCardProps = {
  note: ProjectNote;
  isDeleting?: boolean;
  isSaving?: boolean;
  onSave: (input: {
    noteId: string;
    content: string;
    noteType: ProjectNoteType;
  }) => Promise<void>;
  onDelete: (noteId: string) => Promise<void>;
};

function formatCapturedAt(value: string) {
  return new Intl.DateTimeFormat("en-AU", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function SiteNoteCard({
  note,
  isDeleting,
  isSaving,
  onSave,
  onDelete,
}: SiteNoteCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [content, setContent] = useState(note.content);
  const [noteType, setNoteType] = useState<ProjectNoteType>(note.noteType);
  const [editError, setEditError] = useState<string | null>(null);

  function handleCancelEdit() {
    setContent(note.content);
    setNoteType(note.noteType);
    setEditError(null);
    setIsEditing(false);
  }

  async function handleSaveEdit() {
    if (!content.trim()) {
      setEditError("Add a note before saving.");
      return;
    }

    setEditError(null);
    try {
      await onSave({
        noteId: note.id,
        content: content.trim(),
        noteType,
      });
      setIsEditing(false);
    } catch {
      setEditError("Could not save note. Please try again.");
    }
  }

  async function handleConfirmDelete() {
    await onDelete(note.id);
    setDeleteOpen(false);
  }

  return (
    <>
      <article
        className={cn(
          "rounded-xl border bg-card/50 p-4",
          isEditing && "ring-1 ring-primary/15"
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="text-[11px] font-normal">
                {isEditing
                  ? PROJECT_NOTE_TYPE_LABELS[noteType]
                  : note.noteTypeLabel}
              </Badge>
              {!isEditing && note.analysisStatus === "analysed" ? (
                <Badge
                  variant="outline"
                  className="text-[10px] font-normal text-muted-foreground"
                >
                  Analysed
                </Badge>
              ) : !isEditing && note.analysisStatus === "pending" ? (
                <Badge
                  variant="outline"
                  className="text-[10px] font-normal text-muted-foreground"
                >
                  Not analysed
                </Badge>
              ) : null}
              {!isEditing && note.source !== "site_walk" ? (
                <span className="text-[11px] text-muted-foreground">
                  {note.sourceLabel}
                </span>
              ) : null}
            </div>
            <p className="text-[11px] text-muted-foreground">
              {formatCapturedAt(note.capturedAt)}
            </p>
          </div>

          {!isEditing ? (
            <div className="flex shrink-0 items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Edit note"
                onClick={() => setIsEditing(true)}
                disabled={isDeleting || isSaving}
              >
                <Pencil className="size-3.5" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Delete note"
                onClick={() => setDeleteOpen(true)}
                disabled={isDeleting || isSaving}
              >
                {isDeleting ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Trash2 className="size-3.5" />
                )}
              </Button>
            </div>
          ) : null}
        </div>

        {isEditing ? (
          <div className="mt-3 space-y-3">
            <div className="space-y-2">
              <Label htmlFor={`note-type-${note.id}`}>Note type</Label>
              <select
                id={`note-type-${note.id}`}
                value={noteType}
                onChange={(event) =>
                  setNoteType(event.target.value as ProjectNoteType)
                }
                className="flex h-9 w-full rounded-xl border border-transparent bg-input/50 px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
              >
                {PROJECT_NOTE_TYPE_OPTIONS.map((type) => (
                  <option key={type} value={type}>
                    {PROJECT_NOTE_TYPE_LABELS[type]}
                  </option>
                ))}
              </select>
            </div>
            <Textarea
              value={content}
              onChange={(event) => setContent(event.target.value)}
              rows={4}
              className="min-h-24"
            />
            {editError ? (
              <p className="text-sm text-destructive" role="alert">
                {editError}
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                onClick={handleSaveEdit}
                disabled={isSaving}
              >
                {isSaving ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" />
                    Saving…
                  </>
                ) : (
                  "Save changes"
                )}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleCancelEdit}
                disabled={isSaving}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed">
            {note.content}
          </p>
        )}
      </article>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Delete note?</DialogTitle>
            <DialogDescription>
              Delete this note? This will remove it from the project notes list.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteOpen(false)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleConfirmDelete}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  Deleting…
                </>
              ) : (
                "Delete note"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
