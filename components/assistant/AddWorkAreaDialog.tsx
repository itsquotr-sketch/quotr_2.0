"use client";

import { useMemo, useState } from "react";
import {
  getEstimateSupportLabel,
  SCOPE_CATALOGUE,
  type ScopeCatalogueItem,
} from "@/lib/scopes/catalogue";
import type { WorkArea } from "@/components/assistant/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";

type AddWorkAreaDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workAreas: WorkArea[];
  isSaving?: boolean;
  error?: string | null;
  onAdd: (workAreaType: string) => Promise<void>;
};

function isAvailableToAdd(
  item: ScopeCatalogueItem,
  workAreas: WorkArea[]
): boolean {
  const existing = workAreas.find((area) => area.type === item.type);
  if (!existing) return true;
  return existing.status === "excluded";
}

export function AddWorkAreaDialog({
  open,
  onOpenChange,
  workAreas,
  isSaving,
  error,
  onAdd,
}: AddWorkAreaDialogProps) {
  const [query, setQuery] = useState("");
  const [selectedType, setSelectedType] = useState<string | null>(null);

  const options = useMemo(() => {
    const available = SCOPE_CATALOGUE.filter((item) =>
      isAvailableToAdd(item, workAreas)
    );

    const normalized = query.trim().toLowerCase();
    if (!normalized) return available;

    return available.filter(
      (item) =>
        item.label.toLowerCase().includes(normalized) ||
        item.category.toLowerCase().includes(normalized) ||
        item.description.toLowerCase().includes(normalized)
    );
  }, [query, workAreas]);

  const handleAdd = async () => {
    if (!selectedType) return;
    await onAdd(selectedType);
    setSelectedType(null);
    setQuery("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-hidden sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add work area</DialogTitle>
          <DialogDescription>
            Choose a scope item to include in this estimate. Changing work
            areas will mark the estimate as outdated.
          </DialogDescription>
        </DialogHeader>

        <Input
          placeholder="Search work areas…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          disabled={isSaving}
        />

        <div className="max-h-[50vh] space-y-2 overflow-y-auto pr-1">
          {options.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No additional work areas available to add.
            </p>
          ) : (
            options.map((item) => {
              const isSelected = selectedType === item.type;
              const wasExcluded = workAreas.some(
                (area) => area.type === item.type && area.status === "excluded"
              );

              return (
                <button
                  key={item.type}
                  type="button"
                  disabled={isSaving}
                  onClick={() => setSelectedType(item.type)}
                  className={`w-full rounded-xl border px-3 py-3 text-left transition-colors ${
                    isSelected
                      ? "border-primary/30 bg-primary/5 ring-1 ring-primary/20"
                      : "border-border hover:bg-muted/40"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium">{item.label}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {item.category}
                      </p>
                    </div>
                    <Badge variant="secondary" className="shrink-0 text-[10px]">
                      {getEstimateSupportLabel(item.estimateSupport)}
                    </Badge>
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                    {item.description}
                  </p>
                  {wasExcluded ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Previously excluded — will be restored.
                    </p>
                  ) : null}
                </button>
              );
            })
          )}
        </div>

        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}

        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            disabled={isSaving}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={!selectedType || isSaving}
            onClick={() => void handleAdd()}
          >
            {isSaving ? (
              <>
                <Loader2 className="mr-1.5 size-4 animate-spin" />
                Adding…
              </>
            ) : (
              "Add work area"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
