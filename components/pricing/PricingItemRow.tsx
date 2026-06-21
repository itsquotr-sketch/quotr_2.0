"use client";

import { memo, useState, useTransition } from "react";
import { Copy, Pencil, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DELIVERY_METHODS,
  PRICING_ITEM_TYPES,
} from "@/lib/pricing/status";
import { formatPricingMoney, formatPricingPercent } from "@/lib/pricing/format";
import type { PricingItem, PricingItemInput } from "@/lib/pricing/types";

type PricingItemRowProps = {
  item: PricingItem;
  onSave: (input: PricingItemInput) => Promise<{ error?: string }>;
  onDuplicate: () => Promise<{ error?: string }>;
  onDelete: () => Promise<{ error?: string }>;
};

function PricingItemRowComponent({
  item,
  onSave,
  onDuplicate,
  onDelete,
}: PricingItemRowProps) {
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState<PricingItemInput>({
    internal_label: item.internal_label,
    client_label: item.client_label,
    internal_description: item.internal_description,
    client_description: item.client_description,
    quantity: item.quantity,
    unit: item.unit,
    unit_cost: item.unit_cost,
    unit_sell: item.unit_sell,
    total_cost: item.total_cost,
    total_sell: item.total_sell,
    item_type: item.item_type,
    delivery_method: item.delivery_method,
    visible_on_quote: item.visible_on_quote,
    optional: item.optional,
    notes_internal: item.notes_internal,
    notes_client: item.notes_client,
    work_area_id: item.work_area_id,
  });

  const runAction = (action: () => Promise<{ error?: string }>) => {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (result.error) {
        setError(result.error);
        return;
      }
      setExpanded(false);
    });
  };

  return (
    <div className="rounded-xl border border-border/60 bg-background">
      <div className="hidden gap-2 px-3 py-2 text-xs font-medium text-muted-foreground md:grid md:grid-cols-[minmax(0,1.4fr)_repeat(7,minmax(0,0.7fr))_auto] md:items-center">
        <span>Item</span>
        <span>Type</span>
        <span>Delivery</span>
        <span className="text-right">Qty</span>
        <span className="text-right">Unit cost</span>
        <span className="text-right">Unit charge</span>
        <span className="text-right">Total cost</span>
        <span className="text-right">Total charge</span>
        <span className="text-right">Margin</span>
        <span />
      </div>

      <div className="grid gap-3 p-3 md:grid-cols-[minmax(0,1.4fr)_repeat(7,minmax(0,0.7fr))_auto] md:items-center">
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-medium leading-snug">{item.client_label}</p>
          {item.internal_label !== item.client_label ? (
            <p className="text-xs text-muted-foreground">{item.internal_label}</p>
          ) : null}
          <div className="flex flex-wrap gap-1 md:hidden">
            <Badge variant="secondary" className="text-[10px]">
              {PRICING_ITEM_TYPES.find((type) => type.value === item.item_type)
                ?.label ?? item.item_type}
            </Badge>
            <Badge variant="outline" className="text-[10px]">
              {DELIVERY_METHODS.find(
                (method) => method.value === item.delivery_method
              )?.label ?? item.delivery_method}
            </Badge>
          </div>
        </div>

        <div className="hidden text-xs md:block">
          {PRICING_ITEM_TYPES.find((type) => type.value === item.item_type)
            ?.label ?? item.item_type}
        </div>
        <div className="hidden text-xs md:block">
          {DELIVERY_METHODS.find(
            (method) => method.value === item.delivery_method
          )?.label ?? item.delivery_method}
        </div>
        <div className="hidden text-right text-sm md:block">
          {item.quantity ?? "—"}
          {item.unit ? ` ${item.unit}` : ""}
        </div>
        <div className="hidden text-right text-sm md:block">
          {item.unit_cost != null ? formatPricingMoney(item.unit_cost) : "—"}
        </div>
        <div className="hidden text-right text-sm md:block">
          {item.unit_sell != null ? formatPricingMoney(item.unit_sell) : "—"}
        </div>
        <div className="hidden text-right text-sm md:block">
          {formatPricingMoney(item.total_cost)}
        </div>
        <div className="hidden text-right text-sm font-medium md:block">
          {formatPricingMoney(item.total_sell)}
        </div>
        <div className="hidden text-right text-sm md:block">
          {formatPricingPercent(item.margin_percent)}
        </div>

        <div className="flex items-center justify-end gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Edit item"
            disabled={isPending}
            onClick={() => setExpanded((value) => !value)}
          >
            <Pencil className="size-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Duplicate item"
            disabled={isPending}
            onClick={() => runAction(onDuplicate)}
          >
            <Copy className="size-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Delete item"
            disabled={isPending}
            onClick={() => runAction(onDelete)}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-2 text-sm md:hidden">
          <div>
            <p className="text-xs text-muted-foreground">Total cost</p>
            <p>{formatPricingMoney(item.total_cost)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Total charge</p>
            <p className="font-medium">{formatPricingMoney(item.total_sell)}</p>
          </div>
        </div>
      </div>

      {expanded ? (
        <div className="space-y-4 border-t px-3 py-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Client label</Label>
              <Input
                value={form.client_label}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    client_label: event.target.value,
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Internal label</Label>
              <Input
                value={form.internal_label}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    internal_label: event.target.value,
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Item type</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={form.item_type}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    item_type: event.target.value as PricingItemInput["item_type"],
                  }))
                }
              >
                {PRICING_ITEM_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Delivery method</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={form.delivery_method}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    delivery_method:
                      event.target.value as PricingItemInput["delivery_method"],
                  }))
                }
              >
                {DELIVERY_METHODS.map((method) => (
                  <option key={method.value} value={method.value}>
                    {method.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Quantity</Label>
              <Input
                type="number"
                step="0.01"
                value={form.quantity ?? ""}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    quantity: event.target.value
                      ? Number(event.target.value)
                      : null,
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Unit</Label>
              <Input
                value={form.unit ?? ""}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    unit: event.target.value || null,
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Unit cost</Label>
              <Input
                type="number"
                step="0.01"
                value={form.unit_cost ?? ""}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    unit_cost: event.target.value
                      ? Number(event.target.value)
                      : null,
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Unit charge</Label>
              <Input
                type="number"
                step="0.01"
                value={form.unit_sell ?? ""}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    unit_sell: event.target.value
                      ? Number(event.target.value)
                      : null,
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Total cost</Label>
              <Input
                type="number"
                step="0.01"
                value={form.total_cost ?? 0}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    total_cost: Number(event.target.value),
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Total charge</Label>
              <Input
                type="number"
                step="0.01"
                value={form.total_sell ?? 0}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    total_sell: Number(event.target.value),
                  }))
                }
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={form.visible_on_quote}
                onCheckedChange={(checked) =>
                  setForm((current) => ({
                    ...current,
                    visible_on_quote: checked === true,
                  }))
                }
              />
              Visible on quote
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={form.optional}
                onCheckedChange={(checked) =>
                  setForm((current) => ({
                    ...current,
                    optional: checked === true,
                  }))
                }
              />
              Optional item
            </label>
          </div>

          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              disabled={isPending}
              onClick={() => runAction(() => onSave(form))}
            >
              Save item
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={isPending}
              onClick={() => setExpanded(false)}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export const PricingItemRow = memo(PricingItemRowComponent);
