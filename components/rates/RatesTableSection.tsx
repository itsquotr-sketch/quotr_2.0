"use client";

import { useMemo, useState } from "react";
import { Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  formatRateUnit,
  formatProductivityHours,
  groupCatalogueByWorkArea,
} from "@/lib/rates/catalogue";
import { upsertRate } from "@/lib/rates/actions";
import type { RateCatalogueEntry } from "@/lib/rates/types";
import type { RatesPageRate } from "@/lib/rates/types";
import {
  displayChargeOut,
  formatMoney,
  resolveCompanyGrossMarginPercent,
} from "@/lib/rates/cost-first-presentation";
import { DEFAULT_MARGIN_PERCENT } from "@/lib/estimate/constants";
import {
  RateEditDialog,
  parseOptionalNumber,
  type RateEditValues,
} from "./RateEditDialog";

type RatesTableSectionProps = {
  title: string;
  description: string;
  catalogue: RateCatalogueEntry[];
  rates: RatesPageRate[];
  onRatesChange: (rates: RatesPageRate[]) => void;
  companyGrossMarginPercent?: number;
  variant?: "labour" | "grouped" | "productivity";
  showEngineColumn?: boolean;
  showAddButton?: boolean;
  readOnly?: boolean;
};

function isProductivityEntry(entry: RateCatalogueEntry): boolean {
  return entry.rate_type === "productivity";
}

