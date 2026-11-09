"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { savePreliminariesPlan } from "@/lib/estimate/preliminaries-actions";
import type { OrganisationRate } from "@/components/setup/types";
import {
  additionalIdentityItem,
  newCustomPreliminary,
  overlappingIdentity,
  planFromFacts,
  preliminaryLabourRate,
  preliminaryRoleLabel,
  quotePreliminary,
  type PreliminaryBasis,
  type PreliminaryIdentityReview,
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
  tradeDescriptions?: readonly string[];
  labourRates?: readonly OrganisationRate[];
  siblingLines?: readonly { scopeKey?: string | null; componentKey?: string | null }[];
};

const BASES: { value: PreliminaryBasis; label: string }[] = [
  { value: "unresolved", label: "Not resolved" },
  { value: "fixed", label: "Fixed cost" },
  { value: "labour_hours", label: "Labour hours" },
  { value: "occurrences", label: "Days or occurrences" },
  { value: "recurring_labour", label: "Recurring labour" },
];

function planSignature(plan: PreliminariesPlan): string {
  return JSON.stringify(plan);
}

function itemStatus(item: PreliminaryItem, rates: readonly OrganisationRate[]): string {
  if (item.treatment === "excluded") return "Excluded";
  const quote = quotePreliminary(item, [...rates], null);
  if (item.treatment === "requested" || item.basis === "unresolved" || quote.unresolvedReason) {
    return "Requested · needs a price";
  }
  return BASES.find((basis) => basis.value === item.basis)?.label ?? "Included";
}

