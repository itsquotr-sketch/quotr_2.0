"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import type { RfqDetail, RfqPricingTarget } from "@/lib/rfqs/load";
import { applyRfqPricingApplication, previewRfqPricingApplication } from "@/lib/rfqs/pricing-apply";
import type { RfqPricingPreviewResult } from "@/lib/rfqs/pricing-apply";
import { gstTreatmentLabel, pricingStructureLabel } from "@/lib/rfqs/shared";

function money(value: number | null): string {
  if (value == null) return "Unknown";
  return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function percent(value: number | null): string {
  if (value == null) return "Unknown";
  return `${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
}

export function RfqPricingApply({
  detail,
  pricing,
  canPrice,
}: {
  detail: RfqDetail;
  pricing: RfqPricingTarget | null;
  canPrice: boolean;
}) {
  const router = useRouter();
  const submitted = detail.responses.filter((response) => response.status === "submitted");
  const [responseId, setResponseId] = useState(submitted[0]?.id ?? "");
  const [selected, setSelected] = useState<string[]>([]);
  const [preview, setPreview] = useState<RfqPricingPreviewResult | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const response = submitted.find((item) => item.id === responseId) ?? null;
  const names = new Map(detail.recipients.map((recipient) => [recipient.id, recipient.tradingName]));
  const newer = detail.applications.some((application) => {
    const latest = submitted
      .filter((item) => item.recipientId === application.recipientId)
      .sort((a, b) => b.versionNumber - a.versionNumber)[0];
    return Boolean(latest && latest.id !== application.responseId);
  });
  const lines = (pricing?.items ?? []).filter((item) => {
    if (detail.workAreaId && item.workAreaId !== detail.workAreaId) return false;
    if (detail.applications.some((application) => application.allowanceItemId === item.id)) return false;
    return true;
  });

  if (!canPrice || detail.status !== "sent" || submitted.length === 0) return null;

  function toggle(id: string) {
    setPreview(null);
    setConfirmed(false);
    setSelected((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  async function runPreview() {
    if (!response || !pricing) return;
    setPending(true);
    setError(null);
    const result = await previewRfqPricingApplication({
      responseId: response.id,
      pricingDocumentId: pricing.documentId,
      workAreaId: detail.workAreaId || lines.find((line) => selected.includes(line.id))?.workAreaId || "",
      replacedItemIds: selected,
    });
    setPending(false);
    if (!result.ok) {
      setPreview(null);
      setError(result.error);
      return;
    }
    setPreview(result);
  }

  async function apply() {
    if (!response || !pricing || !preview) return;
    setPending(true);
    setError(null);
    const result = await applyRfqPricingApplication({
      responseId: response.id,
      pricingDocumentId: pricing.documentId,
      workAreaId: detail.workAreaId || lines.find((line) => selected.includes(line.id))?.workAreaId || "",
      replacedItemIds: selected,
    });
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setConfirmed(false);
    router.refresh();
  }

  return (
    <section className="grid gap-3" data-rfq-pricing-apply>
      <h2 className="text-base font-semibold">Use for pricing</h2>
      <p className="text-sm text-foreground/70">
        This puts the selected response onto draft pricing. It does not award the work or notify the subcontractor.
      </p>
      {newer ? <p className="text-sm font-medium">Newer response available</p> : null}
      {!pricing ? <p className="text-sm">Create draft pricing before using a response.</p> : null}
      <label className="grid gap-1 text-sm">
        Response
        <select
          className="h-11 min-h-11 rounded-md border border-border bg-background px-3"
          value={responseId}
          onChange={(event) => {
            setResponseId(event.target.value);
            setPreview(null);
            setConfirmed(false);
          }}
        >
          {submitted.map((item) => (
            <option key={item.id} value={item.id}>
              {names.get(item.recipientId) || "Recipient"} · version {item.versionNumber} · {item.priceExGst?.toLocaleString() ?? "No price"} ex GST
            </option>
          ))}
        </select>
      </label>
      {response ? (
        <div className="grid gap-1 text-sm">
          <p>{pricingStructureLabel(response.pricingStructure)} · {gstTreatmentLabel(response.gstTreatment)}</p>
          {response.pricingStructure === "itemised" ? (
            <>
              <p className="font-medium">Included</p>
              {(response.includedScope || "None stated").split("\n").map((line, index) => (
                <p key={`in-${index}`}>{line}</p>
              ))}
              <p className="font-medium">Excluded</p>
              {(response.excludedScope || "None stated").split("\n").map((line, index) => (
                <p key={`out-${index}`}>{line}</p>
              ))}
            </>
          ) : (
            <p>This becomes one subcontract allowance named for {detail.scopeLabel || "the requested work"}.</p>
          )}
          {detail.applications.some((application) => application.responseId === response.id) ? (
            <p>This response is already used for pricing.</p>
          ) : null}
        </div>
      ) : null}
      <fieldset className="grid gap-2">
        <legend className="text-sm font-medium">Pricing lines this response replaces</legend>
        {lines.length === 0 ? <p className="text-sm">No draft pricing lines in this work area.</p> : null}
        {lines.map((line) => (
          <label key={line.id} className="flex min-h-11 items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-1"
              checked={selected.includes(line.id)}
              onChange={() => toggle(line.id)}
            />
            <span>
              {line.label}
              <span className="block text-foreground/70">
                Cost {line.totalCost === 0 && line.totalSell === 0 ? "Unknown" : line.totalCost.toLocaleString()} · Sell {line.totalCost === 0 && line.totalSell === 0 ? "Unknown" : line.totalSell.toLocaleString()}
              </span>
            </span>
          </label>
        ))}
      </fieldset>
      <Button type="button" variant="outline" className="h-11 min-h-11 w-fit" disabled={pending || selected.length === 0 || !pricing} onClick={runPreview}>
        Preview pricing
      </Button>
      {preview ? (
        <div className="grid gap-2 rounded-xl border border-border bg-card p-4 text-sm" data-rfq-pricing-preview>
          <p className="font-medium">{preview.label}</p>
          <p>Subcontract cost ex GST: {money(preview.allowanceCost)}</p>
          <p>Subcontract sell: {preview.sellKnown ? money(preview.allowanceSell) : "Unknown"}</p>
          <p>Pricing cost: {money(preview.before.cost)} → {money(preview.after.cost)}</p>
          <p>Pricing sell: {money(preview.before.sell)} → {money(preview.after.sell)}</p>
          <p>Margin: {percent(preview.before.marginPercent)} → {percent(preview.after.marginPercent)}</p>
          <p>GST: {money(preview.before.gstAmount)} → {money(preview.after.gstAmount)}</p>
          <p>Total including GST: {money(preview.before.totalInclGst)} → {money(preview.after.totalInclGst)}</p>
          {preview.quoteExists ? (
            <p>A quote already exists. This changes draft pricing only. Issuing the revised price uses the normal new quote or revision path.</p>
          ) : null}
          <label className="flex min-h-11 items-start gap-2">
            <input type="checkbox" className="mt-1" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />
            <span>Use this response for draft pricing. This does not award the work or notify the subcontractor.</span>
          </label>
          <Button type="button" className="h-11 min-h-11 w-fit" disabled={!confirmed || pending} onClick={apply}>
            Use for pricing
          </Button>
        </div>
      ) : null}
      {error ? <p className="text-sm text-red-700" role="alert">{error}</p> : null}
    </section>
  );
}
