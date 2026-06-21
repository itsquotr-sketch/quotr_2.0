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
  groupCatalogueByWorkArea,
} from "@/lib/rates/catalogue";
import { getRateSourceLabel } from "@/lib/rates/calibration";
import { upsertRate } from "@/lib/rates/actions";
import type { RateCatalogueEntry } from "@/lib/rates/types";
import type { RatesPageRate } from "@/lib/rates/types";
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
  variant?: "labour" | "grouped";
  showEngineColumn?: boolean;
  showAddButton?: boolean;
};

function formatCurrency(value: number | null | undefined): string {
  if (value == null) return "—";
  return value.toFixed(2);
}

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
  return (
    <Badge variant="outline" className="text-[10px]">
      Planned
    </Badge>
  );
}

function RateRow({
  entry,
  rate,
  showEngineColumn,
  labelColumn,
  onEdit,
}: {
  entry: RateCatalogueEntry;
  rate: RatesPageRate | undefined;
  showEngineColumn: boolean;
  labelColumn: string;
  onEdit: () => void;
}) {
  return (
    <tr className="border-b last:border-0">
      <td className="px-3 py-2.5">
        <div className="font-medium">{labelColumn}</div>
        {entry.description ? (
          <div className="text-xs text-muted-foreground">{entry.description}</div>
        ) : null}
      </td>
      <td className="hidden px-3 py-2.5 text-muted-foreground sm:table-cell">
        {formatRateUnit(entry.unit)}
      </td>
      <td className="px-3 py-2.5 tabular-nums">
        {formatCurrency(rate?.cost_rate)}
      </td>
      <td className="px-3 py-2.5 tabular-nums">
        {formatCurrency(rate?.sell_rate)}
      </td>
      <td className="px-3 py-2.5">
        {!rate ? (
          <Badge variant="outline" className="text-[10px]">
            Not set
          </Badge>
        ) : rate.active ? (
          <Badge variant="secondary" className="text-[10px]">
            Active
          </Badge>
        ) : (
          <Badge variant="outline" className="text-[10px]">
            Inactive
          </Badge>
        )}
      </td>
      <td className="hidden px-3 py-2.5 text-xs text-muted-foreground md:table-cell">
        {getRateSourceLabel(rate)}
      </td>
      {showEngineColumn ? (
        <td className="hidden px-3 py-2.5 lg:table-cell">
          <EngineBadge support={entry.calculatorSupport} />
        </td>
      ) : null}
      <td className="px-3 py-2.5 text-right">
        <Button type="button" variant="ghost" size="sm" onClick={onEdit}>
          <Pencil className="mr-1 size-3.5" />
          {rate ? "Edit" : "Set"}
        </Button>
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
  variant = "labour",
  showEngineColumn = false,
  showAddButton = true,
}: RatesTableSectionProps) {
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
    variant === "grouped"
      ? groupCatalogueByWorkArea(catalogue)
      : [{ workAreaLabel: "", entries: catalogue }];

  async function handleSave(values: RateEditValues): Promise<boolean> {
    if (!editingEntry) return false;

    setSaving(true);
    setNotice(null);

    const existing = rateMap.get(editingEntry.item_key);
    const result = await upsertRate({
      id: existing?.id,
      item_key: editingEntry.item_key,
      rate_type: editingEntry.rate_type,
      trade: editingEntry.trade,
      work_area_type: editingEntry.work_area_type,
      label: editingEntry.label,
      unit: editingEntry.unit,
      cost_rate: parseOptionalNumber(values.cost_rate),
      sell_rate: parseOptionalNumber(values.sell_rate),
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

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
          <div>
            <CardTitle>{title}</CardTitle>
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
            <p className="rounded-lg border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
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
                {variant === "grouped" && group.workAreaLabel ? (
                  <h3 className="text-sm font-medium">{group.workAreaLabel}</h3>
                ) : null}
                <div className="overflow-x-auto rounded-lg border">
                  <table className="w-full min-w-[640px] text-sm">
                    <thead>
                      <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                        <th className="px-3 py-2 font-medium">
                          {variant === "labour" ? "Role" : "Rate"}
                        </th>
                        <th className="hidden px-3 py-2 font-medium sm:table-cell">
                          Unit
                        </th>
                        <th className="px-3 py-2 font-medium">Cost</th>
                        <th className="px-3 py-2 font-medium">Charge</th>
                        <th className="px-3 py-2 font-medium">Active</th>
                        <th className="hidden px-3 py-2 font-medium md:table-cell">
                          Source
                        </th>
                        {showEngineColumn ? (
                          <th className="hidden px-3 py-2 font-medium lg:table-cell">
                            Engine
                          </th>
                        ) : null}
                        <th className="px-3 py-2 text-right font-medium">
                          Action
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.entries.map((entry) => (
                        <RateRow
                          key={entry.item_key}
                          entry={entry}
                          rate={rateMap.get(entry.item_key)}
                          showEngineColumn={showEngineColumn}
                          labelColumn={entry.label}
                          onEdit={() => {
                            setEditingEntry(entry);
                            setNotice(null);
                          }}
                        />
                      ))}
                    </tbody>
                  </table>
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
          onSave={handleSave}
          saving={saving}
        />
      ) : null}
    </>
  );
}
