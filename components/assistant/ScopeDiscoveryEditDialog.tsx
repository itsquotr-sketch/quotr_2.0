"use client";

import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { SCOPE_CATALOGUE } from "@/lib/scopes/catalogue";
import type { SafeSuggestionView } from "@/lib/scope-discovery/application/types";

type ScopeDiscoveryEditDialogProps = {
  open: boolean;
  suggestion: SafeSuggestionView | null;
  isSaving?: boolean;
  error?: string | null;
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: {
    modifiedTitle: string;
    modifiedDescription: string | null;
    modifiedWorkAreaType: string;
  }) => Promise<void>;
};

type EditDraft = {
  title: string;
  description: string;
  workAreaType: string;
  sourceSuggestionId: string;
};

function buildDraft(suggestion: SafeSuggestionView): EditDraft {
  const supportedTypes = SCOPE_CATALOGUE.map((item) => item.type);
  const initialType = suggestion.proposedWorkAreaType ?? "";
  return {
    title: suggestion.proposedTitle,
    description: suggestion.proposedDescription ?? "",
    workAreaType: supportedTypes.includes(initialType)
      ? initialType
      : (supportedTypes[0] ?? ""),
    sourceSuggestionId: suggestion.suggestionId,
  };
}

export function ScopeDiscoveryEditDialog({
  open,
  suggestion,
  isSaving,
  error,
  onOpenChange,
  onSubmit,
}: ScopeDiscoveryEditDialogProps) {
  const baseline = useMemo(
    () => (suggestion ? buildDraft(suggestion) : null),
    [suggestion]
  );
  const [override, setOverride] = useState<EditDraft | null>(null);

  // When the target suggestion changes, drop local overrides so fields reset.
  const draft =
    baseline &&
    override &&
    override.sourceSuggestionId === baseline.sourceSuggestionId
      ? override
      : baseline;

  const updateDraft = (patch: Partial<EditDraft>) => {
    if (!baseline) return;
    setOverride({
      ...(override &&
      override.sourceSuggestionId === baseline.sourceSuggestionId
        ? override
        : baseline),
      ...patch,
      sourceSuggestionId: baseline.sourceSuggestionId,
    });
  };

  const canSubmit =
    Boolean(draft) &&
    draft!.title.trim().length > 0 &&
    draft!.workAreaType.length > 0 &&
    SCOPE_CATALOGUE.some((item) => item.type === draft!.workAreaType) &&
    !isSaving;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setOverride(null);
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit and add work area</DialogTitle>
          <DialogDescription>
            Adjust the title, type and description, then add one corrected work
            area. The original suggestion is kept for history.
          </DialogDescription>
        </DialogHeader>

        {suggestion ? (
          <p className="rounded-md border border-border/60 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
            Original proposal: {suggestion.proposedTitle}
            {suggestion.proposedWorkAreaType
              ? ` · ${suggestion.proposedWorkAreaType.replaceAll("_", " ")}`
              : ""}
          </p>
        ) : null}

        {draft ? (
          <div className="space-y-3">
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">
                Title
              </span>
              <Input
                value={draft.title}
                onChange={(event) =>
                  updateDraft({ title: event.target.value })
                }
                disabled={isSaving}
                maxLength={200}
                aria-required
              />
            </label>

            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">
                Work area type
              </span>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={draft.workAreaType}
                disabled={isSaving}
                onChange={(event) =>
                  updateDraft({ workAreaType: event.target.value })
                }
                aria-required
              >
                {SCOPE_CATALOGUE.map((item) => (
                  <option key={item.type} value={item.type}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">
                Description
              </span>
              <textarea
                className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={draft.description}
                disabled={isSaving}
                maxLength={2000}
                onChange={(event) =>
                  updateDraft({ description: event.target.value })
                }
              />
            </label>
          </div>
        ) : null}

        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="ghost"
            disabled={isSaving}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={!canSubmit || !draft}
            onClick={() => {
              if (!draft) return;
              void onSubmit({
                modifiedTitle: draft.title.trim(),
                modifiedDescription: draft.description.trim() || null,
                modifiedWorkAreaType: draft.workAreaType,
              });
            }}
          >
            {isSaving ? (
              <>
                <Loader2 className="mr-1.5 size-4 animate-spin" aria-hidden />
                Adding…
              </>
            ) : (
              "Add corrected work area"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
