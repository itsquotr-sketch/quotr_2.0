"use client";

import { useMemo, useState } from "react";
import { ChevronDown, Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  formatRateUnit,
  formatProductivityHours,
  groupCatalogueByWorkArea,
} from "@/lib/rates/catalogue";
import { upsertRate } from "@/lib/rates/actions";
import type { RateCatalogueEntry } from "@/lib/rates/types";
import type { RatesPageRate } from "@/lib/rates/types";
import { cn } from "@/lib/utils";
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
import {
  RateField,
  RateGridHeader,
  RateGridRow,
  moneyRateColumns,
  productivityRateColumns,
  ratesFilterControlClass,
} from "./rate-row-grid";

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
      : "Pricing Required";
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

  const productivity = isProductivityEntry(entry);
  const unitLabel = productivity
    ? `h/${formatRateUnit(entry.unit)}`
    : formatRateUnit(entry.unit);

  return (
    <RateGridRow
      columns={productivity ? productivityRateColumns : moneyRateColumns}
      data-rate-key={entry.item_key}
      data-rate-authority={statusLabel}
    >
      <div className="min-w-0">
        <p className="text-sm font-medium leading-snug">{labelColumn}</p>
        {entry.trade ? (
          <p className="line-clamp-2 text-xs text-muted-foreground">{entry.trade}</p>
        ) : null}
      </div>
      <RateField label={productivity ? "Your productivity" : "Your rate"} align="end">
        {yourRateDisplay}
        <span className="sr-only">Your cost</span>
      </RateField>
      <RateField label="Quotr benchmark" align="end">
        {benchmarkDisplay}
      </RateField>
      <RateField label="Unit">{unitLabel}</RateField>
      <RateField
        label="Status"
        attention={statusLabel === "Pricing Required"}
      >
        {statusLabel}
      </RateField>
      {productivity ? null : (
        <RateField label="Recommended charge-out" align="end">
          {charge.value != null ? formatMoney(charge.value) : "—"}
          <span className="sr-only">Charge-out</span>
        </RateField>
      )}
      <div className="flex min-h-11 items-center justify-between gap-2 lg:min-h-0 lg:flex-col lg:items-stretch">
        <span className="text-xs text-muted-foreground lg:sr-only">Action</span>
        {readOnly ? (
          <span className="text-sm text-muted-foreground">—</span>
        ) : (
          <div className="flex flex-wrap justify-end gap-1 lg:flex-col">
            {canAdopt ? (
              <Button
                type="button"
                variant="ghost"
                size="touch"
                className="h-11 min-h-11 px-2 text-xs lg:h-9 lg:min-h-9 lg:w-full lg:whitespace-normal"
                onClick={onAdoptBenchmark}
              >
                {productivity ? "Use starter hours" : "Use benchmark cost"}
              </Button>
            ) : null}
            <Button
              type="button"
              variant="outline"
              size="touch"
              className="h-11 min-h-11 lg:h-9 lg:min-h-9 lg:w-full"
              onClick={onEdit}
            >
              <Pencil className="mr-1 size-3.5" />
              {hasCompanyRate ? "Edit" : "Add"}
            </Button>
          </div>
        )}
      </div>
    </RateGridRow>
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
  const [noticeTone, setNoticeTone] = useState<"error" | "success">("success");
  const [query, setQuery] = useState("");
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  function showNotice(message: string, tone: "error" | "success") {
    setNotice(message);
    setNoticeTone(tone);
  }

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
      showNotice(result.error, "error");
      return false;
    }

    if (result.rate) {
      const nextRates = existing
        ? rates.map((rate) =>
            rate.id === result.rate!.id ? result.rate! : rate
          )
        : [...rates, result.rate];
      onRatesChange(nextRates);
      showNotice("Regenerate an estimate to apply updated rates.", "success");
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
      showNotice(result.error, "error");
      return;
    }

    if (result.rate) {
      const nextRates = existing
        ? rates.map((rate) =>
            rate.id === result.rate!.id ? result.rate! : rate
          )
        : [...rates, result.rate];
      onRatesChange(nextRates);
      showNotice(
        `Benchmark cost adopted. Charge-out will use your ${margin}% company gross margin. Regenerate an estimate to apply.`,
        "success"
      );
    }
  }

  const filteredGroups = groups
    .map((group) => {
      const q = query.trim().toLowerCase();
      if (!q) return group;
      return {
        ...group,
        entries: group.entries.filter((entry) => {
          const haystack = [
            entry.label,
            entry.item_key,
            entry.workAreaLabel,
            entry.trade,
            entry.unit,
            group.workAreaLabel,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();
          return haystack.includes(q);
        }),
      };
    })
    .filter((group) => group.entries.length > 0);

  const collapsible =
    (variant === "grouped" || variant === "productivity") && groups.length > 1;

  return (
    <>
      <Card className="rounded-xl border-border/60 shadow-none ring-0">
        <CardHeader className="flex flex-col items-start justify-between gap-3 space-y-0 sm:flex-row sm:gap-4">
          <div>
            <CardTitle className="text-base">{title}</CardTitle>
            <CardDescription className="mt-1.5">{description}</CardDescription>
          </div>
          {showAddButton && !readOnly && unsetEntries.length > 0 ? (
            <Button
              type="button"
              variant="outline"
              size="touch"
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
            <p
              role={noticeTone === "error" ? "alert" : "status"}
              className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-sm text-muted-foreground"
            >
              {notice}
            </p>
          ) : null}

          {catalogue.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No rates in this section.
            </p>
          ) : (
            <>
              <Input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search this section"
                aria-label={`Search ${title}`}
                className={cn(ratesFilterControlClass, "sm:col-span-2 lg:max-w-md")}
              />
              {filteredGroups.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No matching rates.
                </p>
              ) : (
                filteredGroups.map((group) => {
                  const groupKey = group.workAreaLabel || "labour";
                  const expanded =
                    !collapsible || Boolean(query.trim()) || openGroups[groupKey] === true;
                  return (
                    <div key={groupKey} className="space-y-1" data-rates-group={groupKey}>
                      {collapsible && group.workAreaLabel ? (
                        <button
                          type="button"
                          className="flex min-h-11 w-full items-center justify-between gap-3 rounded-md px-1 text-left outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-orange)]"
                          aria-expanded={expanded}
                          onClick={() =>
                            setOpenGroups((current) => ({
                              ...current,
                              [groupKey]: !expanded,
                            }))
                          }
                        >
                          <span className="text-sm font-medium">
                            {group.workAreaLabel}
                            <span className="ml-2 font-normal text-muted-foreground">
                              {group.entries.length}
                            </span>
                          </span>
                          <ChevronDown
                            className={cn(
                              "size-4 shrink-0 text-muted-foreground transition-transform",
                              expanded && "rotate-180"
                            )}
                            aria-hidden
                          />
                        </button>
                      ) : group.workAreaLabel ? (
                        <h3 className="text-sm font-medium">{group.workAreaLabel}</h3>
                      ) : null}

                      {expanded ? (
                        <div
                          className="min-w-0 overflow-hidden"
                          data-rates-compact-list
                          role={collapsible ? "region" : undefined}
                        >
                          <RateGridHeader
                            columns={
                              productivityTable
                                ? productivityRateColumns
                                : moneyRateColumns
                            }
                            labels={
                              productivityTable
                                ? [
                                    { text: "Operation" },
                                    { text: "Your productivity", align: "end" },
                                    { text: "Quotr benchmark", align: "end" },
                                    { text: "Unit" },
                                    { text: "Status" },
                                    { text: "Action", align: "end" },
                                  ]
                                : [
                                    { text: "Item" },
                                    { text: "Your rate", align: "end" },
                                    { text: "Quotr benchmark", align: "end" },
                                    { text: "Unit" },
                                    { text: "Status" },
                                    { text: "Charge-out", align: "end" },
                                    { text: "Action", align: "end" },
                                  ]
                            }
                          />
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
                      ) : null}
                    </div>
                  );
                })
              )}
            </>
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
