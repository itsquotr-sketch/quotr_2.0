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
import { formatPricingBadgeLabel } from "@/lib/pricing/status";
import type { PricingDocumentStatus } from "@/lib/pricing/types";
import { formatQuoteBadgeLabel } from "@/lib/quotes/status";
import { scrollWorkspaceTarget } from "@/lib/rfqs/scroll-workspace";
import type { QuoteStatus } from "@/lib/quotes/types";

const fieldClass =
  "min-h-11 w-full rounded-md border border-border bg-background px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-orange)]";

const choiceClass = (selected: boolean) =>
  selected
    ? "grid gap-2 rounded-lg border border-[var(--brand-orange)] bg-[var(--brand-orange)]/5 p-3 ring-1 ring-[var(--brand-orange)]"
    : "grid gap-2 rounded-lg border border-border p-3";

const focusClass = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-orange)]";

const ISSUED_QUOTE = new Set<QuoteStatus>(["sent", "viewed", "accepted", "declined", "expired"]);

export type RfqReviewRequest = { id: string; nonce: number; focus?: "decision" | "compare" };

type QuoteLock = { id: string; status: QuoteStatus };

type SavedDecision = {
  responseId: string;
  versionNumber: number;
  supplier: string;
  costExGst: number;
  sellExGst: number | null;
  sellKnown: boolean;
  replacedCount: number;
};

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

function supplierConditions(response: RfqResponseView): Array<{ title: string; body: string }> {
  const items: Array<{ title: string; body: string }> = [];
  if (response.excludedScope.trim()) items.push({ title: "Exclusion", body: response.excludedScope.trim() });
  if (response.assumptions.trim()) items.push({ title: "Qualification or assumption", body: response.assumptions.trim() });
  if (response.qualified && items.length === 0) {
    items.push({ title: "Qualified response", body: "The supplier marked this response as qualified and did not write the condition." });
  }
  return items;
}

function choiceReason(treatment: RfqSellTreatment, reason: string | null): string {
  if (treatment === "keep" && reason === "That sell cannot be stored on a pricing line.") {
    return "Keep is unavailable because the stored margin limit would be exceeded.";
  }
  return reason ?? "Checking this choice.";
}

