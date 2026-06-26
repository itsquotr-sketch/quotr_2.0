"use client";

import { memo, useCallback } from "react";
import { PricingItemRow } from "@/components/pricing/PricingItemRow";
import type { PricingItem, PricingItemInput } from "@/lib/pricing/types";

type PricingItemListItemProps = {
  item: PricingItem;
  layout: "table" | "card";
  onSaveItem: (
    itemId: string,
    input: PricingItemInput
  ) => Promise<{ error?: string }>;
  onDuplicateItem: (itemId: string) => Promise<{ error?: string }>;
  onDeleteItem: (itemId: string) => Promise<{ error?: string }>;
};

function PricingItemListItemComponent({
  item,
  layout,
  onSaveItem,
  onDuplicateItem,
  onDeleteItem,
}: PricingItemListItemProps) {
  const handleSave = useCallback(
    (input: PricingItemInput) => onSaveItem(item.id, input),
    [item.id, onSaveItem]
  );
  const handleDuplicate = useCallback(
    () => onDuplicateItem(item.id),
    [item.id, onDuplicateItem]
  );
  const handleDelete = useCallback(
    () => onDeleteItem(item.id),
    [item.id, onDeleteItem]
  );

  return (
    <PricingItemRow
      item={item}
      layout={layout}
      onSave={handleSave}
      onDuplicate={handleDuplicate}
      onDelete={handleDelete}
    />
  );
}

export const PricingItemListItem = memo(PricingItemListItemComponent);
