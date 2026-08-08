"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  addManualScopeItemAction,
  decideManualScopeItemAction,
} from "@/lib/work-areas/scope-items/actions";
import type { ManualScopeItemView } from "@/lib/work-areas/scope-items/types";
import { SCOPE_DISCOVERY_UI_COPY } from "@/lib/scope-discovery/ui/labels";

export function ManualScopeItemRow({
  projectId,
  item,
  disabled,
  onChanged,
  /** When set, checkbox is local-only (Edit scope batch). */
  localIncluded,
  onLocalToggle,
}: {
  projectId: string;
  item: ManualScopeItemView;
  disabled?: boolean;
  onChanged?: (next: ManualScopeItemView) => void;
  localIncluded?: boolean;
  onLocalToggle?: (included: boolean) => void;
}) {
  const [pending, setPending] = useState(false);
  const controlled = typeof localIncluded === "boolean";
  const included = controlled ? localIncluded : item.state === "INCLUDED";

  return (
    <div className="border-b border-border/40 py-2.5 last:border-b-0">
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          className="mt-1 size-4 shrink-0 accent-[var(--brand-orange)]"
          checked={included}
          disabled={disabled || pending}
          aria-label={item.title}
          onChange={(e) => {
            const next = e.target.checked;
            if (controlled) {
              onLocalToggle?.(next);
              return;
            }
            setPending(true);
            void decideManualScopeItemAction({
              projectId,
              scopeItemId: item.id,
              intendedState: next ? "INCLUDED" : "NOT_REQUIRED",
            }).then((result) => {
              setPending(false);
              if (result.ok) {
                onChanged?.({ ...item, state: result.state });
              }
            });
          }}
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium leading-snug">{item.title}</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {SCOPE_DISCOVERY_UI_COPY.addedByYou}
            {included ? ` · ${SCOPE_DISCOVERY_UI_COPY.pricingRequired}` : ""}
          </p>
          {item.description ? (
            <p className="mt-0.5 text-xs text-muted-foreground">
              {item.description}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function AddManualScopeItemForm({
  projectId,
  workAreaId,
  workAreaName,
  disabled,
  onAdded,
}: {
  projectId: string;
  workAreaId: string;
  workAreaName: string;
  disabled?: boolean;
  onAdded: (item: ManualScopeItemView) => void;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="mt-1 h-8 px-2 text-xs"
        disabled={disabled}
        onClick={() => setOpen(true)}
      >
        + {SCOPE_DISCOVERY_UI_COPY.addScopeItem}
      </Button>
    );
  }

  return (
    <div className="mt-2 space-y-2 rounded-md border border-dashed border-border/70 bg-background/50 p-3">
      <p className="text-xs text-muted-foreground">
        Add under{" "}
        <span className="font-medium text-foreground">{workAreaName}</span>
      </p>
      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Scope item name"
        disabled={saving || disabled}
        maxLength={200}
      />
      <Textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Short description (optional)"
        rows={2}
        disabled={saving || disabled}
        maxLength={2000}
      />
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          disabled={saving || disabled || !title.trim()}
          onClick={() => {
            setSaving(true);
            setError(null);
            void addManualScopeItemAction({
              projectId,
              workAreaId,
              title,
              description: description.trim() || null,
            }).then((result) => {
              setSaving(false);
              if (!result.ok) {
                setError(result.message);
                return;
              }
              onAdded(result.item);
              setTitle("");
              setDescription("");
              setOpen(false);
            });
          }}
        >
          {saving ? "Saving…" : "Save"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={saving}
          onClick={() => {
            setOpen(false);
            setError(null);
          }}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
