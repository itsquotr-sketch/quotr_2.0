"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { saveStarterRates } from "@/lib/setup/actions";
import { RATE_AUTHORITY_LABELS } from "@/lib/rates/authority";
import {
  buildStarterRateRows,
  formatRateUnit,
  type StarterRateRowDefinition,
} from "@/lib/setup/starter-rates";
import { SCOPE_CATALOGUE } from "@/lib/scopes/catalogue";
import { cn } from "@/lib/utils";
import { RateInputRow } from "./RateInputRow";
import type { OrganisationRate, SetupState, StarterRateInput } from "./types";

type RatesStepProps = {
  state: SetupState;
  onSaved?: () => void;
  onSkip?: () => void;
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

function hasSavedCompanyRate(
  row: StarterRateRowDefinition,
  rates: OrganisationRate[]
): boolean {
  const saved = rates.find((rate) => rate.item_key === row.item_key);
  return Boolean(saved?.active && saved.cost_rate != null);
}

export function RatesStep({ state, onSaved, onSkip }: RatesStepProps) {
  const enabledWorkAreas = useMemo(() => {
    if (state.workAreas.length > 0) {
      return state.workAreas.map((area) => ({
        work_area_type: area.work_area_type,
        enabled: area.enabled,
      }));
    }

    return SCOPE_CATALOGUE.map((item) => ({
      work_area_type: item.type,
      enabled: false,
    }));
  }, [state.workAreas]);

  const { rows, preferredWorkTypes, unsupportedTypes } = useMemo(
    () => buildStarterRateRows(enabledWorkAreas),
    [enabledWorkAreas]
  );

  const labourRows = rows.filter((row) => row.section === "labour");
  const componentRows = rows.filter((row) => row.section === "component");

  const [values, setValues] = useState<RateValues>(() =>
    getInitialValues(rows, state.rates)
  );
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const ratesPayload = useMemo(
    (): StarterRateInput[] => rows.map((row) => rowToPayload(row, values)),
    [rows, values]
  );

  async function handleSave(skip = false) {
    setError(null);
    setSuccess(null);
    setSaving(true);

    const result = await saveStarterRates({
      rates: skip ? [] : ratesPayload,
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

    if (skip) {
      onSkip?.();
      return;
    }

    setSuccess("Rates saved. You can refine them anytime in Manage all rates.");
    onSaved?.();
  }

  function updateValue(key: string, value: string) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function renderRateRow(row: StarterRateRowDefinition, optional = false) {
    const isCompany = hasSavedCompanyRate(row, state.rates);
    const costFilled = Boolean(
      (values[valueKey(row.item_key, "cost")] ?? "").trim()
    );
    const authorityLabel = costFilled || isCompany
      ? RATE_AUTHORITY_LABELS.EXPLICIT_COMPANY
      : row.benchmarkCost != null
        ? RATE_AUTHORITY_LABELS.BENCHMARK
        : undefined;

    const benchmarkHint =
      !costFilled && row.benchmarkCost != null
        ? `Quotr benchmark: $${row.benchmarkCost.toFixed(0)}${
            row.benchmarkSell != null
              ? ` cost / $${row.benchmarkSell.toFixed(0)} sell`
              : ""
          } ${formatRateUnit(row.unit)} — enter your figures to make them company rates.`
        : undefined;

    return (
      <RateInputRow
        key={row.item_key}
        label={row.label}
        unit={formatRateUnit(row.unit)}
        description={row.description}
        authorityLabel={authorityLabel}
        benchmarkHint={benchmarkHint}
        optional={optional}
        showMarkup={row.fields.includes("markup_percent")}
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

  const preferredLabels = preferredWorkTypes
    .map(
      (type) => SCOPE_CATALOGUE.find((item) => item.type === type)?.label ?? type
    )
    .join(", ");

  return (
    <Card>
      <CardHeader>
        <CardTitle>Set your key rates</CardTitle>
        <CardDescription>
          Start with the rates Quotr uses most often. Blank is fine — Quotr can
          use disclosed benchmarks until you add your own. Default gross margin
          and GST live under Company settings / Rates defaults — not duplicated
          here.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {error ? (
          <p className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        ) : null}
        {success ? (
          <p className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-800 dark:text-emerald-200">
            {success}
          </p>
        ) : null}

        <section className="space-y-3">
          <div>
            <h3 className="text-sm font-medium">1. Your labour</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Cost is what the person costs your business. Sell is what you
              charge for their time.
            </p>
          </div>
          <div className="space-y-3">
            {labourRows.map((row) =>
              renderRateRow(row, row.item_key === "labour.labourer.hour")
            )}
          </div>
        </section>

        <section className="space-y-3">
          <div>
            <h3 className="text-sm font-medium">
              2. Rates for your common work types
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {preferredWorkTypes.length > 0
                ? `Component rates Quotr uses for: ${preferredLabels}. Overall $/m² package rates are not the primary model.`
                : "Choose work types in Setup to personalise these. You can still manage all rates anytime."}
            </p>
          </div>
          {componentRows.length > 0 ? (
            <div className="space-y-3">
              {componentRows.map((row) => renderRateRow(row, true))}
            </div>
          ) : (
            <p className="rounded-lg border border-dashed px-3 py-4 text-sm text-muted-foreground">
              No preferred work types yet — labour alone is enough to start.
              Add work types or open Manage all rates for every supported
              component.
            </p>
          )}
          {unsupportedTypes.length > 0 ? (
            <p className="text-sm text-muted-foreground">
              Some preferred work types have fewer keyed component rates —
              manage them in the full Rates library.
            </p>
          ) : null}
        </section>

        <section className="space-y-2 rounded-lg border bg-muted/20 px-3 py-3">
          <h3 className="text-sm font-medium">3. Other rates later</h3>
          <p className="text-sm text-muted-foreground">
            Materials, allowances, and legacy overall benchmarks live in the
            full Rates page. Preferences only change ordering — never capability.
          </p>
          <Link
            href="/app/rates"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            Manage all rates
          </Link>
        </section>
      </CardContent>
      <CardFooter className="flex flex-wrap justify-between gap-2 border-t">
        <Button
          type="button"
          variant="ghost"
          onClick={() => handleSave(true)}
          disabled={saving}
        >
          Do this later
        </Button>
        <Button
          type="button"
          onClick={() => handleSave(false)}
          disabled={saving}
        >
          {saving ? "Saving…" : "Save rates"}
        </Button>
      </CardFooter>
    </Card>
  );
}
