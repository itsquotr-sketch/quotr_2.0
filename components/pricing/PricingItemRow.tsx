"use client";

import { memo, useMemo, useRef, useState, useTransition } from "react";
import { ChevronDown, MoreHorizontal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import {
  getCalculationModeForSave,
  itemToForm,
  PricingItemEditForm,
} from "@/components/pricing/PricingItemEditForm";
import { PricingCalculationDetails } from "@/components/pricing/PricingCalculationDetails";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { PricingOwnershipBadge } from "@/components/pricing/PricingOwnershipBadge";
import { parseLineItemNotes } from "@/lib/estimate/line-item-metadata";
import { pricingItemViewModel } from "@/lib/pricing/financial-view-model";
import { formatPricingMoney } from "@/lib/pricing/format";
import { presentPricingLine } from "@/lib/pricing/line-presentation";
import {
  PRICING_TABLE_GRID,
  PRICING_TABLE_GRID_READONLY,
} from "@/lib/pricing/table-layout";
import type {
  PricingDocumentStatus,
  PricingItem,
  PricingItemInput,
} from "@/lib/pricing/types";
import { cn } from "@/lib/utils";

type PricingItemRowProps = {
  item: PricingItem;
  layout?: "table" | "card";
  selected?: boolean;
  selectionMode?: boolean;
  documentStatus?: PricingDocumentStatus;
  detailsOpen?: boolean;
  onToggleDetails?: () => void;
  onToggleSelect?: (itemId: string) => void;
  onSave: (input: PricingItemInput) => Promise<{ error?: string }>;
  onDuplicate: () => Promise<{ error?: string }>;
  onDelete: () => Promise<{ error?: string }>;
  canEdit?: boolean;
};

function statusNote(status: PricingDocumentStatus | undefined): string | null {
  if (status === "reviewed") {
    return "Saving returns this reviewed pricing to draft. The quote is not rewritten.";
  }
  if (status === "converted_to_quote") {
    return "A quote already exists. Editing this pricing does not change that quote.";
  }
  if (status === "archived") {
    return "This pricing is archived. The quote is not rewritten.";
  }
  return null;
}

function PricingItemRowComponent({
  item,
  layout = "table",
  selected = false,
  selectionMode = false,
  documentStatus,
  detailsOpen,
  onToggleDetails,
  onToggleSelect,
  onSave,
  onDuplicate,
  onDelete,
  canEdit = true,
}: PricingItemRowProps) {
  const actionsRef = useRef<HTMLButtonElement>(null);
  const [localDetails, setLocalDetails] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState<PricingItemInput>(() => itemToForm(item));
  const detailsExpanded = detailsOpen ?? localDetails;

  const moneyView = useMemo(() => pricingItemViewModel(item), [item]);
  const line = useMemo(() => presentPricingLine(item), [item]);
  const { metadata: pricingMetadata } = useMemo(
    () => parseLineItemNotes(item.notes_internal),
    [item.notes_internal]
  );
  const readOnlyNote = statusNote(documentStatus);

  const openEditor = () => {
    setForm(itemToForm(item));
    setError(null);
    setEditorOpen(true);
  };

  const closeEditor = () => {
    setEditorOpen(false);
    setError(null);
    actionsRef.current?.focus();
  };

  const toggleDetails = () => {
    if (onToggleDetails) {
      onToggleDetails();
      return;
    }
    setLocalDetails((current) => !current);
  };

  const runAction = (action: () => Promise<{ error?: string }>) => {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (result.error) {
        setError(result.error);
        return;
      }
      closeEditor();
      setConfirmDelete(false);
    });
  };

  const handleSave = () => {
    runAction(() =>
      onSave({
        ...form,
        calculation_mode: getCalculationModeForSave(form),
      })
    );
  };

  const editForm = (
    <div className="[&_input]:min-h-11 [&_input]:text-base [&_select]:min-h-11 [&_select]:text-base md:[&_input]:text-sm md:[&_select]:text-sm">
      <PricingItemEditForm
        form={form}
        setForm={setForm}
        error={error}
        isPending={isPending}
        onSave={handleSave}
        onCancel={closeEditor}
        saveLabel={moneyView.pricingRequired ? "Add price" : "Save item"}
      />
    </div>
  );

  const selectControl =
    canEdit && onToggleSelect && (layout === "table" || selectionMode) ? (
      <Checkbox
        checked={selected}
        aria-label={`Select ${item.client_label}`}
        onClick={(event) => event.stopPropagation()}
        onCheckedChange={() => onToggleSelect(item.id)}
      />
    ) : null;

  const actions = !canEdit ? null : (
    <DropdownMenu>
      <DropdownMenuTrigger
        ref={actionsRef}
        type="button"
        className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-lg border border-input bg-background px-3 text-sm font-medium outline-none hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
        disabled={isPending}
      >
        <MoreHorizontal className="size-4" />
        Actions
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-44">
        <DropdownMenuItem className="min-h-11" onClick={openEditor}>
          {moneyView.pricingRequired ? "Add price" : "Edit line"}
        </DropdownMenuItem>
        <DropdownMenuItem
          className="min-h-11"
          disabled={isPending}
          onClick={() => runAction(onDuplicate)}
        >
          Duplicate
        </DropdownMenuItem>
        <DropdownMenuItem
          className="min-h-11"
          variant="destructive"
          disabled={isPending}
          onClick={() => setConfirmDelete(true)}
        >
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const identity = (
    <div className="min-w-0">
      <p className="text-sm font-medium leading-snug">{line.title}</p>
      {line.supporting ? (
        <p className="truncate text-xs text-muted-foreground">{line.supporting}</p>
      ) : null}
      <div className="mt-1 flex flex-wrap items-center gap-1.5">
        {moneyView.pricingRequired ? (
          <Badge
            variant="outline"
            className="border-amber-300/80 bg-amber-50 text-xs font-medium text-amber-950"
          >
            Pricing required
          </Badge>
        ) : null}
        <PricingOwnershipBadge
          owner={pricingMetadata.pricingOwner}
          includedInTotal={pricingMetadata.includedInTotal}
        />
        {pricingMetadata.contributingNestedItemIds &&
        pricingMetadata.contributingNestedItemIds.length > 1 ? (
          <span
            className="text-xs text-muted-foreground"
            data-pricing-portion-contributors
          >
            Includes {pricingMetadata.contributingNestedItemIds.length} ceiling portions
          </span>
        ) : null}
      </div>
    </div>
  );

  const details = detailsExpanded ? (
    <div className="space-y-3 border-t border-border/60 bg-muted/30 px-3 py-3 text-sm">
      {readOnlyNote ? (
        <p className="text-xs text-muted-foreground">{readOnlyNote}</p>
      ) : null}
      {line.specification ? (
        <p className="text-sm leading-5">{line.specification}</p>
      ) : null}
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <div>
          <dt className="text-xs text-muted-foreground">Quantity</dt>
          <dd className="tabular-nums">{line.quantityLabel}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">
            {line.hourlyCostLabel ? "Hourly cost" : "Unit cost"}
          </dt>
          <dd className="text-right tabular-nums">
            {line.hourlyCostLabel ??
              (moneyView.pricingRequired || item.unit_cost == null
                ? "—"
                : formatPricingMoney(item.unit_cost))}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Internal cost</dt>
          <dd className="text-right tabular-nums">{line.costLabel}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Client sell</dt>
          <dd className="text-right font-medium tabular-nums">{line.sellLabel}</dd>
        </div>
        {!moneyView.pricingRequired ? (
          <div>
            <dt className="text-xs text-muted-foreground">Margin</dt>
            <dd className="text-right tabular-nums">{moneyView.marginLabel}</dd>
          </div>
        ) : (
          <div className="col-span-2">
            <p className="text-xs text-amber-950">
              {canEdit
                ? "A cost or client sell still needs to be entered. Use Add price."
                : "A cost or client sell still needs to be entered."}
            </p>
          </div>
        )}
        <div>
          <dt className="text-xs text-muted-foreground">Source</dt>
          <dd>{line.source}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Quote</dt>
          <dd>{item.visible_on_quote ? "Visible on quote" : "Hidden from quote"}</dd>
        </div>
        {line.pricingBasis ? (
          <div className="col-span-2">
            <dt className="text-xs text-muted-foreground">Pricing basis</dt>
            <dd>{line.pricingBasis}</dd>
          </div>
        ) : null}
        {line.productivitySource ? (
          <div className="col-span-2">
            <dt className="text-xs text-muted-foreground">Productivity source</dt>
            <dd>{line.productivitySource}</dd>
          </div>
        ) : null}
      </dl>
      <PricingCalculationDetails item={item} rawNotes={item.notes_internal} />
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      {canEdit ? (
        <Button type="button" variant="outline" className="min-h-11" onClick={openEditor}>
          {moneyView.pricingRequired ? "Add price" : "Edit line"}
        </Button>
      ) : null}
    </div>
  ) : null;

  const editor =
    layout === "card" ? (
      <Sheet
        open={editorOpen}
        onOpenChange={(open) => {
          if (!open) closeEditor();
        }}
      >
        <SheetContent
          side="bottom"
          className="max-h-[85vh] overflow-hidden rounded-t-2xl px-0 pb-[calc(1rem+env(safe-area-inset-bottom))]"
          showCloseButton
        >
          <SheetHeader className="border-b px-4 pb-3 text-left">
            <SheetTitle className="text-base">{line.title}</SheetTitle>
            <SheetDescription>
              {moneyView.pricingRequired
                ? "Enter the missing cost or client sell."
                : "Update this pricing line. Amounts stay as entered."}
            </SheetDescription>
          </SheetHeader>
          <div className="max-h-[65vh] overflow-y-auto px-4 pt-4">{editForm}</div>
        </SheetContent>
      </Sheet>
    ) : (
      <Dialog
        open={editorOpen}
        onOpenChange={(open) => {
          if (!open) closeEditor();
        }}
      >
        <DialogContent className="max-h-[85vh] max-w-lg overflow-hidden p-0">
          <DialogHeader className="px-6 pt-6 pr-14">
            <DialogTitle>{line.title}</DialogTitle>
            <DialogDescription>
              {moneyView.pricingRequired
                ? "Enter the missing cost or client sell."
                : "Update this pricing line. Amounts stay as entered."}
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[65vh] overflow-y-auto px-6 pb-6">{editForm}</div>
        </DialogContent>
      </Dialog>
    );

  const deleteDialog = (
    <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this pricing line?</AlertDialogTitle>
          <AlertDialogDescription>
            {line.manual
              ? "This removes the manual line. Estimate lines are left unchanged."
              : "This removes the pricing line. The estimate is not changed."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel type="button">Cancel</AlertDialogCancel>
          <AlertDialogAction
            type="button"
            variant="destructive"
            disabled={isPending}
            onClick={() => runAction(onDelete)}
          >
            Delete line
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  if (layout === "card") {
    return (
      <div
        className="overflow-hidden rounded-lg border border-border/60 bg-card"
        data-pricing-line={item.id}
      >
        <div className="flex items-start gap-2 p-3">
          {selectionMode ? <div className="pt-1">{selectControl}</div> : null}
          <button
            type="button"
            className="flex min-w-0 flex-1 items-start gap-2 text-left"
            aria-expanded={detailsExpanded}
            onClick={toggleDetails}
          >
            <ChevronDown
              className={cn(
                "mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform",
                detailsExpanded && "rotate-180"
              )}
            />
            <div className="min-w-0 flex-1 space-y-1">
              {identity}
              <p className="text-xs text-muted-foreground">
                {line.quantityLabel}
                <span className="px-1">·</span>
                {line.source}
              </p>
              <p
                className={cn(
                  "text-sm font-medium tabular-nums",
                  moneyView.pricingRequired && "text-amber-950"
                )}
              >
                {line.sellLabel}
              </p>
            </div>
          </button>
          {actions}
        </div>
        {details}
        {error && !detailsExpanded && !editorOpen ? (
          <p className="px-3 pb-3 text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
        {canEdit ? editor : null}
        {canEdit ? deleteDialog : null}
      </div>
    );
  }

  return (
    <div className="bg-background" data-pricing-line={item.id}>
      <div className={canEdit ? PRICING_TABLE_GRID : PRICING_TABLE_GRID_READONLY}>
        {canEdit ? (
          <div className="hidden items-center lg:flex">{selectControl}</div>
        ) : null}
        <button
          type="button"
          className="min-w-0 text-left"
          aria-expanded={detailsExpanded}
          onClick={toggleDetails}
        >
          {identity}
        </button>
        <div className="hidden truncate text-xs text-muted-foreground lg:block">
          {line.category}
        </div>
        <div className="hidden text-right text-xs tabular-nums lg:block">
          {line.quantityLabel}
        </div>
        <div className="hidden text-right text-sm tabular-nums lg:block">
          {line.costLabel}
        </div>
        <div
          className={cn(
            "hidden text-right text-sm font-medium tabular-nums lg:block",
            moneyView.pricingRequired && "text-amber-950"
          )}
        >
          {line.sellLabel}
        </div>
        <div className="hidden truncate text-right text-xs text-muted-foreground lg:block">
          {line.source}
        </div>
        {canEdit ? <div className="flex justify-end">{actions}</div> : null}
      </div>
      {details}
      {error && !detailsExpanded && !editorOpen ? (
        <p className="px-3 pb-3 text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      {canEdit ? editor : null}
      {canEdit ? deleteDialog : null}
    </div>
  );
}

export const PricingItemRow = memo(PricingItemRowComponent);
