"use client";

import { memo, useMemo, useState, useTransition } from "react";
import { Copy, Eye, EyeOff, Pencil, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  getCalculationModeForSave,
  itemToForm,
  PricingItemEditForm,
} from "@/components/pricing/PricingItemEditForm";
import { PricingCalculationDetails } from "@/components/pricing/PricingCalculationDetails";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { PRICING_ITEM_TYPES } from "@/lib/pricing/status";
import { PricingOwnershipBadge } from "@/components/pricing/PricingOwnershipBadge";
import { parseLineItemNotes } from "@/lib/estimate/line-item-metadata";
import { pricingItemViewModel } from "@/lib/pricing/financial-view-model";
import { PRICING_TABLE_GRID } from "@/lib/pricing/table-layout";
import type { PricingItem, PricingItemInput } from "@/lib/pricing/types";
import { cn } from "@/lib/utils";

type PricingItemRowProps = {
  item: PricingItem;
  layout?: "table" | "card";
  selected?: boolean;
  selectionMode?: boolean;
  onToggleSelect?: (itemId: string) => void;
  onSave: (input: PricingItemInput) => Promise<{ error?: string }>;
  onDuplicate: () => Promise<{ error?: string }>;
  onDelete: () => Promise<{ error?: string }>;
};

function PricingItemRowComponent({
  item,
  layout = "table",
  selected = false,
  selectionMode = false,
  onToggleSelect,
  onSave,
  onDuplicate,
  onDelete,
}: PricingItemRowProps) {
  const [expanded, setExpanded] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState<PricingItemInput>(() => itemToForm(item));

  const moneyView = useMemo(() => pricingItemViewModel(item), [item]);
  const { metadata: pricingMetadata } = useMemo(
    () => parseLineItemNotes(item.notes_internal),
    [item.notes_internal]
  );
  const categoryLabel = useMemo(
    () =>
      PRICING_ITEM_TYPES.find((type) => type.value === item.item_type)?.label ??
      item.item_type,
    [item.item_type]
  );

  const openEditor = () => {
    setForm(itemToForm(item));
    setError(null);
    if (layout === "card") {
      setSheetOpen(true);
    } else {
      setExpanded(true);
    }
  };

  const closeEditor = () => {
    setExpanded(false);
    setSheetOpen(false);
    setError(null);
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

  const qtyLabel =
    item.quantity != null
      ? `${item.quantity}${item.unit ? ` ${item.unit}` : ""}`
      : "—";

  const editForm = (
    <div className="space-y-4">
      <PricingItemEditForm
        form={form}
        setForm={setForm}
        error={error}
        isPending={isPending}
        onSave={handleSave}
        onCancel={closeEditor}
      />
      <PricingCalculationDetails item={item} rawNotes={item.notes_internal} />
    </div>
  );

  const selectControl =
    onToggleSelect && (layout === "table" || selectionMode) ? (
      <Checkbox
        checked={selected}
        aria-label={`Select ${item.client_label}`}
        className="mt-0.5"
        onClick={(event) => event.stopPropagation()}
        onCheckedChange={() => onToggleSelect(item.id)}
      />
    ) : null;

  if (layout === "card") {
    return (
      <>
        <div className="rounded-lg border border-border/60 bg-card p-3">
          <div className="flex items-start gap-2">
            {selectionMode ? (
              <div className="pt-0.5">{selectControl}</div>
            ) : null}
            <div className="min-w-0 flex-1 space-y-1.5">
              <p className="text-sm font-medium leading-snug">
                {item.client_label}
              </p>
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge variant="secondary" className="text-[10px] font-normal">
                  {categoryLabel}
                </Badge>
                <PricingOwnershipBadge
                  owner={pricingMetadata.pricingOwner}
                  includedInTotal={pricingMetadata.includedInTotal}
                />
                {moneyView.pricingRequired ? (
                  <Badge
                    variant="outline"
                    className="border-amber-300/80 bg-amber-50 text-[10px] font-medium text-amber-900"
                  >
                    Pricing required
                  </Badge>
                ) : null}
                <span className="text-xs text-muted-foreground">{qtyLabel}</span>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <span className="font-semibold tabular-nums">
                  {moneyView.totalSellFormatted}
                </span>
                <span className="text-xs text-muted-foreground">
                  Margin {moneyView.marginLabel}
                </span>
              </div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                {item.visible_on_quote ? (
                  <>
                    <Eye className="size-3" />
                    On quote
                  </>
                ) : (
                  <>
                    <EyeOff className="size-3" />
                    Hidden
                  </>
                )}
              </div>
              <PricingCalculationDetails
                item={item}
                rawNotes={item.notes_internal}
              />
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 shrink-0"
              disabled={isPending}
              onClick={openEditor}
            >
              Edit
            </Button>
          </div>
        </div>

        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetContent
            side="bottom"
            className="max-h-[92vh] overflow-y-auto rounded-t-2xl px-4 pb-8"
            showCloseButton
          >
            <SheetHeader className="border-b pb-4 text-left">
              <SheetTitle className="text-base">{item.client_label}</SheetTitle>
            </SheetHeader>
            <div className="pt-4">{editForm}</div>
          </SheetContent>
        </Sheet>
      </>
    );
  }

  return (
    <div className="bg-background">
      <div className={PRICING_TABLE_GRID}>
        <div className="hidden md:flex md:items-center">{selectControl}</div>
        <div className="min-w-0">
          <p className="text-sm font-medium leading-snug">{item.client_label}</p>
          {moneyView.pricingRequired ? (
            <Badge
              variant="outline"
              className="mt-1 border-amber-300/80 bg-amber-50 text-[10px] font-medium text-amber-900"
            >
              Pricing required
            </Badge>
          ) : null}
          {item.internal_label !== item.client_label ? (
            <p className="truncate text-xs text-muted-foreground">
              {item.internal_label}
            </p>
          ) : null}
        </div>

        <div className="hidden min-w-0 truncate text-xs md:block">
          {categoryLabel}
        </div>
        <div className="hidden text-right text-xs tabular-nums md:block">
          {qtyLabel}
        </div>
        <div className="hidden text-right text-sm font-medium tabular-nums md:block">
          {moneyView.totalSellFormatted}
        </div>
        <div className="hidden text-right text-xs tabular-nums md:block">
          {moneyView.marginLabel}
        </div>
        <div className="hidden md:block">
          {item.visible_on_quote ? (
            <Badge variant="outline" className="text-[10px] font-normal">
              On quote
            </Badge>
          ) : (
            <span className="text-xs text-muted-foreground">Hidden</span>
          )}
        </div>

        <div className="flex items-center justify-end gap-0.5">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Edit item"
            disabled={isPending}
            onClick={() => (expanded ? setExpanded(false) : openEditor())}
          >
            <Pencil className="size-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Duplicate item"
            disabled={isPending}
            onClick={() => runAction(onDuplicate)}
          >
            <Copy className="size-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Delete item"
            disabled={isPending}
            onClick={() => runAction(onDelete)}
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </div>

      {expanded ? (
        <div
          className={cn(
            "space-y-4 border-t bg-muted/20 px-3 py-4",
            layout === "table" && "hidden md:block"
          )}
        >
          {editForm}
        </div>
      ) : null}

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent
          side="bottom"
          className="max-h-[92vh] overflow-y-auto rounded-t-2xl px-4 pb-8 md:hidden"
          showCloseButton
        >
          <SheetHeader className="border-b pb-4 text-left">
            <SheetTitle className="text-base">{item.client_label}</SheetTitle>
          </SheetHeader>
          <div className="pt-4">{editForm}</div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

export const PricingItemRow = memo(PricingItemRowComponent);
