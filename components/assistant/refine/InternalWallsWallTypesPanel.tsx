"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { INTERNAL_WALLS_HEIGHT_ASSUMPTION_STATEMENT } from "@/lib/estimate/internal-walls-wall-types";
import type { InternalWallsRefinePanel } from "@/lib/assistant/refine/types";
import {
  releaseSingleActivation,
  tryBeginSingleActivation,
} from "@/lib/assistant/refine/single-activation";
import { PREMIUM } from "@/lib/ui/premium";
import { cn } from "@/lib/utils";

export function InternalWallsWallTypesPanel({
  panel,
  isSaving = false,
  onAdd,
  onDuplicate,
  onDelete,
  onSelect,
  onAddOpening,
  onDeleteOpening,
  onSelectOpening,
}: {
  panel: InternalWallsRefinePanel;
  isSaving?: boolean;
  onAdd: (workAreaId: string) => void | Promise<unknown>;
  onDuplicate: (workAreaId: string, wallTypeId: string) => void;
  onDelete: (workAreaId: string, wallTypeId: string) => void;
  onSelect: (workAreaId: string, wallTypeId: string) => void;
  onAddOpening?: (
    workAreaId: string,
    wallTypeId: string,
    openingId: string
  ) => void | Promise<unknown>;
  onDeleteOpening?: (workAreaId: string, wallTypeId: string, openingId: string) => void;
  onSelectOpening?: (workAreaId: string, wallTypeId: string, openingId: string) => void;
}) {
  const addTypeLock = useRef(false);
  const addOpeningLock = useRef(false);
  const [addTypePending, setAddTypePending] = useState(false);
  const [addOpeningPending, setAddOpeningPending] = useState(false);

  const addBusy = isSaving || addTypePending;
  const openingBusy = isSaving || addOpeningPending;

  return (
    <section
      className="space-y-3"
      data-internal-walls-wall-types
      data-work-area-id={panel.workAreaId}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className={PREMIUM.sectionTitle}>{panel.workAreaName}</p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {panel.types.length === 0
              ? "Add a wall type to describe this work."
              : `${panel.types.reduce(
                  (sum, row) =>
                    sum + (row.wallCount != null && row.wallCount > 0 ? row.wallCount : 1),
                  0
                )} walls · ${panel.types.length} Wall Type${panel.types.length === 1 ? "" : "s"}`}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          className="h-11 min-h-11 shrink-0 px-3"
          data-add-wall-type
          data-add-wall-type-pending={addBusy ? "true" : undefined}
          disabled={addBusy}
          onClick={() => {
            if (isSaving || !tryBeginSingleActivation(addTypeLock)) return;
            setAddTypePending(true);
            void Promise.resolve(onAdd(panel.workAreaId)).finally(() => {
              releaseSingleActivation(addTypeLock);
              setAddTypePending(false);
            });
          }}
        >
          {addBusy ? "Adding…" : "Add wall type"}
        </Button>
      </div>
      {panel.assumedHeight ? (
        <p className="text-xs text-muted-foreground" data-wall-height-assumption>
          {INTERNAL_WALLS_HEIGHT_ASSUMPTION_STATEMENT}
        </p>
      ) : null}
      <div className="space-y-2">
        {panel.types.map((type) => {
          const selected = type.id === panel.activeId;
          return (
            <article
              key={type.id}
              className={cn(
                "rounded-xl border px-3 py-3",
                selected
                  ? "border-[var(--brand-orange)]/50 bg-[var(--brand-orange)]/5"
                  : "border-border bg-background"
              )}
              data-wall-type-card={type.id}
              data-wall-type-selected={selected ? "true" : "false"}
            >
              <button
                type="button"
                className="w-full text-left"
                onClick={() => onSelect(panel.workAreaId, type.id)}
              >
                <p className="text-sm font-medium">{type.displayName}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {[
                    type.frameLine,
                    type.geometryLine,
                    type.centresLine,
                    type.liningLine,
                    type.openingsLine,
                    type.finishLine,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </button>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="h-10 min-h-10 px-3"
                  data-edit-wall-type={type.id}
                  onClick={() => onSelect(panel.workAreaId, type.id)}
                >
                  Edit
                </Button>
                {!type.id.startsWith("legacy:") ? (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-10 min-h-10 px-3"
                      data-duplicate-wall-type={type.id}
                      onClick={() => onDuplicate(panel.workAreaId, type.id)}
                    >
                      Duplicate
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-10 min-h-10 px-3"
                      data-delete-wall-type={type.id}
                      onClick={() => {
                        if (
                          window.confirm(
                            `Remove ${type.displayName}? This cannot be undone.`
                          )
                        ) {
                          onDelete(panel.workAreaId, type.id);
                        }
                      }}
                    >
                      Delete
                    </Button>
                  </>
                ) : null}
              </div>
              {selected ? (
                <div className="mt-3 space-y-2" data-wall-type-openings={type.id}>
                  {type.openings.map((opening) => {
                    const openingSelected = opening.id === panel.activeOpeningId;
                    return (
                      <div
                        key={opening.id}
                        className={cn(
                          "rounded-lg border px-3 py-2",
                          openingSelected
                            ? "border-[var(--brand-orange)]/40 bg-background"
                            : "border-border/70 bg-background"
                        )}
                        data-opening-card={opening.id}
                      >
                        <p className="text-sm">{opening.summaryLine}</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            className="h-10 min-h-10 px-3"
                            data-edit-opening={opening.id}
                            onClick={() =>
                              onSelectOpening?.(panel.workAreaId, type.id, opening.id)
                            }
                          >
                            Edit
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            className="h-10 min-h-10 px-3"
                            data-delete-opening={opening.id}
                            onClick={() => {
                              if (window.confirm("Remove this opening?")) {
                                onDeleteOpening?.(
                                  panel.workAreaId,
                                  type.id,
                                  opening.id
                                );
                              }
                            }}
                          >
                            Delete
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                  <Button
                    type="button"
                    variant="outline"
                    className="h-10 min-h-10 w-full px-3 sm:w-auto"
                    data-add-opening
                    data-add-opening-pending={openingBusy ? "true" : undefined}
                    disabled={openingBusy}
                    onClick={() => {
                      if (isSaving || !tryBeginSingleActivation(addOpeningLock)) {
                        return;
                      }
                      setAddOpeningPending(true);
                      const id =
                        typeof crypto !== "undefined" &&
                        typeof crypto.randomUUID === "function"
                          ? crypto.randomUUID()
                          : `op-${Date.now().toString(16)}`;
                      void Promise.resolve(
                        onAddOpening?.(panel.workAreaId, type.id, id)
                      ).finally(() => {
                        releaseSingleActivation(addOpeningLock);
                        setAddOpeningPending(false);
                      });
                    }}
                  >
                    {openingBusy ? "Adding…" : "Add opening"}
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
