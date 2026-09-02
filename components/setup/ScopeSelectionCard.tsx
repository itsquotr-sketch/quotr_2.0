"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import type { ScopeCatalogueItem } from "@/lib/scopes/catalogue";
import { cn } from "@/lib/utils";

type ScopeSelectionCardProps = {
  scope: ScopeCatalogueItem;
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  compact?: boolean;
};

/**
 * Preference checkbox for Setup Work Types.
 * No support-level badge here — catalogue items currently share equal
 * calculator support, so repeating that label was noise (R2B).
 */
export function ScopeSelectionCard({
  scope,
  enabled,
  onToggle,
  compact = false,
}: ScopeSelectionCardProps) {
  return (
    <Card
      size="sm"
      className={cn(
        "cursor-pointer transition-colors",
        enabled ? "ring-2 ring-primary/20" : "opacity-80 hover:opacity-100"
      )}
      onClick={() => onToggle(!enabled)}
    >
      <CardContent className="flex gap-3 py-3 sm:py-4">
        <Checkbox
          checked={enabled}
          onCheckedChange={(checked) => onToggle(checked === true)}
          onClick={(event) => event.stopPropagation()}
          aria-label={`Prefer ${scope.label}`}
        />
        <div className="min-w-0 flex-1 space-y-1">
          <Label className="cursor-pointer text-sm font-medium">
            {scope.label}
          </Label>
          {compact ? null : (
            <p className="text-sm text-muted-foreground">{scope.description}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
