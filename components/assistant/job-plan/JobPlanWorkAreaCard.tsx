"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type {
  JobPlanScopeItem,
  JobPlanWorkAreaCard,
} from "@/lib/assistant/job-plan/types";
import { ASSISTANT_ACTION_LABELS } from "@/lib/assistant/presentation/action-labels";

const INCLUDED_PREVIEW_LIMIT = 6;

type JobPlanWorkAreaCardViewProps = {
  card: JobPlanWorkAreaCard;
  readOnly?: boolean;
  isRemoving?: boolean;
  onToggleScope?: (
    item: JobPlanScopeItem,
    presentation: "INCLUDED" | "NOT_INCLUDED"
  ) => void;
  onRemove?: (
    workAreaId: string
  ) => Promise<{ success: boolean; error?: string }> | void;
  specEditor?: ReactNode;
  /**
   * When set, this card will open its edit UI immediately and focus the
   * requested control.
   */
  autoEditOpen?: boolean;
  specFocusKey?: string | null;
  scopeFocusItemId?: string | null;
};

function ScopeRow({
  item,
  showActions,
  tone,
  onToggle,
}: {
  item: JobPlanScopeItem;
  showActions: boolean;
  tone: "included" | "check" | "excluded";
  onToggle?: (presentation: "INCLUDED" | "NOT_INCLUDED") => void;
}) {
  return (
    <li
      className={cn(
        "flex min-h-11 items-center justify-between gap-2 py-0.5",
        tone === "excluded" && "text-muted-foreground"
      )}
      data-job-plan-item={item.id}
      data-job-plan-state={item.presentation}
    >
      <span className="text-sm">
        {tone === "included" ? (
          <span aria-hidden="true" className="mr-1.5 text-foreground">
            ✓
          </span>
        ) : null}
        {tone === "check" ? (
          <span aria-hidden="true" className="mr-1.5 text-foreground">
            ?
          </span>
        ) : null}
        <span>{item.label}</span>
        {tone === "excluded" ? (
          <span className="ml-1.5 text-xs">— Not included</span>
        ) : null}
        <span className="sr-only">
          {tone === "included"
            ? ", included"
            : tone === "check"
              ? ", not confirmed"
              : ", not included"}
        </span>
      </span>
      {showActions && onToggle ? (
        <span className="flex shrink-0 gap-1">
          <Button
            type="button"
            size="sm"
            variant="outline"
            aria-label={`Include ${item.label}`}
            onClick={() => onToggle("INCLUDED")}
          >
            Include
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            aria-label={`Mark ${item.label} as not included`}
            onClick={() => onToggle("NOT_INCLUDED")}
          >
            Not included
          </Button>
        </span>
      ) : null}
    </li>
  );
}

