"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { RfqApplyColumn } from "@/components/rfqs/rfq-layout";
import type { RfqDetail, RfqPricingTarget, RfqResponseView } from "@/lib/rfqs/load";
import { RfqSchedulePricing } from "@/components/rfqs/RfqSchedulePricing";
import { applyRfqPricingApplication, previewRfqPricingApplication } from "@/lib/rfqs/pricing-apply";
import type { RfqPricingPreviewResult } from "@/lib/rfqs/pricing-apply";
import type { RfqPricingMoneyView, RfqSellTreatment } from "@/lib/rfqs/pricing-preview";
import { gstTreatmentLabel, pricingStructureLabel } from "@/lib/rfqs/shared";
import { formatPricingMoney, formatPricingPercent } from "@/lib/pricing/format";

const fieldClass =
  "min-h-11 w-full rounded-md border border-border bg-background px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-orange)]";

const choiceClass = (selected: boolean) =>
  selected
    ? "grid gap-2 rounded-lg border border-[var(--brand-orange)] bg-[var(--brand-orange)]/5 p-3 ring-1 ring-[var(--brand-orange)]"
    : "grid gap-2 rounded-lg border border-border p-3";

export type RfqReviewRequest = { id: string; nonce: number };

function money(value: number | null, unknownLabel = "Pricing Required"): string {
  if (value == null) return unknownLabel;
  return formatPricingMoney(value);
}

function percent(value: number | null): string {
  if (value == null) return "Pricing Required";
  return formatPricingPercent(value);
}

function signedDelta(before: number | null, after: number | null, kind: "money" | "percent"): string {
  if (before == null || after == null) return "Pricing Required";
  const diff = Math.round((after - before) * 100) / 100;
  const body = kind === "percent" ? formatPricingPercent(Math.abs(diff)) : formatPricingMoney(Math.abs(diff));
  if (diff > 0) return `+${body}`;
  if (diff < 0) return `−${body}`;
  return body;
}

function submittedLabel(value: string | null): string {
  if (!value) return "Not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not recorded";
  return date.toLocaleString("en-NZ", { dateStyle: "medium", timeStyle: "short" });
}

function quantityLabel(quantity: number | null, unit: string | null): string {
  const unitText = unit === "m2" ? "m²" : unit === "lump_sum" ? "lump sum" : unit || "";
  if (quantity == null) return unitText || "Quantity not set";
  return unitText ? `${quantity.toLocaleString("en-NZ")} ${unitText}` : quantity.toLocaleString("en-NZ");
}

function lineKnown(line: { totalCost: number; totalSell: number }): boolean {
  return line.totalCost > 0 || line.totalSell > 0;
}

function lineSuggested(label: string, supplierScope: string, areaName: string): boolean {
  const stems = areaName
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length >= 4)
    .flatMap((word) => [word, word.endsWith("s") ? word.slice(0, -1) : word]);
  const skip = new Set([...stems, "supply", "install", "installation", "materials", "labour", "labor", "included", "allowance"]);
  const words = label.toLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length >= 5 && !skip.has(word));
  const haystack = supplierScope.toLowerCase();
  return words.length > 0 && words.some((word) => haystack.includes(word));
}

function supplierConditions(response: RfqResponseView): Array<{ title: string; body: string }> {
  const items: Array<{ title: string; body: string }> = [];
  if (response.excludedScope.trim()) items.push({ title: "Exclusion", body: response.excludedScope.trim() });
  if (response.assumptions.trim()) items.push({ title: "Qualification or assumption", body: response.assumptions.trim() });
  if (response.qualified && items.length === 0) {
    items.push({ title: "Qualified response", body: "The supplier marked this response as qualified and did not write the condition." });
  }
  return items;
}

