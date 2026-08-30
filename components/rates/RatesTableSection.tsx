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
import { getRateSourceLabel } from "@/lib/rates/calibration";
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
};

function EngineBadge({
  support,
}: {
  support: RateCatalogueEntry["calculatorSupport"];
}) {
  if (support === "used_now") {
    return (
      <Badge variant="secondary" className="text-[10px]">
        Used now
      </Badge>
    );
  }
  if (support === "leftover") {
    return (
      <Badge variant="outline" className="text-[10px]">
        Legacy
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-[10px]">
      Planned
    </Badge>
  );
}

function isProductivityEntry(entry: RateCatalogueEntry): boolean {
  return entry.rate_type === "productivity";
}

function ChargeOutCell({
  rate,
  companyGrossMarginPercent,
}: {
  rate: RatesPageRate | undefined;
  companyGrossMarginPercent: number;
}) {
  const charge = displayChargeOut({
    costRate: rate?.cost_rate,
    sellRate: rate?.sell_rate,
    companyGrossMarginPercent,
  });
  if (charge.value == null) {
    return <span className="text-muted-foreground">—</span>;
  }
  return (
    <span className="tabular-nums">
      {formatMoney(charge.value)}
      {charge.isCustom ? (
        <span className="ml-1 text-[10px] font-normal text-muted-foreground">
          custom
        </span>
      ) : charge.isRecommended && rate?.cost_rate != null ? (
        <span className="ml-1 text-[10px] font-normal text-muted-foreground">
          recommended
        </span>
      ) : null}
    </span>
  );
}

function RateMobileCard({
  entry,
  rate,
  labelColumn,
  companyGrossMarginPercent,
  onEdit,
  onAdoptBenchmark,
}: {
  entry: RateCatalogueEntry;
  rate: RatesPageRate | undefined;
  labelColumn: string;
  companyGrossMarginPercent: number;
  onEdit: () => void;
  onAdoptBenchmark?: () => void;
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

  return (
    <div className="rounded-lg border border-border/60 bg-card p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1 space-y-1.5">
          <p className="text-sm font-medium leading-snug">{labelColumn}</p>
          {entry.trade ? (
            <p className="text-xs text-muted-foreground">{entry.trade}</p>
          ) : null}
          {entry.description ? (
            <p className="text-xs text-muted-foreground">{entry.description}</p>
          ) : null}
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>{formatRateUnit(entry.unit)}</span>
            <span>·</span>
            <span>{getRateSourceLabel(rate, entry.item_key)}</span>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm tabular-nums">
            {isProductivityEntry(entry) ? (
              <span>
                Hours{" "}
                <span className="font-medium">
                  {formatProductivityHours(
                    rate?.cost_rate ?? entry.defaultCostRate ?? null,
                    entry.unit
                  )}
                </span>
              </span>
            ) : (
              <>
                <span>
                  Your cost{" "}
                  <span className="font-medium">{formatMoney(rate?.cost_rate)}</span>
                </span>
                <span>
                  Charge-out{" "}
                  <span className="font-medium">{formatMoney(charge.value)}</span>
                  {charge.isCustom ? (
                    <span className="ml-1 text-xs font-normal text-muted-foreground">
                      (custom)
                    </span>
                  ) : null}
                </span>
              </>
            )}
          </div>
          {!hasCompanyRate && entry.defaultCostRate != null ? (
            <p className="text-xs text-muted-foreground">
              {isProductivityEntry(entry)
                ? `Quotr starter: ${formatProductivityHours(entry.defaultCostRate, entry.unit)}`
                : `Quotr benchmark cost: $${entry.defaultCostRate.toFixed(entry.defaultCostRate % 1 === 0 ? 0 : 2)} ${formatRateUnit(entry.unit)}`}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-col gap-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8"
            onClick={onEdit}
          >
            <Pencil className="mr-1 size-3.5" />
            {hasCompanyRate ? "Edit" : "Add your rate"}
          </Button>
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
        </div>
      </div>
    </div>
  );
}

function RateRow({
  entry,
  rate,
  showEngineColumn,
  hideChargeOut = false,
  labelColumn,
  companyGrossMarginPercent,
  onEdit,
  onAdoptBenchmark,
}: {
  entry: RateCatalogueEntry;
  rate: RatesPageRate | undefined;
  showEngineColumn: boolean;
  hideChargeOut?: boolean;
  labelColumn: string;
  companyGrossMarginPercent: number;
  onEdit: () => void;
  onAdoptBenchmark?: () => void;
}) {
  const hasCompanyRate = Boolean(rate?.active && rate.cost_rate != null);
  const canAdopt =
    !hasCompanyRate &&
    entry.defaultCostRate != null &&
    typeof onAdoptBenchmark === "function";

  return (
    <tr className="border-b border-border/50 last:border-0">
      <td className="px-3 py-2.5">
        <div className="font-medium">{labelColumn}</div>
        {entry.trade ? (
          <div className="text-xs text-muted-foreground">{entry.trade}</div>
        ) : null}
        {entry.description ? (
          <div className="text-xs text-muted-foreground">{entry.description}</div>
        ) : null}
        {!hasCompanyRate && entry.defaultCostRate != null ? (
          <div className="text-xs text-muted-foreground">
            {isProductivityEntry(entry)
              ? `Quotr starter: ${formatProductivityHours(entry.defaultCostRate, entry.unit)}`
              : `Quotr benchmark cost: $${entry.defaultCostRate.toFixed(entry.defaultCostRate % 1 === 0 ? 0 : 2)}`}
          </div>
        ) : null}
      </td>
      <td className="hidden px-3 py-2.5 text-muted-foreground sm:table-cell">
        {isProductivityEntry(entry)
          ? `h/${formatRateUnit(entry.unit)}`
          : formatRateUnit(entry.unit)}
      </td>
      <td className="px-3 py-2.5 tabular-nums">
        {isProductivityEntry(entry)
          ? formatProductivityHours(
              rate?.cost_rate ?? entry.defaultCostRate ?? null,
              entry.unit
            )
          : formatMoney(rate?.cost_rate)}
      </td>
      {hideChargeOut ? null : (
      <td className="px-3 py-2.5">
        {isProductivityEntry(entry) ? (
          <span className="text-muted-foreground">—</span>
        ) : (
          <ChargeOutCell
            rate={rate}
            companyGrossMarginPercent={companyGrossMarginPercent}
          />
        )}
      </td>
      )}
      <td className="hidden px-3 py-2.5 text-xs text-muted-foreground md:table-cell">
        {getRateSourceLabel(rate, entry.item_key)}
      </td>
      <td className="px-3 py-2.5">
        {hasCompanyRate ? (
          <Badge variant="secondary" className="text-[10px]">
            Active
          </Badge>
        ) : (
          <Badge variant="outline" className="text-[10px]">
            {entry.defaultCostRate != null ? "Benchmark" : "Pricing required"}
          </Badge>
        )}
      </td>
      {showEngineColumn ? (
        <td className="hidden px-3 py-2.5 lg:table-cell">
          <EngineBadge support={entry.calculatorSupport} />
        </td>
      ) : null}
      <td className="px-3 py-2.5 text-right">
        <div className="flex flex-wrap items-center justify-end gap-1">
          {canAdopt ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onAdoptBenchmark}
            >
              {isProductivityEntry(entry) ? "Use starter hours" : "Use benchmark cost"}
            </Button>
          ) : null}
          <Button type="button" variant="ghost" size="sm" onClick={onEdit}>
            <Pencil className="mr-1 size-3.5" />
            {hasCompanyRate ? "Edit" : "Add your rate"}
          </Button>
        </div>
      </td>
    </tr>
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
}: RatesTableSectionProps) {
  const margin = resolveCompanyGrossMarginPercent(companyGrossMarginPercent);
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
          {showAddButton && unsetEntries.length > 0 ? (
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
              <div key={group.workAreaLabel || "labour"} className="space-y-2">
                {((variant === "grouped" || variant === "productivity") &&
                group.workAreaLabel) ? (
                  <h3 className="text-sm font-medium">{group.workAreaLabel}</h3>
                ) : null}

                <div className="hidden overflow-x-auto rounded-lg border border-border/60 md:block">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border/60 bg-muted/30 text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                        <th className="px-3 py-2">Item</th>
                        <th className="hidden px-3 py-2 sm:table-cell">Unit</th>
                        <th className="px-3 py-2">
                          {productivityTable ? "Hours" : "Your cost"}
                        </th>
                        {productivityTable ? null : (
                          <th className="px-3 py-2">Charge-out</th>
                        )}
                        <th className="hidden px-3 py-2 md:table-cell">
                          Source
                        </th>
                        <th className="px-3 py-2">Status</th>
                        {showEngineColumn ? (
                          <th className="hidden px-3 py-2 lg:table-cell">
                            Engine
                          </th>
                        ) : null}
                        <th className="px-3 py-2 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.entries.map((entry) => (
                        <RateRow
                          key={entry.item_key}
                          entry={entry}
                          rate={rateMap.get(entry.item_key)}
                          showEngineColumn={showEngineColumn}
                          hideChargeOut={productivityTable}
                          labelColumn={entry.label}
                          companyGrossMarginPercent={margin}
                          onEdit={() => {
                            setEditingEntry(entry);
                            setNotice(null);
                          }}
                          onAdoptBenchmark={() => {
                            void handleAdoptBenchmark(entry);
                          }}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="space-y-2 md:hidden">
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
                    />
                  ))}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {editingEntry ? (
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
