"use client";

import { Button } from "@/components/ui/button";

type CompletedSetupSummaryProps = {
  title: string;
  detail: string;
  onEdit: () => void;
};

export function CompletedSetupSummary({
  title,
  detail,
  onEdit,
}: CompletedSetupSummaryProps) {
  return (
    <div
      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/60 bg-card px-4 py-3"
      data-setup-compact="true"
    >
      <div className="min-w-0">
        <p className="text-sm font-semibold">{title}</p>
        <p className="text-xs text-muted-foreground">{detail}</p>
      </div>
      <Button
        type="button"
        variant="outline"
        className="h-10 min-h-10"
        data-setup-edit
        onClick={onEdit}
      >
        Edit
      </Button>
    </div>
  );
}
