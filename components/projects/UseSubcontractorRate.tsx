"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { clearDialogClassName, revealFocusedField, useClearDialogStyle } from "@/components/subcontractors/clear-dialog";
import { applySubcontractorRateUse, previewSubcontractorRateUse } from "@/lib/subcontractors/rate-use-actions";
import type { JobRatePricingContext, RateUsePreview } from "@/lib/subcontractors/rate-use-actions";
import type { RfqSellTreatment } from "@/lib/rfqs/pricing-preview";
import { SUBCONTRACTOR_RATE_UNIT_LABELS, type StoredRateVersion, type SubcontractorRateUnit } from "@/lib/subcontractors/rate-book";
import { rateScopeConflictsWithResponse } from "@/lib/subcontractors/rate-use";

function money(value: number | null, unknownLabel = "Unknown"): string {
  if (value == null) return unknownLabel;
  return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function percent(value: number | null): string {
  if (value == null) return "Unknown";
  return `${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
}

export function UseSubcontractorRate({
  projectId,
  area,
  rate,
  pricing,
  canEdit,
  buttonLabel = "Use this rate on the job",
}: {
  projectId: string;
  area: { id: string; name: string; summary: string | null };
  rate: StoredRateVersion;
  pricing: JobRatePricingContext | null;
  canEdit: boolean;
  buttonLabel?: string;
}) {
  const router = useRouter();
  const dialogStyle = useClearDialogStyle();
  const [open, setOpen] = useState(false);
  const [quantity, setQuantity] = useState("");
  const [target, setTarget] = useState<string>("");
  const [confirmScope, setConfirmScope] = useState(false);
  const [confirmQuantity, setConfirmQuantity] = useState(false);
  const [sourceChoice, setSourceChoice] = useState<"" | "rate" | "response">("");
  const [preview, setPreview] = useState<RateUsePreview | null>(null);
  const [treatment, setTreatment] = useState<RfqSellTreatment | "">("");
  const [manualSell, setManualSell] = useState("");
  const [acknowledgeLoss, setAcknowledgeLoss] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const lossRef = useRef<HTMLLabelElement>(null);
  const applyingRef = useRef(false);
  const [pending, setPending] = useState(false);
  const existing = pricing?.uses.find((use) => use.rateId === rate.rateId) ?? null;
  const lines = (pricing?.items ?? []).filter((item) => item.workAreaId === area.id && item.id !== existing?.allowanceItemId);
  const conflict = (pricing?.responses ?? []).find((response) =>
    response.workAreaId === area.id && rateScopeConflictsWithResponse(rate.scope, response.includedScope, response.scopeLabel)
  );
  const lump = rate.unit === "lump_sum";
  const selectedChoice = preview?.choices.find((choice) => choice.treatment === treatment) ?? null;
  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);
  useEffect(() => {
    if (!selectedChoice?.loss) return;
    const node = lossRef.current;
    const scroller = node?.closest("[data-rate-review]");
    if (!node || !(scroller instanceof HTMLElement)) return;
    window.requestAnimationFrame(() => {
      const field = node.getBoundingClientRect();
      const frame = scroller.getBoundingClientRect();
      if (field.top < frame.top) scroller.scrollTop += field.top - frame.top - 8;
      else if (field.bottom > frame.bottom) scroller.scrollTop += field.bottom - frame.bottom + 8;
    });
  }, [selectedChoice?.loss, treatment]);
  const jobScope = area.summary?.trim() ? area.summary : "No specification is recorded for this work area.";

  if (!canEdit) return null;

  function resetPreview() {
    setPreview(null);
    setTreatment("");
    setAcknowledgeLoss(false);
  }

  function targetMode(): { mode: "add" | "replace"; itemId: string | null } | null {
    if (existing) return { mode: "replace", itemId: existing.allowanceItemId };
    if (target === "add") return { mode: "add", itemId: null };
    if (target) return { mode: "replace", itemId: target };
    if (lines.length === 0) return { mode: "add", itemId: null };
    return null;
  }

  async function runPreview() {
    if (!pricing) return;
    const chosen = targetMode();
    if (!chosen) {
      setError("Choose the one item to replace, or add a new item.");
      return;
    }
    if (!confirmScope || !confirmQuantity) {
      setError("Confirm the supplier scope and the quantity before previewing the price.");
      return;
    }
    if (conflict && sourceChoice !== "rate") {
      setError("A response already covers this scope. Choose one source.");
      return;
    }
    setPending(true);
    setError(null);
    resetPreview();
    const result = await previewSubcontractorRateUse({
      projectId,
      pricingDocumentId: pricing.documentId,
      workAreaId: area.id,
      rateVersionId: rate.versionId,
      targetMode: chosen.mode,
      targetItemId: chosen.itemId,
      quantity: lump ? null : quantity.trim() === "" ? null : Number(quantity),
      manualSell: manualSell.trim() === "" ? null : Number(manualSell),
    });
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setPreview(result);
  }

  async function applyChoice() {
    if (applyingRef.current || !pricing || !preview || !treatment) return;
    const chosen = targetMode();
    const choice = preview.choices.find((item) => item.treatment === treatment);
    if (!chosen || !choice?.available) return;
    if (choice.loss && !acknowledgeLoss) return;
    applyingRef.current = true;
    setPending(true);
    setError(null);
    try {
      const result = await applySubcontractorRateUse({
        projectId,
        pricingDocumentId: pricing.documentId,
        workAreaId: area.id,
        rateVersionId: rate.versionId,
        targetMode: chosen.mode,
        targetItemId: chosen.itemId,
        quantity: lump ? null : quantity.trim() === "" ? null : Number(quantity),
        manualSell: manualSell.trim() === "" ? null : Number(manualSell),
        sellTreatment: treatment,
        acknowledgeLoss,
        confirmScope,
        confirmQuantity,
        sourceChoice: conflict ? "rate" : null,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setOpen(false);
      router.refresh();
    } catch {
      setError("Could not use that rate on this job. Nothing was changed.");
    } finally {
      applyingRef.current = false;
      setPending(false);
    }
  }

  return (
    <>
      <Button type="button" className="h-11 min-h-11" disabled={!pricing || pricing.quoteIssued} onClick={() => { setError(null); setOpen(true); }}>
        {buttonLabel}
      </Button>
      {!pricing ? <p className="text-sm">Create pricing from the estimate before using a rate.</p> : null}
      {pricing?.quoteIssued ? <p className="text-sm">An issued quote stays as it was. This rate is not applied.</p> : null}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className={clearDialogClassName}
          style={{ ...dialogStyle, display: "flex", flexDirection: "column", overflow: "hidden" }}
          data-use-rate={rate.versionId}
        >
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 pt-6 pb-4" data-rate-review onChange={() => setError(null)} onFocus={revealFocusedField}>
            <DialogHeader>
              <DialogTitle>{buttonLabel}</DialogTitle>
            </DialogHeader>
            <div className="mt-4 grid gap-3 text-sm">
              <p data-rate-version>Version {rate.versionNumber}. A later change to the rate book does not change this job.</p>
              <p data-rate-effective>Effective {rate.effectiveFrom.slice(0, 10)}{rate.effectiveUntil ? ` until ${rate.effectiveUntil.slice(0, 10)}` : ", with no end date"}.</p>
              <p className="break-words" data-rate-exclusions>Exclusions: {rate.exclusions.trim() ? rate.exclusions : "None recorded"}.</p>
              <p className="break-words">Supplier scope: {rate.scope}</p>
              <p className="break-words" data-job-scope>Job scope: {jobScope}</p>
              <p>A work-area match does not mean this supplier scope matches the job.</p>
              {lump ? (
                <p data-lump-sum>One lump sum · {money(rate.costExGst)} NZD ex GST. This cost is used once.</p>
              ) : (
                <p>Unit: {SUBCONTRACTOR_RATE_UNIT_LABELS[rate.unit as SubcontractorRateUnit] ?? rate.unit} · {money(rate.costExGst)} NZD ex GST</p>
              )}
              {rate.minimumCharge != null && !lump ? <p>Minimum charge {money(rate.minimumCharge)} ex GST, applied once.</p> : null}
              {lump ? null : (
                <label className="grid gap-1">Measured quantity
                  <input className="h-11 min-h-11 rounded-md border border-border bg-background px-3" inputMode="decimal" value={quantity} onChange={(event) => { setQuantity(event.target.value); resetPreview(); }} />
                </label>
              )}
              <label className="flex min-h-11 items-start gap-2">
                <input type="checkbox" className="mt-1" checked={confirmScope} onChange={(event) => { setConfirmScope(event.target.checked); resetPreview(); }} />
                I confirm this supplier scope matches the job scope.
              </label>
              <label className="flex min-h-11 items-start gap-2">
                <input type="checkbox" className="mt-1" checked={confirmQuantity} onChange={(event) => { setConfirmQuantity(event.target.checked); resetPreview(); }} />
                {lump ? "I confirm this lump sum is used once." : "I confirm this measured quantity."}
              </label>
              {existing ? (
                <p data-rate-target>This updates {existing.scope}. It does not add a second allowance.</p>
              ) : (
                <fieldset className="grid gap-2" data-rate-target>
                  <legend className="font-medium">Item</legend>
                  {lines.map((line) => (
                    <label key={line.id} className="flex min-h-11 items-start gap-2">
                      <input type="radio" name={`rate-target-${rate.rateId}`} checked={target === line.id} onChange={() => { setTarget(line.id); resetPreview(); }} />
                      <span>Replace {line.label} ({line.unit || "no unit"}{line.quantity == null ? "" : `, ${line.quantity}`})</span>
                    </label>
                  ))}
                  <label className="flex min-h-11 items-start gap-2">
                    <input type="radio" name={`rate-target-${rate.rateId}`} checked={target === "add" || (lines.length === 0 && target === "")} onChange={() => { setTarget("add"); resetPreview(); }} />
                    <span>Add a new pricing item</span>
                  </label>
                  {lines.length > 1 && target === "" ? <p>More than one item matches this work area. Choose one.</p> : null}
                </fieldset>
              )}
              {conflict ? (
                <fieldset className="grid gap-2 rounded-md border border-border p-3">
                  <legend className="font-medium">One source</legend>
                  <p>A response already covers {conflict.scopeLabel}. Using both would charge this scope twice.</p>
                  <label className="flex min-h-11 items-start gap-2">
                    <input type="radio" name={`rate-source-${rate.rateId}`} checked={sourceChoice === "rate"} onChange={() => { setSourceChoice("rate"); resetPreview(); }} />
                    Use this rate and stop charging that response.
                  </label>
                  <label className="flex min-h-11 items-start gap-2">
                    <input type="radio" name={`rate-source-${rate.rateId}`} checked={sourceChoice === "response"} onChange={() => { setSourceChoice("response"); resetPreview(); }} />
                    Keep the response. Do not use this rate.
                  </label>
                </fieldset>
              ) : null}
              <label className="grid gap-1">Manual sell ex GST
                <input className="h-11 min-h-11 rounded-md border border-border bg-background px-3" inputMode="decimal" value={manualSell} onChange={(event) => { setManualSell(event.target.value); resetPreview(); }} />
              </label>
              {preview ? (
                <div className="grid gap-2" data-rate-pricing-preview>
                  <p>Supplier cost ex GST: {money(preview.supplierCost)}{preview.minimumApplied ? " (minimum charge)" : ""}.</p>
                  <p data-rate-before>Pricing before: cost {money(preview.before.cost)} · sell {money(preview.before.sell)} · gross profit {money(preview.before.grossProfit)} · margin {percent(preview.before.marginPercent)} · GST {money(preview.before.gstAmount)} · total {money(preview.before.totalInclGst)}</p>
                  <fieldset className="grid gap-2">
                    <legend className="font-medium">Choose the sell. Nothing is selected for you.</legend>
                    {preview.choices.map((choice) => {
                      const title = choice.treatment === "keep"
                        ? "Keep the current sell"
                        : choice.treatment === "target_margin"
                          ? preview.targetMarginPercent == null
                            ? "Reprice at the job target"
                            : `Reprice at the ${preview.targetMarginSource === "job" ? "job" : "pricing"} target of ${preview.targetMarginPercent}%`
                          : "Enter a sell";
                      return (
                        <div key={choice.treatment} className="grid gap-1 rounded-md border border-border p-3" data-sell-choice={choice.treatment}>
                          <label className="flex min-h-11 items-center gap-2 font-medium">
                            <input type="radio" name={`rate-sell-${rate.rateId}`} disabled={!choice.available} checked={treatment === choice.treatment} onChange={() => { setTreatment(choice.treatment); setAcknowledgeLoss(false); }} />
                            {title}
                          </label>
                          {choice.available ? (
                            <>
                              <p>After: cost {money(choice.after.cost)} · sell {money(choice.after.sell)} · gross profit {money(choice.after.grossProfit)} · margin {percent(choice.after.marginPercent)} · GST {money(choice.after.gstAmount)} · total {money(choice.after.totalInclGst)}</p>
                              {choice.loss ? (
                                <div className="grid gap-2" data-loss-review>
                                  <p className="font-medium text-destructive">Cost is higher than the sell. The gross margin is negative.</p>
                                  {treatment === choice.treatment ? (
                                    <label ref={lossRef} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md border border-destructive/40 px-3 py-2" data-loss-acknowledgement>
                                      <input type="checkbox" className="size-6 shrink-0" checked={acknowledgeLoss} onChange={(event) => setAcknowledgeLoss(event.target.checked)} />
                                      I acknowledge this cost is higher than the sell.
                                    </label>
                                  ) : null}
                                </div>
                              ) : null}
                            </>
                          ) : <p>{choice.unavailableReason}</p>}
                        </div>
                      );
                    })}
                  </fieldset>
                </div>
              ) : null}
            </div>
          </div>
          <div className="shrink-0 border-t bg-popover" data-dialog-actions>
            {error ? <p ref={errorRef} className="px-6 pt-3 text-destructive" role="alert" tabIndex={-1}>{error}</p> : null}
            <DialogFooter className="px-6 pt-3 pb-4">
              <Button type="button" variant="outline" className="h-11 min-h-11" onClick={() => setOpen(false)}>Cancel</Button>
              {preview && treatment ? (
                <Button type="button" className="h-11 min-h-11" disabled={pending || (preview.choices.find((choice) => choice.treatment === treatment)?.loss && !acknowledgeLoss)} onClick={() => void applyChoice()}>
                  {pending ? "Saving…" : "Use this rate"}
                </Button>
              ) : (
                <Button type="button" className="h-11 min-h-11" disabled={pending || sourceChoice === "response"} onClick={() => void runPreview()}>
                  {pending ? "Checking…" : "Preview pricing"}
                </Button>
              )}
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
