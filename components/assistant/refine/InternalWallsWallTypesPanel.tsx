"use client";

import { Button } from "@/components/ui/button";
import { INTERNAL_WALLS_HEIGHT_ASSUMPTION_STATEMENT } from "@/lib/estimate/internal-walls-wall-types";
import type { InternalWallsRefinePanel } from "@/lib/assistant/refine/types";
import { PREMIUM } from "@/lib/ui/premium";
import { cn } from "@/lib/utils";

export function InternalWallsWallTypesPanel({
  panel,
  onAdd,
  onDuplicate,
  onDelete,
  onSelect,
}: {
  panel: InternalWallsRefinePanel;
  onAdd: (workAreaId: string) => void;
  onDuplicate: (workAreaId: string, wallTypeId: string) => void;
  onDelete: (workAreaId: string, wallTypeId: string) => void;
  onSelect: (workAreaId: string, wallTypeId: string) => void;
}) {
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
              : `${panel.types.length} wall type${panel.types.length === 1 ? "" : "s"}`}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          className="h-11 min-h-11 shrink-0 px-3"
          data-add-wall-type
          onClick={() => onAdd(panel.workAreaId)}
        >
          Add wall type
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
                  {[type.frameLine, type.geometryLine, type.centresLine, type.liningLine]
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
            </article>
          );
        })}
      </div>
    </section>
  );
}
