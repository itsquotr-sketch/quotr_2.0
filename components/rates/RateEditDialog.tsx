"use client";

import { useMemo, useState } from "react";
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
import { personHoursPerUnit } from "@/lib/estimate/retaining-wall-family-coverage";
import type { OrganisationRate } from "@/components/setup/types";
import {
  formatMoney,
  presentCompanyRate,
  tryRecommendedChargeOutFromCostString,
  type CompanyRateSellMode,
} from "@/lib/rates/cost-first-presentation";

export type RateEditValues = {
  cost_rate: string;
  /** Empty when derived; set when retained custom / explicit override */
  sell_rate: string;
  markup_percent: string;
  active: boolean;
  /** Persist null sell when derived */
  sellMode: CompanyRateSellMode | "explicit_override";
};

type RateEditDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  catalogueEntry: RateCatalogueEntry;
  existingRate: OrganisationRate | null;
  companyGrossMarginPercent: number;
  onSave: (values: RateEditValues) => Promise<boolean>;
  saving: boolean;
};

function getInitialValues(
  rate: OrganisationRate | null,
  companyGrossMarginPercent: number
): RateEditValues {
  const presented = presentCompanyRate({
    costRate: rate?.cost_rate,
    sellRate: rate?.sell_rate,
    companyGrossMarginPercent,
  });

  return {
    cost_rate: rate?.cost_rate?.toString() ?? "",
    sell_rate: rate?.sell_rate?.toString() ?? "",
    markup_percent: rate?.markup_percent?.toString() ?? "",
    active: rate?.active ?? true,
    sellMode: presented.sellMode,
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
  companyGrossMarginPercent,
  onSave,
  saving,
}: RateEditDialogProps) {
  const [values, setValues] = useState<RateEditValues>(() =>
    getInitialValues(existingRate, companyGrossMarginPercent)
  );
  const [error, setError] = useState<string | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(
    () =>
      presentCompanyRate({
        costRate: existingRate?.cost_rate,
        sellRate: existingRate?.sell_rate,
        companyGrossMarginPercent,
      }).hasRetainedChargeOut
  );
  const [crewSize, setCrewSize] = useState("2");
  const [elapsedHours, setElapsedHours] = useState("1");
  const [quantityCompleted, setQuantityCompleted] = useState("4");

  const unitLabel = formatRateUnit(catalogueEntry.unit);
  const isProductivity = catalogueEntry.rate_type === "productivity";
  const recommended = useMemo(
    () =>
      tryRecommendedChargeOutFromCostString(
        values.cost_rate,
        companyGrossMarginPercent
      ),
    [values.cost_rate, companyGrossMarginPercent]
  );

  const initialPresented = useMemo(
    () =>
      presentCompanyRate({
        costRate: existingRate?.cost_rate,
        sellRate: existingRate?.sell_rate,
        companyGrossMarginPercent,
      }),
    [existingRate, companyGrossMarginPercent]
  );

  const isRetained =
    values.sellMode === "retained_custom" ||
    values.sellMode === "explicit_override";

  const derivedPersonHours = useMemo(() => {
    const crew = parseOptionalNumber(crewSize);
    const elapsed = parseOptionalNumber(elapsedHours);
    const qty = parseOptionalNumber(quantityCompleted);
    if (crew == null || elapsed == null || qty == null) return null;
    return personHoursPerUnit({
      crewSize: crew,
      elapsedHours: elapsed,
      quantityCompleted: qty,
    });
  }, [crewSize, elapsedHours, quantityCompleted]);

  async function handleSave() {
    setError(null);

    const cost = parseOptionalNumber(values.cost_rate);
    if (cost == null) {
      setError(isProductivity ? "Enter hours." : "Enter your cost.");
      return;
    }
    if (isProductivity) {
      if (!(cost > 0)) {
        setError("Hours must be greater than zero.");
        return;
      }
    } else if (cost < 0) {
      setError("Cost must be non-negative.");
      return;
    }

    let sellToSave = "";
    let mode = isProductivity ? "derived" : values.sellMode;

    if (mode === "derived") {
      sellToSave = "";
    } else {
      const sell = parseOptionalNumber(values.sell_rate);
      if (sell == null) {
        setError("Enter a custom charge-out, or use the recommended rate.");
        return;
      }
      if (sell < 0) {
        setError("Charge-out must be non-negative.");
        return;
      }
      sellToSave = values.sell_rate;
      mode = "explicit_override";
    }

    const ok = await onSave({
      ...values,
      sell_rate: sellToSave,
      sellMode: mode === "derived" ? "derived" : "explicit_override",
    });
    if (ok) {
      onOpenChange(false);
    }
  }

  function useRecommended() {
    setValues((prev) => ({
      ...prev,
      sell_rate: "",
      sellMode: "derived",
    }));
    setAdvancedOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{catalogueEntry.label}</DialogTitle>
          <DialogDescription>
            {catalogueEntry.description ??
              (catalogueEntry.workAreaLabel
                ? `${catalogueEntry.workAreaLabel} · ${unitLabel}`
                : unitLabel)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {error ? (
            <p className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="rate-cost">
              {isProductivity ? "Hours" : "Your cost"}
            </Label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                {catalogueEntry.rate_type === "productivity" ? "h" : "$"}
              </span>
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
                className="pl-7"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {isProductivity
                ? `Total worker-hours per ${unitLabel} — not elapsed crew time.`
                : `What this costs your business · ${unitLabel}`}
            </p>
          </div>

          {isProductivity ? (
            <div className="space-y-2 rounded-lg border border-border/60 bg-muted/20 px-3 py-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Productivity helper
              </p>
              <p className="text-xs text-muted-foreground">
                Crew size × elapsed hours ÷ quantity completed = labour-hours per
                unit.
              </p>
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <Label htmlFor="crew-size" className="text-xs">
                    Crew
                  </Label>
                  <Input
                    id="crew-size"
                    type="number"
                    min="1"
                    step="1"
                    inputMode="numeric"
                    value={crewSize}
                    onChange={(event) => setCrewSize(event.target.value)}
                    className="h-8"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="elapsed-hours" className="text-xs">
                    Elapsed (h)
                  </Label>
                  <Input
                    id="elapsed-hours"
                    type="number"
                    min="0"
                    step="0.01"
                    inputMode="decimal"
                    value={elapsedHours}
                    onChange={(event) => setElapsedHours(event.target.value)}
                    className="h-8"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="qty-completed" className="text-xs">
                    Qty done
                  </Label>
                  <Input
                    id="qty-completed"
                    type="number"
                    min="0"
                    step="0.01"
                    inputMode="decimal"
                    value={quantityCompleted}
                    onChange={(event) =>
                      setQuantityCompleted(event.target.value)
                    }
                    className="h-8"
                  />
                </div>
              </div>
              {derivedPersonHours != null ? (
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm tabular-nums">
                    = {derivedPersonHours} labour-h/{unitLabel}
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7"
                    onClick={() =>
                      setValues((prev) => ({
                        ...prev,
                        cost_rate: String(derivedPersonHours),
                      }))
                    }
                  >
                    Use result
                  </Button>
                </div>
              ) : null}
            </div>
          ) : null}

          {isProductivity ? null : (
            <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-3 space-y-1.5">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Recommended charge-out
            </p>
            <p className="text-lg font-semibold tabular-nums">
              {formatMoney(recommended)}
              <span className="ml-1 text-sm font-normal text-muted-foreground">
                / {unitLabel}
              </span>
            </p>
            <p className="text-xs text-muted-foreground">
              Using {companyGrossMarginPercent}% company gross margin
            </p>
          </div>
          )}

          {isProductivity ? null : initialPresented.hasRetainedChargeOut &&
          values.sellMode === "retained_custom" ? (
            <div className="rounded-lg border border-amber-200/80 bg-amber-50/50 px-3 py-3 space-y-2 dark:border-amber-900/40 dark:bg-amber-950/20">
              <p className="text-sm font-medium">Current charge-out retained</p>
              <p className="text-sm tabular-nums">
                {formatMoney(initialPresented.persistedSellRate)} / {unitLabel}
              </p>
              {initialPresented.recommendedDiffersFromRetained ? (
                <p className="text-xs text-muted-foreground">
                  Based on your {companyGrossMarginPercent}% company margin,
                  Quotr&apos;s recommended charge-out is{" "}
                  {formatMoney(recommended)}.
                </p>
              ) : null}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8"
                onClick={useRecommended}
              >
                Use recommended rate
              </Button>
            </div>
          ) : null}

          {isProductivity ? null : !isRetained ? (
            <p className="text-xs text-muted-foreground">
              Charge-out will follow your company gross margin when you estimate.
            </p>
          ) : null}

          {isProductivity ? null : (
          <div className="space-y-2">
            <button
              type="button"
              className="text-xs font-medium text-muted-foreground underline-offset-4 hover:underline"
              onClick={() => setAdvancedOpen((open) => !open)}
            >
              {advancedOpen ? "Hide custom charge-out" : "Custom charge-out"}
            </button>
            {advancedOpen ? (
              <div className="space-y-2 rounded-lg border border-dashed border-border/70 p-3">
                <Label htmlFor="rate-sell">Custom charge-out</Label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                    $
                  </span>
                  <Input
                    id="rate-sell"
                    type="number"
                    min="0"
                    step="0.01"
                    inputMode="decimal"
                    placeholder={
                      recommended != null
                        ? recommended.toFixed(2)
                        : "0.00"
                    }
                    value={values.sell_rate}
                    onChange={(event) =>
                      setValues((prev) => ({
                        ...prev,
                        sell_rate: event.target.value,
                        sellMode: "explicit_override",
                      }))
                    }
                    className="pl-7"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Overrides the recommended charge-out until you clear it or use
                  the recommended rate.
                </p>
                {isRetained ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 px-0"
                    onClick={useRecommended}
                  >
                    Clear custom — use recommended
                  </Button>
                ) : null}
              </div>
            ) : null}
          </div>
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
