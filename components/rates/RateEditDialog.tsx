"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { RateCatalogueEntry } from "@/lib/rates/types";
import { formatRateUnit } from "@/lib/rates/catalogue";
import type { OrganisationRate } from "@/components/setup/types";

export type RateEditValues = {
  cost_rate: string;
  sell_rate: string;
  markup_percent: string;
  active: boolean;
};

type RateEditDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  catalogueEntry: RateCatalogueEntry;
  existingRate: OrganisationRate | null;
  onSave: (values: RateEditValues) => Promise<boolean>;
  saving: boolean;
};

function getInitialValues(rate: OrganisationRate | null): RateEditValues {
  return {
    cost_rate: rate?.cost_rate?.toString() ?? "",
    sell_rate: rate?.sell_rate?.toString() ?? "",
    markup_percent: rate?.markup_percent?.toString() ?? "",
    active: rate?.active ?? true,
  };
}

function parseOptionalNumber(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

export function RateEditDialog({
  open,
  onOpenChange,
  catalogueEntry,
  existingRate,
  onSave,
  saving,
}: RateEditDialogProps) {
  const [values, setValues] = useState<RateEditValues>(() =>
    getInitialValues(existingRate)
  );
  const [error, setError] = useState<string | null>(null);

  const showMarkup = false;

  async function handleSave() {
    setError(null);

    const cost = parseOptionalNumber(values.cost_rate);
    const sell = parseOptionalNumber(values.sell_rate);
    const markup = parseOptionalNumber(values.markup_percent);

    if (showMarkup) {
      if (markup != null && markup < 0) {
        setError("Markup must be non-negative.");
        return;
      }
    } else {
      if (cost != null && cost < 0) {
        setError("Cost rate must be non-negative.");
        return;
      }
      if (sell != null && sell < 0) {
        setError("Charge rate must be non-negative.");
        return;
      }
      if (cost == null && sell == null) {
        setError("Enter at least a cost rate.");
        return;
      }
    }

    const ok = await onSave(values);
    if (ok) {
      onOpenChange(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{catalogueEntry.label}</DialogTitle>
          <DialogDescription>
            {catalogueEntry.description ??
              (catalogueEntry.workAreaLabel
                ? `${catalogueEntry.workAreaLabel} · ${formatRateUnit(catalogueEntry.unit)}`
                : formatRateUnit(catalogueEntry.unit))}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {error ? (
            <p className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          ) : null}

          {showMarkup ? (
            <div className="space-y-2">
              <Label htmlFor="rate-markup">Markup %</Label>
              <Input
                id="rate-markup"
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={values.markup_percent}
                onChange={(event) =>
                  setValues((prev) => ({
                    ...prev,
                    markup_percent: event.target.value,
                  }))
                }
              />
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="rate-cost">Cost rate</Label>
                <Input
                  id="rate-cost"
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={values.cost_rate}
                  onChange={(event) =>
                    setValues((prev) => ({
                      ...prev,
                      cost_rate: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="rate-sell">Charge rate</Label>
                <Input
                  id="rate-sell"
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  placeholder="Leave blank to derive from margin"
                  value={values.sell_rate}
                  onChange={(event) =>
                    setValues((prev) => ({
                      ...prev,
                      sell_rate: event.target.value,
                    }))
                  }
                />
                <p className="text-xs text-muted-foreground">
                  If charge rate is blank, Quotr derives it from your margin.
                </p>
              </div>
            </>
          )}

          {existingRate ? (
            <div className="flex items-center gap-2">
              <Checkbox
                id="rate-active"
                checked={values.active}
                onCheckedChange={(checked) =>
                  setValues((prev) => ({
                    ...prev,
                    active: checked === true,
                  }))
                }
              />
              <Label htmlFor="rate-active" className="font-normal">
                Active
              </Label>
            </div>
          ) : null}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button type="button" onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : "Save rate"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export { parseOptionalNumber };
