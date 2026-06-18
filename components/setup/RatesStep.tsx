"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { saveStarterRates } from "@/lib/setup/actions";
import {
  buildStarterRateRows,
  formatRateUnit,
  type StarterRateRowDefinition,
} from "@/lib/setup/starter-rates";
import { SCOPE_CATALOGUE } from "@/lib/scopes/catalogue";
import { RateInputRow } from "./RateInputRow";
import type { OrganisationRate, SetupState, StarterRateInput } from "./types";

type RatesStepProps = {
  state: SetupState;
  onComplete: () => void;
  onBack: () => void;
};

type RateValues = Record<string, string>;

function valueKey(itemKey: string, field: "cost" | "sell" | "markup"): string {
  return `${itemKey}:${field}`;
}

function getInitialValues(
  rows: StarterRateRowDefinition[],
  rates: OrganisationRate[]
): RateValues {
  const rateMap = new Map(rates.map((rate) => [rate.item_key, rate]));
  const values: RateValues = {};

  for (const row of rows) {
    const saved = rateMap.get(row.item_key);
    if (row.fields.includes("cost_rate")) {
      values[valueKey(row.item_key, "cost")] =
        saved?.cost_rate?.toString() ?? "";
    }
    if (row.fields.includes("sell_rate")) {
      values[valueKey(row.item_key, "sell")] =
        saved?.sell_rate?.toString() ?? "";
    }
    if (row.fields.includes("markup_percent")) {
      values[valueKey(row.item_key, "markup")] =
        saved?.markup_percent?.toString() ?? "";
    }
  }

  return values;
}

function parseOptionalNumber(value: string | undefined): number | undefined {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return undefined;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function rowToPayload(
  row: StarterRateRowDefinition,
  values: RateValues
): StarterRateInput {
  return {
    item_key: row.item_key,
    rate_type: row.rate_type,
    trade: row.trade,
    work_area_type: row.work_area_type,
    label: row.label,
    unit: row.unit,
    cost_rate: row.fields.includes("cost_rate")
      ? parseOptionalNumber(values[valueKey(row.item_key, "cost")])
      : undefined,
    sell_rate: row.fields.includes("sell_rate")
      ? parseOptionalNumber(values[valueKey(row.item_key, "sell")])
      : undefined,
    markup_percent: row.fields.includes("markup_percent")
      ? parseOptionalNumber(values[valueKey(row.item_key, "markup")])
      : undefined,
  };
}

export function RatesStep({ state, onComplete, onBack }: RatesStepProps) {
  const enabledWorkAreas = useMemo(() => {
    if (state.workAreas.length > 0) {
      return state.workAreas.map((area) => ({
        work_area_type: area.work_area_type,
        enabled: area.enabled,
      }));
    }

    return SCOPE_CATALOGUE.map((item) => ({
      work_area_type: item.type,
      enabled: item.defaultEnabled,
    }));
  }, [state.workAreas]);

  const { rows, unsupportedTypes } = useMemo(
    () => buildStarterRateRows(enabledWorkAreas),
    [enabledWorkAreas]
  );

  const labourRows = rows.filter((row) => row.section === "labour");
  const scopeRows = rows.filter((row) => row.section === "scope");

  const [values, setValues] = useState<RateValues>(() =>
    getInitialValues(rows, state.rates)
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const ratesPayload = useMemo(
    (): StarterRateInput[] => rows.map((row) => rowToPayload(row, values)),
    [rows, values]
  );

  async function handleSave(skip = false) {
    setError(null);
    setSaving(true);

    const result = await saveStarterRates({
      rates: ratesPayload,
      skip,
    });

    setSaving(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    if (result.fieldErrors) {
      const firstError = Object.values(result.fieldErrors).flat()[0];
      setError(firstError ?? "Please check your rate values.");
      return;
    }

    onComplete();
  }

  function updateValue(key: string, value: string) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function renderRateRow(row: StarterRateRowDefinition) {
    const showMarkup = row.fields.includes("markup_percent");
    const isScope = row.section === "scope";

    return (
      <RateInputRow
        key={row.item_key}
        label={row.label}
        unit={formatRateUnit(row.unit)}
        description={
          row.item_key === "allowance.subcontractor.default"
            ? "Markup applied to subcontractor allowances."
            : undefined
        }
        optional={isScope}
        showMarkup={showMarkup}
        costRate={
          row.fields.includes("cost_rate")
            ? values[valueKey(row.item_key, "cost")]
            : undefined
        }
        sellRate={
          row.fields.includes("sell_rate")
            ? values[valueKey(row.item_key, "sell")]
            : undefined
        }
        markupPercent={
          row.fields.includes("markup_percent")
            ? values[valueKey(row.item_key, "markup")]
            : undefined
        }
        onCostRateChange={
          row.fields.includes("cost_rate")
            ? (value) => updateValue(valueKey(row.item_key, "cost"), value)
            : undefined
        }
        onSellRateChange={
          row.fields.includes("sell_rate")
            ? (value) => updateValue(valueKey(row.item_key, "sell"), value)
            : undefined
        }
        onMarkupPercentChange={
          row.fields.includes("markup_percent")
            ? (value) => updateValue(valueKey(row.item_key, "markup"), value)
            : undefined
        }
      />
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Starter rates</CardTitle>
        <CardDescription>
          Add the rates you know now. You can leave items blank and fill them in
          later. If rates are missing, Quotr will use benchmark assumptions.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {error ? (
          <p className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        ) : null}

        <section className="space-y-3">
          <div>
            <h3 className="text-sm font-medium">Labour and allowances</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Core commercial rates used across most estimates.
            </p>
          </div>
          <div className="space-y-3">{labourRows.map(renderRateRow)}</div>
        </section>

        {scopeRows.length > 0 ? (
          <section className="space-y-3">
            <div>
              <h3 className="text-sm font-medium">Scope starter rates</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                These starter rates help Quotr use your pricing before falling
                back to benchmarks.
              </p>
            </div>
            <div className="space-y-3">{scopeRows.map(renderRateRow)}</div>
          </section>
        ) : null}

        {unsupportedTypes.length > 0 ? (
          <p className="text-sm text-muted-foreground">
            Some selected scopes can be priced later in Rates.
          </p>
        ) : null}
      </CardContent>
      <CardFooter className="flex flex-col gap-3 border-t sm:flex-row sm:justify-between">
        <Button
          type="button"
          variant="outline"
          onClick={onBack}
          disabled={saving}
          className="w-full sm:w-auto"
        >
          Back
        </Button>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <Button
            type="button"
            variant="ghost"
            onClick={() => handleSave(true)}
            disabled={saving}
            className="w-full sm:w-auto"
          >
            Skip for now
          </Button>
          <Button
            type="button"
            onClick={() => handleSave(false)}
            disabled={saving}
            className="w-full sm:w-auto"
          >
            {saving ? "Saving…" : "Save and continue"}
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}