export function PreliminariesSection({
  projectId,
  briefText,
  facts,
  tradeDescriptions = [],
  labourRates = [],
  siblingLines = [],
}: PreliminariesSectionProps) {
  const initial = useMemo(
    () => planFromFacts(facts, briefText, tradeDescriptions),
    [facts, briefText, tradeDescriptions]
  );
  const [plan, setPlan] = useState<PreliminariesPlan>(initial);
  const [savedSignature, setSavedSignature] = useState(() => planSignature(initial));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [removed, setRemoved] = useState<PreliminaryItem[]>([]);
  const [pendingEditId, setPendingEditId] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [customLabel, setCustomLabel] = useState("");
  const dirty = planSignature(plan) !== savedSignature;

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  if (plan.items.length === 0 && removed.length === 0 && !plan.deliveryWindow && (plan.reviews ?? []).length === 0) {
    return null;
  }

  function update(id: string, patch: Partial<PreliminaryItem>) {
    setPlan((current) => ({
      ...current,
      items: current.items.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    }));
    setStatus("idle");
  }

  function decideReview(review: PreliminaryIdentityReview, separate: boolean) {
    setPlan((current) => {
      const reviews = (current.reviews ?? []).map((row) =>
        row.id === review.id ? { ...row, separate } : row
      );
      const extra = additionalIdentityItem({ ...review, separate });
      const items = separate
        ? current.items.some((item) => item.id === extra.id)
          ? current.items
          : [...current.items, extra]
        : current.items.filter((item) => item.id !== extra.id);
      return { ...current, reviews, items };
    });
    setStatus("idle");
  }

  function openEditor(id: string) {
    if (editingId && editingId !== id && dirty) {
      setPendingEditId(id);
      return;
    }
    setEditingId(id);
    setPendingEditId(null);
  }

  function discardEdits() {
    const restored = JSON.parse(savedSignature) as PreliminariesPlan;
    setPlan(restored);
    setEditingId(pendingEditId);
    setPendingEditId(null);
    setStatus("idle");
  }

  async function save(nextPlan = plan) {
    setStatus("saving");
    setError(null);
    const result = await savePreliminariesPlan(projectId, nextPlan);
    if (!result.ok) {
      setStatus("error");
      setError(result.error);
      return false;
    }
    setSavedSignature(planSignature(nextPlan));
    setStatus("saved");
    if (pendingEditId) {
      setEditingId(pendingEditId);
      setPendingEditId(null);
    }
    return true;
  }

  return (
    <section className="rounded-xl border border-border/70 bg-card p-4" data-preliminaries>
      <h3 className="text-sm font-semibold text-foreground">Preliminaries</h3>
      <p className="mt-1 text-sm leading-5 text-muted-foreground">
        Requested items stay in the job until they are priced, excluded, or removed. Confirming Work does not require a price for each one.
      </p>
      {plan.deliveryWindow ? (
        <p className="mt-2 text-sm text-foreground" data-preliminaries-delivery-window>
          {plan.deliveryWindow} This is not a charge.
        </p>
      ) : null}
      <div className="mt-3 space-y-2">
        {(plan.reviews ?? []).map((review) => (
          <article
            key={review.id}
            className="rounded-lg border border-border/60 p-3"
            data-preliminary-review={review.id}
          >
            <h4 className="text-sm font-medium text-foreground">{review.label}</h4>
            <p className="mt-1 text-sm text-muted-foreground">{review.detail}</p>
            <label className="mt-3 flex min-h-11 items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={review.separate}
                onChange={(event) => decideReview(review, event.target.checked)}
              />
              This is a different service and can be priced on its own
            </label>
          </article>
        ))}
        {plan.items.map((item) => {
          const overlap = overlappingIdentity(item, siblingLines);
          const editing = editingId === item.id;
          return (
            <article key={item.id} className="rounded-lg border border-border/60 p-3" data-preliminary-id={item.id}>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <h4 className="text-sm font-medium text-foreground">{item.label}</h4>
                  <p className="text-sm text-muted-foreground" data-preliminary-status>
                    {itemStatus(item, labourRates)}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11 w-full sm:w-auto"
                  data-preliminary-edit={item.id}
                  onClick={() => (editing ? setEditingId(null) : openEditor(item.id))}
                >
                  {editing ? "Close" : "Edit"}
                </Button>
              </div>
              {editing ? (
                <ItemEditor
                  item={item}
                  rates={labourRates}
                  showOverlap={overlap != null || item.overlapAcknowledged}
                  overlapName={overlap}
                  onChange={(patch) => update(item.id, patch)}
                  onExclude={() => {
                    update(item.id, { treatment: "excluded" });
                    setEditingId(null);
                  }}
                  onInclude={() => update(item.id, { treatment: "requested", basis: item.basis === "unresolved" ? "unresolved" : item.basis })}
                  onRemove={() => {
                    setRemoved((current) => [...current, item]);
                    setPlan((current) => ({
                      ...current,
                      removedIds: [...(current.removedIds ?? []).filter((id) => id !== item.id), item.id],
                      items: current.items.filter((row) => row.id !== item.id),
                    }));
                    setEditingId(null);
                    setStatus("idle");
                  }}
                />
              ) : null}
            </article>
          );
        })}
      </div>
      {removed.length > 0 ? (
        <div className="mt-3 rounded-lg border border-border/60 px-3 py-2" data-preliminary-removed>
          <p className="text-sm text-foreground">
            {removed[removed.length - 1]?.label} was removed from this job.
          </p>
          <Button
            type="button"
            variant="outline"
            className="mt-2 min-h-11"
            data-preliminary-undo-removal
            onClick={() => {
              const last = removed[removed.length - 1];
              if (!last) return;
              setRemoved((current) => current.slice(0, -1));
              setPlan((current) => ({
                ...current,
                removedIds: (current.removedIds ?? []).filter((id) => id !== last.id),
                items: current.items.some((row) => row.id === last.id)
                  ? current.items
                  : [...current.items, last],
              }));
              setStatus("idle");
            }}
          >
            Undo removal
          </Button>
        </div>
      ) : null}
      {pendingEditId ? (
        <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-3 text-sm" data-preliminary-unsaved>
          <p>Save or discard unsaved edits before opening another item.</p>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <Button type="button" className="min-h-11" onClick={() => void save()}>
              Save
            </Button>
            <Button type="button" variant="outline" className="min-h-11" onClick={discardEdits}>
              Discard
            </Button>
          </div>
        </div>
      ) : null}
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <input
          className="h-11 min-w-0 flex-1 rounded-md border border-input bg-background px-2 text-sm"
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
            setEditingId(item.id);
            setStatus("idle");
          }}
        >
          Add item
        </Button>
      </div>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
        <Button type="button" className="min-h-11 w-full sm:w-auto" onClick={() => void save()} disabled={status === "saving"}>
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

