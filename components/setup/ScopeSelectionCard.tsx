"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  getEstimateSupportLabel,
  type ScopeCatalogueItem,
} from "@/lib/scopes/catalogue";
import { cn } from "@/lib/utils";

type ScopeSelectionCardProps = {
  scope: ScopeCatalogueItem;
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
};

export function ScopeSelectionCard({
  scope,
  enabled,
  onToggle,
}: ScopeSelectionCardProps) {
  const supportLabel = getEstimateSupportLabel(scope.estimateSupport);

  return (
    <Card
      size="sm"
      className={cn(
        "cursor-pointer transition-colors",
        enabled ? "ring-2 ring-primary/20" : "opacity-80 hover:opacity-100"
      )}
      onClick={() => onToggle(!enabled)}
    >
      <CardContent className="flex gap-3 py-4">
        <Checkbox
          checked={enabled}
          onCheckedChange={(checked) => onToggle(checked === true)}
          onClick={(event) => event.stopPropagation()}
          aria-label={`Enable ${scope.label}`}
        />
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <Label className="cursor-pointer text-sm font-medium">
              {scope.label}
            </Label>
            <Badge
              variant={
                scope.estimateSupport === "calculator" ? "default" : "secondary"
              }
            >
              {supportLabel}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">{scope.description}</p>
        </div>
      </CardContent>
    </Card>
  );
}