export function JobPlanWorkAreaCardView({
  card,
  readOnly,
  isRemoving,
  onToggleScope,
  onRemove,
  specEditor,
  autoEditOpen,
  specFocusKey = null,
  scopeFocusItemId = null,
}: JobPlanWorkAreaCardViewProps) {
  const [editOpen, setEditOpen] = useState(() => Boolean(autoEditOpen));
  const [showAllIncluded, setShowAllIncluded] = useState(false);
  const [removeConfirmOpen, setRemoveConfirmOpen] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const headingId = `job-plan-${card.workAreaId}-title`;
  const rootRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!editOpen) return;

    // Focus the requested material/spec control for supported editors.
    if (specFocusKey) {
      const id =
        specFocusKey === "deck.board_material"
          ? `deck-material-${card.workAreaId}`
          : specFocusKey === "deck.board_width_mm"
            ? `deck-width-${card.workAreaId}`
            : specFocusKey === "deck.height_m"
              ? `deck-height-${card.workAreaId}`
              : null;

      const el = id ? document.getElementById(id) : null;
      if (el instanceof HTMLElement) {
        el.focus({ preventScroll: true });
        return;
      }
    }

    // Focus the first edit action button for the target scope row.
    if (scopeFocusItemId) {
      const row = rootRef.current?.querySelector<HTMLElement>(
        `[data-job-plan-item="${scopeFocusItemId}"]`
      );
      const btn = row?.querySelector<HTMLButtonElement>("button");
      btn?.focus({ preventScroll: true });
    }
  }, [editOpen, specFocusKey, scopeFocusItemId, card.workAreaId]);

  const visibleIncluded =
    editOpen || showAllIncluded || card.included.length <= INCLUDED_PREVIEW_LIMIT
      ? card.included
      : card.included.slice(0, INCLUDED_PREVIEW_LIMIT);
  const hiddenIncludedCount = card.included.length - visibleIncluded.length;

  return (
    <article
      ref={rootRef}
      data-job-plan-card
      data-work-area-id={card.workAreaId}
      data-work-area-type={card.workAreaType}
      aria-labelledby={headingId}
      className="rounded-xl border border-border bg-card px-4 py-3"
    >
      <header className="flex items-start justify-between gap-2">
        <div className="min-w-0 space-y-1">
          <h3 id={headingId} className="text-sm font-semibold tracking-tight">
            {card.name}
          </h3>
          {card.summary ? (
            <p
              data-job-plan-spec
              data-job-plan-section="spec"
              className="text-xs text-muted-foreground"
            >
              {card.summary}
            </p>
          ) : null}
        </div>
        {readOnly || !onRemove ? null : (
          <DropdownMenu>
            <DropdownMenuTrigger
              className="inline-flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={`More actions for ${card.name}`}
              data-job-plan-overflow
            >
              <MoreHorizontal className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem
                variant="destructive"
                disabled={isRemoving}
                data-job-plan-remove
                onClick={() => {
                  setRemoveError(null);
                  setRemoveConfirmOpen(true);
                }}
              >
                {ASSISTANT_ACTION_LABELS.removeWorkArea} {card.name}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </header>

      {onRemove ? (
        <Dialog
          open={removeConfirmOpen}
          onOpenChange={(open) => {
            if (!open) {
              setRemoveConfirmOpen(false);
              setRemoveError(null);
            }
          }}
        >
          <DialogContent showCloseButton>
            <DialogHeader>
              <DialogTitle>Remove from estimate?</DialogTitle>
              <DialogDescription>
                Remove {card.name} from this estimate? Existing details will be
                kept in case you add it back later. The estimate will need to be
                updated.
              </DialogDescription>
            </DialogHeader>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                disabled={isRemoving}
                onClick={() => setRemoveConfirmOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={isRemoving}
                data-job-plan-remove-confirm
                onClick={() => {
                  setRemoveError(null);
                  const result = onRemove(card.workAreaId);
                  void Promise.resolve(result).then((out) => {
                    if (out?.success) {
                      setRemoveConfirmOpen(false);
                      return;
                    }
                    if (out && !out.success) {
                      setRemoveError(
                        out.error ?? "Could not remove work area."
                      );
                    }
                  });
                }}
              >
                {isRemoving ? "Removing…" : "Remove from estimate"}
              </Button>
            </div>
            {removeError ? (
              <p
                className="mt-2 text-sm text-destructive"
                role="alert"
                data-job-plan-remove-error
              >
                {removeError}
              </p>
            ) : null}
          </DialogContent>
        </Dialog>
      ) : null}

      {card.included.length > 0 ? (
        <section
          className="mt-3"
          data-job-plan-included
          data-job-plan-section="included"
        >
          <h4 className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Included
          </h4>
          <ul className="mt-0.5" aria-label="Included scope">
            {visibleIncluded.map((item) => (
              <ScopeRow
                key={item.id}
                item={item}
                showActions={
                  Boolean(
                    !readOnly &&
                      editOpen &&
                      item.togglable &&
                      onToggleScope
                  )
                }
                tone="included"
                onToggle={
                  onToggleScope
                    ? (next) => onToggleScope(item, next)
                    : undefined
                }
              />
            ))}
          </ul>
          {hiddenIncludedCount > 0 ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="mt-1"
              onClick={() => setShowAllIncluded(true)}
            >
              View all {card.included.length} items
            </Button>
          ) : null}
        </section>
      ) : null}

      {card.notConfirmed.length > 0 ? (
        <section
          className="mt-3"
          data-job-plan-check
          data-job-plan-section="check"
        >
          <h4 className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Check
          </h4>
          <ul className="mt-0.5" aria-label="Items to confirm">
            {card.notConfirmed.map((item) => (
              <ScopeRow
                key={item.id}
                item={item}
                showActions={Boolean(!readOnly && item.togglable && onToggleScope)}
                tone="check"
                onToggle={
                  onToggleScope
                    ? (next) => onToggleScope(item, next)
                    : undefined
                }
              />
            ))}
          </ul>
        </section>
      ) : null}

      {editOpen && card.notIncluded.length > 0 ? (
        <section
          className="mt-3"
          data-job-plan-excluded
          data-job-plan-section="excluded"
        >
          <h4 className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Not included
          </h4>
          <ul className="mt-0.5" aria-label="Explicitly not included">
            {card.notIncluded.map((item) => (
              <ScopeRow
                key={item.id}
                item={item}
                showActions={
                  Boolean(
                    !readOnly &&
                      editOpen &&
                      item.togglable &&
                      onToggleScope
                  )
                }
                tone="excluded"
                onToggle={
                  onToggleScope
                    ? (next) => onToggleScope(item, next)
                    : undefined
                }
              />
            ))}
          </ul>
        </section>
      ) : null}

      {editOpen && specEditor ? (
        <div className="mt-3 border-t border-border pt-3">
          <h4 className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Edit specification
          </h4>
          {specEditor}
        </div>
      ) : null}

      {readOnly ? null : (
        <div className="mt-2">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            data-job-plan-edit
            aria-expanded={editOpen}
            aria-label="Edit scope and specification"
            onClick={() => setEditOpen((open) => !open)}
          >
            {editOpen ? "Done" : "Edit"}
          </Button>
        </div>
      )}
    </article>
  );
}
