"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { selectVariationComponentRate } from "@/lib/variations/actions";
import type { VariationCostCategory, VariationRateSource } from "@/lib/variations/domain";

export type VariationRateChoice = {
  canonicalKey: string;
  label: string;
  unit: string;
  group: string;
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
  unit: string;
  currency: string;
  selectedKey: string | null;
  projectId: string;
  variationId: string;
  revisionId: string;
  itemId: string;
  componentId: string;
  rates: VariationRateChoice[];
  pending: boolean;
  truncated: boolean;
  onSearch: (query: string) => void;
  onApplied: (patch: {
    unitCost: string;
    costSource: VariationRateSource;
    canonicalRateKey: string;
    sourceLabel: string | null;
  }) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [selecting, setSelecting] = useState(false);
  const groups = new Map<string, VariationRateChoice[]>();
  for (const rate of props.rates) {
    const list = groups.get(rate.group) ?? [];
    list.push(rate);
    groups.set(rate.group, list);
  }

  return (
    <div className="grid gap-2 rounded-xl border bg-muted/30 p-3">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={`rate-search-${props.componentId}`}>Search rates</Label>
        <Button type="button" variant="outline" size="touch" onClick={props.onClose}>Close</Button>
      </div>
      <form
        className="flex flex-wrap gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          props.onSearch(query);
        }}
      >
        <Input
          id={`rate-search-${props.componentId}`}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by name or work area"
        />
        <Button type="submit" variant="outline" size="touch" disabled={props.pending || selecting}>Search</Button>
      </form>
      {error ? <p role="alert" className="text-sm">{error}</p> : null}
      {props.pending ? <p className="text-sm text-muted-foreground">Loading rates…</p> : null}
      {!props.pending && props.rates.length === 0 ? (
        <p className="text-sm text-muted-foreground">No matching rates for this unit. Enter the cost manually.</p>
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
                    setError(null);
                    const result = await selectVariationComponentRate({
                      projectId: props.projectId,
                      variationId: props.variationId,
                      revisionId: props.revisionId,
                      itemId: props.itemId,
                      componentId: props.componentId,
                      category: props.category,
                      unit: props.unit,
                      canonicalKey: rate.canonicalKey,
                    });
                    setSelecting(false);
                    if (!result.ok || result.unitCost == null) {
                      setError(result.ok ? "That rate is not available for this component." : result.error);
                      return;
                    }
                    props.onApplied({
                      unitCost: String(result.unitCost),
                      costSource: result.costSource,
                      canonicalRateKey: rate.canonicalKey,
                      sourceLabel: result.sourceLabel ?? rate.label,
                    });
                    props.onClose();
                  })();
                }}
              >
                <span className="font-medium">{rate.label}</span>
                <span>
                  {displayUnit(rate.unit)} · {rate.badge} · {money(props.currency, rate.effectiveCost)}
                  {selected ? " · Selected" : ""}
                </span>
              </button>
            );
          })}
        </div>
      ))}
      {props.truncated ? <p className="text-xs text-muted-foreground">Search to narrow this list.</p> : null}
    </div>
  );
}
