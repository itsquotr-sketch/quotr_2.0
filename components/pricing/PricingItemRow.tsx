"use client";

import { memo, useMemo, useState, useTransition } from "react";
import { ChevronDown, Copy, Eye, EyeOff, Pencil, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  getCalculationModeForSave,
  itemToForm,
  PricingItemEditForm,
} from "@/components/pricing/PricingItemEditForm";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { PRICING_ITEM_TYPES } from "@/lib/pricing/status";
import { PricingOwnershipBadge } from "@/components/pricing/PricingOwnershipBadge";
import { parseLineItemNotes } from "@/lib/estimate/line-item-metadata";
import {
  formatQuantityBasisDisplay,
  getCommercialTrustDetailLinesFromNotes,
} from "@/lib/estimate/commercial-realism";
import { formatPricingMoney, formatPricingPercent } from "@/lib/pricing/format";
import {
  getMaterialBuildUpDisplay,
  getMaterialRateSourceDisplay,
} from "@/lib/estimate/line-item-metadata";
import {
  pricingItemToCalculationInput,
  resolvePricingItemCalculation,
} from "@/lib/pricing/pricing-item-calculation";
import { PRICING_TABLE_GRID } from "@/lib/pricing/table-layout";
import type { PricingItem, PricingItemInput } from "@/lib/pricing/types";
import { cn } from "@/lib/utils";

type PricingItemRowProps = {
  item: PricingItem;
  layout?: "table" | "card";
  onSave: (input: PricingItemInput) => Promise<{ error?: string }>;
  onDuplicate: () => Promise<{ error?: string }>;
  onDelete: () => Promise<{ error?: string }>;
};

function PricingItemRowComponent({
  item,
  layout = "table",
  onSave,
  onDuplicate,
  onDelete,
}: PricingItemRowProps) {
  const [expanded, setExpanded] = useState(false);
  const [detailExpanded, setDetailExpanded] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState<PricingItemInput>(() => itemToForm(item));

  const resolvedItem = useMemo(
    () =>
      resolvePricingItemCalculation(pricingItemToCalculationInput(item)),
    [item]
  );
  const materialBuildUpDisplay = useMemo(
    () => getMaterialBuildUpDisplay(item.notes_internal),
    [item.notes_internal]
  );
  const materialRateSourceDisplay = useMemo(
    () => getMaterialRateSourceDisplay(item.notes_internal),
    [item.notes_internal]
  );
  const { metadata: pricingMetadata } = useMemo(
    () => parseLineItemNotes(item.notes_internal),
    [item.notes_internal]
  );
  const trustDetailLines = useMemo(
    () =>
      getCommercialTrustDetailLinesFromNotes(
        item.notes_internal,
        pricingMetadata.pricingOwner
      ),
    [item.notes_internal, pricingMetadata.pricingOwner]
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
    resolvedItem.quantity != null
      ? `${resolvedItem.quantity}${resolvedItem.unit ? ` ${resolvedItem.unit}` : ""}`
      : "—";

  const editForm = (
    <PricingItemEditForm
      form={form}
      setForm={setForm}
      materialBuildUpDisplay={materialBuildUpDisplay}
      materialRateSourceDisplay={materialRateSourceDisplay}
      error={error}
      isPending={isPending}
      onSave={handleSave}
      onCancel={closeEditor}
    />
  );

  if (layout === "card") {
    return (
      <>
        <div className="rounded-lg border border-border/60 bg-card p-3">
          <div className="flex items-start justify-between gap-2">
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
                <span className="text-xs text-muted-foreground">{qtyLabel}</span>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <span className="font-semibold tabular-nums">
                  {formatPricingMoney(item.total_sell)}
                </span>
                <span className="text-xs text-muted-foreground">
                  Margin {formatPricingPercent(item.margin_percent)}
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
              {detailExpanded ? (
                <div className="space-y-1 border-t border-border/50 pt-2 text-[11px] leading-snug text-muted-foreground">
                  {pricingMetadata.quantityBasis ? (
                    <p>
                      <span className="font-medium text-foreground/80">
                        Qty basis:
                      </span>{" "}
                      {formatQuantityBasisDisplay(pricingMetadata.quantityBasis)}
                    </p>
                  ) : null}
                  {materialBuildUpDisplay ? (
                    <p>
                      <span className="font-medium text-foreground/80">
                        Build-up:
                      </span>{" "}
                      {materialBuildUpDisplay}
                    </p>
                  ) : null}
                  {materialRateSourceDisplay ? (
                    <p>
                      <span className="font-medium text-foreground/80">
                        Rate source:
                      </span>{" "}
                      {materialRateSourceDisplay}
                    </p>
                  ) : null}
                  {trustDetailLines.length > 0 ? (
                    <p>{trustDetailLines.join(" · ")}</p>
                  ) : null}
                  {item.notes_internal && !materialBuildUpDisplay ? (
                    <p className="italic">{item.notes_internal}</p>
                  ) : null}
                </div>
              ) : trustDetailLines.length > 0 ? (
                <p className="text-[11px] leading-snug text-muted-foreground">
                  {trustDetailLines.join(" · ")}
                </p>
              ) : null}
            </div>
            <div className="flex shrink-0 flex-col gap-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8"
                disabled={isPending}
                onClick={openEditor}
              >
                Edit
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-[11px] text-muted-foreground"
                onClick={() => setDetailExpanded((prev) => !prev)}
              >
                {detailExpanded ? "Less" : "Details"}
                <ChevronDown
                  className={cn(
                    "ml-0.5 size-3 transition-transform",
                    detailExpanded && "rotate-180"
                  )}
                />
              </Button>
            </div>
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
        <div className="min-w-0 md:col-span-1">
          <p className="text-sm font-medium leading-snug">{item.client_label}</p>
          {item.internal_label !== item.client_label ? (
            <p className="truncate text-xs text-muted-foreground">
              {item.internal_label}
            </p>
          ) : null}
          {materialBuildUpDisplay ? (
            <p className="mt-1 text-[11px] italic leading-snug text-muted-foreground/90">
              {materialBuildUpDisplay}
            </p>
          ) : null}
          {materialRateSourceDisplay ? (
            <p className="mt-0.5 text-[10px] leading-snug text-muted-foreground/60">
              {materialRateSourceDisplay}
            </p>
          ) : null}
          {trustDetailLines.length > 0 ? (
            <p className="mt-1 text-[11px] leading-snug text-muted-foreground/90">
              {trustDetailLines.join(" · ")}
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
          {formatPricingMoney(item.total_sell)}
        </div>
        <div className="hidden text-right text-xs tabular-nums md:block">
          {formatPricingPercent(item.margin_percent)}
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
