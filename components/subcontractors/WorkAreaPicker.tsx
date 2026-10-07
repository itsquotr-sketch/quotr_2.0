"use client";

import { useMemo, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { SCOPE_CATALOGUE, SCOPE_CATEGORIES } from "@/lib/scopes/catalogue";
import { workAreaLabel } from "@/lib/subcontractors/work-areas";

type WorkAreaPickerProps = {
  selected: string[];
  onChange: (types: string[]) => void;
  disabled?: boolean;
};

export function WorkAreaPicker({ selected, onChange, disabled = false }: WorkAreaPickerProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const needle = query.trim().toLowerCase();
  const groups = useMemo(
    () =>
      SCOPE_CATEGORIES.map((category) => ({
        category,
        items: SCOPE_CATALOGUE.filter(
          (item) =>
            item.category === category &&
            (!needle ||
              item.label.toLowerCase().includes(needle) ||
              item.type.replace(/_/g, " ").includes(needle))
        ),
      })).filter((group) => group.items.length > 0),
    [needle]
  );

  function toggle(type: string) {
    if (disabled) return;
    onChange(
      selected.includes(type) ? selected.filter((item) => item !== type) : [...selected, type]
    );
  }

  return (
    <div
      className="space-y-2"
      data-work-area-picker
      ref={boxRef}
      onBlur={(event) => {
        if (!boxRef.current?.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      {selected.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {selected.map((type) => (
            <button
              key={type}
              type="button"
              className="inline-flex min-h-11 max-w-full items-center gap-2 rounded-full border border-border bg-background px-3 text-left text-sm"
              onClick={() => toggle(type)}
              disabled={disabled}
            >
              <span className="min-w-0 break-words">{workAreaLabel(type)}</span>
              <span aria-hidden="true">×</span>
              <span className="sr-only">Remove {workAreaLabel(type)}</span>
            </button>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No work areas selected.</p>
      )}
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
        placeholder="Search work areas"
        className="min-h-11"
        disabled={disabled}
        autoComplete="off"
        data-work-area-search
        aria-label="Search work areas"
        aria-expanded={open}
        role="combobox"
      />
      {open ? <div className="max-h-52 overflow-y-auto rounded-xl border border-border/80" data-work-area-options>
        {groups.length === 0 ? (
          <p className="px-3 py-3 text-sm text-muted-foreground">No work areas match that search.</p>
        ) : (
          groups.map((group) => (
            <div key={group.category}>
              <p className="bg-muted/60 px-3 py-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                {group.category}
              </p>
              {group.items.map((item) => {
                const active = selected.includes(item.type);
                return (
                  <button
                    key={item.type}
                    type="button"
                    className="flex min-h-11 w-full items-center justify-between gap-3 px-3 text-left text-sm hover:bg-muted disabled:opacity-60"
                    aria-pressed={active}
                    onClick={() => toggle(item.type)}
                    disabled={disabled}
                  >
                    <span className="min-w-0 break-words">{item.label}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {active ? "Selected" : "Add"}
                    </span>
                  </button>
                );
              })}
            </div>
          ))
        )}
      </div> : null}
    </div>
  );
}
