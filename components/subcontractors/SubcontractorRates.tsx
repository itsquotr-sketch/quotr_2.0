"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { StatusPill } from "@/components/ui/status-pill";
import { retireSubcontractorRate, saveSubcontractorRate } from "@/lib/subcontractors/rate-actions";
import type { SubcontractorRateRecord } from "@/lib/subcontractors/rate-actions";
import {
  rateBookCurrencyGate,
  rateCostLabel,
  rateRecordStatus,
  scopePromptsFor,
  SUBCONTRACTOR_RATE_UNITS,
  SUBCONTRACTOR_RATE_UNIT_LABELS,
  type RateRecordStatus,
  type SubcontractorRateUnit,
} from "@/lib/subcontractors/rate-book";
import { workAreaLabel } from "@/lib/subcontractors/work-areas";

const selectClass =
  "h-11 min-h-11 w-full min-w-0 rounded-xl border border-border/80 bg-background px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 md:text-sm";

const STATUS_LABEL: Record<RateRecordStatus, string> = {
  current: "Current",
  upcoming: "Not started",
  expired: "Expired",
  retired: "Retired",
};

function money(value: number): string {
  return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function showDate(value: string): string {
  const [year, month, day] = value.slice(0, 10).split("-");
  const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const index = Number(month) - 1;
  if (!year || !day || index < 0 || index > 11) return value;
  return `${Number(day)} ${names[index]} ${year}`;
}

function sourceLabel(rate: SubcontractorRateRecord): string {
  if (rate.originResponseId || rate.source === "rfq_response") return "From a response";
  if (rate.source === "rate_schedule_document") return "Rate schedule";
  return "Entered here";
}

function rangesOverlap(
  leftFrom: string,
  leftUntil: string | null,
  rightFrom: string,
  rightUntil: string | null
): boolean {
  const leftEnd = leftUntil?.slice(0, 10) || "9999-12-31";
  const rightEnd = rightUntil?.slice(0, 10) || "9999-12-31";
  return leftFrom.slice(0, 10) <= rightEnd && rightFrom.slice(0, 10) <= leftEnd;
}

type RateDialogProps = {
  subcontractorId: string;
  workAreaTypes: readonly string[];
  rates: SubcontractorRateRecord[];
  today: string;
  countryCode: string | null;
  preferredCurrency: string | null;
  rate: SubcontractorRateRecord | null;
  onClose: () => void;
};

function RateDialog({
  subcontractorId,
  workAreaTypes,
  rates,
  today,
  countryCode,
  preferredCurrency,
  rate,
  onClose,
}: RateDialogProps) {
  const router = useRouter();
  const fromResponse = rate?.originResponseId != null;
  const lockedUnit = fromResponse && rate?.unit === "lump_sum";
  const currencyGate = rateBookCurrencyGate({ countryCode, preferredCurrency });
  const [workAreaType, setWorkAreaType] = useState(rate?.workAreaType ?? "");
  const [scope, setScope] = useState(rate?.scope ?? "");
  const [unit, setUnit] = useState<SubcontractorRateUnit | "">(
    lockedUnit ? "lump_sum" : ((rate?.unit as SubcontractorRateUnit) ?? "")
  );
  const [cost, setCost] = useState(rate ? String(rate.costExGst) : "");
  const [effectiveFrom, setEffectiveFrom] = useState(rate?.effectiveFrom?.slice(0, 10) ?? (rate ? "" : today));
  const [effectiveUntil, setEffectiveUntil] = useState(rate?.effectiveUntil?.slice(0, 10) ?? "");
  const [minimum, setMinimum] = useState(rate?.minimumCharge == null ? "" : String(rate.minimumCharge));
  const [bandMin, setBandMin] = useState(rate?.quantityBandMin == null ? "" : String(rate.quantityBandMin));
  const [bandMax, setBandMax] = useState(rate?.quantityBandMax == null ? "" : String(rate.quantityBandMax));
  const [inclusions, setInclusions] = useState(rate?.inclusions ?? "");
  const [exclusions, setExclusions] = useState(rate?.exclusions ?? "");
  const [confirmedOn, setConfirmedOn] = useState(rate?.lastConfirmedOn?.slice(0, 10) ?? "");
  const [notes, setNotes] = useState(rate?.internalNotes ?? "");
  const [more, setMore] = useState(false);
  const [step, setStep] = useState<"edit" | "review">("edit");
  const [amountIsNzd, setAmountIsNzd] = useState(false);
  const [confirmScope, setConfirmScope] = useState(false);
  const [confirmUnit, setConfirmUnit] = useState(false);
  const [confirmAmount, setConfirmAmount] = useState(false);
  const [confirmValidity, setConfirmValidity] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const measured = unit !== "" && unit !== "lump_sum";
  const prompts = scopePromptsFor(workAreaType);

  function missing(): string | null {
    if (!workAreaType || !scope.trim() || !unit || cost.trim() === "" || !effectiveFrom) {
      return "Add a work area, scope, unit, cost, and start date.";
    }
    if (!Number.isFinite(Number(cost)) || Number(cost) < 0) return "Enter the cost ex GST.";
    if (currencyGate.needsNzdConfirmation && !amountIsNzd) return "Confirm this amount is in New Zealand dollars.";
    return null;
  }

  const overlap = useMemo(() => {
    if (!workAreaType || !effectiveFrom) return false;
    const latest = new Map<string, SubcontractorRateRecord>();
    for (const item of rates) {
      const current = latest.get(item.rateId);
      if (!current || item.versionNumber > current.versionNumber) latest.set(item.rateId, item);
    }
    return [...latest.values()].some((item) =>
      item.rateId !== rate?.rateId
      && !item.retired
      && !item.subcontractorArchived
      && item.workAreaType === workAreaType
      && rangesOverlap(effectiveFrom, effectiveUntil || null, item.effectiveFrom, item.effectiveUntil)
    );
  }, [effectiveFrom, effectiveUntil, rate?.rateId, rates, workAreaType]);

  async function save() {
    const problem = missing();
    if (problem || !unit) {
      setError(problem);
      setStep("edit");
      return;
    }
    if (fromResponse && (!confirmScope || !confirmUnit || !confirmAmount || !confirmValidity)) {
      setError("Confirm the scope, unit, amount, and dates from the response.");
      return;
    }
    setPending(true);
    setError(null);
    const result = await saveSubcontractorRate({
      subcontractorId,
      rateId: rate?.rateId,
      workAreaType,
      scope: scope.trim(),
      unit,
      costExGst: Number(cost),
      minimumCharge: measured && minimum.trim() !== "" ? Number(minimum) : null,
      quantityBandMin: measured && bandMin.trim() !== "" ? Number(bandMin) : null,
      quantityBandMax: measured && bandMax.trim() !== "" ? Number(bandMax) : null,
      inclusions,
      exclusions,
      effectiveFrom,
      effectiveUntil: effectiveUntil || null,
      lastConfirmedOn: confirmedOn || null,
      internalNotes: notes,
      source: "builder",
      confirmScope: true,
      confirmUnit: true,
      confirmAmount: true,
      confirmValidity: true,
    });
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onClose();
    router.refresh();
  }

  const unitLabel = unit ? SUBCONTRACTOR_RATE_UNIT_LABELS[unit] : "";
  const summary = unit
    ? `${workAreaLabel(workAreaType)}. ${scope.trim()}. ${money(Number(cost) || 0)} NZD ex GST${unit === "lump_sum" ? " as a lump sum" : ` per ${unitLabel}`}, from ${showDate(effectiveFrom)}${effectiveUntil ? ` until ${showDate(effectiveUntil)}` : ", with no end date"}.`
    : "";

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-lg" data-rate-dialog>
        <DialogHeader>
          <DialogTitle>{step === "review" ? "Review rate" : rate ? "Edit rate" : "Add rate"}</DialogTitle>
        </DialogHeader>
        {step === "edit" ? (
          <div className="grid gap-3">
            <label className="grid gap-1 text-sm">Work area
              <select className={selectClass} value={workAreaType} onChange={(event) => setWorkAreaType(event.target.value)}>
                <option value="">Choose a work area</option>
                {workAreaTypes.map((type) => (
                  <option key={type} value={type}>{workAreaLabel(type)}</option>
                ))}
              </select>
            </label>
            {workAreaTypes.length === 0 ? <p className="text-sm">Add a work area on Overview before saving a rate.</p> : null}
            <div className="space-y-1.5">
              <Label htmlFor="rate-scope">Precise scope</Label>
              <Textarea id="rate-scope" value={scope} onChange={(event) => setScope(event.target.value)} className="min-h-20" />
            </div>
            {prompts.length > 0 ? (
              <div className="grid gap-2">
                <p className="text-sm text-muted-foreground">Scope prompts. Not a price, and not a match to a job.</p>
                <div className="flex flex-wrap gap-2">
                  {prompts.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      className="min-h-11 rounded-full border border-border px-3 text-left text-sm"
                      onClick={() => setScope((current) => current.trim() ? `${current.trim()} ${prompt}` : prompt)}
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            <label className="grid gap-1 text-sm">Unit
              <select
                className={selectClass}
                value={lockedUnit ? "lump_sum" : unit}
                disabled={lockedUnit}
                onChange={(event) => setUnit(event.target.value as SubcontractorRateUnit | "")}
              >
                <option value="">Choose a unit</option>
                {SUBCONTRACTOR_RATE_UNITS.map((item) => (
                  <option key={item} value={item}>{SUBCONTRACTOR_RATE_UNIT_LABELS[item]}</option>
                ))}
              </select>
            </label>
            {lockedUnit ? <p className="text-sm">This came from a lump-sum response, so the unit stays a lump sum.</p> : null}
            <label className="grid gap-1 text-sm">{rateCostLabel(unit)}{currencyGate.needsNzdConfirmation ? "" : " (NZD)"}
              <Input className="min-h-11" inputMode="decimal" value={cost} onChange={(event) => setCost(event.target.value)} />
            </label>
            {currencyGate.notice ? <p className="text-sm">{currencyGate.notice}</p> : null}
            {currencyGate.needsNzdConfirmation ? (
              <label className="flex min-h-11 items-start gap-2 text-sm">
                <input type="checkbox" className="mt-1" checked={amountIsNzd} onChange={(event) => setAmountIsNzd(event.target.checked)} />
                This amount is in New Zealand dollars.
              </label>
            ) : null}
            <label className="grid gap-1 text-sm">Effective from
              <Input className="min-h-11" type="date" value={effectiveFrom} onChange={(event) => setEffectiveFrom(event.target.value)} />
            </label>
            <Button type="button" variant="outline" className="h-11 min-h-11 w-fit" aria-expanded={more} onClick={() => setMore((open) => !open)}>
              More details
            </Button>
            {more ? (
              <div className="grid gap-3" data-rate-more>
                <label className="grid gap-1 text-sm">Effective until
                  <Input className="min-h-11" type="date" value={effectiveUntil} onChange={(event) => setEffectiveUntil(event.target.value)} />
                </label>
                {measured ? (
                  <div className="grid gap-3 sm:grid-cols-3">
                    <label className="grid gap-1 text-sm">Minimum charge
                      <Input className="min-h-11" inputMode="decimal" value={minimum} onChange={(event) => setMinimum(event.target.value)} />
                    </label>
                    <label className="grid gap-1 text-sm">Quantity from
                      <Input className="min-h-11" inputMode="decimal" value={bandMin} onChange={(event) => setBandMin(event.target.value)} />
                    </label>
                    <label className="grid gap-1 text-sm">Quantity to
                      <Input className="min-h-11" inputMode="decimal" value={bandMax} onChange={(event) => setBandMax(event.target.value)} />
                    </label>
                  </div>
                ) : null}
                <label className="grid gap-1 text-sm">Inclusions
                  <Textarea value={inclusions} onChange={(event) => setInclusions(event.target.value)} className="min-h-16" />
                </label>
                <label className="grid gap-1 text-sm">Exclusions
                  <Textarea value={exclusions} onChange={(event) => setExclusions(event.target.value)} className="min-h-16" />
                </label>
                <p className="text-sm">Source: {rate ? sourceLabel(rate) : "Entered here"}</p>
                {rate?.sourceAmountExGst != null ? (
                  <p className="text-sm">Originating amount {money(rate.sourceAmountExGst)} ex GST stays on the first version.</p>
                ) : null}
                <label className="grid gap-1 text-sm">Last confirmed
                  <Input className="min-h-11" type="date" value={confirmedOn} onChange={(event) => setConfirmedOn(event.target.value)} />
                </label>
                <label className="grid gap-1 text-sm">Internal notes
                  <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} className="min-h-16" />
                </label>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="grid gap-3 text-sm" data-rate-review>
            <p>{summary}</p>
            {exclusions.trim() ? <p>Exclusions: {exclusions.trim()}</p> : null}
            {overlap ? <p>Another rate for this work area covers the same dates. Both can stay.</p> : null}
            <p>{rate ? "Saving keeps the earlier version." : "Saving adds this rate."} Estimate and Pricing stay unchanged.</p>
            {fromResponse ? (
              <div className="grid gap-2">
                <label className="flex min-h-11 items-start gap-2"><input type="checkbox" className="mt-1" checked={confirmScope} onChange={(event) => setConfirmScope(event.target.checked)} />I confirm this reusable scope.</label>
                <label className="flex min-h-11 items-start gap-2"><input type="checkbox" className="mt-1" checked={confirmUnit} onChange={(event) => setConfirmUnit(event.target.checked)} />I confirm this unit.</label>
                <label className="flex min-h-11 items-start gap-2"><input type="checkbox" className="mt-1" checked={confirmAmount} onChange={(event) => setConfirmAmount(event.target.checked)} />I confirm this cost ex GST.</label>
                <label className="flex min-h-11 items-start gap-2"><input type="checkbox" className="mt-1" checked={confirmValidity} onChange={(event) => setConfirmValidity(event.target.checked)} />I confirm these effective dates.</label>
              </div>
            ) : null}
          </div>
        )}
        {error ? <p className="text-sm text-destructive" role="alert" data-rate-incomplete={step === "edit" ? "true" : undefined}>{error}</p> : null}
        <DialogFooter>
          {step === "review" ? (
            <Button type="button" variant="outline" className="h-11 min-h-11" onClick={() => setStep("edit")}>Back</Button>
          ) : (
            <Button type="button" variant="outline" className="h-11 min-h-11" onClick={onClose}>Cancel</Button>
          )}
          {step === "edit" ? (
            <Button type="button" className="h-11 min-h-11" onClick={() => {
              const problem = missing();
              setError(problem);
              if (!problem) setStep("review");
            }}>
              Review
            </Button>
          ) : (
            <Button
              type="button"
              className="h-11 min-h-11"
              disabled={pending || (fromResponse && (!confirmScope || !confirmUnit || !confirmAmount || !confirmValidity))}
              onClick={() => void save()}
            >
              {pending ? "Saving…" : "Save"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function SubcontractorRates({
  subcontractorId,
  workAreaTypes,
  rates,
  canEdit,
  today,
  countryCode,
  preferredCurrency,
}: {
  subcontractorId: string;
  workAreaTypes: readonly string[];
  rates: SubcontractorRateRecord[];
  canEdit: boolean;
  today: string;
  countryCode: string | null;
  preferredCurrency: string | null;
}) {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState<RateRecordStatus>("current");
  const [areaFilter, setAreaFilter] = useState("");
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<SubcontractorRateRecord | null>(null);
  const [details, setDetails] = useState<SubcontractorRateRecord | null>(null);
  const [retiring, setRetiring] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const latest = useMemo(() => {
    const grouped = new Map<string, SubcontractorRateRecord[]>();
    for (const rate of rates) {
      const list = grouped.get(rate.rateId) ?? [];
      list.push(rate);
      grouped.set(rate.rateId, list);
    }
    return [...grouped.values()].flatMap((versions) => {
      const ordered = [...versions].sort((a, b) => b.versionNumber - a.versionNumber);
      const current = ordered[0];
      return current ? [{ current, versions: ordered }] : [];
    });
  }, [rates]);

  const visible = latest.filter(({ current }) => {
    if (rateRecordStatus(current, today) !== statusFilter) return false;
    if (areaFilter && current.workAreaType !== areaFilter) return false;
    const needle = query.trim().toLowerCase();
    return !needle || current.scope.toLowerCase().includes(needle);
  });
  const areas = [...new Set(latest.map(({ current }) => current.workAreaType))];

  async function retire(rateId: string) {
    setError(null);
    const result = await retireSubcontractorRate({ subcontractorId, rateId });
    if (!result.ok) setError(result.error);
    setRetiring(null);
    setDetails(null);
    router.refresh();
  }

  return (
    <section className="grid min-w-0 gap-3" data-subcontractor-rates>
      <div className="grid gap-2 sm:grid-cols-[auto_auto_1fr]">
        <select className={selectClass} aria-label="Rate status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as RateRecordStatus)}>
          {(Object.keys(STATUS_LABEL) as RateRecordStatus[]).map((status) => (
            <option key={status} value={status}>{STATUS_LABEL[status]}</option>
          ))}
        </select>
        <select className={selectClass} aria-label="Filter by work area" value={areaFilter} onChange={(event) => setAreaFilter(event.target.value)}>
          <option value="">All work areas</option>
          {areas.map((type) => (
            <option key={type} value={type}>{workAreaLabel(type)}</option>
          ))}
        </select>
        <Input className="min-h-11" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search scope" aria-label="Search scope" />
      </div>
      {currencyGateNotice(countryCode, preferredCurrency)}
      <div className="grid gap-3">
        {visible.length === 0 ? <p className="text-sm">{statusFilter === "current" ? "No current rates." : `No ${STATUS_LABEL[statusFilter].toLowerCase()} rates.`}</p> : null}
        {visible.map(({ current, versions }) => (
          <article key={current.rateId} className="grid gap-1 rounded-xl border border-border/70 bg-card px-3 py-3 text-sm" data-rate-id={current.rateId} data-rate-status={rateRecordStatus(current, today)}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <p className="min-w-0 font-medium">{current.scope}</p>
              <StatusPill tone={rateRecordStatus(current, today) === "current" ? "positive" : "warning"}>{STATUS_LABEL[rateRecordStatus(current, today)]}</StatusPill>
            </div>
            <p className="text-muted-foreground">{workAreaLabel(current.workAreaType)}</p>
            <p>{money(current.costExGst)} NZD ex GST{current.unit === "lump_sum" ? " lump sum" : ` / ${SUBCONTRACTOR_RATE_UNIT_LABELS[current.unit as SubcontractorRateUnit] ?? current.unit}`}</p>
            {current.minimumCharge != null && current.unit !== "lump_sum" ? <p>Minimum {money(current.minimumCharge)}</p> : null}
            <p>Last confirmed {current.lastConfirmedOn ? showDate(current.lastConfirmedOn) : "not recorded"} · {sourceLabel(current)}</p>
            <div className="mt-1 flex flex-wrap gap-2">
              <Button type="button" variant="outline" className="h-11 min-h-11" onClick={() => setDetails(current)}>Details</Button>
              {canEdit && !current.retired ? (
                <Button type="button" variant="outline" className="h-11 min-h-11" onClick={() => setEditing(current)}>Edit</Button>
              ) : null}
              {canEdit && !current.retired ? (
                retiring === current.rateId ? (
                  <>
                    <Button type="button" variant="outline" className="h-11 min-h-11" onClick={() => void retire(current.rateId)}>Retire</Button>
                    <Button type="button" variant="ghost" className="h-11 min-h-11" onClick={() => setRetiring(null)}>Cancel</Button>
                  </>
                ) : (
                  <Button type="button" variant="outline" className="h-11 min-h-11" onClick={() => setRetiring(current.rateId)}>Retire</Button>
                )
              ) : null}
            </div>
            <Dialog open={details?.rateId === current.rateId} onOpenChange={(open) => { if (!open) setDetails(null); }}>
              <DialogContent className="sm:max-w-lg" data-rate-details={current.rateId}>
                <DialogHeader>
                  <DialogTitle>{current.scope}</DialogTitle>
                </DialogHeader>
                <div className="grid gap-2 text-sm">
                  <p>Inclusions: {current.inclusions.trim() || "None"}</p>
                  <p>Exclusions: {current.exclusions.trim() || "None"}</p>
                  {current.unit !== "lump_sum" ? (
                    <p>
                      Quantity {current.quantityBandMin == null && current.quantityBandMax == null
                        ? "not limited"
                        : `${current.quantityBandMin ?? "any"} to ${current.quantityBandMax ?? "any"}`}
                    </p>
                  ) : null}
                  <p>Notes: {current.internalNotes.trim() || "None"}</p>
                  <p className="font-medium">Versions</p>
                  <ul className="grid gap-1">
                    {versions.map((version) => (
                      <li key={version.versionId}>
                        Version {version.versionNumber}: {money(version.costExGst)} ex GST · {version.scope}
                      </li>
                    ))}
                  </ul>
                </div>
              </DialogContent>
            </Dialog>
          </article>
        ))}
      </div>
      {canEdit ? (
        <Button type="button" className="h-11 min-h-11 w-fit" onClick={() => setAdding(true)}>Add rate</Button>
      ) : null}
      {error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}
      {adding ? (
        <RateDialog
          subcontractorId={subcontractorId}
          workAreaTypes={workAreaTypes}
          rates={rates}
          today={today}
          countryCode={countryCode}
          preferredCurrency={preferredCurrency}
          rate={null}
          onClose={() => setAdding(false)}
        />
      ) : null}
      {editing ? (
        <RateDialog
          subcontractorId={subcontractorId}
          workAreaTypes={workAreaTypes}
          rates={rates}
          today={today}
          countryCode={countryCode}
          preferredCurrency={preferredCurrency}
          rate={editing}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </section>
  );
}

function currencyGateNotice(countryCode: string | null, preferredCurrency: string | null) {
  const gate = rateBookCurrencyGate({ countryCode, preferredCurrency });
  if (!gate.notice) return null;
  return <p className="text-sm text-muted-foreground">{gate.notice}</p>;
}