function ItemEditor(props: {
  item: PreliminaryItem;
  rates: readonly OrganisationRate[];
  showOverlap: boolean;
  overlapName: string | null;
  onChange: (patch: Partial<PreliminaryItem>) => void;
  onExclude: () => void;
  onInclude: () => void;
  onRemove: () => void;
}) {
  const { item } = props;
  const quote = quotePreliminary(item, [...props.rates], null);
  const labour =
    item.basis === "labour_hours" || item.basis === "recurring_labour"
      ? preliminaryLabourRate({ item, rates: [...props.rates], settings: null })
      : null;
  return (
    <div className="mt-3 space-y-3" data-preliminary-editor={item.id}>
      <p className="text-sm text-muted-foreground">{item.description}</p>
      <label className="block text-xs font-medium text-foreground">
        Scope
        <select
          className="mt-1 h-11 w-full rounded-md border border-input bg-background px-2 text-sm"
          value={item.treatment}
          onChange={(event) =>
            props.onChange({ treatment: event.target.value as PreliminaryTreatment })
          }
        >
          <option value="requested">Requested</option>
          <option value="included">Included</option>
          <option value="excluded">Excluded</option>
        </select>
      </label>
      <label className="flex min-h-11 items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={item.provisional}
          onChange={(event) => props.onChange({ provisional: event.target.checked })}
        />
        Provisional
      </label>
      <label className="block text-xs font-medium text-foreground">
        Pricing basis
        <select
          className="mt-1 h-11 w-full rounded-md border border-input bg-background px-2 text-sm"
          value={item.basis}
          onChange={(event) => props.onChange({ basis: event.target.value as PreliminaryBasis })}
        >
          {BASES.map((basis) => (
            <option key={basis.value} value={basis.value}>
              {basis.label}
            </option>
          ))}
        </select>
      </label>
      {item.basis === "fixed" ? (
        <div className="grid gap-2 sm:grid-cols-3">
          <NumberField label="Fixed cost" value={item.fixedCost} onChange={(fixedCost) => props.onChange({ fixedCost })} />
          <NumberField label="Materials part" value={item.materialCost} onChange={(materialCost) => props.onChange({ materialCost })} />
          <NumberField label="Labour part" value={item.labourCost} onChange={(labourCost) => props.onChange({ labourCost })} />
        </div>
      ) : null}
      {item.basis === "labour_hours" || item.basis === "recurring_labour" ? (
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="block text-xs font-medium">
            Role
            <select
              className="mt-1 h-11 w-full rounded-md border border-input bg-background px-2 text-sm"
              value={item.role ?? "carpenter"}
              onChange={(event) => props.onChange({ role: event.target.value as PreliminaryRole })}
            >
              <option value="carpenter">Carpenter</option>
              <option value="labourer">Labourer</option>
              <option value="apprentice">Apprentice</option>
            </select>
          </label>
          <NumberField
            label="Project hourly cost"
            value={item.hourlyCostOverride}
            onChange={(hourlyCostOverride) => props.onChange({ hourlyCostOverride })}
          />
        </div>
      ) : null}
      {item.basis === "labour_hours" ? (
        <NumberField label="Hours" value={item.hours} onChange={(hours) => props.onChange({ hours })} />
      ) : null}
      {item.basis === "occurrences" || item.basis === "recurring_labour" ? (
        <div className="grid gap-2 sm:grid-cols-2">
          <NumberField
            label="Days or occurrences"
            value={item.occurrences}
            onChange={(occurrences) => props.onChange({ occurrences })}
          />
          <label className="block text-xs font-medium">
            Unit
            <input
              className="mt-1 h-11 w-full rounded-md border border-input bg-background px-2 text-sm"
              value={item.occurrenceUnit ?? ""}
              placeholder="day"
              onChange={(event) => props.onChange({ occurrenceUnit: event.target.value })}
            />
          </label>
        </div>
      ) : null}
      {item.basis === "occurrences" ? (
        <NumberField label="Cost each" value={item.unitCost} onChange={(unitCost) => props.onChange({ unitCost })} />
      ) : null}
      {item.basis === "recurring_labour" ? (
        <NumberField
          label="Hours each occurrence"
          value={item.hoursPerOccurrence}
          onChange={(hoursPerOccurrence) => props.onChange({ hoursPerOccurrence })}
        />
      ) : null}
      {props.showOverlap ? (
        <label className="flex min-h-11 items-center gap-2 text-sm" data-preliminary-overlap>
          <input
            type="checkbox"
            checked={item.overlapAcknowledged}
            onChange={(event) => props.onChange({ overlapAcknowledged: event.target.checked })}
          />
          {props.overlapName
            ? `This may be the same cost as ${props.overlapName}. Confirm it is separate before pricing it.`
            : "This is separate from the matching allowance already in the estimate."}
        </label>
      ) : null}
      {labour ? (
        <p className="text-sm text-foreground" data-preliminary-rate>
          {labour.sourceLabel} · $
          {labour.hourlyCost.toLocaleString("en-NZ", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
          /h · {preliminaryRoleLabel(labour.role)}
        </p>
      ) : item.basis === "labour_hours" || item.basis === "recurring_labour" ? (
        <p className="text-sm text-foreground" data-preliminary-rate>
          A company labour rate or a project hourly cost is still required.
        </p>
      ) : null}
      <p className="text-sm text-foreground" data-preliminary-formula>
        {item.provisional ? "Provisional. " : ""}
        {quote.formula}
      </p>
      <div className="flex flex-col gap-2 sm:flex-row">
        {item.treatment === "excluded" ? (
          <Button type="button" variant="outline" className="min-h-11" data-preliminary-include onClick={props.onInclude}>
            Include again
          </Button>
        ) : (
          <Button type="button" variant="outline" className="min-h-11" data-preliminary-exclude onClick={props.onExclude}>
            Exclude from this job
          </Button>
        )}
        <Button type="button" variant="outline" className="min-h-11" data-preliminary-remove onClick={props.onRemove}>
          Remove from scope
        </Button>
      </div>
    </div>
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
