"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { rateDraftForResponse, saveSubcontractorRate } from "@/lib/subcontractors/rate-actions";
import {
  SUBCONTRACTOR_RATE_UNITS,
  SUBCONTRACTOR_RATE_UNIT_LABELS,
  type RateDraftFromResponse,
  type SubcontractorRateUnit,
} from "@/lib/subcontractors/rate-book";
import { workAreaLabel } from "@/lib/subcontractors/work-areas";

const fieldClass = "h-11 min-h-11 rounded-md border border-border bg-background px-3";

export function SaveResponseAsRate({
  responseId,
  canSave,
}: {
  responseId: string;
  canSave: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<RateDraftFromResponse | null>(null);
  const [subcontractorId, setSubcontractorId] = useState("");
  const [scope, setScope] = useState("");
  const [unit, setUnit] = useState<SubcontractorRateUnit | "">("");
  const [cost, setCost] = useState("");
  const [effectiveFrom, setEffectiveFrom] = useState("");
  const [effectiveUntil, setEffectiveUntil] = useState("");
  const [inclusions, setInclusions] = useState("");
  const [exclusions, setExclusions] = useState("");
  const [confirmScope, setConfirmScope] = useState(false);
  const [confirmUnit, setConfirmUnit] = useState(false);
  const [confirmAmount, setConfirmAmount] = useState(false);
  const [confirmValidity, setConfirmValidity] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!canSave) return null;

  async function openDraft() {
    setPending(true);
    setError(null);
    const result = await rateDraftForResponse(responseId);
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setDraft(result.draft);
    setSubcontractorId(result.subcontractorId);
    setScope(result.draft.scope);
    setUnit(result.draft.unit ?? "");
    setCost(result.draft.costExGst == null ? "" : String(result.draft.costExGst));
    setEffectiveFrom(result.draft.effectiveFrom);
    setEffectiveUntil(result.draft.suggestedEffectiveUntil ?? "");
    setInclusions(result.draft.inclusions);
    setExclusions(result.draft.exclusions);
    setConfirmScope(false);
    setConfirmUnit(false);
    setConfirmAmount(false);
    setConfirmValidity(false);
    setOpen(true);
  }

  async function save() {
    if (!draft || !unit) return;
    setPending(true);
    setError(null);
    const result = await saveSubcontractorRate({
      subcontractorId,
      responseId,
      workAreaType: draft.workAreaType ?? "",
      scope,
      unit,
      costExGst: Number(cost),
      minimumCharge: null,
      quantityBandMin: null,
      quantityBandMax: null,
      inclusions,
      exclusions,
      effectiveFrom,
      effectiveUntil: effectiveUntil || null,
      lastConfirmedOn: null,
      internalNotes: "",
      source: "rfq_response",
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
    setOpen(false);
    router.refresh();
  }

  return (
    <div className="grid gap-2" data-save-response-rate={responseId}>
      <Button type="button" variant="outline" className="h-11 min-h-11 w-fit" disabled={pending} onClick={() => void openDraft()}>
        Save as reusable rate
      </Button>
      {open && draft ? (
        <div className="grid gap-2 rounded-md border border-border p-3 text-sm">
          <p>Confirm the scope, unit, ex-GST amount, and validity. This does not change Estimate or Pricing.</p>
          {draft.workAreaType ? <p>Work area: {workAreaLabel(draft.workAreaType)}</p> : <p>This request has no single work area, so add the rate from the business profile.</p>}
          <label className="grid gap-1">Precise scope
            <Textarea value={scope} onChange={(event) => setScope(event.target.value)} className="min-h-16" />
          </label>
          <label className="grid gap-1">Unit
            <select className={fieldClass} value={unit} disabled={draft.unitLocked} onChange={(event) => setUnit(event.target.value as SubcontractorRateUnit)}>
              <option value="">Choose a unit</option>
              {SUBCONTRACTOR_RATE_UNITS.map((item) => (
                <option key={item} value={item}>{SUBCONTRACTOR_RATE_UNIT_LABELS[item]}</option>
              ))}
            </select>
          </label>
          {draft.unitLocked ? <p>This response is a lump sum. It cannot be saved as a per-m² rate.</p> : null}
          <label className="grid gap-1">Cost ex GST (NZD)
            <Input className={fieldClass} inputMode="decimal" value={cost} onChange={(event) => setCost(event.target.value)} />
          </label>
          <p>Inclusions and exclusions came from the response. The scope was not guessed.</p>
          <label className="grid gap-1">Inclusions
            <Textarea value={inclusions} onChange={(event) => setInclusions(event.target.value)} className="min-h-16" />
          </label>
          <label className="grid gap-1">Exclusions
            <Textarea value={exclusions} onChange={(event) => setExclusions(event.target.value)} className="min-h-16" />
          </label>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="grid gap-1">Effective from
              <Input className={fieldClass} type="date" value={effectiveFrom} onChange={(event) => setEffectiveFrom(event.target.value)} />
            </label>
            <label className="grid gap-1">Effective until
              <Input className={fieldClass} type="date" value={effectiveUntil} onChange={(event) => setEffectiveUntil(event.target.value)} />
            </label>
          </div>
          {draft.suggestedEffectiveUntil ? <p>The response said it was valid until {draft.suggestedEffectiveUntil}. That date is not saved until you confirm it.</p> : null}
          <label className="flex min-h-11 items-start gap-2"><input type="checkbox" className="mt-1" checked={confirmScope} onChange={(event) => setConfirmScope(event.target.checked)} />I confirm this scope.</label>
          <label className="flex min-h-11 items-start gap-2"><input type="checkbox" className="mt-1" checked={confirmUnit} onChange={(event) => setConfirmUnit(event.target.checked)} />I confirm this unit.</label>
          <label className="flex min-h-11 items-start gap-2"><input type="checkbox" className="mt-1" checked={confirmAmount} onChange={(event) => setConfirmAmount(event.target.checked)} />I confirm this cost ex GST.</label>
          <label className="flex min-h-11 items-start gap-2"><input type="checkbox" className="mt-1" checked={confirmValidity} onChange={(event) => setConfirmValidity(event.target.checked)} />I confirm these effective dates.</label>
          <Button type="button" className="h-11 min-h-11 w-fit" disabled={pending || !draft.workAreaType || !unit || !confirmScope || !confirmUnit || !confirmAmount || !confirmValidity} onClick={() => void save()}>
            Save rate
          </Button>
        </div>
      ) : null}
      {error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}
    </div>
  );
}
