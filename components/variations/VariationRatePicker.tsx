"use client";

import { useEffect, useId, useRef, useState } from "react";
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
  derived: boolean;
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

export function variationRateSourceText(rate: { badge: VariationRateChoice["badge"]; derived: boolean }): string {
  if (rate.badge === "Company Rate") return "Company Rate";
  if (rate.derived) return "Derived Quotr benchmark";
  return "Quotr benchmark";
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
  onListOpenChange?: (open: boolean) => void;
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
    derived: boolean;
  }) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const onSearchRef = useRef(props.onSearch);
  const [query, setQuery] = useState("");
  const [listOpen, setListOpen] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const [selecting, setSelecting] = useState(false);
  const [selectError, setSelectError] = useState<string | null>(null);
  const listId = useId();
  const searchLabel = props.category === "labour" ? "Search labour rates" : props.category === "material" ? "Search materials" : "Search rates";
  const alert = selectError ?? props.error;
  const index = props.rates.length === 0 ? 0 : Math.min(activeIndex, props.rates.length - 1);
  const activeId = props.rates[index] ? `${listId}-option-${index}` : undefined;

  useEffect(() => {
    onSearchRef.current = props.onSearch;
  });

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      onSearchRef.current(query);
    }, 250);
    return () => window.clearTimeout(handle);
  }, [query]);

  const onListOpenChange = props.onListOpenChange;
  useEffect(() => {
    onListOpenChange?.(listOpen);
    return () => onListOpenChange?.(false);
  }, [listOpen, onListOpenChange]);

  async function selectRate(rate: VariationRateChoice): Promise<void> {
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
      derived: result.derived,
    });
  }

  return (
    <div className="grid gap-2" data-variation-rate-combobox="true">
      <Label htmlFor="variation-rate-search">{searchLabel}</Label>
      <Input
        ref={inputRef}
        id="variation-rate-search"
        role="combobox"
        aria-expanded={listOpen}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={listOpen ? activeId : undefined}
        autoFocus
        value={query}
        placeholder={searchLabel}
        onChange={(event) => {
          setQuery(event.target.value);
          setListOpen(true);
          setActiveIndex(0);
          setSelectError(null);
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            event.stopPropagation();
            setListOpen(true);
            setActiveIndex((current) => Math.min(current + 1, Math.max(props.rates.length - 1, 0)));
            return;
          }
          if (event.key === "ArrowUp") {
            event.preventDefault();
            event.stopPropagation();
            setListOpen(true);
            setActiveIndex((current) => Math.max(current - 1, 0));
            return;
          }
          if (event.key === "Enter") {
            event.preventDefault();
            event.stopPropagation();
            const rate = props.rates[index];
            if (rate && !selecting) void selectRate(rate);
            return;
          }
          if (event.key === "Escape") {
            event.preventDefault();
            event.stopPropagation();
            setListOpen(false);
          }
        }}
      />
      {listOpen ? (
        <div id={listId} role="listbox" className="grid max-h-60 gap-1 overflow-y-auto rounded-xl border bg-background p-1">
          {alert ? <p role="alert" className="px-2 py-2 text-sm">{alert}</p> : null}
          {props.pending ? <p className="px-2 py-2 text-sm text-muted-foreground">Loading rates…</p> : null}
          {!props.pending && !query.trim() && !alert ? (
            <p className="px-2 py-2 text-sm text-muted-foreground">Start typing to search Rates.</p>
          ) : null}
          {!props.pending && props.searched && query.trim() && props.rates.length === 0 && !alert ? (
            <p className="px-2 py-2 text-sm text-muted-foreground">No matching rates.</p>
          ) : null}
          {props.rates.map((rate, rateIndex) => {
            const selected = rate.canonicalKey === props.selectedKey;
            const active = rateIndex === index;
            return (
              <button
                key={rate.canonicalKey}
                id={`${listId}-option-${rateIndex}`}
                type="button"
                role="option"
                aria-selected={active || selected}
                disabled={selecting}
                className={`grid min-h-11 gap-0.5 rounded-lg px-2 py-2 text-left text-sm ${active ? "bg-muted" : ""}`}
                onMouseEnter={() => setActiveIndex(rateIndex)}
                onClick={() => {
                  void selectRate(rate);
                }}
              >
                <span className="font-medium">{rate.label}</span>
                <span>{[rate.detail, displayUnit(rate.unit)].filter(Boolean).join(" · ")}</span>
                <span>
                  {money(props.currency, rate.effectiveCost)} / {displayUnit(rate.unit)} · {variationRateSourceText(rate)}
                  {selected ? " · Selected" : ""}
                </span>
              </button>
            );
          })}
          {props.truncated ? <p className="px-2 py-1 text-xs text-muted-foreground">Showing the closest matches. Keep typing to narrow this list.</p> : null}
        </div>
      ) : null}
    </div>
  );
}
