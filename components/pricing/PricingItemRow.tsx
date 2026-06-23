"use client";

import { memo, useMemo, useState, useTransition } from "react";
import { Copy, Pencil, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  DELIVERY_METHODS,
  PRICING_ITEM_TYPES,
} from "@/lib/pricing/status";
import {
  calculatePricingItemEdit,
  type PricingItemEditField,
} from "@/lib/pricing/calculations";
import { formatPricingMoney, formatPricingPercent } from "@/lib/pricing/format";
import type { PricingItem, PricingItemInput } from "@/lib/pricing/types";

type PricingItemRowProps = {
  item: PricingItem;
  onSave: (input: PricingItemInput) => Promise<{ error?: string }>;
  onDuplicate: () => Promise<{ error?: string }>;
  onDelete: () => Promise<{ error?: string }>;
};

const ROW_GRID =
  "grid gap-2 px-3 py-2 md:grid-cols-[minmax(0,1.5fr)_0.7fr_0.8fr_0.6fr_0.75fr_0.75fr_0.75fr_0.75fr_0.55fr_auto] md:items-center";

function itemToForm(item: PricingItem): PricingItemInput {
  return {
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
  };
}

function parseNumericInput(value: string): number | null {
  if (!value.trim()) {
    return null;
  }
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function PricingItemRowComponent({
  item,
  onSave,
  onDuplicate,
  onDelete,
}: PricingItemRowProps) {
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState<PricingItemInput>(() => itemToForm(item));

  const calculated = useMemo(
    () =>
      calculatePricingItemEdit({
        quantity: form.quantity,
        unitCost: form.unit_cost,
        unitSell: form.unit_sell,
        totalCost: form.total_cost,
        totalSell: form.total_sell,
        changedField: "quantity",
        itemType: form.item_type,
      }),
    [form]
  );

  const updateCalculatedField = (
    field: PricingItemEditField,
    value: number | null
  ) => {
    setForm((current) => {
      const totals = calculatePricingItemEdit({
        quantity: field === "quantity" ? value : current.quantity,
        unitCost: field === "unitCost" ? value : current.unit_cost,
        unitSell: field === "unitSell" ? value : current.unit_sell,
        totalCost: field === "totalCost" ? value ?? 0 : current.total_cost,
        totalSell: field === "totalSell" ? value ?? 0 : current.total_sell,
        changedField: field,
        itemType: current.item_type,
      });

      return {
        ...current,
        quantity: totals.quantity,
        unit_cost: totals.unitCost,
        unit_sell: totals.unitSell,
        total_cost: totals.totalCost,
        total_sell: totals.totalSell,
      };
    });
  };

  const openEditor = () => {
    setForm(itemToForm(item));
    setError(null);
    setExpanded(true);
  };

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
    <div className="bg-background">
      <div className={ROW_GRID}>
        <div className="min-w-0">
          <p className="text-sm font-medium leading-snug">{item.client_label}</p>
          {item.internal_label !== item.client_label ? (
            <p className="text-xs text-muted-foreground truncate">
              {item.internal_label}
            </p>
          ) : null}
          <div className="mt-1 flex flex-wrap gap-1 md:hidden">
            <Badge variant="secondary" className="text-[10px]">
              {PRICING_ITEM_TYPES.find((type) => type.value === item.item_type)
                ?.label ?? item.item_type}
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
        <div className="hidden text-right text-xs md:block">
          {item.quantity ?? "—"}
          {item.unit ? ` ${item.unit}` : ""}
        </div>
        <div className="hidden text-right text-xs md:block">
          {item.unit_cost != null ? formatPricingMoney(item.unit_cost) : "—"}
        </div>
        <div className="hidden text-right text-xs md:block">
          {item.unit_sell != null ? formatPricingMoney(item.unit_sell) : "—"}
        </div>
        <div className="hidden text-right text-xs md:block">
          {formatPricingMoney(item.total_cost)}
        </div>
        <div className="hidden text-right text-xs font-medium md:block">
          {formatPricingMoney(item.total_sell)}
        </div>
        <div className="hidden text-right text-xs md:block">
          {formatPricingPercent(item.margin_percent)}
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
        <div className="space-y-4 border-t bg-muted/20 px-3 py-4">
          <p className="text-xs text-muted-foreground">
            Editing unit or total values will recalculate the related fields.
          </p>
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
              <Label>Qty</Label>
              <Input
                type="number"
                step="0.01"
                value={form.quantity ?? ""}
                onChange={(event) =>
                  updateCalculatedField(
                    "quantity",
                    parseNumericInput(event.target.value)
                  )
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
                  updateCalculatedField(
                    "unitCost",
                    parseNumericInput(event.target.value)
                  )
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
                  updateCalculatedField(
                    "unitSell",
                    parseNumericInput(event.target.value)
                  )
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
                  updateCalculatedField(
                    "totalCost",
                    parseNumericInput(event.target.value) ?? 0
                  )
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
                  updateCalculatedField(
                    "totalSell",
                    parseNumericInput(event.target.value) ?? 0
                  )
                }
              />
            </div>
            <div className="rounded-md border border-border/60 bg-background px-3 py-2 text-xs sm:col-span-2">
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                <span>
                  Gross profit:{" "}
                  <span className="font-medium text-foreground">
                    {formatPricingMoney(calculated.grossProfit)}
                  </span>
                </span>
                <span>
                  Margin:{" "}
                  <span className="font-medium text-foreground">
                    {formatPricingPercent(calculated.marginPercent)}
                  </span>
                </span>
                <span>
                  Markup:{" "}
                  <span className="font-medium text-foreground">
                    {formatPricingPercent(calculated.markupPercent)}
                  </span>
                </span>
              </div>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Internal notes</Label>
              <Textarea
                rows={2}
                value={form.notes_internal ?? ""}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    notes_internal: event.target.value || null,
                  }))
                }
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Client notes</Label>
              <Textarea
                rows={2}
                value={form.notes_client ?? ""}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    notes_client: event.target.value || null,
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
