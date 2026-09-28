"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { describeVariationComponentRate } from "@/lib/variations/actions";
import type { VariationCostCategory, VariationRateSource } from "@/lib/variations/domain";

export type VariationRateChoice = {
  canonicalKey: string;
  label: string;
  unit: string;
  group: string;
  detail: string | null;
  badge: "Company Rate" | "Quotr benchmark";
  effectiveCost: number;
};

function displayUnit(unit: string): string {
  if (unit === "m2") return "m²";
  if (unit === "m3") return "m³";
  if (unit === "hour") return "hour";
  return unit;
}

function money(currency: string, value: number): string {
  return new Intl.NumberFormat("en-NZ", { style: "currency", currency }).format(value);
}

export function VariationRatePicker(props: {
  category: VariationCostCategory;
  currency: string;
  selectedKey: string | null;
  rates: VariationRateChoice[];
  pending: boolean;
  searched: boolean;
  truncated: boolean;
  error: string | null;
  onSearch: (query: string) => void;
  onApplied: (patch: {
    description: string;
    unit: string;
    unitCost: string;
    costSource: VariationRateSource;
    canonicalRateKey: string;
    sourceLabel: string | null;
    detail: string | null;
    sourceRecordId: string | null;
  }) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [selecting, setSelecting] = useState(false);
  const [selectError, setSelectError] = useState<string | null>(null);
  const groups = new Map<string, VariationRateChoice[]>();
  for (const rate of props.rates) {
    const list = groups.get(rate.group) ?? [];
    list.push(rate);
    groups.set(rate.group, list);
  }
  const searchLabel = props.category === "labour" ? "Search labour rates" : props.category === "material" ? "Search materials" : "Search rates";
  const alert = selectError ?? props.error;

  return (
    <div className="grid gap-2 rounded-xl border bg-muted/30 p-3">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor="variation-rate-search">{searchLabel}</Label>
        <Button type="button" variant="outline" size="touch" onClick={props.onClose}>Close</Button>
      </div>
      <form
        className="flex flex-col gap-2 sm:flex-row"
        onSubmit={(event) => {
          event.preventDefault();
          setSelectError(null);
          props.onSearch(query);
        }}
      >
        <Input
          id="variation-rate-search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={searchLabel}
        />
        <Button type="submit" variant="outline" size="touch" disabled={props.pending || selecting}>Search</Button>
      </form>
      {alert ? <p role="alert" className="text-sm">{alert}</p> : null}
      {props.pending ? <p className="text-sm text-muted-foreground">Loading rates…</p> : null}
      {!props.pending && !props.searched && !alert ? (
        <p className="text-sm text-muted-foreground">Enter a search to find a rate.</p>
      ) : null}
      {!props.pending && props.searched && props.rates.length === 0 && !alert ? (
        <p className="text-sm text-muted-foreground">No matching rates. Try different wording or enter the cost manually.</p>
      ) : null}
      {[...groups.entries()].map(([group, rows]) => (
        <div key={group} className="grid gap-2">
          <p className="text-xs font-medium text-muted-foreground">{group}</p>
          {rows.map((rate) => {
            const selected = rate.canonicalKey === props.selectedKey;
            return (
              <button
                key={rate.canonicalKey}
                type="button"
                aria-pressed={selected}
                disabled={selecting}
                className="grid min-h-11 gap-1 rounded-xl border bg-background px-3 py-2 text-left text-sm"
                onClick={() => {
                  void (async () => {
                    setSelecting(true);
                    setSelectError(null);
                    const result = await describeVariationComponentRate({
                      category: props.category,
                      canonicalKey: rate.canonicalKey,
                    });
                    setSelecting(false);
                    if (!result.ok) {
                      setSelectError(result.error);
                      return;
                    }
                    props.onApplied({
                      description: result.label,
                      unit: result.unit,
                      unitCost: String(result.effectiveCost),
                      costSource: result.costSource,
                      canonicalRateKey: result.canonicalKey,
                      sourceLabel: result.label,
                      detail: result.detail,
                      sourceRecordId: result.rateId,
                    });
                  })();
                }}
              >
                <span className="font-medium">{rate.label}</span>
                {rate.detail ? <span>{rate.detail}</span> : null}
                <span>
                  {displayUnit(rate.unit)} · {rate.badge} · {money(props.currency, rate.effectiveCost)}
                  {selected ? " · Selected" : ""}
                </span>
              </button>
            );
          })}
        </div>
      ))}
      {props.truncated ? <p className="text-xs text-muted-foreground">Showing the closest matches. Refine the search to see more.</p> : null}
    </div>
  );
}