function pricingStatusLabel(status: string): string {
  if (status === "draft" || status === "reviewed" || status === "converted_to_quote" || status === "archived") {
    return formatPricingBadgeLabel(status as PricingDocumentStatus);
  }
  return "Pricing";
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
  quote?: QuoteLock | null;
  reviewRequest?: RfqReviewRequest | null;
  onResponseId?: (id: string | null) => void;
}) {
  if (props.detail.pricingRequest === "schedule") {
    return (
      <RfqApplyColumn>
        <RfqSchedulePricing
          detail={props.detail}
          pricing={props.pricing}
          canPrice={props.canPrice}
          reviewRequest={props.reviewRequest}
          onResponseId={props.onResponseId ?? undefined}
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
  quote = null,
  reviewRequest,
  onResponseId,
}: {
  detail: RfqDetail;
  pricing: RfqPricingTarget | null;
  canPrice: boolean;
  quote?: QuoteLock | null;
  reviewRequest?: RfqReviewRequest | null;
  onResponseId?: (id: string | null) => void;
}) {
  const router = useRouter();
  const submitted = detail.responses.filter((response) => response.status === "submitted");
  const activeApplication = detail.applications.find((application) => !detail.workAreaId || application.workAreaId === detail.workAreaId) ?? null;
  const activeResponse = submitted.find((item) => item.id === activeApplication?.responseId) ?? null;
  const [responseId, setResponseId] = useState("");
  const [editing, setEditing] = useState(false);
  const [coverMode, setCoverMode] = useState<"" | "replace" | "add">("");
  const [changeIntent, setChangeIntent] = useState<"" | "update" | "add">("");
  const [selected, setSelected] = useState<string[]>([]);
  const [acknowledgeOverlap, setAcknowledgeOverlap] = useState(false);
  const [preview, setPreview] = useState<RfqPricingPreviewResult | null>(null);
  const [treatment, setTreatment] = useState<RfqSellTreatment | "">("");
  const [manualSell, setManualSell] = useState("");
  const [acknowledgeLoss, setAcknowledgeLoss] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [settled, setSettled] = useState<SavedDecision | null>(null);
  const [focusNonce, setFocusNonce] = useState(0);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const flight = useRef(false);
  const request = useRef(0);
  const previewTimer = useRef<number | null>(null);
  const consumedReview = useRef<number | null>(null);
  const response = submitted.find((item) => item.id === responseId) ?? null;
  const names = new Map(detail.recipients.map((recipient) => [recipient.id, recipient.tradingName]));
  const areaItems = (pricing?.items ?? []).filter((item) => !detail.workAreaId || item.workAreaId === detail.workAreaId);
  const allowanceIds = new Set(detail.applications.map((application) => application.allowanceItemId));
  const hiddenLines = areaItems.filter((item) => !allowanceIds.has(item.id) && !(item.recalibrationNote ?? "").startsWith("Replaced for draft pricing") && item.visibleOnQuote === false);
  const replacedLines = areaItems.filter((item) => (item.recalibrationNote ?? "").startsWith("Replaced for draft pricing") || (activeApplication?.replacedItemIds ?? []).includes(item.id));
  const allowanceLines = areaItems.filter((item) => allowanceIds.has(item.id));
  const lines = areaItems.filter((item) => !allowanceIds.has(item.id) && item.visibleOnQuote !== false && !(item.recalibrationNote ?? "").startsWith("Replaced for draft pricing"));
  const unavailableCount = hiddenLines.length + replacedLines.filter((item) => !lines.includes(item)).length + allowanceLines.length;
  const workAreaId = detail.workAreaId || lines.find((line) => selected.includes(line.id))?.workAreaId || "";
  const newer = activeResponse
    ? submitted
        .filter((item) => item.recipientId === activeResponse.recipientId && item.versionNumber > activeResponse.versionNumber)
        .sort((a, b) => b.versionNumber - a.versionNumber)[0] ?? null
    : null;
  const issuedQuote = quote && ISSUED_QUOTE.has(quote.status) ? quote : null;
  const pricingClosed = !pricing || !["draft", "reviewed", "converted_to_quote"].includes(pricing.documentStatus);
  const quoteLocked = Boolean(pricing && (pricing.documentStatus === "converted_to_quote" || issuedQuote));
  const locked = Boolean(pricing && (pricingClosed || quoteLocked));
  const sameApplied = Boolean(response && activeResponse && response.id === activeResponse.id);
  const updatingExisting = Boolean(activeApplication && response && response.id !== activeApplication.responseId);
  const showForm = Boolean(response && pricing) && !locked && (saving || editing || !sameApplied) && !(settled && response?.id === settled.responseId && !editing);
  const showSummary = Boolean((activeApplication && activeResponse) || settled) && !showForm;
  const conditions = response ? supplierConditions(response) : [];
  const fresh = previewing ? null : preview;
  const selectedChoice = fresh?.choices.find((choice) => choice.treatment === treatment) ?? null;
  const overlapRequired = coverMode === "add" && !activeApplication && lines.length > 0;
  const replacedIds = updatingExisting
    ? activeApplication?.replacedItemIds ?? []
    : coverMode === "add"
      ? []
      : selected;
  const canApply = Boolean(
    !sameApplied &&
    !locked &&
    selectedChoice?.available &&
    confirmed &&
    !saving &&
    !previewing &&
    (updatingExisting || (coverMode === "replace" && selected.length > 0) || coverMode === "add") &&
    (!overlapRequired || acknowledgeOverlap) &&
    (!selectedChoice.loss || acknowledgeLoss)
  );
  const supplierName = response ? names.get(response.recipientId) || "Supplier" : "Supplier";
  const decisionState = saving
    ? "saving"
    : locked
      ? "locked"
      : showForm
        ? "selected"
        : newer
          ? "newer"
          : showSummary
            ? "applied"
            : "none";

  function resetAcknowledgements() {
    setAcknowledgeLoss(false);
    setAcknowledgeOverlap(false);
    setConfirmed(false);
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
    if (!error) return;
    errorRef.current?.focus();
  }, [error]);

  useEffect(() => {
    onResponseId?.(responseId || null);
  }, [responseId, onResponseId]);

  useEffect(() => {
    if (focusNonce === 0) return;
    const node = document.getElementById("rfq-pricing-decision");
    if (node instanceof HTMLElement) scrollWorkspaceTarget(node, { focus: true });
  }, [focusNonce]);

  useEffect(() => {
    if (!reviewRequest || consumedReview.current === reviewRequest.nonce) return;
    consumedReview.current = reviewRequest.nonce;
    const nextId = reviewRequest.id;
    if (!submitted.some((item) => item.id === nextId)) return;
    if (nextId !== responseId) {
      const nextActive = detail.applications.find((application) => !detail.workAreaId || application.workAreaId === detail.workAreaId) ?? null;
      queueMicrotask(() => {
        setResponseId(nextId);
        setEditing(false);
        setCoverMode("");
        setChangeIntent("");
        setSelected([]);
        setTreatment("");
        setManualSell("");
        setNotice(null);
        setSettled(null);
        resetAcknowledgements();
        if (nextActive && nextId !== nextActive.responseId) {
          schedulePreview(nextActive.replacedItemIds, nextActive.replacedItemIds.length === 0, "", nextId);
        } else {
          schedulePreview([], false, "", "");
        }
        if (reviewRequest.focus !== "compare") setFocusNonce((current) => current + 1);
      });
      return;
    }
    if (reviewRequest.focus === "compare") return;
    queueMicrotask(() => setFocusNonce((current) => current + 1));
    // The review nonce is the only trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reviewRequest]);

  if (!canPrice || detail.status !== "sent" || submitted.length === 0) return null;

  function toggle(id: string) {
    const next = selected.includes(id) ? selected.filter((item) => item !== id) : [...selected, id];
    setSelected(next);
    setCoverMode("replace");
    resetAcknowledgements();
    schedulePreview(next, false, manualSell, responseId);
  }

  function openEdit() {
    if (!activeResponse) return;
    setResponseId(activeResponse.id);
    setEditing(true);
    setCoverMode("");
    setChangeIntent("");
    setSelected([]);
    setTreatment("");
    setManualSell("");
    setNotice(null);
    setSettled(null);
    resetAcknowledgements();
    schedulePreview([], false, "", "");
    setFocusNonce((current) => current + 1);
  }

  async function confirmSameVersion() {
    if (!response || !pricing || !activeApplication || flight.current) return;
    const treatment = activeApplication.sellTreatment;
    if (!treatment) {
      setError("Choose how the sell should be set before using this response.");
      return;
    }
    flight.current = true;
    setSaving(true);
    setError(null);
    setNotice(null);
    const result = await applyRfqPricingApplication({
      responseId: response.id,
      pricingDocumentId: pricing.documentId,
      workAreaId: activeApplication.workAreaId || detail.workAreaId || "",
      replacedItemIds: activeApplication.replacedItemIds,
      sellTreatment: treatment,
      manualSell: treatment === "manual" ? activeApplication.sellExGst : null,
      acknowledgeLoss: true,
    });
    flight.current = false;
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setNotice(result.alreadyApplied
      ? "This application is unchanged. No second charge was added."
      : "This application was updated. One allowance remains.");
    setEditing(false);
    setChangeIntent("");
    setConfirmed(false);
  }

  async function apply() {
    if (!response || !pricing || !fresh || !treatment || !canApply || flight.current) return;
    flight.current = true;
    setSaving(true);
    setError(null);
    setNotice(null);
    const parsedSell = manualSell.trim() === "" ? null : Number(manualSell);
    const result = await applyRfqPricingApplication({
      responseId: response.id,
      pricingDocumentId: pricing.documentId,
      workAreaId,
      replacedItemIds: replacedIds,
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
    if (result.alreadyApplied) {
      setNotice("This application is unchanged. No second charge was added.");
      setEditing(false);
      setConfirmed(false);
      return;
    }
    setSettled({
      responseId: response.id,
      versionNumber: response.versionNumber,
      supplier: supplierName,
      costExGst: response.priceExGst ?? selectedChoice?.cost ?? 0,
      sellExGst: selectedChoice?.sell ?? null,
      sellKnown: Boolean(selectedChoice?.sellKnown),
      replacedCount: replacedIds.length,
    });
    setEditing(false);
    setConfirmed(false);
    setNotice("Saved to draft Pricing.");
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

  function openReviewedVersion(id: string) {
    setEditing(false);
    setResponseId(id);
    setChangeIntent("");
    setCoverMode("");
    setSelected([]);
    setTreatment("");
    setManualSell("");
    setNotice(null);
    setSettled(null);
    resetAcknowledgements();
    if (activeApplication && id !== activeApplication.responseId) {
      schedulePreview(activeApplication.replacedItemIds, activeApplication.replacedItemIds.length === 0, "", id);
    }
    setFocusNonce((current) => current + 1);
  }

  const summaryResponse = settled && activeApplication?.responseId !== settled.responseId
    ? null
    : activeResponse;
  const summaryApplication = summaryResponse ? activeApplication : null;
  const summarySupplier = summaryApplication
    ? names.get(summaryApplication.recipientId) || settled?.supplier || "Supplier"
    : settled?.supplier || "Supplier";
  const summaryVersion = summaryResponse?.versionNumber ?? settled?.versionNumber ?? null;
  const summaryCost = summaryApplication?.costExGst ?? settled?.costExGst ?? null;
  const summarySellKnown = summaryApplication ? summaryApplication.sellKnown : Boolean(settled?.sellKnown);
  const summarySell = summaryApplication ? summaryApplication.sellExGst : settled?.sellExGst ?? null;
  const summaryReplaced = summaryApplication ? summaryApplication.replacedItemIds.length : settled?.replacedCount ?? 0;
  const replacedLabels = (summaryApplication?.replacedItemIds ?? [])
    .map((id) => pricing?.items.find((item) => item.id === id)?.label)
    .filter((label): label is string => Boolean(label));

  return (
    <RfqApplyColumn>
      <section
        id="rfq-pricing-apply"
        className="grid scroll-mt-6 gap-4 rounded-xl border border-border bg-card p-4 sm:p-6"
        data-rfq-pricing-apply
        data-rfq-decision-state={decisionState}
        aria-busy={saving}
      >
        <h2 id="rfq-pricing-decision" tabIndex={-1} className={`text-base font-semibold outline-none focus:ring-2 focus:ring-[var(--brand-orange)] ${focusClass}`}>
          Pricing decision
        </h2>
        {notice ? <p className="text-sm" role="status">{notice}</p> : null}
        {error ? (
          <p ref={errorRef} tabIndex={-1} className="text-sm text-red-700 outline-none" role="alert">{error}</p>
        ) : null}
        {locked ? <LockNotice detail={detail} pricing={pricing} quote={issuedQuote} documentConverted={pricing?.documentStatus === "converted_to_quote"} /> : null}
        {!pricing && !locked ? <p className="text-sm">Create draft Pricing before using a response.</p> : null}

        {showSummary && summaryVersion != null && summaryCost != null ? (
          <AppliedSummary
            supplier={summarySupplier}
            versionNumber={summaryVersion}
            costExGst={summaryCost}
            sellKnown={summarySellKnown}
            sellExGst={summarySell}
            replacedCount={summaryReplaced}
            replacedLabels={replacedLabels}
            pricingHref={pricing ? `/app/projects/${detail.projectId}/pricing/${pricing.documentId}` : null}
            pricingLabel={pricing ? pricingStatusLabel(pricing.documentStatus) : "Pricing"}
            newer={newer}
            emphasizePricing={!locked}
            onReviewNewer={newer ? () => openReviewedVersion(newer.id) : undefined}
            onChange={locked ? undefined : openEdit}
          />
        ) : null}

        {!response && !showSummary && !locked ? (
          <p className="text-sm">Choose a response above. Nothing is applied until you confirm a pricing decision.</p>
        ) : null}

        {response && locked ? (
          <p className="text-sm">Version {response.versionNumber} is selected for pricing review. There is no save on this page while Pricing or the Quote is locked.</p>
        ) : null}

        {showForm && response ? (
          <form className="grid gap-6" onSubmit={(event) => { event.preventDefault(); void apply(); }}>
            <fieldset disabled={saving} className="m-0 grid min-w-0 gap-6 border-0 p-0">
            <section className="grid gap-3" aria-labelledby="rfq-offer-heading">
              <h3 id="rfq-offer-heading" className="text-sm font-semibold">Supplier offer</h3>
              {updatingExisting && activeResponse && activeApplication ? (
                <p className="rounded-md border border-border bg-background px-3 py-2 text-sm" role="status">
                  Draft Pricing still uses version {activeResponse.versionNumber}: supplier cost {money(activeApplication.costExGst)} ex GST
                  {activeApplication.sellKnown ? `, client sell ${money(activeApplication.sellExGst)} ex GST` : ", client sell Pricing Required"}.
                  {" "}Newer price available. Nothing changes until you confirm an update. This does not add another charge.
                </p>
              ) : null}
              <article className="grid gap-2 rounded-lg border border-border bg-background p-4" data-rfq-offer>
                <p className="break-words font-semibold">
                  {supplierName}
                  {" · "}
                  Version {response.versionNumber}
                  {" · "}
                  {response.priceExGst == null ? "No price" : `${money(response.priceExGst)} ex GST`}
                </p>
                <p className="text-sm text-foreground/70">
                  {gstTreatmentLabel(response.gstTreatment)}
                  {" · "}
                  Submitted {submittedLabel(response.submittedAt)}
                  {" · "}
                  {pricingStructureLabel(response.pricingStructure)}
                </p>
                <div className="grid gap-1 text-sm">
                  <p className="font-medium">Supplier scope</p>
                  <p className="whitespace-pre-wrap">{response.includedScope.trim() || "The supplier did not write what this price includes."}</p>
                </div>
                {conditions.length > 0 ? (
                  <details className="rounded-md border border-border px-3 py-2 text-sm">
                    <summary className={`min-h-11 cursor-pointer py-2 ${focusClass}`}>
                      {conditions.length === 1 ? "1 qualification or exclusion" : `${conditions.length} qualifications or exclusions`}
                    </summary>
                    <div className="grid gap-3 pb-2">
                      {conditions.map((condition) => (
                        <div key={condition.title} className="grid gap-1">
                          <p className="font-medium">{condition.title}</p>
                          <p className="whitespace-pre-wrap">{condition.body}</p>
                        </div>
                      ))}
                      <p>These conditions stay on the supplier response. This step does not copy them onto the client Quote.</p>
                    </div>
                  </details>
                ) : <p className="text-sm text-foreground/70">No qualifications or exclusions on this version.</p>}
              </article>
            </section>

            {sameApplied ? (
              <SameVersionChange
                intent={changeIntent}
                onIntent={setChangeIntent}
                newer={newer}
                allowanceLabel={pricing?.items.find((item) => item.id === activeApplication?.allowanceItemId)?.label || "the supplier allowance"}
                replacedLabels={replacedLabels}
                saving={saving}
                onSave={() => void confirmSameVersion()}
                onReviewNewer={newer ? () => openReviewedVersion(newer.id) : undefined}
              />
            ) : (
              <>
                <section className="grid gap-3" aria-labelledby="rfq-cover-heading">
                  <h3 id="rfq-cover-heading" className="text-sm font-semibold">Work this price covers</h3>
                  {updatingExisting ? (
                    <div className="grid gap-2 text-sm">
                      <p>Update this application. The allowance already on draft Pricing changes. A second charge is not added.</p>
                      <p>
                        {summaryReplaced === 0
                          ? "No Pricing lines were replaced. The allowance stays as an extra charge."
                          : `${summaryReplaced === 1 ? "1 Pricing line stays replaced" : `${summaryReplaced} Pricing lines stay replaced`}${replacedLabels.length > 0 ? `: ${replacedLabels.join(", ")}` : ""}.`}
                      </p>
                      <p>Add another charge is not available while this work area already has a subcontract allowance.</p>
                    </div>
                  ) : lines.length === 0 ? (
                    <div className="grid gap-2 text-sm">
                      <p>
                        No Pricing lines in this work area can be replaced.
                        {" "}
                        {unavailableReason(hiddenLines.length, replacedLines.length, allowanceLines.length)}
                      </p>
                      <label className={choiceClass(coverMode === "add")}>
                        <span className="flex min-h-11 items-start gap-3 font-medium">
                          <input
                            type="radio"
                            name="rfq-cover"
                            className="mt-0.5 size-5 shrink-0"
                            checked={coverMode === "add"}
                            onChange={() => {
                              setCoverMode("add");
                              setSelected([]);
                              resetAcknowledgements();
                              schedulePreview([], true, manualSell, responseId);
                            }}
                          />
                          <span>Add a separate allowance</span>
                        </span>
                      </label>
                    </div>
                  ) : (
                    <fieldset className="grid gap-3">
                      <legend className="text-sm">Choose one. Nothing is selected for you.</legend>
                      <label className={choiceClass(coverMode === "replace")}>
                        <span className="flex min-h-11 items-start gap-3 font-medium">
                          <input
                            type="radio"
                            name="rfq-cover"
                            className="mt-0.5 size-5 shrink-0"
                            checked={coverMode === "replace"}
                            onChange={() => {
                              setCoverMode("replace");
                              resetAcknowledgements();
                              schedulePreview(selected, false, manualSell, responseId);
                            }}
                          />
                          <span>Replace selected Pricing lines</span>
                        </span>
                        {coverMode === "replace" ? <span className="pl-8 text-sm font-normal">Unselected lines remain charged.</span> : null}
                      </label>
                      <label className={choiceClass(coverMode === "add")}>
                        <span className="flex min-h-11 items-start gap-3 font-medium">
                          <input
                            type="radio"
                            name="rfq-cover"
                            className="mt-0.5 size-5 shrink-0"
                            checked={coverMode === "add"}
                            onChange={() => {
                              setCoverMode("add");
                              setSelected([]);
                              resetAcknowledgements();
                              schedulePreview([], true, manualSell, responseId);
                            }}
                          />
                          <span>Add a separate allowance</span>
                        </span>
                      </label>
                    </fieldset>
                  )}

                  {coverMode === "replace" && !updatingExisting ? (
                    <div className="grid gap-2">
                      <p className="text-sm">Quotr has not checked that the supplier scope matches these lines.</p>
                      {lines.map((line) => {
                        const known = lineKnown(line);
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
                            </span>
                          </label>
                        );
                      })}
                      {selected.length === 0 ? <p className="text-sm">Choose the Pricing lines this price replaces.</p> : <p className="text-sm">Unselected lines remain charged.</p>}
                    </div>
                  ) : null}

                  {coverMode === "add" && overlapRequired ? (
                    <label className="flex min-h-11 items-start gap-3 text-sm">
                      <input
                        type="checkbox"
                        className="mt-0.5 size-5 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-orange)]"
                        checked={acknowledgeOverlap}
                        onChange={(event) => {
                          setAcknowledgeOverlap(event.target.checked);
                          setConfirmed(false);
                        }}
                      />
                      <span>I confirm the existing lines stay charged and this supplier allowance is added as well.</span>
                    </label>
                  ) : null}

                  {unavailableCount > 0 ? (
                    <details className="text-sm">
                      <summary className={`min-h-11 cursor-pointer py-2 ${focusClass}`}>Why some lines are unavailable</summary>
                      <div className="grid gap-2 pb-2">
                        {hiddenLines.length > 0 ? <p>{hiddenLines.length === 1 ? "1 line is hidden from the Quote." : `${hiddenLines.length} lines are hidden from the Quote.`} {hiddenLines.map((line) => line.label).join(", ")}</p> : null}
                        {replacedLines.length > 0 ? <p>{replacedLines.length === 1 ? "1 line is already replaced." : `${replacedLines.length} lines are already replaced.`} {replacedLines.map((line) => line.label).join(", ")}</p> : null}
                        {allowanceLines.length > 0 ? <p>{allowanceLines.length === 1 ? "1 line is already a supplier allowance." : `${allowanceLines.length} lines are already supplier allowances.`} {allowanceLines.map((line) => line.label).join(", ")}</p> : null}
                      </div>
                    </details>
                  ) : null}
                </section>

                <SellAndReview
                  fresh={fresh}
                  previewing={previewing}
                  treatment={treatment}
                  manualSell={manualSell}
                  selectedChoice={selectedChoice}
                  ready={updatingExisting || (coverMode === "replace" && selected.length > 0) || (coverMode === "add" && (!overlapRequired || acknowledgeOverlap))}
                  waiting={lines.length === 0 && coverMode === "" ? "Add a separate allowance if this price should still go on draft Pricing." : coverMode === "" ? "Choose whether to replace Pricing lines or add a separate allowance." : coverMode === "replace" && selected.length === 0 ? "Choose the Pricing lines this price replaces." : coverMode === "add" && overlapRequired && !acknowledgeOverlap ? "Confirm that the existing lines stay charged before choosing a client sell." : "Choose a client sell to see the before and after."}
                  remaining={Math.max(lines.length - selected.length, 0)}
                  replacedCount={updatingExisting ? (activeApplication?.replacedItemIds.length ?? 0) : selected.length}
                  choiceTitle={choiceTitle}
                  onTreatment={(next) => {
                    setTreatment(next);
                    setAcknowledgeLoss(false);
                    setConfirmed(false);
                  }}
                  onManual={(next) => {
                    setManualSell(next);
                    setTreatment("manual");
                    setAcknowledgeLoss(false);
                    setConfirmed(false);
                    schedulePreview(replacedIds, coverMode === "add" || replacedIds.length === 0, next, responseId);
                  }}
                  confirmed={confirmed}
                  onConfirmed={setConfirmed}
                  acknowledgeLoss={acknowledgeLoss}
                  onAcknowledgeLoss={setAcknowledgeLoss}
                  saving={saving}
                  canApply={canApply}
                  onApply={() => void apply()}
                  reviewed={pricing?.documentStatus === "reviewed"}
                  actionLabel={updatingExisting ? "Update this application" : "Use for draft Pricing"}
                  supplierName={supplierName}
                  versionNumber={response.versionNumber}
                  added={!updatingExisting && coverMode === "add"}
                  updating={updatingExisting}
                />
              </>
            )}
            </fieldset>
          </form>
        ) : null}
      </section>
    </RfqApplyColumn>
  );
}

function unavailableReason(hidden: number, replaced: number, allowance: number): string {
  const parts: string[] = [];
  if (hidden > 0) parts.push(hidden === 1 ? "1 line is hidden" : `${hidden} lines are hidden`);
  if (replaced > 0) parts.push(replaced === 1 ? "1 line is already replaced" : `${replaced} lines are already replaced`);
  if (allowance > 0) parts.push(allowance === 1 ? "1 line is already a supplier allowance" : `${allowance} lines are already supplier allowances`);
  if (parts.length === 0) return "This work area has no pricing lines.";
  return `${parts.join(", ")}.`;
}

function LockNotice({
  detail,
  pricing,
  quote,
  documentConverted,
}: {
  detail: RfqDetail;
  pricing: RfqPricingTarget | null;
  quote: QuoteLock | null;
  documentConverted: boolean;
}) {
  const href = quote
    ? `/app/projects/${detail.projectId}/quotes/${quote.id}`
    : pricing
      ? `/app/projects/${detail.projectId}/pricing/${pricing.documentId}`
      : null;
  const message = !pricing || !["draft", "reviewed", "converted_to_quote"].includes(pricing.documentStatus)
    ? "This Pricing can no longer be changed."
    : quote
      ? `${formatQuoteBadgeLabel(quote.status)}. This Quote stays as issued. Create a revision on the Quote to change the client price.`
      : documentConverted
        ? "This Pricing has been converted to a Quote. Create a revision on the Quote to change the client price."
        : "This Pricing can no longer be changed.";
  return (
    <div className="grid gap-3 rounded-lg border border-border bg-background p-4 text-sm" data-rfq-pricing-lock>
      <p>{message}</p>
      {href ? (
        <Link href={href} className={`inline-flex min-h-11 w-fit items-center rounded-md bg-[var(--brand-orange)] px-4 text-sm font-medium text-white ${focusClass}`}>
          {quote ? "Open Quote" : "Open Pricing"}
        </Link>
      ) : null}
    </div>
  );
}

function AppliedSummary({
  supplier,
  versionNumber,
  costExGst,
  sellKnown,
  sellExGst,
  replacedCount,
  replacedLabels,
  pricingHref,
  pricingLabel,
  newer,
  emphasizePricing = true,
  onReviewNewer,
  onChange,
}: {
  supplier: string;
  versionNumber: number;
  costExGst: number;
  sellKnown: boolean;
  sellExGst: number | null;
  replacedCount: number;
  replacedLabels: string[];
  pricingHref: string | null;
  pricingLabel: string;
  newer: RfqResponseView | null;
  emphasizePricing?: boolean;
  onReviewNewer?: () => void;
  onChange?: () => void;
}) {
  return (
    <div className="grid gap-3 rounded-lg border border-border bg-background p-4" data-rfq-pricing-applied>
      <p className="font-medium">Applied to draft Pricing</p>
      <dl className="grid gap-2 text-sm">
        <div className="flex flex-wrap justify-between gap-2"><dt>Response</dt><dd>{supplier} · version {versionNumber}</dd></div>
        <div className="flex flex-wrap justify-between gap-2"><dt>Supplier cost</dt><dd className="tabular-nums">{money(costExGst)} ex GST</dd></div>
        <div className="flex flex-wrap justify-between gap-2"><dt>Approved client sell</dt><dd className="tabular-nums">{sellKnown ? `${money(sellExGst)} ex GST` : "Pricing Required"}</dd></div>
        <div className="flex flex-wrap justify-between gap-2">
          <dt>What changed</dt>
          <dd className="text-right">
            {replacedCount === 0
              ? "Added an allowance. No Pricing lines were replaced."
              : replacedCount === 1
                ? `Replaced 1 Pricing line${replacedLabels[0] ? `: ${replacedLabels[0]}` : ""}.`
                : `Replaced ${replacedCount} Pricing lines${replacedLabels.length > 0 ? `: ${replacedLabels.join(", ")}` : ""}.`}
          </dd>
        </div>
        <div className="flex flex-wrap justify-between gap-2"><dt>Pricing</dt><dd>{pricingLabel}</dd></div>
      </dl>
      {newer ? (
        <div className="grid gap-2 rounded-md border border-border p-3 text-sm" data-rfq-newer-price>
          <p className="font-medium">Newer price available</p>
          <p>Version {newer.versionNumber} is not on Pricing. The applied version and its money stay as they are.</p>
          {onReviewNewer ? (
            <button type="button" className={`inline-flex min-h-11 w-fit items-center rounded-md border border-border bg-background px-3 font-medium ${focusClass}`} onClick={onReviewNewer}>
              Review version {newer.versionNumber}
            </button>
          ) : null}
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {pricingHref ? (
          <Link
            href={pricingHref}
            className={emphasizePricing
              ? `inline-flex min-h-11 w-fit items-center rounded-md bg-[var(--brand-orange)] px-4 text-sm font-medium text-white ${focusClass}`
              : `inline-flex min-h-11 w-fit items-center text-sm font-medium underline ${focusClass}`}
          >
            Open Pricing
          </Link>
        ) : null}
        {onChange ? (
          <button type="button" className={`inline-flex min-h-11 w-fit items-center rounded-md border border-border bg-background px-4 text-sm font-medium ${focusClass}`} onClick={onChange}>
            Change pricing decision
          </button>
        ) : null}
      </div>
    </div>
  );
}

function SameVersionChange({
  intent,
  onIntent,
  newer,
  allowanceLabel,
  replacedLabels,
  saving,
  onSave,
  onReviewNewer,
}: {
  intent: "" | "update" | "add";
  onIntent: (intent: "" | "update" | "add") => void;
  newer: RfqResponseView | null;
  allowanceLabel: string;
  replacedLabels: string[];
  saving: boolean;
  onSave: () => void;
  onReviewNewer?: () => void;
}) {
  const replaced = replacedLabels.length > 0 ? replacedLabels.join(", ") : "none";
  return (
    <fieldset className="grid gap-3">
      <legend className="text-sm font-semibold">Change pricing decision</legend>
      <p className="text-sm">This version is already applied. The existing allowance is {allowanceLabel}. Replaced lines: {replaced}.</p>
      <p className="text-sm">Updating it keeps that one allowance. Adding a second charge is a different decision, and this same version cannot do it.</p>
      <label className={choiceClass(intent === "update")}>
        <span className="flex min-h-11 items-start gap-3 font-medium">
          <input type="radio" name="rfq-change-intent" className="mt-0.5 size-5" checked={intent === "update"} onChange={() => onIntent("update")} />
          <span>Update this application</span>
        </span>
        {intent === "update" ? (
          <span className="pl-8 text-sm font-normal">Saving this version again updates the existing allowance. It does not add another charge.</span>
        ) : null}
      </label>
      {intent === "update" ? (
        <button type="button" className={`inline-flex min-h-11 w-fit items-center rounded-md bg-[var(--brand-orange)] px-4 text-sm font-medium text-white ${focusClass}`} disabled={saving} onClick={onSave}>
          Save this decision
        </button>
      ) : null}
      {intent === "update" && newer && onReviewNewer ? (
        <button type="button" className={`inline-flex min-h-11 w-fit items-center rounded-md border border-border bg-background px-3 text-sm font-medium ${focusClass}`} onClick={onReviewNewer}>
          Review version {newer.versionNumber}
        </button>
      ) : null}
      {intent === "update" && !newer ? <p className="text-sm">A newer response version can update this allowance. This version cannot.</p> : null}
      <label className={choiceClass(intent === "add")}>
        <span className="flex min-h-11 items-start gap-3 font-medium">
          <input type="radio" name="rfq-change-intent" className="mt-0.5 size-5" checked={intent === "add"} onChange={() => onIntent("add")} />
          <span>Add another charge</span>
        </span>
        {intent === "add" ? (
          <span className="pl-8 text-sm font-normal">Adding another charge is not available from this version. It would not create a second allowance, and this page will not pretend that it does.</span>
        ) : null}
      </label>
    </fieldset>
  );
}

function SellAndReview(props: {
  fresh: RfqPricingPreviewResult | null;
  previewing: boolean;
  treatment: RfqSellTreatment | "";
  manualSell: string;
  selectedChoice: RfqPricingPreviewResult["choices"][number] | null;
  ready: boolean;
  waiting: string;
  remaining: number;
  replacedCount: number;
  choiceTitle: (treatment: RfqSellTreatment) => string;
  onTreatment: (treatment: RfqSellTreatment) => void;
  onManual: (value: string) => void;
  confirmed: boolean;
  onConfirmed: (value: boolean) => void;
  acknowledgeLoss: boolean;
  onAcknowledgeLoss: (value: boolean) => void;
  saving: boolean;
  canApply: boolean;
  onApply: () => void;
  reviewed: boolean;
  actionLabel: string;
  supplierName: string;
  versionNumber: number;
  added: boolean;
  updating: boolean;
}) {
  const { fresh, selectedChoice } = props;
  const lossAmount = selectedChoice?.loss && selectedChoice.sell != null
    ? Math.round((selectedChoice.cost - selectedChoice.sell) * 100) / 100
    : null;
  const showDecision = props.ready || props.previewing || props.saving;
  if (!showDecision) return <p className="text-sm">{props.waiting}</p>;
  return (
    <>
      <section className="grid gap-3" aria-labelledby="rfq-sell-heading" data-rfq-pricing-preview>
        <h3 id="rfq-sell-heading" className="text-sm font-semibold">Client sell</h3>
        {props.previewing ? <p className="text-sm">Checking these lines…</p> : null}
        {!props.ready && !props.previewing ? <p className="text-sm">{props.waiting}</p> : null}
        {props.ready && (fresh || props.previewing) ? (
          <fieldset className="grid gap-3" disabled={props.saving}>
            <legend className="text-sm">Choose one. Nothing is selected for you.</legend>
            {(["keep", "target_margin", "manual"] as const).map((choiceTreatment) => {
              const choice = fresh?.choices.find((item) => item.treatment === choiceTreatment) ?? null;
              const chosen = props.treatment === choiceTreatment;
              return (
                <label key={choiceTreatment} className={choiceClass(chosen)} data-rfq-sell-choice={choiceTreatment}>
                  <span className="flex min-h-11 items-start gap-3 font-medium">
                    <input
                      type="radio"
                      name="rfq-sell-treatment"
                      className="mt-0.5 size-5 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-orange)]"
                      disabled={!choice || (choiceTreatment !== "manual" && !choice.available)}
                      checked={chosen}
                      onChange={() => props.onTreatment(choiceTreatment)}
                    />
                    <span>{props.choiceTitle(choiceTreatment)}</span>
                  </span>
                  {choiceTreatment === "manual" && chosen ? (
                    <span className="grid gap-1 pl-8 text-sm font-normal">
                      Client sell ex GST
                      <input
                        className={fieldClass}
                        inputMode="decimal"
                        aria-label="Client sell ex GST"
                        value={props.manualSell}
                        onChange={(event) => props.onManual(event.target.value)}
                      />
                    </span>
                  ) : null}
                  {props.previewing ? (
                    <span className="pl-8 text-sm font-normal">Updating this preview…</span>
                  ) : choice?.available ? (
                    <span className="grid gap-1 pl-8 text-sm font-normal">
                      <span>Client sell {choice.sellKnown ? money(choice.sell) : "Pricing Required"}</span>
                      <span>Gross profit {money(choice.grossProfit)}</span>
                      <span>Margin {percent(choice.marginPercent)}</span>
                    </span>
                  ) : (
                    <span className="pl-8 text-sm font-normal">{choiceReason(choiceTreatment, choice?.unavailableReason ?? null)}</span>
                  )}
                </label>
              );
            })}
          </fieldset>
        ) : null}
      </section>

      <section className="grid gap-4" aria-labelledby="rfq-review-heading">
        <h3 id="rfq-review-heading" className="text-sm font-semibold">Review and confirm</h3>
        {props.previewing ? <p className="text-sm">Updating the before and after.</p> : null}
        {!props.previewing && fresh && selectedChoice?.available ? (
          <>
            <dl className="grid gap-2 text-sm" data-rfq-confirm-primary>
              <div className="flex flex-wrap justify-between gap-2">
                <dt>Selected work cost</dt>
                <dd className="tabular-nums">{money(fresh.selectedBefore.cost)} → {money(selectedChoice.selectedAfter.cost)}</dd>
              </div>
              <div className="flex flex-wrap justify-between gap-2">
                <dt>Selected work client sell</dt>
                <dd className="tabular-nums">{money(fresh.selectedBefore.sell)} → {selectedChoice.sellKnown ? money(selectedChoice.sell) : "Pricing Required"}</dd>
              </div>
              <div className="flex flex-wrap justify-between gap-2">
                <dt>Whole-job client sell</dt>
                <dd className="tabular-nums">{money(fresh.before.sell)} → {money(selectedChoice.after.sell)}</dd>
              </div>
              <div className="flex flex-wrap justify-between gap-2">
                <dt>Whole-job total incl GST</dt>
                <dd className="tabular-nums">{money(fresh.before.totalInclGst)} → {money(selectedChoice.after.totalInclGst)}</dd>
              </div>
            </dl>
            <details className="rounded-md border border-border px-3 py-2 text-sm">
              <summary className={`min-h-11 cursor-pointer py-2 ${focusClass}`}>Full money breakdown</summary>
              <div className="grid gap-4 pb-2">
                <div className="grid gap-2">
                  <p className="font-medium">Selected work before and after</p>
                  <p className="text-foreground/70">GST in this block is on the selected-work subtotal. It is not the document GST.</p>
                  {props.replacedCount === 0 ? <p>No existing lines are included. The new allowance is the selected work.</p> : null}
                  <MoneyRows before={fresh.selectedBefore} after={selectedChoice.selectedAfter} gstLabel="GST on the selected-work subtotal" totalLabel="Selected-work total incl GST" />
                </div>
                <div className="grid gap-2">
                  <p className="font-medium">Whole pricing document before and after</p>
                  <p className="text-foreground/70">Document GST is calculated on the document sell.</p>
                  <MoneyRows before={fresh.before} after={selectedChoice.after} gstLabel="Document GST" totalLabel="Document total incl GST" />
                </div>
              </div>
            </details>
          </>
        ) : !props.previewing && props.ready ? <p className="text-sm">{props.waiting}</p> : null}

        {selectedChoice?.loss && lossAmount != null ? (
          <div className="grid gap-2 rounded-md border border-destructive p-3 text-sm" role="alert">
            <p className="font-medium">Selected work would make a loss of {money(lossAmount)}.</p>
            <p>
              Whole job after this: gross profit {money(selectedChoice.after.grossProfit)}, margin {percent(selectedChoice.after.marginPercent)}.
            </p>
            <label className="flex min-h-11 items-start gap-3">
              <input
                type="checkbox"
                className="mt-0.5 size-5 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-orange)]"
                checked={props.acknowledgeLoss}
                onChange={(event) => props.onAcknowledgeLoss(event.target.checked)}
              />
              <span>Confirm that this cost is higher than the sell before using it.</span>
            </label>
          </div>
        ) : null}

        {selectedChoice?.available || props.saving ? (
          <>
            <label className="flex min-h-11 items-start gap-3 text-sm">
              <input
                type="checkbox"
                className="mt-0.5 size-5 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-orange)]"
                checked={props.confirmed}
                onChange={(event) => props.onConfirmed(event.target.checked)}
              />
              <span>
                Use this response for draft pricing. This changes draft Pricing and does not award the work or notify the subcontractor.
                {" "}
                {props.supplierName}, version {props.versionNumber}.
                {" "}
                {props.updating
                  ? "This updates the allowance already on draft Pricing. It does not add another charge."
                  : props.added
                    ? "This adds the supplier allowance and does not replace a line."
                    : `This replaces ${props.replacedCount === 1 ? "1 line" : `${props.replacedCount} lines`}.`}
                {" "}
                {props.remaining === 1 ? "1 other line remains charged." : `${props.remaining} other lines remain charged.`}
              </span>
            </label>
            {props.reviewed ? <p className="text-sm">Saving returns reviewed Pricing to draft.</p> : null}
            <div className="scroll-mb-[calc(5.75rem+env(safe-area-inset-bottom))]" aria-live="polite">
              <Button type="button" className="h-11 min-h-11 w-full sm:w-fit" disabled={!props.canApply || props.saving} onClick={props.onApply}>
                {props.saving ? "Saving draft Pricing…" : props.actionLabel}
              </Button>
            </div>
          </>
        ) : null}
      </section>
    </>
  );
}
