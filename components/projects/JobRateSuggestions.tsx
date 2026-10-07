"use client";

import { useMemo, useState } from "react";
import {
  previewRateCost,
  SUBCONTRACTOR_RATE_UNIT_LABELS,
  suggestRatesForWorkArea,
  type StoredRateVersion,
  type SubcontractorRateUnit,
} from "@/lib/subcontractors/rate-book";
import { workAreaLabel } from "@/lib/subcontractors/work-areas";
import { UseSubcontractorRate } from "@/components/projects/UseSubcontractorRate";
import type { JobRatePricingContext } from "@/lib/subcontractors/rate-use-actions";

function money(value: number): string {
  return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function JobRateSuggestions({
  projectId,
  areas,
  rates,
  today,
  pricing = null,
  canEdit = false,
}: {
  projectId: string;
  areas: Array<{ id: string; type: string; name: string; summary: string | null }>;
  rates: StoredRateVersion[];
  today: string;
  pricing?: JobRatePricingContext | null;
  canEdit?: boolean;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [jobUnit, setJobUnit] = useState("");
  const [quantity, setQuantity] = useState("");

  const groups = useMemo(() => areas.map((area) => ({
    area,
    suggestions: suggestRatesForWorkArea(rates, {
      workAreaType: area.type,
      specification: area.summary,
      quantityUnit: jobUnit || null,
      quantity: quantity.trim() === "" ? null : Number(quantity),
    }, today),
  })), [areas, rates, today, jobUnit, quantity]);

  if (areas.length === 0) return null;

  return (
    <section className="grid gap-3" data-job-rate-suggestions>
      <h2 className="text-base font-semibold">Subcontractor rates</h2>
      <p className="text-sm text-foreground/70">
        A work-area match is only a suggestion. It does not mean the supplier scope matches the job. Choosing one previews a cost only. It is not applied to the Estimate or to Pricing.
      </p>
      <label className="grid max-w-xs gap-1 text-sm">Job unit for this preview
        <select className="h-11 min-h-11 rounded-md border border-border bg-background px-3" value={jobUnit} onChange={(event) => setJobUnit(event.target.value)}>
          <option value="">Not selected</option>
          {Object.entries(SUBCONTRACTOR_RATE_UNIT_LABELS).map(([unit, label]) => (
            <option key={unit} value={unit}>{label}</option>
          ))}
        </select>
      </label>
      <label className="grid max-w-xs gap-1 text-sm">Quantity for this preview
        <input className="h-11 min-h-11 rounded-md border border-border bg-background px-3" inputMode="decimal" value={quantity} onChange={(event) => setQuantity(event.target.value)} />
      </label>
      {groups.map(({ area, suggestions }) => (
        <div key={area.id} className="grid gap-2 rounded-xl border border-border bg-card p-4" data-job-rate-area={area.type}>
          <p className="font-medium">{area.name}</p>
          <p className="text-sm text-foreground/70">{area.summary?.trim() ? area.summary : "No specification is recorded for this work area."}</p>
          {suggestions.length === 0 ? <p className="text-sm">No active rate matches this work area.</p> : null}
          {suggestions.map((rate) => {
            const preview = selected === rate.rateId
              ? previewRateCost({
                  unit: rate.unit,
                  costExGst: rate.costExGst,
                  minimumCharge: rate.minimumCharge,
                  quantity: quantity.trim() === "" ? null : Number(quantity),
                  jobUnit: jobUnit || null,
                })
              : null;
            return (
              <article key={rate.rateId} className="grid gap-1 rounded-md border border-border p-3 text-sm" data-rate-suggestion={rate.rateId} data-rate-fit={rate.fit}>
                <p className="font-medium">{rate.tradingName} · {workAreaLabel(rate.workAreaType)}</p>
                <p>Scope: {rate.scope}</p>
                <p>Unit: {SUBCONTRACTOR_RATE_UNIT_LABELS[rate.unit as SubcontractorRateUnit] ?? rate.unit} · {money(rate.costExGst)} {rate.currency} ex GST</p>
                <p>Version {rate.versionNumber}. Effective {rate.effectiveFrom}{rate.effectiveUntil ? ` to ${rate.effectiveUntil}` : ", no end date"}</p>
                <p>Exclusions: {rate.exclusions.trim() ? rate.exclusions : "None recorded"}</p>
                {rate.fit === "reference" ? rate.reasons.map((reason) => <p key={reason}>{reason}</p>) : <p>The recorded specification and unit match this rate.</p>}
                {rate.overlaps ? <p>Another active rate covers the same dates.</p> : null}
                <label className="flex min-h-11 items-center gap-2">
                  <input type="radio" name={`job-rate-${area.id}`} checked={selected === rate.rateId} onChange={() => setSelected(rate.rateId)} />
                  Preview this cost for the job
                </label>
                {preview ? (
                  <p data-rate-preview>
                    {preview.amountExGst == null ? "No job total." : `${money(preview.amountExGst)} ex GST.`} {preview.statement}
                  </p>
                ) : null}
                <UseSubcontractorRate projectId={projectId} area={area} rate={rate} pricing={pricing} canEdit={canEdit} />
              </article>
            );
          })}
        </div>
      ))}
    </section>
  );
}
