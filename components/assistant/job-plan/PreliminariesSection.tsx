"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { savePreliminariesPlan } from "@/lib/estimate/preliminaries-actions";
import {
  newCustomPreliminary,
  planFromFacts,
  quotePreliminary,
  type PreliminaryBasis,
  type PreliminaryItem,
  type PreliminaryRole,
  type PreliminaryTreatment,
  type PreliminariesPlan,
} from "@/lib/estimate/preliminaries";
import type { EstimateFact } from "@/lib/estimate/types";

type PreliminariesSectionProps = {
  projectId: string;
  briefText?: string | null;
  facts: readonly EstimateFact[];
};

const BASES: { value: PreliminaryBasis; label: string }[] = [
  { value: "unresolved", label: "Not resolved" },
  { value: "fixed", label: "Fixed cost" },
  { value: "labour_hours", label: "Labour hours" },
  { value: "occurrences", label: "Days or occurrences" },
  { value: "recurring_labour", label: "Recurring labour" },
];

export function PreliminariesSection({
  projectId,
  briefText,
  facts,
}: PreliminariesSectionProps) {
  const initial = useMemo(
    () => planFromFacts(facts, briefText),
    [facts, briefText]
  );
  const [plan, setPlan] = useState<PreliminariesPlan>(initial);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [customLabel, setCustomLabel] = useState("");

  if (plan.items.length === 0 && !plan.deliveryWindow) return null;

  function update(id: string, patch: Partial<PreliminaryItem>) {
    setPlan((current) => ({
      ...current,
      items: current.items.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    }));
    setStatus("idle");
  }

  async function save() {
    setStatus("saving");
    setError(null);
    const result = await savePreliminariesPlan(projectId, plan);
    if (!result.ok) {
      setStatus("error");
      setError(result.error);
      return;
    }
    setStatus("saved");
  }

  return (
    <section className="rounded-xl border border-border/70 bg-card p-4" data-preliminaries>
      <h3 className="text-sm font-semibold text-foreground">Preliminaries</h3>
      <p className="mt-1 text-sm leading-5 text-muted-foreground">
        Project-wide work. Saving keeps your choices. Generate or regenerate the estimate to price them. An unresolved request stays in the job until you price it or exclude it.
      </p>
      {plan.deliveryWindow ? (
        <p className="mt-2 text-sm text-foreground" data-preliminaries-delivery-window>
          {plan.deliveryWindow}
        </p>
      ) : null}
      <div className="mt-3 space-y-3">
        {plan.items.map((item) => {
          const quote = quotePreliminary(item, [], null);
          return (
            <article key={item.id} className="rounded-lg border border-border/60 p-3" data-preliminary-id={item.id}>
              <h4 className="text-sm font-medium text-foreground">{item.label}</h4>
              <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
              <label className="mt-3 block text-xs font-medium text-foreground">
                Scope
                <select
                  className="mt-1 h-11 w-full rounded-md border border-input bg-background px-2 text-sm"
                  value={item.treatment}
                  onChange={(event) =>
                    update(item.id, { treatment: event.target.value as PreliminaryTreatment })
                  }
                >
                  <option value="requested">Requested</option>
                  <option value="included">Included</option>
                  <option value="excluded">Excluded</option>
                </select>
              </label>
              <label className="mt-3 flex min-h-11 items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={item.provisional}
                  onChange={(event) => update(item.id, { provisional: event.target.checked })}
                />
                Provisional
              </label>
              <label className="mt-2 block text-xs font-medium text-foreground">
                Pricing basis
                <select
                  className="mt-1 h-11 w-full rounded-md border border-input bg-background px-2 text-sm"
                  value={item.basis}
                  onChange={(event) =>
                    update(item.id, { basis: event.target.value as PreliminaryBasis })
                  }
                >
                  {BASES.map((basis) => (
                    <option key={basis.value} value={basis.value}>
                      {basis.label}
                    </option>
                  ))}
                </select>
              </label>
              {item.basis === "fixed" ? (
                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                  <NumberField label="Fixed cost" value={item.fixedCost} onChange={(fixedCost) => update(item.id, { fixedCost })} />
                  <NumberField label="Materials part" value={item.materialCost} onChange={(materialCost) => update(item.id, { materialCost })} />
                  <NumberField label="Labour part" value={item.labourCost} onChange={(labourCost) => update(item.id, { labourCost })} />
                </div>
              ) : null}
              {item.basis === "labour_hours" || item.basis === "recurring_labour" ? (
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <label className="block text-xs font-medium">
                    Role
                    <select
                      className="mt-1 h-11 w-full rounded-md border border-input bg-background px-2 text-sm"
                      value={item.role ?? "carpenter"}
                      onChange={(event) => update(item.id, { role: event.target.value as PreliminaryRole })}
                    >
                      <option value="carpenter">Carpenter</option>
                      <option value="labourer">Labourer</option>
                      <option value="apprentice">Apprentice</option>
                    </select>
                  </label>
                  <NumberField
                    label="Project hourly cost"
                    value={item.hourlyCostOverride}
                    onChange={(hourlyCostOverride) => update(item.id, { hourlyCostOverride })}
                  />
                </div>
              ) : null}
              {item.basis === "labour_hours" ? (
                <div className="mt-2">
                  <NumberField label="Hours" value={item.hours} onChange={(hours) => update(item.id, { hours })} />
                </div>
              ) : null}
              {item.basis === "occurrences" || item.basis === "recurring_labour" ? (
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <NumberField
                    label="Days or occurrences"
                    value={item.occurrences}
                    onChange={(occurrences) => update(item.id, { occurrences })}
                  />
                  <label className="block text-xs font-medium">
                    Unit
                    <input
                      className="mt-1 h-11 w-full rounded-md border border-input bg-background px-2 text-sm"
                      value={item.occurrenceUnit ?? ""}
                      placeholder="day"
                      onChange={(event) => update(item.id, { occurrenceUnit: event.target.value })}
                    />
                  </label>
                </div>
              ) : null}
              {item.basis === "occurrences" ? (
                <div className="mt-2">
                  <NumberField label="Cost each" value={item.unitCost} onChange={(unitCost) => update(item.id, { unitCost })} />
                </div>
              ) : null}
              {item.basis === "recurring_labour" ? (
                <div className="mt-2">
                  <NumberField
                    label="Hours each occurrence"
                    value={item.hoursPerOccurrence}
                    onChange={(hoursPerOccurrence) => update(item.id, { hoursPerOccurrence })}
                  />
                </div>
              ) : null}
              <label className="mt-3 flex min-h-11 items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={item.overlapAcknowledged}
                  onChange={(event) =>
                    update(item.id, { overlapAcknowledged: event.target.checked })
                  }
                />
                This is separate from any existing setup, delivery or allowance with the same requirement
              </label>
              <p className="mt-3 text-sm text-foreground" data-preliminary-formula>
                {item.provisional ? "Provisional. " : ""}
                {quote.formula}
              </p>
            </article>
          );
        })}
      </div>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <input
          className="h-11 flex-1 rounded-md border border-input bg-background px-2 text-sm"
          value={customLabel}
          placeholder="Add a preliminary"
          aria-label="Add a preliminary"
          onChange={(event) => setCustomLabel(event.target.value)}
        />
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
          onClick={() => {
            const item = newCustomPreliminary(customLabel);
            if (!item) return;
            setPlan((current) => ({ ...current, items: [...current.items, item] }));
            setCustomLabel("");
            setStatus("idle");
          }}
        >
          Add item
        </Button>
      </div>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
        <Button type="button" className="min-h-11" onClick={() => void save()} disabled={status === "saving"}>
          {status === "saving" ? "Saving…" : "Save preliminaries"}
        </Button>
        {status === "saved" ? (
          <p className="text-sm text-muted-foreground">Saved. Regenerate the estimate to update Pricing.</p>
        ) : null}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </div>
    </section>
  );
}

function NumberField(props: {
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
}) {
  return (
    <label className="block text-xs font-medium text-foreground">
      {props.label}
      <input
        className="mt-1 h-11 w-full rounded-md border border-input bg-background px-2 text-sm"
        inputMode="decimal"
        value={props.value ?? ""}
        onChange={(event) => {
          const next = event.target.value.trim();
          if (!next) {
            props.onChange(null);
            return;
          }
          const parsed = Number(next);
          props.onChange(Number.isFinite(parsed) ? parsed : null);
        }}
      />
    </label>
  );
}
