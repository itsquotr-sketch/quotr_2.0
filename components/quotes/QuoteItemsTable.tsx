"use client";

import { Eye, EyeOff, Loader2, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatPricingMoney } from "@/lib/pricing/format";
import type { QuoteItemInput } from "@/lib/quotes/types";
import type { QuoteItem } from "@/lib/quotes/types";
import { cn } from "@/lib/utils";

type QuoteItemsTableProps = {
  sectionTitle: string | null;
  items: QuoteItem[];
  onSaveItem: (
    itemId: string,
    input: QuoteItemInput
  ) => Promise<{ error?: string }>;
  onToggleVisible: (
    itemId: string,
    visible: boolean
  ) => Promise<{ error?: string }>;
  onDeleteItem?: (itemId: string) => Promise<{ error?: string }>;
};

function QuoteItemRow({
  item,
  onSaveItem,
  onToggleVisible,
  onDeleteItem,
}: {
  item: QuoteItem;
  onSaveItem: QuoteItemsTableProps["onSaveItem"];
  onToggleVisible: QuoteItemsTableProps["onToggleVisible"];
  onDeleteItem?: QuoteItemsTableProps["onDeleteItem"];
}) {
  const [isPending, startTransition] = useTransition();
  const [label, setLabel] = useState(item.label);
  const [description, setDescription] = useState(item.description ?? "");
  const [quantity, setQuantity] = useState(
    item.quantity != null ? String(item.quantity) : ""
  );
  const [unit, setUnit] = useState(item.unit ?? "");
  const [unitPrice, setUnitPrice] = useState(
    item.unit_price != null ? String(item.unit_price) : ""
  );
  const [total, setTotal] = useState(String(item.total));

  const handleSave = () => {
    startTransition(async () => {
      await onSaveItem(item.id, {
        label: label.trim() || item.label,
        description: description.trim() || null,
        quantity: quantity ? Number(quantity) : null,
        unit: unit.trim() || null,
        unit_price: unitPrice ? Number(unitPrice) : null,
        total: total ? Number(total) : 0,
        visible: item.visible,
        optional: item.optional,
      });
    });
  };

  const handleToggleVisible = () => {
    startTransition(async () => {
      await onToggleVisible(item.id, !item.visible);
    });
  };

  const handleDelete = () => {
    if (!onDeleteItem) return;
    startTransition(async () => {
      await onDeleteItem(item.id);
    });
  };

  return (
    <div
      className={cn(
        "rounded-lg border border-border/60 p-3 space-y-3",
        !item.visible && "opacity-60 bg-muted/30"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="space-y-1">
            <Label className="text-xs">Label</Label>
            <Input
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              className="h-8 text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Description</Label>
            <Textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={2}
              className="text-sm"
            />
          </div>
        </div>
        <div className="flex shrink-0 flex-col gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8"
            title={item.visible ? "Hide from quote" : "Show on quote"}
            onClick={handleToggleVisible}
            disabled={isPending}
          >
            {item.visible ? (
              <Eye className="size-4" />
            ) : (
              <EyeOff className="size-4" />
            )}
          </Button>
          {onDeleteItem ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 text-destructive"
              title="Remove item"
              onClick={handleDelete}
              disabled={isPending}
            >
              <Trash2 className="size-4" />
            </Button>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="space-y-1">
          <Label className="text-xs">Qty</Label>
          <Input
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
            className="h-8 text-sm"
            inputMode="decimal"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Unit</Label>
          <Input
            value={unit}
            onChange={(event) => setUnit(event.target.value)}
            className="h-8 text-sm"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Unit price</Label>
          <Input
            value={unitPrice}
            onChange={(event) => setUnitPrice(event.target.value)}
            className="h-8 text-sm"
            inputMode="decimal"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Total</Label>
          <Input
            value={total}
            onChange={(event) => setTotal(event.target.value)}
            className="h-8 text-sm font-medium"
            inputMode="decimal"
          />
        </div>
      </div>

      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {item.optional ? <span>Optional item</span> : null}
          {!item.visible ? <span>Hidden from client view</span> : null}
          <span className="font-medium text-foreground">
            {formatPricingMoney(item.total)}
          </span>
        </div>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={handleSave}
          disabled={isPending}
        >
          {isPending ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            "Save item"
          )}
        </Button>
      </div>
    </div>
  );
}

export function QuoteItemsTable({
  sectionTitle,
  items,
  onSaveItem,
  onToggleVisible,
  onDeleteItem,
}: QuoteItemsTableProps) {
  if (items.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      {sectionTitle ? (
        <h3 className="text-sm font-semibold">{sectionTitle}</h3>
      ) : null}
      <div className="space-y-2">
        {items.map((item) => (
          <QuoteItemRow
            key={item.id}
            item={item}
            onSaveItem={onSaveItem}
            onToggleVisible={onToggleVisible}
            onDeleteItem={onDeleteItem}
          />
        ))}
      </div>
    </div>
  );
}
