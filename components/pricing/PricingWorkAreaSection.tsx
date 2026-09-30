"use client";

import { useMemo, useState, useTransition } from "react";
import { ChevronDown, Plus } from "lucide-react";
import { PricingItemListItem } from "@/components/pricing/PricingItemListItem";
import { useIsDesktop } from "@/lib/hooks/use-media-query";
import { WorkAreaQuoteDescriptionEditor } from "@/components/work-areas/WorkAreaQuoteDescriptionEditor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { pricingItemViewModel } from "@/lib/pricing/financial-view-model";
import { pricingWorkAreaDomId } from "@/components/pricing/PricingReadiness";
import { presentPricingSectionTotals } from "@/lib/pricing/presentation-section-totals";
import { formatPricingMoney } from "@/lib/pricing/format";
import { PRICING_TABLE_HEADER_CLASS } from "@/lib/pricing/table-layout";
import type {
  PricingItem,
  PricingItemInput,
  PricingWorkArea,
} from "@/lib/pricing/types";
import { cn } from "@/lib/utils";

type PricingWorkAreaSectionProps = {
  projectId: string;
  title?: string;
  workArea: PricingWorkArea | null;
  items: PricingItem[];
  selectedIds?: Set<string>;
  selectionMode?: boolean;
  onToggleSelect?: (itemId: string) => void;
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
  showAddItem?: boolean;
  openRequest?: string | null;
  sectionKey?: string;
};

export function PricingWorkAreaSection({
  projectId,
  title,
  workArea,
  items,
  selectedIds,
  selectionMode = false,
  onToggleSelect,
  onQuoteDescriptionSaved,
  onSaveItem,
  onDuplicateItem,
  onDeleteItem,
  onAddItem,
  showAddItem = true,
  openRequest = null,
  sectionKey = "section",
}: PricingWorkAreaSectionProps) {
  const [expanded, setExpanded] = useState(false);
  const [handledRequest, setHandledRequest] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const isDesktop = useIsDesktop();
  const itemLayout = isDesktop ? "table" : "card";

  const sectionTotals = useMemo(
    () => presentPricingSectionTotals(items),
    [items]
  );
  const requiredCount = items.filter(
    (item) => pricingItemViewModel(item).pricingRequired
  ).length;
  const sectionId = workArea
    ? pricingWorkAreaDomId(workArea.id)
    : sectionKey === "general"
      ? pricingWorkAreaDomId(null)
      : `pricing-group-${sectionKey}`;
  const costLabel = sectionTotals.costKnown
    ? formatPricingMoney(sectionTotals.subtotalCost)
    : "Pricing required";
  const sellLabel =
    requiredCount === items.length && requiredCount > 0
      ? "Pricing required"
      : formatPricingMoney(sectionTotals.subtotalSell);
  const readiness =
    requiredCount > 0
      ? `${requiredCount} Pricing required`
      : "Priced";
  if (openRequest && openRequest === sectionId && handledRequest !== openRequest) {
    setHandledRequest(openRequest);
    setExpanded(true);
  }

  const handleAdd = () => {
    startTransition(async () => {
      await onAddItem(workArea?.id ?? null);
    });
  };

  const sectionName = title ?? workArea?.name ?? "General";

  return (
    <section
      id={sectionId}
      className="scroll-mt-4 overflow-hidden rounded-xl border border-border bg-card"
      data-pricing-work-area={sectionName}
    >
      <div className="flex items-start gap-2 px-3 py-2 sm:px-4">
        <button
          type="button"
          className="flex min-h-11 min-w-0 flex-1 items-start gap-2 py-1 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-orange)]"
          onClick={() => setExpanded((prev) => !prev)}
          aria-expanded={expanded}
          aria-controls={`${sectionId}-lines`}
        >
          <ChevronDown
            className={cn(
              "mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform",
              !expanded && "-rotate-90"
            )}
          />
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-semibold leading-snug">{sectionName}</h3>
              <Badge variant="secondary" className="text-xs font-normal">
                {readiness}
              </Badge>
            </div>
            <p className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs leading-4 text-foreground/75">
              <span>{items.length} {items.length === 1 ? "item" : "items"}</span>
              <span className="tabular-nums">Direct cost {costLabel}</span>
              <span className="tabular-nums">Client sell {sellLabel}</span>
            </p>
          </div>
        </button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn("h-11 min-h-11 shrink-0", !showAddItem && "hidden")}
          disabled={isPending}
          onClick={handleAdd}
        >
          <Plus className="mr-1 size-3.5" />
          <span className="hidden sm:inline">Add item</span>
          <span className="sm:hidden">Add</span>
        </Button>
      </div>

      {expanded ? (
        <div id={`${sectionId}-lines`}>
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
            <span />
            <span className="min-w-0">Item</span>
            <span className="min-w-0">Category</span>
            <span className="text-right">Qty</span>
            <span className="text-right">Total charge</span>
            <span className="text-right">Margin</span>
            <span>On quote</span>
            <span className="text-right">Actions</span>
          </div>

          <div
            className={
              itemLayout === "table"
                ? "divide-y divide-border/50"
                : "space-y-2 p-3"
            }
          >
            {items.map((item) => (
              <PricingItemListItem
                key={item.id}
                item={item}
                layout={itemLayout}
                selected={selectedIds?.has(item.id) ?? false}
                selectionMode={selectionMode}
                onToggleSelect={onToggleSelect}
                onSaveItem={onSaveItem}
                onDuplicateItem={onDuplicateItem}
                onDeleteItem={onDeleteItem}
              />
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
