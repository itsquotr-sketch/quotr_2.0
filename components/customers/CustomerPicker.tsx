"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { CustomerOption } from "@/lib/customers/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type CustomerPickerProps = {
  customers: readonly CustomerOption[];
  selectedId: string | null;
  onSelect: (customer: CustomerOption) => void;
  disabled?: boolean;
};

export function CustomerPicker({
  customers,
  selectedId,
  onSelect,
  disabled = false,
}: CustomerPickerProps) {
  const listId = useId();
  const inputId = useId();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [replacing, setReplacing] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const focusSearchRef = useRef(false);

  const selected = customers.find((customer) => customer.id === selectedId) ?? null;
  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const rows = needle
      ? customers.filter((customer) =>
          [customer.name, customer.email, customer.phone]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()
            .includes(needle)
        )
      : [...customers];
    return rows.slice(0, 30);
  }, [customers, query]);

  useEffect(() => {
    function onPointer(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onPointer);
    return () => document.removeEventListener("mousedown", onPointer);
  }, []);

  function choose(customer: CustomerOption) {
    onSelect(customer);
    setQuery("");
    setOpen(false);
    setReplacing(false);
    setActiveIndex(0);
  }

  if (selected && !replacing) {
    return (
      <div
        ref={rootRef}
        className="rounded-lg border border-[var(--brand-orange)] bg-[var(--brand-orange-muted)] px-3 py-3"
        data-selected-customer
      >
        <p className="font-semibold">{selected.name}</p>
        {selected.email ? <p className="mt-1 text-sm text-foreground">{selected.email}</p> : null}
        {selected.phone ? <p className="mt-1 text-sm text-foreground">{selected.phone}</p> : null}
        <Button
          type="button"
          variant="outline"
          size="touch"
          className="mt-3"
          disabled={disabled}
          onClick={() => {
            focusSearchRef.current = true;
            setReplacing(true);
            setQuery("");
            setOpen(true);
          }}
        >
          Change customer
        </Button>
      </div>
    );
  }

  return (
    <div ref={rootRef} className="space-y-2">
      <Label htmlFor={inputId}>Search customers</Label>
      <Input
        id={inputId}
        ref={(node) => {
          if (node && focusSearchRef.current) {
            focusSearchRef.current = false;
            node.focus();
          }
        }}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        value={query}
        placeholder="Search by name, email or phone"
        disabled={disabled}
        className="min-h-11"
        autoComplete="off"
        onFocus={() => {
          setOpen(true);
          setActiveIndex(0);
        }}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
          setActiveIndex(0);
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setOpen(true);
            setActiveIndex((index) => Math.min(index + 1, Math.max(matches.length - 1, 0)));
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            setActiveIndex((index) => Math.max(index - 1, 0));
          } else if (event.key === "Enter" && open && matches[activeIndex]) {
            event.preventDefault();
            choose(matches[activeIndex]);
          } else if (event.key === "Escape") {
            setOpen(false);
            if (selected) setReplacing(false);
          }
        }}
      />
      {open ? (
        <ul
          id={listId}
          role="listbox"
          className="max-h-60 overflow-y-auto overscroll-contain rounded-xl border bg-background"
        >
          {matches.length === 0 ? (
            <li className="px-3 py-3 text-sm text-muted-foreground">No matching customers</li>
          ) : (
            matches.map((customer, index) => (
              <li key={customer.id} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={customer.id === selectedId}
                  className={cn(
                    "flex min-h-11 w-full flex-col items-start justify-center px-3 py-2 text-left outline-none focus-visible:bg-muted focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--brand-orange)]",
                    index === activeIndex && "bg-muted"
                  )}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => choose(customer)}
                >
                  <span className="font-medium">{customer.name}</span>
                  {customer.email ? (
                    <span className="text-sm text-muted-foreground">{customer.email}</span>
                  ) : null}
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}