function RateMobileCard({
  entry,
  rate,
  labelColumn,
  companyGrossMarginPercent,
  onEdit,
  onAdoptBenchmark,
  readOnly = false,
}: {
  entry: RateCatalogueEntry;
  rate: RatesPageRate | undefined;
  labelColumn: string;
  companyGrossMarginPercent: number;
  onEdit: () => void;
  onAdoptBenchmark?: () => void;
  readOnly?: boolean;
}) {
  const hasCompanyRate = Boolean(rate?.active && rate.cost_rate != null);
  const canAdopt =
    !hasCompanyRate &&
    entry.defaultCostRate != null &&
    typeof onAdoptBenchmark === "function";
  const charge = displayChargeOut({
    costRate: rate?.cost_rate,
    sellRate: rate?.sell_rate,
    companyGrossMarginPercent,
  });
  const statusLabel = hasCompanyRate
    ? "Your rate"
    : entry.defaultCostRate != null
      ? "Quotr benchmark"
      : "Pricing required";
  const yourRateDisplay = isProductivityEntry(entry)
    ? formatProductivityHours(rate?.cost_rate ?? null, entry.unit)
    : formatMoney(rate?.cost_rate);
  const benchmarkDisplay = isProductivityEntry(entry)
    ? entry.defaultCostRate != null
      ? formatProductivityHours(entry.defaultCostRate, entry.unit)
      : "—"
    : entry.defaultCostRate != null
      ? formatMoney(entry.defaultCostRate)
      : "—";

  return (
    <div className="border-b border-border/50 px-0 py-2.5 last:border-0 sm:grid sm:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,0.7fr))_auto_auto] sm:items-center sm:gap-3">
      <div className="min-w-0">
        <p className="text-sm font-medium leading-snug">{labelColumn}</p>
        {entry.trade ? (
          <p className="text-xs text-muted-foreground">{entry.trade}</p>
        ) : null}
      </div>
      <p className="mt-1 text-sm tabular-nums sm:mt-0">
        <span className="text-xs text-muted-foreground sm:hidden">Your rate </span>
        {yourRateDisplay}
        <span className="sr-only">Your cost</span>
      </p>
      <p className="text-sm text-muted-foreground tabular-nums">
        <span className="text-xs sm:hidden">Quotr benchmark </span>
        {benchmarkDisplay}
      </p>
      <p className="text-xs text-muted-foreground">
        {isProductivityEntry(entry)
          ? `h/${formatRateUnit(entry.unit)}`
          : formatRateUnit(entry.unit)}
      </p>
      <Badge variant={hasCompanyRate ? "secondary" : "outline"} className="mt-1 w-fit text-[10px] sm:mt-0">
        {statusLabel}
      </Badge>
      <div className="mt-1.5 flex flex-wrap items-center gap-1 sm:mt-0 sm:justify-end">
        {isProductivityEntry(entry) ? null : charge.value != null ? (
          <span className="text-[11px] text-muted-foreground tabular-nums">
            Charge-out {formatMoney(charge.value)}
          </span>
        ) : null}
        {readOnly ? null : (
          <>
            {canAdopt ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 text-xs"
                onClick={onAdoptBenchmark}
              >
                {isProductivityEntry(entry) ? "Use starter hours" : "Use benchmark cost"}
              </Button>
            ) : null}
            <Button type="button" variant="outline" size="sm" className="h-8" onClick={onEdit}>
              <Pencil className="mr-1 size-3.5" />
              {hasCompanyRate ? "Edit" : "Add"}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

export function RatesTableSection({
  title,
  description,
  catalogue,
  rates,
  onRatesChange,
  companyGrossMarginPercent = DEFAULT_MARGIN_PERCENT,
  variant = "labour",
  showEngineColumn = false,
  showAddButton = true,
  readOnly = false,
}: RatesTableSectionProps) {
  const margin = resolveCompanyGrossMarginPercent(companyGrossMarginPercent);
  void showEngineColumn;
  const rateMap = useMemo(
    () => new Map(rates.map((rate) => [rate.item_key, rate])),
    [rates]
  );

  const [editingEntry, setEditingEntry] = useState<RateCatalogueEntry | null>(
    null
  );
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const unsetEntries = catalogue.filter(
    (entry) => !rateMap.has(entry.item_key)
  );

  const groups =
    variant === "grouped" || variant === "productivity"
      ? groupCatalogueByWorkArea(catalogue)
      : [{ workAreaLabel: "", entries: catalogue }];
  const productivityTable = variant === "productivity";

  async function handleSave(values: RateEditValues): Promise<boolean> {
    if (!editingEntry) return false;

    setSaving(true);
    setNotice(null);

    const existing = rateMap.get(editingEntry.item_key);
    const cost = parseOptionalNumber(values.cost_rate);
    const sell =
      values.sellMode === "derived"
        ? null
        : parseOptionalNumber(values.sell_rate);

    const result = await upsertRate({
      id: existing?.id,
      item_key: editingEntry.item_key,
      rate_type: editingEntry.rate_type,
      trade: editingEntry.trade,
      work_area_type: editingEntry.work_area_type,
      label: editingEntry.label,
      unit: editingEntry.unit,
      cost_rate: cost,
      sell_rate: sell,
      markup_percent: parseOptionalNumber(values.markup_percent),
      active: values.active,
    });

    setSaving(false);

    if (result.error) {
      setNotice(result.error);
      return false;
    }

    if (result.rate) {
      const nextRates = existing
        ? rates.map((rate) =>
            rate.id === result.rate!.id ? result.rate! : rate
          )
        : [...rates, result.rate];
      onRatesChange(nextRates);
      setNotice("Regenerate an estimate to apply updated rates.");
    }

    return true;
  }

  async function handleAdoptBenchmark(entry: RateCatalogueEntry) {
    if (entry.defaultCostRate == null) return;

    setSaving(true);
    setNotice(null);

    const existing = rateMap.get(entry.item_key);
    // Cost-first adopt: store benchmark COST only; charge-out derives from company GM.
    const result = await upsertRate({
      id: existing?.id,
      item_key: entry.item_key,
      rate_type: entry.rate_type,
      trade: entry.trade,
      work_area_type: entry.work_area_type,
      label: entry.label,
      unit: entry.unit,
      cost_rate: entry.defaultCostRate,
      sell_rate: null,
      markup_percent: null,
      active: true,
    });

    setSaving(false);

    if (result.error) {
      setNotice(result.error);
      return;
    }

    if (result.rate) {
      const nextRates = existing
        ? rates.map((rate) =>
            rate.id === result.rate!.id ? result.rate! : rate
          )
        : [...rates, result.rate];
      onRatesChange(nextRates);
      setNotice(
        `Benchmark cost adopted. Charge-out will use your ${margin}% company gross margin. Regenerate an estimate to apply.`
      );
    }
  }

  return (
    <>
      <Card className="border-border/60 shadow-none">
        <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
          <div>
            <CardTitle className="text-base">{title}</CardTitle>
            <CardDescription className="mt-1.5">{description}</CardDescription>
          </div>
          {showAddButton && !readOnly && unsetEntries.length > 0 ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0"
              onClick={() => {
                setEditingEntry(unsetEntries[0]);
                setNotice(null);
              }}
            >
              <Plus className="mr-1 size-3.5" />
              Add rate
            </Button>
          ) : null}
        </CardHeader>
        <CardContent className="space-y-4">
          {notice ? (
            <p className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
              {notice}
            </p>
          ) : null}

          {catalogue.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No rates in this section.
            </p>
          ) : (
            groups.map((group) => (
              <div key={group.workAreaLabel || "labour"} className="space-y-1">
                {((variant === "grouped" || variant === "productivity") &&
                group.workAreaLabel) ? (
                  <h3 className="text-sm font-medium">{group.workAreaLabel}</h3>
                ) : null}

                <div
                  className="min-w-0 overflow-hidden"
                  data-rates-compact-list
                >
                  <div className="hidden border-b border-border/60 pb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground sm:grid sm:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,0.7fr))_auto_auto] sm:gap-3">
                    <span>Item</span>
                    <span>{productivityTable ? "Hours" : "Your rate"}</span>
                    <span>Quotr benchmark</span>
                    <span>Unit</span>
                    <span>Status</span>
                    <span className="text-right">Edit</span>
                  </div>
                  {group.entries.map((entry) => (
                    <RateMobileCard
                      key={entry.item_key}
                      entry={entry}
                      rate={rateMap.get(entry.item_key)}
                      labelColumn={entry.label}
                      companyGrossMarginPercent={margin}
                      onEdit={() => {
                        setEditingEntry(entry);
                        setNotice(null);
                      }}
                      onAdoptBenchmark={() => {
                        void handleAdoptBenchmark(entry);
                      }}
                      readOnly={readOnly}
                    />
                  ))}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {editingEntry && !readOnly ? (
        <RateEditDialog
          key={`${editingEntry.item_key}-${rateMap.get(editingEntry.item_key)?.id ?? "new"}`}
          open={Boolean(editingEntry)}
          onOpenChange={(open) => {
            if (!open) setEditingEntry(null);
          }}
          catalogueEntry={editingEntry}
          existingRate={rateMap.get(editingEntry.item_key) ?? null}
          companyGrossMarginPercent={margin}
          onSave={handleSave}
          saving={saving}
        />
      ) : null}
    </>
  );
}
