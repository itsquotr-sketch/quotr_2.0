"use client";

import { useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  NATIONWIDE_REGION,
  OTHER_REGION,
  regionLabel,
  serviceRegionsForCountry,
} from "@/lib/subcontractors/regions";
import type { SubcontractorCountryCode } from "@/lib/subcontractors/types";

type ServiceRegionPickerProps = {
  country: SubcontractorCountryCode | null;
  selected: string[];
  otherLabels: string[];
  onChange: (next: { selected: string[]; otherLabels: string[] }) => void;
  disabled?: boolean;
};

export function ServiceRegionPicker({
  country,
  selected,
  otherLabels,
  onChange,
  disabled = false,
}: ServiceRegionPickerProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [otherDraft, setOtherDraft] = useState("");
  const boxRef = useRef<HTMLDivElement>(null);
  const needle = query.trim().toLowerCase();
  const options = useMemo(() => {
    const catalogue = [
      ...serviceRegionsForCountry(country),
      NATIONWIDE_REGION,
      OTHER_REGION,
    ];
    return catalogue.filter(
      (region) => !needle || region.label.toLowerCase().includes(needle)
    );
  }, [country, needle]);

  function toggle(code: string) {
    if (disabled || !country) return;
    if (selected.includes(code)) {
      onChange({
        selected: selected.filter((item) => item !== code),
        otherLabels: code === OTHER_REGION.code ? [] : otherLabels,
      });
      return;
    }
    onChange({ selected: [...selected, code], otherLabels });
  }

  function removeLabel(label: string) {
    const nextLabels = otherLabels.filter((item) => item !== label);
    onChange({
      selected:
        nextLabels.length === 0
          ? selected.filter((item) => item !== OTHER_REGION.code)
          : selected.includes(OTHER_REGION.code)
            ? selected
            : [...selected, OTHER_REGION.code],
      otherLabels: nextLabels,
    });
  }

  function addOtherLabel() {
    const label = otherDraft.trim();
    if (!label || disabled) return;
    const exists = otherLabels.some((item) => item.toLowerCase() === label.toLowerCase());
    onChange({
      selected: selected.includes(OTHER_REGION.code) ? selected : [...selected, OTHER_REGION.code],
      otherLabels: exists ? otherLabels : [...otherLabels, label].slice(0, 20),
    });
    setOtherDraft("");
  }

  return (
    <div
      className="space-y-2"
      data-service-region-picker
      ref={boxRef}
      onBlur={(event) => {
        if (!boxRef.current?.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <div className="flex flex-wrap gap-2">
        {selected
          .filter((code) => code !== OTHER_REGION.code)
          .map((code) => (
            <button
              key={code}
              type="button"
              className="inline-flex min-h-11 max-w-full items-center gap-2 rounded-full border border-border bg-background px-3 text-left text-sm"
              onClick={() => toggle(code)}
              disabled={disabled}
            >
              <span className="min-w-0 break-words">{regionLabel(code)}</span>
              <span aria-hidden="true">×</span>
              <span className="sr-only">Remove {regionLabel(code)}</span>
            </button>
          ))}
        {selected.includes(OTHER_REGION.code) && otherLabels.length === 0 ? (
          <button
            type="button"
            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-border bg-background px-3 text-sm"
            onClick={() => toggle(OTHER_REGION.code)}
            disabled={disabled}
          >
            Other
            <span aria-hidden="true">×</span>
            <span className="sr-only">Remove Other</span>
          </button>
        ) : null}
        {otherLabels.map((label) => (
          <button
            key={label}
            type="button"
            className="inline-flex min-h-11 max-w-full items-center gap-2 rounded-full border border-border bg-background px-3 text-left text-sm"
            onClick={() => removeLabel(label)}
            disabled={disabled}
          >
            <span className="min-w-0 break-words">Other: {label}</span>
            <span aria-hidden="true">×</span>
            <span className="sr-only">Remove {label}</span>
          </button>
        ))}
        {selected.filter((code) => code !== OTHER_REGION.code).length === 0 &&
        otherLabels.length === 0 &&
        !selected.includes(OTHER_REGION.code) ? (
          <p className="text-sm text-muted-foreground">No service regions selected.</p>
        ) : null}
      </div>
      {country ? (
        <>
          <Input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={(event) => {
              if (event.key === "Escape" && open) {
                event.stopPropagation();
                setOpen(false);
              }
            }}
            placeholder={country === "AU" ? "Search states and territories" : "Search regions"}
            className="min-h-11"
            disabled={disabled}
            autoComplete="off"
            aria-label="Search service regions"
            aria-expanded={open}
            role="combobox"
            data-service-region-search
          />
          {open ? <div className="max-h-52 overflow-y-auto rounded-xl border border-border/80" data-service-region-options>
            {options.length === 0 ? (
              <p className="px-3 py-3 text-sm text-muted-foreground">No regions match that search.</p>
            ) : (
              options.map((region) => {
                const active =
                  region.code === OTHER_REGION.code
                    ? selected.includes(region.code) || otherLabels.length > 0
                    : selected.includes(region.code);
                return (
                  <button
                    key={region.code}
                    type="button"
                    className="flex min-h-11 w-full items-center justify-between gap-3 px-3 text-left text-sm hover:bg-muted disabled:opacity-60"
                    aria-pressed={active}
                    onClick={() => toggle(region.code)}
                    disabled={disabled}
                  >
                    <span>{region.label}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {active ? "Selected" : "Add"}
                    </span>
                  </button>
                );
              })
            )}
          </div> : null}
          {selected.includes(OTHER_REGION.code) || otherLabels.length > 0 ? (
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                value={otherDraft}
                onChange={(event) => setOtherDraft(event.target.value)}
                placeholder="Name the other area"
                className="min-h-11"
                maxLength={80}
                disabled={disabled}
                aria-label="Other service area"
                data-service-region-other
              />
              <Button
                type="button"
                variant="outline"
                size="touch"
                className="w-full sm:w-auto"
                onClick={addOtherLabel}
                disabled={disabled || !otherDraft.trim()}
              >
                Add other area
              </Button>
            </div>
          ) : null}
        </>
      ) : (
        <p className="text-sm text-muted-foreground">Choose a country before selecting service regions.</p>
      )}
    </div>
  );
}
