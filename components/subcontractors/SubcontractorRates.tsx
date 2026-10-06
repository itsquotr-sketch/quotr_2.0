"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { retireSubcontractorRate, saveSubcontractorRate } from "@/lib/subcontractors/rate-actions";
import {
  SUBCONTRACTOR_RATE_UNITS,
  SUBCONTRACTOR_RATE_UNIT_LABELS,
  type SubcontractorRateUnit,
} from "@/lib/subcontractors/rate-book";
import type { SubcontractorRateRecord } from "@/lib/subcontractors/rate-actions";
import { workAreaLabel } from "@/lib/subcontractors/work-areas";

const fieldClass = "min-h-11";

type RateFormProps = {
  subcontractorId: string;
  workAreaTypes: readonly string[];
  rate?: SubcontractorRateRecord;
  onDone: () => void;
};

function money(value: number): string {
  return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function RateForm({ subcontractorId, workAreaTypes, rate, onDone }: RateFormProps) {
  const router = useRouter();
  const [workAreaType, setWorkAreaType] = useState(rate?.workAreaType ?? workAreaTypes[0] ?? "");
  const [scope, setScope] = useState(rate?.scope ?? "");
  const [unit, setUnit] = useState<SubcontractorRateUnit>((rate?.unit as SubcontractorRateUnit) ?? "lump_sum");
  const [cost, setCost] = useState(rate ? String(rate.costExGst) : "");
  const [minimum, setMinimum] = useState(rate?.minimumCharge == null ? "" : String(rate.minimumCharge));
  const [bandMin, setBandMin] = useState(rate?.quantityBandMin == null ? "" : String(rate.quantityBandMin));
  const [bandMax, setBandMax] = useState(rate?.quantityBandMax == null ? "" : String(rate.quantityBandMax));
  const [inclusions, setInclusions] = useState(rate?.inclusions ?? "");
  const [exclusions, setExclusions] = useState(rate?.exclusions ?? "");
  const [effectiveFrom, setEffectiveFrom] = useState(rate?.effectiveFrom ?? "");
  const [effectiveUntil, setEffectiveUntil] = useState(rate?.effectiveUntil ?? "");
  const [confirmedOn, setConfirmedOn] = useState(rate?.lastConfirmedOn ?? "");
  const [notes, setNotes] = useState(rate?.internalNotes ?? "");
  const [confirmScope, setConfirmScope] = useState(false);
  const [confirmUnit, setConfirmUnit] = useState(false);
  const [confirmAmount, setConfirmAmount] = useState(false);
  const [confirmValidity, setConfirmValidity] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lockedUnit = rate?.unit === "lump_sum" && rate.originResponseId != null;

  async function save() {
    setPending(true);
    setError(null);
    const parsed = Number(cost);
    const result = await saveSubcontractorRate({
      subcontractorId,
      rateId: rate?.rateId,
      workAreaType,
      scope,
      unit: lockedUnit ? "lump_sum" : unit,
      costExGst: parsed,
      minimumCharge: minimum.trim() === "" ? null : Number(minimum),
      quantityBandMin: bandMin.trim() === "" ? null : Number(bandMin),
      quantityBandMax: bandMax.trim() === "" ? null : Number(bandMax),
      inclusions,
      exclusions,
      effectiveFrom,
      effectiveUntil: effectiveUntil || null,
      lastConfirmedOn: confirmedOn || null,
      internalNotes: notes,
      source: "builder",
      confirmScope,
      confirmUnit,
      confirmAmount,
      confirmValidity,
    });
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onDone();
    router.refresh();
  }

  return (
    <div className="grid gap-3 rounded-md border border-border p-3" data-rate-form>
      <label className="grid gap-1 text-sm">Work area
        <select className={fieldClass} value={workAreaType} onChange={(event) => setWorkAreaType(event.target.value)}>
          {workAreaTypes.map((type) => (
            <option key={type} value={type}>{workAreaLabel(type)}</option>
          ))}
        </select>
      </label>
      <div className="space-y-1.5">
        <Label htmlFor="rate-scope">Precise scope</Label>
        <Textarea id="rate-scope" value={scope} onChange={(event) => setScope(event.target.value)} className="min-h-20" />
      </div>
      <label className="grid gap-1 text-sm">Unit
        <select className={fieldClass} value={lockedUnit ? "lump_sum" : unit} disabled={lockedUnit} onChange={(event) => setUnit(event.target.value as SubcontractorRateUnit)}>
          {SUBCONTRACTOR_RATE_UNITS.map((item) => (
            <option key={item} value={item}>{SUBCONTRACTOR_RATE_UNIT_LABELS[item]}</option>
          ))}
        </select>
      </label>
      {lockedUnit ? <p className="text-sm">This rate came from a lump-sum response, so the unit stays a lump sum.</p> : null}
      <label className="grid gap-1 text-sm">Cost ex GST (NZD)
        <Input className={fieldClass} inputMode="decimal" value={cost} onChange={(event) => setCost(event.target.value)} />
      </label>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="grid gap-1 text-sm">Minimum charge
          <Input className={fieldClass} inputMode="decimal" value={minimum} onChange={(event) => setMinimum(event.target.value)} />
        </label>
        <label className="grid gap-1 text-sm">Quantity from
          <Input className={fieldClass} inputMode="decimal" value={bandMin} onChange={(event) => setBandMin(event.target.value)} />
        </label>
        <label className="grid gap-1 text-sm">Quantity to
          <Input className={fieldClass} inputMode="decimal" value={bandMax} onChange={(event) => setBandMax(event.target.value)} />
        </label>
      </div>
      <label className="grid gap-1 text-sm">Inclusions
        <Textarea value={inclusions} onChange={(event) => setInclusions(event.target.value)} className="min-h-16" />
      </label>
      <label className="grid gap-1 text-sm">Exclusions
        <Textarea value={exclusions} onChange={(event) => setExclusions(event.target.value)} className="min-h-16" />
      </label>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="grid gap-1 text-sm">Effective from
          <Input className={fieldClass} type="date" value={effectiveFrom} onChange={(event) => setEffectiveFrom(event.target.value)} />
        </label>
        <label className="grid gap-1 text-sm">Effective until
          <Input className={fieldClass} type="date" value={effectiveUntil} onChange={(event) => setEffectiveUntil(event.target.value)} />
        </label>
        <label className="grid gap-1 text-sm">Last confirmed
          <Input className={fieldClass} type="date" value={confirmedOn} onChange={(event) => setConfirmedOn(event.target.value)} />
        </label>
      </div>
      <label className="grid gap-1 text-sm">Internal notes
        <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} className="min-h-16" />
      </label>
      {rate?.sourceAmountExGst != null ? (
        <p className="text-sm">Originating amount ex GST: {money(rate.sourceAmountExGst)}. Later versions keep that amount on record.</p>
      ) : null}
      <label className="flex min-h-11 items-start gap-2 text-sm">
        <input type="checkbox" className="mt-1" checked={confirmScope} onChange={(event) => setConfirmScope(event.target.checked)} />
        I confirm this scope.
      </label>
      <label className="flex min-h-11 items-start gap-2 text-sm">
        <input type="checkbox" className="mt-1" checked={confirmUnit} onChange={(event) => setConfirmUnit(event.target.checked)} />
        I confirm this unit.
      </label>
      <label className="flex min-h-11 items-start gap-2 text-sm">
        <input type="checkbox" className="mt-1" checked={confirmAmount} onChange={(event) => setConfirmAmount(event.target.checked)} />
        I confirm this cost ex GST.
      </label>
      <label className="flex min-h-11 items-start gap-2 text-sm">
        <input type="checkbox" className="mt-1" checked={confirmValidity} onChange={(event) => setConfirmValidity(event.target.checked)} />
        I confirm these effective dates.
      </label>
      {error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}
      <div className="flex flex-wrap gap-2">
        <Button type="button" className="h-11 min-h-11" disabled={pending || !confirmScope || !confirmUnit || !confirmAmount || !confirmValidity} onClick={() => void save()}>
          {rate ? "Save new version" : "Save rate"}
        </Button>
        <Button type="button" variant="outline" className="h-11 min-h-11" onClick={onDone}>Cancel</Button>
      </div>
    </div>
  );
}

