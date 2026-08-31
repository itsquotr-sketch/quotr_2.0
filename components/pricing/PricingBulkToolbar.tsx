"use client";

import { Eye, EyeOff, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";

type PricingBulkToolbarProps = {
  selectedCount: number;
  canDeleteCount: number;
  isPending?: boolean;
  onShowOnQuote: () => void;
  onHideFromQuote: () => void;
  onDeleteManual: () => void;
  onClear: () => void;
};

export function PricingBulkToolbar({
  selectedCount,
  canDeleteCount,
  isPending = false,
  onShowOnQuote,
  onHideFromQuote,
  onDeleteManual,
  onClear,
}: PricingBulkToolbarProps) {
  if (selectedCount === 0) {
    return null;
  }

  return (
    <div className="sticky top-[3.25rem] z-30 flex flex-wrap items-center gap-2 rounded-lg border bg-card px-3 py-2 shadow-sm">
      <p className="text-sm font-medium">
        {selectedCount} selected
      </p>
      <div className="flex flex-wrap items-center gap-1.5">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8"
          disabled={isPending}
          onClick={onShowOnQuote}
        >
          <Eye className="mr-1 size-3.5" />
          Show on Quote
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8"
          disabled={isPending}
          onClick={onHideFromQuote}
        >
          <EyeOff className="mr-1 size-3.5" />
          Hide from Quote
        </Button>
        {canDeleteCount > 0 ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 text-destructive"
            disabled={isPending}
            onClick={onDeleteManual}
          >
            <Trash2 className="mr-1 size-3.5" />
            Delete ({canDeleteCount})
          </Button>
        ) : null}
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-8"
          disabled={isPending}
          onClick={onClear}
        >
          <X className="mr-1 size-3.5" />
          Clear
        </Button>
      </div>
    </div>
  );
}
