"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  generateWorkAreaQuoteDescriptionDraft,
  updateWorkAreaQuoteDescription,
} from "@/lib/work-areas/description-actions";

type WorkAreaQuoteDescriptionEditorProps = {
  projectId: string;
  workAreaId: string;
  workAreaName: string;
  initialDescription?: string | null;
  existingQuoteWarning?: boolean;
  onSaved?: (description: string | null) => void;
};

function previewText(description: string | null | undefined): string | null {
  const trimmed = description?.trim();
  return trimmed ? trimmed : null;
}

export function WorkAreaQuoteDescriptionEditor({
  projectId,
  workAreaId,
  workAreaName,
  initialDescription = null,
  existingQuoteWarning = false,
  onSaved,
}: WorkAreaQuoteDescriptionEditorProps) {
  const [savedDescription, setSavedDescription] = useState(
    initialDescription ?? ""
  );
  const [draft, setDraft] = useState(initialDescription ?? "");
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentPreview = previewText(savedDescription);

  async function handleGenerateDraft() {
    setError(null);
    setIsGenerating(true);

    const result = await generateWorkAreaQuoteDescriptionDraft({
      projectId,
      workAreaId,
    });

    setIsGenerating(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    if (result.draft) {
      setDraft(result.draft);
      setIsEditing(true);
    }
  }

  async function handleSave() {
    setError(null);
    setIsSaving(true);

    const result = await updateWorkAreaQuoteDescription({
      projectId,
      workAreaId,
      quoteDescription: draft,
    });

    setIsSaving(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    const nextDescription = result.quoteDescription ?? "";
    setSavedDescription(nextDescription);
    setDraft(nextDescription);
    setIsEditing(false);
    onSaved?.(result.quoteDescription ?? null);
  }

  return (
    <div className="mt-3 border-t border-border/50 pt-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Quote description
          </h4>
          {existingQuoteWarning ? (
            <p className="mt-1 text-[11px] leading-relaxed text-amber-800 dark:text-amber-300">
              Existing quotes will not update automatically. Revise the quote if
              this description should be reflected.
            </p>
          ) : null}
        </div>
        {!isEditing ? (
          <div className="flex shrink-0 gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              disabled={isGenerating}
              onClick={() => void handleGenerateDraft()}
            >
              {isGenerating ? "Generating…" : "Generate draft"}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => {
                setDraft(savedDescription);
                setIsEditing(true);
              }}
            >
              {currentPreview ? "Edit" : "Add"}
            </Button>
          </div>
        ) : null}
      </div>

      {error ? (
        <p className="mt-2 text-xs text-destructive">{error}</p>
      ) : null}

      {isEditing ? (
        <div className="mt-2 space-y-2">
          <Textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            rows={4}
            placeholder={`Add a client-facing description for ${workAreaName}.`}
          />
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              disabled={isSaving}
              onClick={() => void handleSave()}
            >
              {isSaving ? "Saving…" : "Save description"}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isGenerating}
              onClick={() => void handleGenerateDraft()}
            >
              {isGenerating ? "Generating…" : "Use suggested description"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={isSaving}
              onClick={() => {
                setDraft(savedDescription);
                setIsEditing(false);
                setError(null);
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : currentPreview ? (
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground break-words whitespace-pre-wrap">
          {currentPreview}
        </p>
      ) : (
        <p className="mt-2 text-xs text-muted-foreground italic">
          Add a client-facing description for this work area.
        </p>
      )}
    </div>
  );
}
