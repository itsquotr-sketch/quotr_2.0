"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { VariationCostCategory, VariationRateSource } from "@/lib/variations/domain";
import { filterVariationRateOptions, variationRateHeading } from "@/lib/variations/rate-query";

export type VariationRateChoice = {
  canonicalKey: string;
  label: string;
  unit: string;
  group: string;
  detail: string | null;
  familyName: string | null;
  thickness: string | null;
  sheetSize: string | null;
  badge: "Company Rate" | "Quotr benchmark";
  derived: boolean;
  effectiveCost: number;
  source: "company_rate" | "quotr_benchmark";
  rateType: string;
  rateId: string | null;
  searchText: string;
};

const VISIBLE_LIMIT = 80;

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

function resultHeading(rate: VariationRateChoice): string {
  return variationRateHeading(rate);
}

function resultContext(rate: VariationRateChoice): string {
  const context = rate.familyName ?? (rate.group && rate.group !== rate.label ? rate.group : null);
  return [context, displayUnit(rate.unit)].filter(Boolean).join(" · ");
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
  const appliedRef = useRef(false);
  const [query, setQuery] = useState("");
  const [listOpen, setListOpen] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const listId = useId();
  const searchLabel = props.category === "labour" ? "Search labour rates" : props.category === "material" ? "Search materials" : "Search rates";
  const needle = query.trim();
  const matched = needle ? filterVariationRateOptions(props.rates, needle) : [];
  const visible = matched.slice(0, VISIBLE_LIMIT);
  const index = visible.length === 0 ? 0 : Math.min(activeIndex, visible.length - 1);
  const activeId = visible[index] ? `${listId}-option-${index}` : undefined;

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const onListOpenChange = props.onListOpenChange;
  useEffect(() => {
    onListOpenChange?.(listOpen);
    return () => onListOpenChange?.(false);
  }, [listOpen, onListOpenChange]);

  function selectRate(rate: VariationRateChoice): void {
    if (appliedRef.current) return;
    appliedRef.current = true;
    props.onApplied({
      description: rate.label,
      unit: rate.unit,
      unitCost: String(rate.effectiveCost),
      costSource: rate.source,
      canonicalRateKey: rate.canonicalKey,
      sourceLabel: rate.label,
      detail: rate.detail,
      sourceRecordId: rate.rateId,
      derived: rate.derived,
    });
  }

  return (
    <div className="grid min-w-0 gap-2" data-variation-rate-combobox="true">
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
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            event.stopPropagation();
            setListOpen(true);
            setActiveIndex((current) => Math.min(current + 1, Math.max(visible.length - 1, 0)));
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
            const rate = visible[index];
            if (rate) selectRate(rate);
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
        <div id={listId} role="listbox" className="flex max-h-72 min-w-0 flex-col gap-1 overflow-x-hidden overflow-y-auto rounded-xl border bg-background p-1">
          {props.error ? <p role="alert" className="px-2 py-2 text-sm">{props.error}</p> : null}
          {props.pending && props.rates.length === 0 ? <p className="px-2 py-2 text-sm text-muted-foreground">Loading rates…</p> : null}
          {!props.pending && !needle && !props.error ? (
            <p className="px-2 py-2 text-sm text-muted-foreground">Start typing to search Rates.</p>
          ) : null}
          {!props.pending && props.searched && needle && visible.length === 0 && !props.error ? (
            <p className="px-2 py-2 text-sm text-muted-foreground">No matching rates.</p>
          ) : null}
          {visible.map((rate, rateIndex) => {
            const selected = rate.canonicalKey === props.selectedKey;
            const active = rateIndex === index;
            return (
              <button
                key={rate.canonicalKey}
                id={`${listId}-option-${rateIndex}`}
                type="button"
                role="option"
                aria-selected={active || selected}
                className={`flex h-auto w-full min-w-0 shrink-0 flex-col items-start gap-0.5 whitespace-normal break-words rounded-lg px-3 py-2.5 text-left text-sm leading-5 hover:bg-muted focus-visible:bg-muted ${active || selected ? "bg-muted" : ""}`}
                onMouseEnter={() => setActiveIndex(rateIndex)}
                onClick={() => selectRate(rate)}
              >
                <span className="w-full font-medium leading-5">{resultHeading(rate)}</span>
                <span className="w-full leading-5 text-muted-foreground">{resultContext(rate)}</span>
                <span className="w-full leading-5">{money(props.currency, rate.effectiveCost)} / {displayUnit(rate.unit)}</span>
                <span className="w-full leading-5">{variationRateSourceText(rate)}{selected ? " · Selected" : ""}</span>
              </button>
            );
          })}
          {needle && (matched.length > VISIBLE_LIMIT || props.truncated) ? (
            <p className="px-2 py-1 text-xs text-muted-foreground">Showing the closest matches. Keep typing to narrow this list.</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