export function SubcontractorRates({
  subcontractorId,
  workAreaTypes,
  rates,
  canEdit,
}: {
  subcontractorId: string;
  workAreaTypes: readonly string[];
  rates: SubcontractorRateRecord[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const grouped = new Map<string, SubcontractorRateRecord[]>();
  for (const rate of rates) {
    const list = grouped.get(rate.rateId) ?? [];
    list.push(rate);
    grouped.set(rate.rateId, list);
  }

  async function retire(rateId: string) {
    setError(null);
    const result = await retireSubcontractorRate({ subcontractorId, rateId });
    if (!result.ok) setError(result.error);
    router.refresh();
  }

  return (
    <section className="min-w-0 rounded-xl border border-border/60 bg-card px-4 py-4" data-subcontractor-rates>
      <h3 className="text-base font-medium">Rates</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Reusable costs for this business. A rate schedule upload stays a document and is not turned into a rate. Saving a rate does not change an Estimate or Pricing.
      </p>
      <div className="mt-4 grid gap-3">
        {[...grouped.entries()].map(([rateId, versions]) => {
          const ordered = [...versions].sort((a, b) => b.versionNumber - a.versionNumber);
          const current = ordered[0];
          if (!current) return null;
          return (
            <article key={rateId} className="grid gap-2 rounded-md border border-border p-3 text-sm" data-rate-id={rateId}>
              <p className="font-medium">{workAreaLabel(current.workAreaType)} · {current.scope}</p>
              <p>
                {SUBCONTRACTOR_RATE_UNIT_LABELS[current.unit as SubcontractorRateUnit] ?? current.unit}
                {" · "}
                {money(current.costExGst)} {current.currency} ex GST
                {current.retired ? " · Retired" : ""}
              </p>
              <p>Effective {current.effectiveFrom}{current.effectiveUntil ? ` to ${current.effectiveUntil}` : ""}{current.lastConfirmedOn ? ` · Confirmed ${current.lastConfirmedOn}` : ""}</p>
              {current.exclusions ? <p>Exclusions: {current.exclusions}</p> : null}
              {current.minimumCharge != null ? <p>Minimum charge {money(current.minimumCharge)}</p> : null}
              {current.sourceAmountExGst != null ? <p>Originating response amount {money(current.sourceAmountExGst)} ex GST, kept on version 1.</p> : null}
              {ordered.length > 1 ? (
                <details>
                  <summary className="min-h-11 cursor-pointer">Version history</summary>
                  <ul className="grid gap-1 pt-2">
                    {ordered.map((version) => (
                      <li key={version.versionId}>
                        Version {version.versionNumber}: {money(version.costExGst)} ex GST · {version.scope}
                      </li>
                    ))}
                  </ul>
                </details>
              ) : null}
              {canEdit && !current.retired ? (
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" className="h-11 min-h-11" onClick={() => setEditing(editing === rateId ? null : rateId)}>Edit as new version</Button>
                  <Button type="button" variant="outline" className="h-11 min-h-11" onClick={() => void retire(rateId)}>Retire</Button>
                </div>
              ) : null}
              {editing === rateId ? (
                <RateForm subcontractorId={subcontractorId} workAreaTypes={workAreaTypes} rate={current} onDone={() => setEditing(null)} />
              ) : null}
            </article>
          );
        })}
        {grouped.size === 0 ? <p className="text-sm">No rates yet.</p> : null}
        {canEdit && workAreaTypes.length > 0 ? (
          adding ? (
            <RateForm subcontractorId={subcontractorId} workAreaTypes={workAreaTypes} onDone={() => setAdding(false)} />
          ) : (
            <Button type="button" className="h-11 min-h-11 w-fit" onClick={() => setAdding(true)}>Add rate</Button>
          )
        ) : null}
        {error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}
      </div>
    </section>
  );
}
