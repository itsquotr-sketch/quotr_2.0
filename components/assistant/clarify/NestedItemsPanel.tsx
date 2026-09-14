"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import type { NestedItemPanel } from "@/lib/assistant/clarify/types";
import {
  releaseSingleActivation,
  tryBeginSingleActivation,
} from "@/lib/assistant/refine/single-activation";
import { cn } from "@/lib/utils";

export function NestedItemsPanel({
  panel,
  isSaving = false,
  onAdd,
  onDuplicate,
  onDelete,
}: {
  panel: NestedItemPanel;
  isSaving?: boolean;
  onAdd: (workAreaId: string, key: string) => void | Promise<unknown>;
  onDuplicate: (workAreaId: string, key: string, itemId: string) => void;
  onDelete: (workAreaId: string, key: string, itemId: string) => void;
}) {
  const addLock = useRef(false);
  const [addPending, setAddPending] = useState(false);
  const addBusy = isSaving || addPending;

  return (
    <section
      className="space-y-3"
      data-nested-item-panel={panel.workAreaType}
      data-work-area-id={panel.workAreaId}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="mt-0.5 text-sm text-muted-foreground">
            {panel.items.length === 0
              ? `Add a ${panel.itemKindLabel.toLowerCase()} to describe this work.`
              : `${panel.items.length} ${panel.itemKindLabel}${panel.items.length === 1 ? "" : "s"}`}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          className="h-11 min-h-11 shrink-0 px-3"
          data-add-nested-item
          disabled={addBusy}
          onClick={() => {
            if (isSaving || !tryBeginSingleActivation(addLock)) return;
            setAddPending(true);
            void Promise.resolve(onAdd(panel.workAreaId, panel.addKey)).finally(
              () => {
                releaseSingleActivation(addLock);
                setAddPending(false);
              }
            );
          }}
        >
          {addBusy ? "Adding…" : `Add ${panel.itemKindLabel.toLowerCase()}`}
        </Button>
      </div>
      <div className="space-y-2">
        {panel.items.map((item) => (
          <article
            key={item.id}
            className={cn(
              "rounded-xl border px-3 py-3",
              item.specialistRequired
                ? "border-amber-300/80 bg-amber-50/80 dark:border-amber-800/60 dark:bg-amber-950/30"
                : item.complete
                ? "border-border bg-background"
                : "border-[var(--brand-orange)]/40 bg-[var(--brand-orange)]/5"
            )}
            data-nested-item-card={item.id}
            data-nested-item-complete={item.complete ? "true" : "false"}
            data-nested-item-specialist={
              item.specialistRequired ? "true" : "false"
            }
          >
            <p className="text-sm font-medium">{item.label}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {item.specialistRequired
                ? "Pricing required"
                : item.complete
                  ? "Complete"
                  : "Needs details"}
              {item.summary ? ` · ${item.summary}` : ""}
            </p>
            {!item.id.startsWith("legacy:") && !item.id.startsWith("draft:") ? (
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="h-10 min-h-10 px-3"
                  data-duplicate-nested-item={item.id}
                  onClick={() =>
                    onDuplicate(panel.workAreaId, panel.duplicateKey, item.id)
                  }
                >
                  Duplicate
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-10 min-h-10 px-3"
                  data-delete-nested-item={item.id}
                  onClick={() => {
                    if (
                      window.confirm(
                        `Remove ${item.label}? This cannot be undone.`
                      )
                    ) {
                      onDelete(panel.workAreaId, panel.deleteKey, item.id);
                    }
                  }}
                >
                  Delete
                </Button>
              </div>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}
