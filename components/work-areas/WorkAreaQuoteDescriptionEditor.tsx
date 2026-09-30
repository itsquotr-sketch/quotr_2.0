"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  generateWorkAreaQuoteDescriptionDraft,
  updateWorkAreaQuoteDescription,
} from "@/lib/work-areas/description-actions";
import { cn } from "@/lib/utils";

type WorkAreaQuoteDescriptionEditorProps = {
  projectId: string;
  workAreaId: string;
  workAreaName: string;
  initialDescription?: string | null;
  existingQuoteWarning?: boolean;
  onSaved?: (description: string | null) => void;
  /**
   * compact — Estimate Review summary surface: primary Add / Use suggested / Edit
   * actions are immediately discoverable (not behind Review details).
   */
  variant?: "default" | "compact";
  className?: string;
};

function previewText(description: string | null | undefined): string | null {
  const trimmed = description?.trim();
  return trimmed ? trimmed : null;
}

function concisePreview(text: string, max = 140): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max).trim()}…`;
}

export function WorkAreaQuoteDescriptionEditor({
  projectId,
  workAreaId,
  workAreaName,
  initialDescription = null,
  existingQuoteWarning = false,
  onSaved,
  variant = "default",
  className,
}: WorkAreaQuoteDescriptionEditorProps) {
  const [savedDescription, setSavedDescription] = useState(
    initialDescription ?? ""
  );
  const [draft, setDraft] = useState(initialDescription ?? "");
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const currentPreview = previewText(savedDescription);
  const isCompact = variant === "compact";

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      const len = textareaRef.current.value.length;
      textareaRef.current.setSelectionRange(len, len);
    }
  }, [isEditing]);

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

  function openManualEditor() {
    setDraft(savedDescription);
    setIsEditing(true);
    setError(null);
  }

  if (isCompact) {
    return (
      <div className={cn("space-y-2", className)}>
        <div className="flex min-w-0 items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Client description
            </p>
            {!isEditing ? (
              currentPreview ? (
                <p className="mt-0.5 text-xs font-medium leading-relaxed break-words">
                  {concisePreview(currentPreview)}
                </p>
              ) : (
                <p className="mt-0.5 text-xs font-medium text-muted-foreground">
                  Not added
                </p>
              )
            ) : null}
          </div>
          {!isEditing ? (
            <div className="flex shrink-0 flex-wrap justify-end gap-1">
              {currentPreview ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={openManualEditor}
                >
                  Edit
                </Button>
              ) : (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={openManualEditor}
                  >
                    Add description
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    disabled={isGenerating}
                    onClick={() => void handleGenerateDraft()}
                  >
                    {isGenerating ? "Generating…" : "Use suggested"}
                  </Button>
                </>
              )}
            </div>
          ) : null}
        </div>

        {error ? (
          <p className="text-xs text-destructive">{error}</p>
        ) : null}

        {isEditing ? (
          <div className="space-y-2">
            <Textarea
              ref={textareaRef}
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
                {isSaving ? "Saving…" : "Save"}
              </Button>
              {!currentPreview ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isGenerating}
                  onClick={() => void handleGenerateDraft()}
                >
                  {isGenerating ? "Generating…" : "Use suggested"}
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isGenerating}
                  onClick={() => void handleGenerateDraft()}
                >
                  {isGenerating ? "Generating…" : "Regenerate draft"}
                </Button>
              )}
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
            <p className="text-[11px] text-muted-foreground">
              Suggested text stays a draft until you save. Your saved description
              is authoritative.
            </p>
          </div>
        ) : null}

        {existingQuoteWarning ? (
          <p className="text-[11px] leading-relaxed text-amber-800 dark:text-amber-300">
            Existing quotes will not update automatically. Revise the quote if
            this description should be reflected.
          </p>
        ) : null}
      </div>
    );
  }

  const descriptionActions = !isEditing ? (
    <div className="order-3 flex flex-wrap gap-2 lg:order-2 lg:justify-end">
      <Button
        type="button"
        variant="outline"
        className="min-h-11"
        disabled={isGenerating}
        onClick={() => void handleGenerateDraft()}
      >
        {isGenerating ? "Generating…" : "Use suggested description"}
      </Button>
      <Button
        type="button"
        variant="outline"
        className="min-h-11"
        onClick={openManualEditor}
      >
        {currentPreview ? "Edit description" : "Add description"}
      </Button>
    </div>
  ) : null;

  return (
    <div className={cn("mt-3 border-t border-border/50 pt-3", className)} data-pricing-client-description>
      <div className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start lg:gap-x-4">
        <div className="order-1 min-w-0">
          <h4 className="text-sm font-medium">Client description</h4>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Shown on the client quote for this work area. A suggestion is saved only when you choose it.
          </p>
          {existingQuoteWarning ? (
            <p className="mt-1 text-xs leading-relaxed text-amber-800 dark:text-amber-300">
              Existing quotes will not update automatically. Revise the quote if
              this description should be reflected.
            </p>
          ) : null}
        </div>
        {descriptionActions}
        {error ? (
          <p className="order-2 text-xs text-destructive lg:col-span-2" role="alert">
            {error}
          </p>
        ) : null}
        {!isEditing ? (
          currentPreview ? (
            <p className="order-2 text-sm leading-5 break-words whitespace-pre-wrap lg:col-span-2">
              {currentPreview}
            </p>
          ) : (
            <p className="order-2 text-sm text-muted-foreground lg:col-span-2">
              No client description yet.
            </p>
          )
        ) : null}
      </div>

      {isEditing ? (
        <div className="mt-2 space-y-2">
          <Textarea
            ref={textareaRef}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            rows={4}
            placeholder={`Add a client-facing description for ${workAreaName}.`}
          />
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              className="min-h-11"
              disabled={isSaving}
              onClick={() => void handleSave()}
            >
              {isSaving ? "Saving…" : "Save description"}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              disabled={isGenerating}
              onClick={() => void handleGenerateDraft()}
            >
              {isGenerating ? "Generating…" : "Use suggested description"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="min-h-11"
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
          <p className="text-xs text-muted-foreground">
            Suggested text stays a draft until you save. Your saved description
            is authoritative.
          </p>
        </div>
      ) : null}
    </div>
  );
}
