"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import type { CeilingsRefinePanel } from "@/lib/assistant/refine/types";
import {
  releaseSingleActivation,
  tryBeginSingleActivation,
} from "@/lib/assistant/refine/single-activation";
import { PREMIUM } from "@/lib/ui/premium";
import { cn } from "@/lib/utils";

export function CeilingsPortionsPanel({
  panel,
  isSaving = false,
  onAdd,
  onDuplicate,
  onDelete,
  onSelect,
  onAddBulkhead,
  onDeleteBulkhead,
}: {
  panel: CeilingsRefinePanel;
  isSaving?: boolean;
  onAdd: (workAreaId: string) => void | Promise<unknown>;
  onDuplicate: (workAreaId: string, portionId: string) => void;
  onDelete: (workAreaId: string, portionId: string) => void;
  onSelect: (workAreaId: string, portionId: string) => void;
  onAddBulkhead?: (workAreaId: string, portionId: string, bulkheadId: string) => void | Promise<unknown>;
  onDeleteBulkhead?: (workAreaId: string, portionId: string, bulkheadId: string) => void;
}) {
  const addLock = useRef(false);
  const addBhLock = useRef(false);
  const [addPending, setAddPending] = useState(false);
  const [addBhPending, setAddBhPending] = useState(false);
  const addBusy = isSaving || addPending;
  const bhBusy = isSaving || addBhPending;

  return (
    <section className="space-y-3" data-ceilings-portions data-work-area-id={panel.workAreaId}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className={PREMIUM.sectionTitle}>{panel.workAreaName}</p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {panel.portions.length === 0
              ? "Add a ceiling portion to describe this work."
              : `${panel.portions.length} ceiling portion${panel.portions.length === 1 ? "" : "s"}`}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          className="h-11 min-h-11 shrink-0 px-3"
          data-add-ceiling-portion
          disabled={addBusy}
          onClick={() => {
            if (isSaving || !tryBeginSingleActivation(addLock)) return;
            setAddPending(true);
            void Promise.resolve(onAdd(panel.workAreaId)).finally(() => {
              releaseSingleActivation(addLock);
              setAddPending(false);
            });
          }}
        >
          {addBusy ? "Adding…" : "Add ceiling"}
        </Button>
      </div>
      <div className="space-y-2">
        {panel.portions.map((portion) => {
          const selected = portion.id === panel.activeId;
          return (
            <article
              key={portion.id}
              className={cn(
                "rounded-xl border px-3 py-3",
                selected
                  ? "border-[var(--brand-orange)]/50 bg-[var(--brand-orange)]/5"
                  : "border-border bg-background"
              )}
              data-ceiling-portion-card={portion.id}
            >
              <button
                type="button"
                className="min-h-11 w-full text-left"
                onClick={() => onSelect(panel.workAreaId, portion.id)}
              >
                <p className="text-sm font-medium">{portion.displayName}</p>
                {portion.summary ? (
                  <p className="mt-1 text-sm text-muted-foreground">{portion.summary}</p>
                ) : null}
              </button>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="h-10 min-h-10 px-3"
                  onClick={() => onDuplicate(panel.workAreaId, portion.id)}
                >
                  Duplicate
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-10 min-h-10 px-3"
                  onClick={() => {
                    if (window.confirm(`Remove ${portion.displayName}?`)) {
                      onDelete(panel.workAreaId, portion.id);
                    }
                  }}
                >
                  Delete
                </Button>
              </div>
              {selected ? (
                <div className="mt-3 space-y-2">
                  {portion.bulkheads.map((bh) => (
                    <div
                      key={bh.id}
                      className="rounded-lg border border-border/70 px-3 py-2"
                      data-ceiling-bulkhead-card={bh.id}
                    >
                      <p className="text-sm">{bh.displayName}</p>
                      {bh.summary ? (
                        <p className="text-xs text-muted-foreground">{bh.summary}</p>
                      ) : null}
                      <Button
                        type="button"
                        variant="outline"
                        className="mt-2 h-10 min-h-10 px-3"
                        onClick={() => {
                          if (window.confirm("Remove this bulkhead?")) {
                            onDeleteBulkhead?.(panel.workAreaId, portion.id, bh.id);
                          }
                        }}
                      >
                        Delete bulkhead
                      </Button>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    className="h-10 min-h-10 w-full px-3 sm:w-auto"
                    disabled={bhBusy}
                    onClick={() => {
                      if (isSaving || !tryBeginSingleActivation(addBhLock)) return;
                      setAddBhPending(true);
                      const id =
                        typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
                          ? crypto.randomUUID()
                          : `bh-${Date.now().toString(16)}`;
                      void Promise.resolve(
                        onAddBulkhead?.(panel.workAreaId, portion.id, id)
                      ).finally(() => {
                        releaseSingleActivation(addBhLock);
                        setAddBhPending(false);
                      });
                    }}
                  >
                    {bhBusy ? "Adding…" : "Add bulkhead"}
                  </Button>
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}
