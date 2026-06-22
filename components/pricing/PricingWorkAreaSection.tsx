"use client";

import { useMemo, useTransition } from "react";
import { Plus } from "lucide-react";
import { PricingItemRow } from "@/components/pricing/PricingItemRow";
import { WorkAreaQuoteDescriptionEditor } from "@/components/work-areas/WorkAreaQuoteDescriptionEditor";
import { Button } from "@/components/ui/button";
import { calculateDocumentTotals } from "@/lib/pricing/calculations";
import { formatPricingMoney, formatPricingPercent } from "@/lib/pricing/format";
import type {
  PricingItem,
  PricingItemInput,
  PricingWorkArea,
} from "@/lib/pricing/types";

type PricingWorkAreaSectionProps = {
  projectId: string;
  workArea: PricingWorkArea | null;
  items: PricingItem[];
  existingQuoteWarning?: boolean;
  onQuoteDescriptionSaved?: (
    workAreaId: string,
    description: string | null
  ) => void;
  onSaveItem: (
    itemId: string,
    input: PricingItemInput
  ) => Promise<{ error?: string }>;
  onDuplicateItem: (itemId: string) => Promise<{ error?: string }>;
  onDeleteItem: (itemId: string) => Promise<{ error?: string }>;
  onAddItem: (workAreaId: string | null) => Promise<{ error?: string }>;
};

const TABLE_HEADER_CLASS =
  "hidden gap-2 px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground md:grid md:grid-cols-[minmax(0,1.5fr)_0.7fr_0.8fr_0.6fr_0.75fr_0.75fr_0.75fr_0.75fr_0.55fr_auto] md:items-center";

export function PricingWorkAreaSection({
  projectId,
  workArea,
  items,
  existingQuoteWarning = false,
  onQuoteDescriptionSaved,
  onSaveItem,
  onDuplicateItem,
  onDeleteItem,
  onAddItem,
}: PricingWorkAreaSectionProps) {
  const [isPending, startTransition] = useTransition();
  const sectionTotals = useMemo(
    () =>
      calculateDocumentTotals(
        items.map((item) => ({
          total_cost: item.total_cost,
          total_sell: item.total_sell,
        })),
        0
      ),
    [items]
  );

  const handleAdd = () => {
    startTransition(async () => {
      await onAddItem(workArea?.id ?? null);
    });
  };

  return (
    <section className="rounded-xl border border-border/60 bg-muted/10">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border/60 px-4 py-3">
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

      {workArea ? (
        <div className="px-4">
          <WorkAreaQuoteDescriptionEditor
            projectId={projectId}
            workAreaId={workArea.id}
            workAreaName={workArea.name}
            initialDescription={workArea.quote_description}
            existingQuoteWarning={existingQuoteWarning}
            onSaved={(description) =>
              onQuoteDescriptionSaved?.(workArea.id, description)
            }
          />
        </div>
      ) : null}

      <div className={TABLE_HEADER_CLASS}>
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

      <div className="divide-y divide-border/50">
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
    </section>
  );
}
