"use client";

import { useTransition } from "react";
import { Plus } from "lucide-react";
import { PricingItemRow } from "@/components/pricing/PricingItemRow";
import { Button } from "@/components/ui/button";
import {
  calculateDocumentTotals,
} from "@/lib/pricing/calculations";
import { formatPricingMoney, formatPricingPercent } from "@/lib/pricing/format";
import type {
  PricingItem,
  PricingItemInput,
  PricingWorkArea,
} from "@/lib/pricing/types";

type PricingWorkAreaSectionProps = {
  workArea: PricingWorkArea | null;
  items: PricingItem[];
  pricingDocumentId: string;
  projectId: string;
  onSaveItem: (
    itemId: string,
    input: PricingItemInput
  ) => Promise<{ error?: string }>;
  onDuplicateItem: (itemId: string) => Promise<{ error?: string }>;
  onDeleteItem: (itemId: string) => Promise<{ error?: string }>;
  onAddItem: (workAreaId: string | null) => Promise<{ error?: string }>;
};

export function PricingWorkAreaSection({
  workArea,
  items,
  pricingDocumentId,
  projectId,
  onSaveItem,
  onDuplicateItem,
  onDeleteItem,
  onAddItem,
}: PricingWorkAreaSectionProps) {
  const [isPending, startTransition] = useTransition();
  const sectionTotals = calculateDocumentTotals(
    items.map((item) => ({
      total_cost: item.total_cost,
      total_sell: item.total_sell,
    })),
    0
  );

  const handleAdd = () => {
    startTransition(async () => {
      await onAddItem(workArea?.id ?? null);
    });
  };

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">
            {workArea?.name ?? "General"}
          </h3>
          <p className="text-xs text-muted-foreground">
            Cost {formatPricingMoney(sectionTotals.subtotalCost)} · Charge{" "}
            {formatPricingMoney(sectionTotals.subtotalSell)} · Margin{" "}
            {formatPricingPercent(sectionTotals.marginPercent)}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isPending}
          onClick={handleAdd}
        >
          <Plus className="mr-1 size-4" />
          Add item
        </Button>
      </div>

      <div className="space-y-2">
        {items.map((item) => (
          <PricingItemRow
            key={item.id}
            item={item}
            onSave={(input) => onSaveItem(item.id, input)}
            onDuplicate={() => onDuplicateItem(item.id)}
            onDelete={() => onDeleteItem(item.id)}
          />
        ))}
      </div>

      {/* Keep props referenced for future section-specific actions */}
      <span className="sr-only">
        {pricingDocumentId} {projectId}
      </span>
    </section>
  );
}