function MoneyRows({
  before,
  after,
  gstLabel,
  totalLabel,
}: {
  before: RfqPricingMoneyView;
  after: RfqPricingMoneyView;
  gstLabel: string;
  totalLabel: string;
}) {
  const rows: Array<[string, number | null, number | null, "money" | "percent"]> = [
    ["Cost ex GST", before.cost, after.cost, "money"],
    ["Client sell ex GST", before.sell, after.sell, "money"],
    ["Gross profit", before.grossProfit, after.grossProfit, "money"],
    ["Margin", before.marginPercent, after.marginPercent, "percent"],
    [gstLabel, before.gstAmount, after.gstAmount, "money"],
    [totalLabel, before.totalInclGst, after.totalInclGst, "money"],
  ];
  return (
    <div className="grid gap-4 overflow-x-hidden">
      <dl className="grid gap-3 lg:hidden">
        {rows.map(([label, from, to, kind]) => (
          <div key={label} className="grid gap-1 border-b border-border pb-3">
            <dt className="break-words font-medium">{label}</dt>
            <dd className="grid min-w-0 grid-cols-3 gap-2 tabular-nums">
              <span className="min-w-0 break-words"><span className="block text-foreground/70">Before</span>{kind === "percent" ? percent(from) : money(from)}</span>
              <span className="min-w-0 break-words"><span className="block text-foreground/70">After</span>{kind === "percent" ? percent(to) : money(to)}</span>
              <span className="min-w-0 break-words"><span className="block text-foreground/70">Change</span>{signedDelta(from, to, kind)}</span>
            </dd>
          </div>
        ))}
      </dl>
      <div className="hidden lg:grid lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] lg:gap-x-3 lg:gap-y-1">
        <span className="text-foreground/70"> </span>
        <span>Before</span>
        <span>After</span>
        <span>Change</span>
        {rows.map(([label, from, to, kind]) => (
          <div key={label} className="contents">
            <span className="break-words">{label}</span>
            <span className="tabular-nums">{kind === "percent" ? percent(from) : money(from)}</span>
            <span className="tabular-nums">{kind === "percent" ? percent(to) : money(to)}</span>
            <span className="tabular-nums">{signedDelta(from, to, kind)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function RfqPricingApply(props: {
  detail: RfqDetail;
  pricing: RfqPricingTarget | null;
  canPrice: boolean;
  reviewRequest?: RfqReviewRequest | null;
  onResponseId?: (id: string) => void;
}) {
  if (props.detail.pricingRequest === "schedule") {
    return (
      <RfqApplyColumn>
        <RfqSchedulePricing
          detail={props.detail}
          pricing={props.pricing}
          canPrice={props.canPrice}
          reviewRequest={props.reviewRequest}
          onResponseId={props.onResponseId}
        />
      </RfqApplyColumn>
    );
  }
  return <LumpPricingApply {...props} />;
}

function LumpPricingApply({
  detail,
  pricing,
  canPrice,
  reviewRequest,
  onResponseId,
}: {
  detail: RfqDetail;
  pricing: RfqPricingTarget | null;
  canPrice: boolean;
  reviewRequest?: RfqReviewRequest | null;
  onResponseId?: (id: string) => void;
}) {
  const router = useRouter();
  const submitted = detail.responses.filter((response) => response.status === "submitted");
  const appliedId = detail.applications.find((application) => submitted.some((response) => response.id === application.responseId))?.responseId;
  const newestId = [...submitted].sort((a, b) => b.versionNumber - a.versionNumber)[0]?.id ?? "";
  const [responseId, setResponseId] = useState(appliedId ?? newestId);
  const [selected, setSelected] = useState<string[]>([]);
  const [addOnly, setAddOnly] = useState(false);
  const [acknowledgeOverlap, setAcknowledgeOverlap] = useState(false);
  const [preview, setPreview] = useState<RfqPricingPreviewResult | null>(null);
  const [treatment, setTreatment] = useState<RfqSellTreatment | "">("");
  const [manualSell, setManualSell] = useState("");
  const [acknowledgeLoss, setAcknowledgeLoss] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const flight = useRef(false);
  const request = useRef(0);
  const previewTimer = useRef<number | null>(null);
  const consumedReview = useRef<number | null>(null);
  const response = submitted.find((item) => item.id === responseId) ?? null;
  const names = new Map(detail.recipients.map((recipient) => [recipient.id, recipient.tradingName]));
  const lines = (pricing?.items ?? []).filter((item) => {
    if (detail.workAreaId && item.workAreaId !== detail.workAreaId) return false;
    if (item.visibleOnQuote === false) return false;
    if ((item.recalibrationNote ?? "").startsWith("Replaced for draft pricing")) return false;
    if (detail.applications.some((application) => application.allowanceItemId === item.id)) return false;
    return true;
  });
  const omitted = (pricing?.items ?? []).filter((item) => {
    if (detail.workAreaId && item.workAreaId !== detail.workAreaId) return false;
    return !lines.some((line) => line.id === item.id);
  }).length;
  const workAreaId = detail.workAreaId || lines.find((line) => selected.includes(line.id))?.workAreaId || "";
  const activeApplication = detail.applications.find((application) => !detail.workAreaId || application.workAreaId === detail.workAreaId) ?? null;
  const activeResponse = submitted.find((item) => item.id === activeApplication?.responseId) ?? null;
  const newerThanApplied = Boolean(
    response && activeResponse && response.id !== activeResponse.id && response.versionNumber > activeResponse.versionNumber
  );
  const picked = lines.filter((line) => selected.includes(line.id));
  const remaining = lines.length - picked.length;
  const conditions = response ? supplierConditions(response) : [];
  const fresh = previewing ? null : preview;
  const selectedChoice = fresh?.choices.find((choice) => choice.treatment === treatment) ?? null;
  const overlapRequired = selected.length === 0 && !activeApplication && lines.length > 0;
  const canApply = Boolean(
    selectedChoice?.available &&
    confirmed &&
    !saving &&
    !previewing &&
    (selected.length > 0 || addOnly) &&
    (!overlapRequired || acknowledgeOverlap) &&
    (!selectedChoice.loss || acknowledgeLoss)
  );
  const supplierName = response ? names.get(response.recipientId) || "Supplier" : "Supplier";
  const statedScope = response?.includedScope.trim() || "";

  useEffect(() => {
    if (!error) return;
    errorRef.current?.focus();
  }, [error]);

  useEffect(() => {
    if (responseId) onResponseId?.(responseId);
  }, [responseId, onResponseId]);

  function resetAcknowledgements() {
    setAcknowledgeLoss(false);
    setAcknowledgeOverlap(false);
    setConfirmed(false);
    setDone(false);
  }

  function schedulePreview(nextSelected: string[], nextAddOnly: boolean, nextManual: string, nextResponseId: string) {
    if (previewTimer.current != null) window.clearTimeout(previewTimer.current);
    const nextResponse = submitted.find((item) => item.id === nextResponseId) ?? null;
    const nextArea = detail.workAreaId || lines.find((line) => nextSelected.includes(line.id))?.workAreaId || "";
    if (!nextResponse || !pricing || (nextSelected.length === 0 && !nextAddOnly)) {
      request.current += 1;
      setPreview(null);
      setPreviewing(false);
      return;
    }
    const token = ++request.current;
    setPreviewing(true);
    setError(null);
    previewTimer.current = window.setTimeout(() => {
      const parsedSell = nextManual.trim() === "" ? null : Number(nextManual);
      void previewRfqPricingApplication({
        responseId: nextResponse.id,
        pricingDocumentId: pricing.documentId,
        workAreaId: nextArea,
        replacedItemIds: nextSelected,
        manualSell: parsedSell != null && Number.isFinite(parsedSell) ? parsedSell : null,
      }).then((result) => {
        if (token !== request.current) return;
        setPreviewing(false);
        if (!result.ok) {
          setPreview(null);
          setError(result.error);
          return;
        }
        setPreview(result);
        setTreatment((current) => {
          if (!current || current === "manual") return current;
          const choice = result.choices.find((item) => item.treatment === current);
          return choice && !choice.available ? "" : current;
        });
        setAcknowledgeLoss(false);
      });
    }, 250);
  }

  useEffect(() => {
    if (!reviewRequest || consumedReview.current === reviewRequest.nonce) return;
    consumedReview.current = reviewRequest.nonce;
    const nextId = reviewRequest.id;
    if (!submitted.some((item) => item.id === nextId) || nextId === responseId) return;
    queueMicrotask(() => {
      setResponseId(nextId);
      setSelected([]);
      setAddOnly(false);
      setManualSell("");
      resetAcknowledgements();
      schedulePreview([], false, "", nextId);
    });
    // The review nonce is the only trigger. schedulePreview closes over the latest lines.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reviewRequest]);

  if (!canPrice || detail.status !== "sent" || submitted.length === 0) return null;

  function toggle(id: string) {
    const next = selected.includes(id) ? selected.filter((item) => item !== id) : [...selected, id];
    setSelected(next);
    setAddOnly(false);
    resetAcknowledgements();
    schedulePreview(next, false, manualSell, responseId);
  }

  async function apply() {
    if (!response || !pricing || !fresh || !treatment || !canApply || flight.current) return;
    flight.current = true;
    setSaving(true);
    setError(null);
    const parsedSell = manualSell.trim() === "" ? null : Number(manualSell);
    const result = await applyRfqPricingApplication({
      responseId: response.id,
      pricingDocumentId: pricing.documentId,
      workAreaId,
      replacedItemIds: selected,
      sellTreatment: treatment,
      manualSell: parsedSell != null && Number.isFinite(parsedSell) ? parsedSell : null,
      acknowledgeLoss,
    });
    flight.current = false;
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setDone(true);
    setConfirmed(false);
    router.refresh();
  }

  function choiceTitle(choiceTreatment: RfqSellTreatment) {
    if (choiceTreatment === "keep") return "Keep current client sell";
    if (choiceTreatment === "target_margin") {
      if (fresh?.targetMarginPercent == null) return "Reprice at the job target margin";
      const source = fresh.targetMarginSource === "job" ? "job" : "pricing";
      return `Reprice at the ${source} target margin (${fresh.targetMarginPercent}%)`;
    }
    return "Enter a client sell ex GST";
  }

  function sellTreatmentLabel() {
    if (treatment === "keep") return "keeps the current client sell";
    if (treatment === "target_margin") return "reprices at the target margin";
    if (selectedChoice?.sellKnown && selectedChoice.sell != null) {
      return `uses a client sell of ${money(selectedChoice.sell)} ex GST`;
    }
    return "uses an entered client sell ex GST";
  }

  const confirmSummary = response && fresh && selectedChoice?.available
    ? [
        `Use ${supplierName}, response version ${response.versionNumber}, for draft pricing.`,
        selected.length === 0
          ? "This adds the supplier allowance and does not replace a line."
          : `This replaces ${selected.length === 1 ? "1 line" : `${selected.length} lines`}.`,
        `${remaining === 1 ? "1 line remains" : `${remaining} lines remain`} charged.`,
        `The allowance is “${fresh.label}”.`,
        `The sell treatment ${sellTreatmentLabel()}.`,
        conditions.length === 0
          ? "No supplier conditions are on this version."
          : "No client-facing scope wording is stored. The supplier conditions stay on the private response.",
      ].join(" ")
    : "";

  return (
    <RfqApplyColumn>
      <section
        id="rfq-pricing-apply"
        className="grid scroll-mt-6 gap-8 rounded-xl border border-border bg-card p-4 sm:p-6"
        data-rfq-pricing-apply
        aria-busy={previewing || saving}
      >
        <div className="grid gap-2">
          <h2 className="text-base font-semibold">Use for pricing</h2>
          <p className="text-sm text-foreground/70">This puts the response onto draft pricing.</p>
        </div>

        {done && pricing ? (
          <div className="grid gap-3 rounded-lg border border-border bg-background p-4" data-rfq-pricing-applied>
            <p className="font-medium">Draft pricing has this allowance.</p>
            <ol className="list-decimal pl-5 text-sm">
              <li>Check the client description and scope.</li>
              <li>Mark Pricing reviewed.</li>
              <li>Create the Quote.</li>
            </ol>
            <p className="text-sm">This step did not create or send a Quote.</p>
            <Link
              href={`/app/projects/${detail.projectId}/pricing/${pricing.documentId}`}
              className="inline-flex min-h-11 w-fit items-center rounded-md bg-[var(--brand-orange)] px-4 text-sm font-medium text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-orange)] focus-visible:ring-offset-2"
            >
              Go to Pricing
            </Link>
          </div>
        ) : (
          <>
            <section className="grid gap-3" aria-labelledby="rfq-offer-heading">
              <h3 id="rfq-offer-heading" tabIndex={-1} className="text-sm font-semibold outline-none">Supplier offer</h3>
              {!pricing ? <p className="text-sm">Create draft pricing before using a response.</p> : null}
              {submitted.length > 1 ? (
                <label className="grid gap-1 text-sm" htmlFor="rfq-response">
                  Response version
                  <select
                    id="rfq-response"
                    className={fieldClass}
                    value={responseId}
                    onChange={(event) => {
                      const nextId = event.target.value;
                      setResponseId(nextId);
                      setSelected([]);
                      setAddOnly(false);
                      setManualSell("");
                      resetAcknowledgements();
                      schedulePreview([], false, "", nextId);
                    }}
                  >
                    {submitted.map((item) => (
                      <option key={item.id} value={item.id}>
                        {names.get(item.recipientId) || "Supplier"} · version {item.versionNumber}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              {response ? (
                <article className="grid gap-2 rounded-lg border border-border bg-background p-4" data-rfq-offer>
                  <p className="break-words text-base font-semibold">
                    {supplierName}
                    {" · "}
                    {detail.scopeLabel || "Requested work"}
                    {" · "}
                    Response version {response.versionNumber}
                    {" · "}
                    {response.priceExGst == null ? "No price" : `${money(response.priceExGst)} ex GST`}
                  </p>
                  <dl className="grid gap-2 text-sm sm:grid-cols-2">
                    <div>
                      <dt className="text-foreground/70">GST treatment</dt>
                      <dd>{gstTreatmentLabel(response.gstTreatment)}</dd>
                    </div>
                    <div>
                      <dt className="text-foreground/70">Submitted</dt>
                      <dd>{submittedLabel(response.submittedAt)}</dd>
                    </div>
                  </dl>
                  <div className="grid gap-1 text-sm">
                    <p className="font-medium">Supplier scope</p>
                    <p className="whitespace-pre-wrap">{statedScope || "The supplier did not write what this price includes."}</p>
                    <p className="text-foreground/70">{pricingStructureLabel(response.pricingStructure)}. This becomes one subcontract allowance.</p>
                  </div>
                  {conditions.length > 0 ? (
                    <div className="grid gap-2">
                      <p className="text-sm font-medium" role="status">
                        {conditions.length === 1 ? "1 supplier condition" : `${conditions.length} supplier conditions`} to review. No client-facing decision is stored.
                      </p>
                      <details className="rounded-md border border-border px-3 py-2 text-sm">
                        <summary className="min-h-11 cursor-pointer py-2">Review supplier conditions</summary>
                        <div className="grid gap-3 pb-2">
                          {conditions.map((condition) => (
                            <div key={condition.title} className="grid gap-1">
                              <p className="font-medium">{condition.title}</p>
                              <p className="whitespace-pre-wrap">{condition.body}</p>
                            </div>
                          ))}
                        </div>
                      </details>
                    </div>
                  ) : (
                    <p className="text-sm text-foreground/70">No qualification or exclusion on this version.</p>
                  )}
                </article>
              ) : null}
              {newerThanApplied && response && activeResponse ? (
                <p className="rounded-md border border-border bg-background px-3 py-2 text-sm" role="status">
                  Version {response.versionNumber} is newer than version {activeResponse.versionNumber}, which is already on draft pricing.
                  Using this version replaces that allowance. Nothing is replaced until you confirm below.
                </p>
              ) : null}
              {response && detail.applications.some((application) => application.responseId === response.id) ? (
                <p className="text-sm">This version is already used for draft pricing. Confirming again keeps that choice.</p>
              ) : null}
            </section>

            <section className="grid gap-3" aria-labelledby="rfq-cover-heading">
              <h3 id="rfq-cover-heading" className="text-sm font-semibold">Work this price covers</h3>
              <div className="grid gap-1 rounded-md border border-border bg-background px-3 py-2 text-sm" data-rfq-line-summary>
                <p>
                  {previewing ? (
                    <>{picked.length === 1 ? "1 line selected" : `${picked.length} lines selected`}. Updating the current cost and client sell.</>
                  ) : fresh && picked.length > 0 ? (
                    <>
                      {fresh.affected.length === 1 ? "1 line replaced" : `${fresh.affected.length} lines replaced`}
                      {" · "}
                      current cost {money(fresh.selectedBefore.cost)}
                      {" · "}
                      current client sell {money(fresh.selectedBefore.sell)}
                    </>
                  ) : (
                    <>{picked.length === 1 ? "1 line selected" : `${picked.length} lines selected`}.</>
                  )}
                </p>
                <p>Unselected lines remain charged.</p>
              </div>
              <div className="grid gap-4 text-sm lg:grid-cols-2">
                <div className="grid min-w-0 gap-1">
                  <p className="font-medium">Supplier’s stated scope</p>
                  <p className="whitespace-pre-wrap text-foreground/80">{statedScope || "No supplier scope was written."}</p>
                  <p className="text-foreground/70">Quotr has not checked that this matches the selected lines.</p>
                </div>
                <div className="grid min-w-0 gap-1">
                  <p className="font-medium">Selected work</p>
                  {picked.length === 0 ? (
                    <p className="text-foreground/80">No pricing lines selected.</p>
                  ) : (
                    <ul className="grid gap-1">
                      {picked.map((line) => (
                        <li key={line.id} className="break-words">{line.label}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
              {conditions.length > 0 ? (
                <p className="text-sm">
                  Supplier conditions need a client-facing assumption, a client exclusion, a linked item, or private handling. None of those decisions is stored, so this step does not write client scope wording.
                </p>
              ) : null}
              {selected.length === 0 ? (
                <div className="grid gap-2 rounded-md border border-border bg-background p-3 text-sm">
                  <p>
                    {activeApplication
                      ? "No lines selected. This updates the allowance already used for this work area and keeps the lines it already replaced hidden. It does not add a second allowance. The lines listed below stay charged."
                      : `No lines selected. Every line listed below stays charged. This adds the supplier allowance of ${response?.priceExGst == null ? "the submitted price" : money(response.priceExGst)} ex GST on top of those lines. The same work can be billed twice if this price already covers it.`}
                  </p>
                  {lines.length > 0 ? (
                    <details>
                      <summary className="min-h-11 cursor-pointer py-2">Lines that stay charged</summary>
                      <ul className="grid gap-1 pb-2">
                        {lines.map((line) => (
                          <li key={line.id} className="break-words">{line.label}</li>
                        ))}
                      </ul>
                    </details>
                  ) : null}
                  <label className="flex min-h-11 items-start gap-3">
                    <input
                      type="checkbox"
                      className="mt-0.5 size-5 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-orange)]"
                    checked={addOnly}
                    onChange={(event) => {
                      const next = event.target.checked;
                      setAddOnly(next);
                      setAcknowledgeLoss(false);
                      setConfirmed(false);
                      setDone(false);
                      schedulePreview(selected, next, manualSell, responseId);
                    }}
                    />
                    <span>Add this supplier allowance without replacing any line.</span>
                  </label>
                  {overlapRequired ? (
                    <label className="flex min-h-11 items-start gap-3">
                      <input
                        type="checkbox"
                        className="mt-0.5 size-5 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-orange)]"
                        checked={acknowledgeOverlap}
                        onChange={(event) => setAcknowledgeOverlap(event.target.checked)}
                      />
                      <span>I confirm the existing lines stay charged and this supplier allowance is added as well.</span>
                    </label>
                  ) : null}
                </div>
              ) : null}
              {omitted > 0 ? (
                <p className="text-sm text-foreground/70">
                  {omitted === 1 ? "1 line" : `${omitted} lines`} in this work area {omitted === 1 ? "is" : "are"} hidden, already replaced, or already a supplier allowance, so {omitted === 1 ? "it is" : "they are"} not offered.
                </p>
              ) : null}
              <fieldset className="grid gap-2">
                <legend className="sr-only">Pricing lines this price can replace</legend>
                {lines.length === 0 ? <p className="text-sm">No active pricing lines in this work area.</p> : null}
                {lines.map((line) => {
                  const known = lineKnown(line);
                  const suggested = lineSuggested(line.label, statedScope, detail.scopeLabel || "");
                  return (
                    <label key={line.id} className="flex min-h-11 items-start gap-3 rounded-md border border-border px-3 py-2 text-sm">
                      <input
                        type="checkbox"
                        className="mt-0.5 size-6 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-orange)]"
                        checked={selected.includes(line.id)}
                        onChange={() => toggle(line.id)}
                      />
                      <span className="grid min-w-0 gap-1">
                        <span className="break-words font-medium">{line.label}</span>
                        <span className="text-foreground/70">
                          {quantityLabel(line.quantity, line.unit)}
                          {" · "}
                          Cost {known ? money(line.totalCost) : "Pricing Required"}
                          {" · "}
                          Client sell {known ? money(line.totalSell) : "Pricing Required"}
                        </span>
                        {suggested ? <span>Some words also appear in the supplier scope. Quotr has not checked that this is the same work.</span> : null}
                      </span>
                    </label>
                  );
                })}
              </fieldset>
              {picked.length > 0 ? (
                <details>
                  <summary className="min-h-11 cursor-pointer py-2 text-sm">Show line details</summary>
                  <ul className="grid gap-2 pb-2 text-sm">
                    {picked.map((line) => {
                      const known = lineKnown(line);
                      const suggested = lineSuggested(line.label, statedScope, detail.scopeLabel || "");
                      return (
                        <li key={line.id} className="break-words">
                          {line.label}
                          {" · "}
                          {quantityLabel(line.quantity, line.unit)}
                          {" · "}
                          cost {known ? money(line.totalCost) : "Pricing Required"}
                          {" · "}
                          sell {known ? money(line.totalSell) : "Pricing Required"}
                          {" · "}
                          Pricing line in {detail.scopeLabel || "this work area"}
                          {suggested ? ". Some words also appear in the supplier scope. Quotr has not checked that this is the same work." : "."}
                        </li>
                      );
                    })}
                  </ul>
                </details>
              ) : null}
            </section>

            <section className="grid gap-3" aria-labelledby="rfq-sell-heading" data-rfq-pricing-preview>
              <h3 id="rfq-sell-heading" className="text-sm font-semibold">Client sell</h3>
              {previewing ? <p className="text-sm">Checking these lines…</p> : null}
              {!fresh && !previewing ? <p className="text-sm">Select the lines this price replaces, or confirm that it adds a new allowance.</p> : null}
              {fresh || previewing ? (
                <fieldset className="grid gap-3">
                  <legend className="text-sm">Choose one. Nothing is selected for you.</legend>
                  {(["keep", "target_margin", "manual"] as const).map((choiceTreatment) => {
                    const choice = fresh?.choices.find((item) => item.treatment === choiceTreatment) ?? null;
                    const chosen = treatment === choiceTreatment;
                    return (
                      <label key={choiceTreatment} className={choiceClass(chosen)} data-rfq-sell-choice={choiceTreatment}>
                        <span className="flex min-h-11 items-start gap-3 font-medium">
                          <input
                            type="radio"
                            name="rfq-sell-treatment"
                            className="mt-0.5 size-5 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-orange)]"
                            disabled={!choice || (choiceTreatment !== "manual" && !choice.available)}
                            checked={chosen}
                            onChange={() => {
                              setTreatment(choiceTreatment);
                              setAcknowledgeLoss(false);
                              setConfirmed(false);
                            }}
                          />
                          <span>{choiceTitle(choiceTreatment)}</span>
                        </span>
                        {choiceTreatment === "manual" && chosen ? (
                          <span className="grid gap-1 pl-8 text-sm font-normal">
                            Client sell ex GST
                            <input
                              className={fieldClass}
                              inputMode="decimal"
                              aria-label="Client sell ex GST"
                              value={manualSell}
                              onChange={(event) => {
                                const next = event.target.value;
                                setManualSell(next);
                                setTreatment("manual");
                                setAcknowledgeLoss(false);
                                setConfirmed(false);
                                schedulePreview(selected, addOnly, next, responseId);
                              }}
                            />
                          </span>
                        ) : null}
                        {previewing ? (
                          <span className="pl-8 text-sm font-normal">Updating this preview…</span>
                        ) : choice?.available ? (
                          <span className="grid gap-1 pl-8 text-sm font-normal">
                            <span>Client sell {choice.sellKnown ? money(choice.sell) : "Pricing Required"}</span>
                            <span>Gross profit {money(choice.grossProfit)}</span>
                            <span>Margin {percent(choice.marginPercent)}</span>
                            {choice.loss ? <span className="font-medium text-destructive">Loss. The supplier cost is higher than the client sell.</span> : null}
                          </span>
                        ) : (
                          <span className="pl-8 text-sm font-normal">{choice?.unavailableReason ?? "Checking this choice."}</span>
                        )}
                      </label>
                    );
                  })}
                </fieldset>
              ) : null}
            </section>

            <section className="grid gap-4" aria-labelledby="rfq-review-heading">
              <h3 id="rfq-review-heading" className="text-sm font-semibold">Review and confirm</h3>
              {previewing ? <p className="text-sm">Updating the before and after.</p> : null}
              {!previewing && fresh && selectedChoice?.available ? (
                <>
                  <dl className="grid gap-2 text-sm" data-rfq-confirm-primary>
                    <div className="flex flex-wrap justify-between gap-2">
                      <dt>Supplier cost for selected work</dt>
                      <dd className="tabular-nums">{money(selectedChoice.cost)}</dd>
                    </div>
                    <div className="flex flex-wrap justify-between gap-2">
                      <dt>Approved client sell for that work</dt>
                      <dd className="tabular-nums">{selectedChoice.sellKnown ? money(selectedChoice.sell) : "Pricing Required"}</dd>
                    </div>
                    <div className="flex flex-wrap justify-between gap-2">
                      <dt>Gross profit and margin</dt>
                      <dd className="tabular-nums">{money(selectedChoice.grossProfit)} · {percent(selectedChoice.marginPercent)}</dd>
                    </div>
                    <div className="flex flex-wrap justify-between gap-2">
                      <dt>Whole-job client sell</dt>
                      <dd className="tabular-nums">{money(fresh.before.sell)} → {money(selectedChoice.after.sell)}</dd>
                    </div>
                    <div className="flex flex-wrap justify-between gap-2">
                      <dt>Whole-job total incl GST</dt>
                      <dd className="tabular-nums">{money(fresh.before.totalInclGst)} → {money(selectedChoice.after.totalInclGst)}</dd>
                    </div>
                    <div className="flex flex-wrap justify-between gap-2">
                      <dt>Lines</dt>
                      <dd>{fresh.affected.length === 1 ? "1 replaced" : `${fresh.affected.length} replaced`} · {remaining === 1 ? "1 remaining" : `${remaining} remaining`}</dd>
                    </div>
                  </dl>
                  <details className="rounded-md border border-border px-3 py-2 text-sm">
                    <summary className="min-h-11 cursor-pointer py-2">Full money breakdown</summary>
                    <div className="grid gap-4 pb-2">
                      <div className="grid gap-2">
                        <p className="font-medium">Selected work before and after</p>
                        <p className="text-foreground/70">GST in this block is on the selected-work subtotal. It is not calculated on each line, and it is not the document GST.</p>
                        {fresh.affected.length === 0 ? <p>No existing lines are included. The new allowance is the selected work.</p> : null}
                        <MoneyRows
                          before={fresh.selectedBefore}
                          after={selectedChoice.selectedAfter}
                          gstLabel="GST on the selected-work subtotal"
                          totalLabel="Selected-work total incl GST"
                        />
                      </div>
                      <div className="grid gap-2">
                        <p className="font-medium">Whole pricing document before and after</p>
                        <p className="text-foreground/70">Document GST is calculated on the document sell. It is not mixed with the selected-work GST above.</p>
                        <MoneyRows
                          before={fresh.before}
                          after={selectedChoice.after}
                          gstLabel="Document GST"
                          totalLabel="Document total incl GST"
                        />
                      </div>
                    </div>
                  </details>
                  {fresh.quoteExists ? (
                    <p className="text-sm">
                      An issued quote on this job stays unchanged. A revised client price needs the normal new quote or revision path.
                    </p>
                  ) : null}
                  <p className="text-sm" data-rfq-confirm-summary>{confirmSummary}</p>
                </>
              ) : !previewing ? (
                <p className="text-sm">Choose a client sell to see the before and after.</p>
              ) : null}
              {selectedChoice?.loss ? (
                <label className="flex min-h-11 items-start gap-3 text-sm">
                  <input
                    type="checkbox"
                    className="mt-0.5 size-5 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-orange)]"
                    checked={acknowledgeLoss}
                    onChange={(event) => setAcknowledgeLoss(event.target.checked)}
                  />
                  <span>Confirm that this cost is higher than the sell before using it.</span>
                </label>
              ) : null}
              <label className="flex min-h-11 items-start gap-3 text-sm">
                <input
                  type="checkbox"
                  className="mt-0.5 size-5 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-orange)]"
                  checked={confirmed}
                  onChange={(event) => setConfirmed(event.target.checked)}
                />
                <span>Use this response for draft pricing. This does not award the work or notify the supplier.</span>
              </label>
              {error ? (
                <p ref={errorRef} tabIndex={-1} className="text-sm text-red-700 outline-none" role="alert">
                  {error}
                </p>
              ) : null}
              <div className="scroll-mb-28">
                <Button
                  type="button"
                  className="h-11 min-h-11 w-full sm:w-fit"
                  disabled={!canApply}
                  onClick={apply}
                >
                  {saving ? "Saving draft pricing…" : "Use for draft Pricing"}
                </Button>
              </div>
            </section>
          </>
        )}
      </section>
    </RfqApplyColumn>
  );
}
