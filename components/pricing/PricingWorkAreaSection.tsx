"use client";

import { useMemo, useState, useTransition } from "react";
import { ChevronDown, Plus } from "lucide-react";
import { PricingItemRow } from "@/components/pricing/PricingItemRow";
import { WorkAreaQuoteDescriptionEditor } from "@/components/work-areas/WorkAreaQuoteDescriptionEditor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { calculateDocumentTotals } from "@/lib/pricing/calculations";
import { formatPricingMoney, formatPricingPercent } from "@/lib/pricing/format";
import { PRICING_TABLE_HEADER_CLASS } from "@/lib/pricing/table-layout";
import type {
  PricingItem,
  PricingItemInput,
  PricingWorkArea,
} from "@/lib/pricing/types";
import { cn } from "@/lib/utils";

type PricingWorkAreaSectionProps = {
  projectId: string;
  workArea: PricingWorkArea | null;
  items: PricingItem[];
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

export function PricingWorkAreaSection({
  projectId,
  workArea,
  items,
  onQuoteDescriptionSaved,
  onSaveItem,
  onDuplicateItem,
  onDeleteItem,
  onAddItem,
}: PricingWorkAreaSectionProps) {
  const [expanded, setExpanded] = useState(true);
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

  const sectionName = workArea?.name ?? "General";

  return (
    <section className="overflow-hidden rounded-lg border border-border/60 bg-card">
      <div className="flex items-start gap-2 border-b border-border/60 px-3 py-3 sm:px-4">
        <button
          type="button"
          className="flex min-w-0 flex-1 items-start gap-2 text-left"
          onClick={() => setExpanded((prev) => !prev)}
          aria-expanded={expanded}
        >
          <ChevronDown
            className={cn(
              "mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform",
              !expanded && "-rotate-90"
            )}
          />
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold">{sectionName}</h3>
              <Badge variant="secondary" className="text-[10px] font-normal">
                {items.length} item{items.length === 1 ? "" : "s"}
              </Badge>
            </div>
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-xs">
              <span className="font-medium text-foreground">
                {formatPricingMoney(sectionTotals.subtotalSell)}
              </span>
              <span className="text-muted-foreground">
                charge · {formatPricingPercent(sectionTotals.marginPercent)} margin
              </span>
            </div>
          </div>
        </button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 shrink-0"
          disabled={isPending}
          onClick={handleAdd}
        >
          <Plus className="mr-1 size-3.5" />
          <span className="hidden sm:inline">Add item</span>
          <span className="sm:hidden">Add</span>
        </Button>
      </div>

      {expanded ? (
        <>
          {workArea ? (
            <div className="border-b border-border/60 px-3 py-3 sm:px-4">
              <WorkAreaQuoteDescriptionEditor
                projectId={projectId}
                workAreaId={workArea.id}
                workAreaName={workArea.name}
                initialDescription={workArea.quote_description}
                onSaved={(description) =>
                  onQuoteDescriptionSaved?.(workArea.id, description)
                }
              />
            </div>
          ) : null}

          <div className={PRICING_TABLE_HEADER_CLASS}>
            <span className="min-w-0">Item</span>
            <span className="min-w-0">Category</span>
            <span className="text-right">Qty</span>
            <span className="text-right">Total charge</span>
            <span className="text-right">Margin</span>
            <span>On quote</span>
            <span className="text-right">Actions</span>
          </div>

          <div className="hidden divide-y divide-border/50 md:block">
            {items.map((item) => (
              <PricingItemRow
                key={item.id}
                item={item}
                layout="table"
                onSave={(input) => onSaveItem(item.id, input)}
                onDuplicate={() => onDuplicateItem(item.id)}
                onDelete={() => onDeleteItem(item.id)}
              />
            ))}
          </div>

          <div className="space-y-2 p-3 md:hidden">
            {items.map((item) => (
              <PricingItemRow
                key={item.id}
                item={item}
                layout="card"
                onSave={(input) => onSaveItem(item.id, input)}
                onDuplicate={() => onDuplicateItem(item.id)}
                onDelete={() => onDeleteItem(item.id)}
              />
            ))}
          </div>
        </>
      ) : null}
    </section>
  );
}
