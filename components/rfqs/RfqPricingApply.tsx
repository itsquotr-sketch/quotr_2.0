"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import type { RfqDetail, RfqPricingTarget } from "@/lib/rfqs/load";
import { RfqSchedulePricing } from "@/components/rfqs/RfqSchedulePricing";
import { applyRfqPricingApplication, previewRfqPricingApplication } from "@/lib/rfqs/pricing-apply";
import type { RfqPricingPreviewResult } from "@/lib/rfqs/pricing-apply";
import type { RfqPricingMoneyView, RfqSellTreatment } from "@/lib/rfqs/pricing-preview";
import { gstTreatmentLabel, pricingStructureLabel } from "@/lib/rfqs/shared";

const fieldClass =
  "min-h-11 w-full rounded-md border border-border bg-background px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-orange)]";

function money(value: number | null, unknownLabel = "Unknown"): string {
  if (value == null) return unknownLabel;
  return value.toLocaleString("en-NZ", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function percent(value: number | null): string {
  if (value == null) return "Unknown";
  return `${value.toLocaleString("en-NZ", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
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

function MoneyRows({ view }: { view: RfqPricingMoneyView }) {
  const rows = [
    ["Cost ex GST", money(view.cost)],
    ["Client sell ex GST", view.sell == null ? "Pricing Required" : money(view.sell)],
    ["Gross profit", money(view.grossProfit)],
    ["Margin", percent(view.marginPercent)],
    ["GST", money(view.gstAmount)],
    ["Total incl GST", money(view.totalInclGst)],
  ];
  return (
    <dl className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-1">
      {rows.map(([label, value]) => (
        <div key={label} className="contents">
          <dt>{label}</dt>
          <dd className="text-right tabular-nums">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function RfqPricingApply(props: {
  detail: RfqDetail;
  pricing: RfqPricingTarget | null;
  canPrice: boolean;
}) {
  if (props.detail.pricingRequest === "schedule") {
    return <RfqSchedulePricing detail={props.detail} pricing={props.pricing} canPrice={props.canPrice} />;
  }
  return <LumpPricingApply {...props} />;
}

function LumpPricingApply({
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
  const [acknowledgeScope, setAcknowledgeScope] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const flight = useRef(false);
  const request = useRef(0);
  const previewTimer = useRef<number | null>(null);
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
  const scopeNote = [response?.excludedScope, response?.assumptions].filter((value) => value && value.trim()).join("\n");
  const needsScopeDecision = Boolean(response && (response.qualified || scopeNote));
  const evidence = response?.includedScope ?? "";
  const selectedChoice = preview?.choices.find((choice) => choice.treatment === treatment) ?? null;
  const canApply = Boolean(
    selectedChoice?.available &&
    confirmed &&
    !saving &&
    !previewing &&
    (selected.length > 0 || addOnly) &&
    (selected.length > 0 || activeApplication || lines.length === 0 || acknowledgeOverlap) &&
    (!selectedChoice.loss || acknowledgeLoss) &&
    (!needsScopeDecision || acknowledgeScope)
  );

  useEffect(() => {
    if (!error) return;
    errorRef.current?.focus();
  }, [error]);

  function resetChoice() {
    setTreatment("");
    setAcknowledgeLoss(false);
    setAcknowledgeScope(false);
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
      });
    }, 250);
  }

  if (!canPrice || detail.status !== "sent" || submitted.length === 0) return null;

  function toggle(id: string) {
    const next = selected.includes(id) ? selected.filter((item) => item !== id) : [...selected, id];
    setSelected(next);
    setAddOnly(false);
    resetChoice();
    schedulePreview(next, false, manualSell, responseId);
  }

  async function apply() {
    if (!response || !pricing || !preview || !treatment || !canApply || flight.current) return;
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

  const choiceTitle = (choiceTreatment: RfqSellTreatment) => {
    if (choiceTreatment === "keep") return "Keep the current client sell for the selected work";
    if (choiceTreatment === "target_margin") {
      return preview?.targetMarginPercent == null
        ? "Reprice the supplier cost at the job target margin"
        : `Reprice the supplier cost at the ${preview.targetMarginSource === "job" ? "job" : "pricing"} target of ${preview.targetMarginPercent}%`;
    }
    return "Enter a client sell ex GST";
  };

  return (
    <section className="mx-auto grid w-full max-w-3xl gap-8 rounded-xl border border-border bg-card p-4 sm:p-6" data-rfq-pricing-apply>
      <div className="grid gap-2">
        <h2 className="text-base font-semibold">Use for pricing</h2>
        <p className="text-sm text-foreground/70">
          This puts the response onto draft pricing. It does not award the work or notify the supplier.
        </p>
      </div>

      {done && pricing ? (
        <div className="grid gap-3 rounded-lg border border-border bg-background p-4" data-rfq-pricing-applied>
          <p className="font-medium">Draft pricing has this allowance.</p>
          <p className="text-sm">
            Next, open Pricing and check the client label, description, and scope. Mark Pricing as reviewed, then create the quote.
            This step did not review Pricing, create a quote, or send one.
          </p>
          <Link
            href={`/app/projects/${detail.projectId}/pricing/${pricing.documentId}`}
            className="inline-flex min-h-11 w-fit items-center rounded-md bg-[var(--brand-orange)] px-4 text-sm font-medium text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-orange)] focus-visible:ring-offset-2"
          >
            Go to Pricing
          </Link>
        </div>
      ) : null}

      <section className="grid gap-3" aria-labelledby="rfq-offer-heading">
        <h3 id="rfq-offer-heading" className="text-sm font-semibold">Supplier offer</h3>
        {!pricing ? <p className="text-sm">Create draft pricing before using a response.</p> : null}
        <label className="grid gap-1 text-sm" htmlFor="rfq-response">
          Response
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
              resetChoice();
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
        {response ? (
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-foreground/70">Supplier</dt>
              <dd className="font-medium">{names.get(response.recipientId) || "Supplier"}</dd>
            </div>
            <div>
              <dt className="text-foreground/70">Scope</dt>
              <dd>{detail.scopeLabel || "Requested work"}</dd>
            </div>
            <div>
              <dt className="text-foreground/70">Response version</dt>
              <dd>Version {response.versionNumber}</dd>
            </div>
            <div>
              <dt className="text-foreground/70">Price ex GST</dt>
              <dd className="tabular-nums">{response.priceExGst == null ? "No price" : money(response.priceExGst)}</dd>
            </div>
            <div>
              <dt className="text-foreground/70">GST treatment</dt>
              <dd>{gstTreatmentLabel(response.gstTreatment)}</dd>
            </div>
            <div>
              <dt className="text-foreground/70">Submitted</dt>
              <dd>{submittedLabel(response.submittedAt)}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-foreground/70">Structure</dt>
              <dd>{pricingStructureLabel(response.pricingStructure)}. This becomes one subcontract allowance.</dd>
            </div>
          </dl>
        ) : null}
        {newerThanApplied && response && activeResponse ? (
          <p className="rounded-md border border-border bg-background px-3 py-2 text-sm" role="status">
            Version {response.versionNumber} is newer than version {activeResponse.versionNumber}, which is already on draft pricing.
            Using this version replaces that allowance. Nothing is replaced until you confirm below.
          </p>
        ) : null}
        {response && detail.applications.some((application) => application.responseId === response.id) ? (
          <p className="text-sm">This version is already used for draft pricing.</p>
        ) : null}
        {scopeNote || response?.qualified ? (
          <div className="grid gap-1 text-sm">
            <p className="font-medium">Qualifications and exclusions</p>
            <p className="whitespace-pre-wrap">{scopeNote || "This response is qualified."}</p>
          </div>
        ) : null}
      </section>

      <section className="grid gap-3" aria-labelledby="rfq-cover-heading">
        <h3 id="rfq-cover-heading" className="text-sm font-semibold">What this price covers</h3>
        <div className="grid gap-3 text-sm sm:grid-cols-2">
          <div className="grid gap-1">
            <p className="font-medium">Supplier scope</p>
            <p className="whitespace-pre-wrap text-foreground/80">{detail.requestedScope || "No written scope."}</p>
            {response?.includedScope ? <p className="whitespace-pre-wrap">Included: {response.includedScope}</p> : null}
            {response?.excludedScope ? <p className="whitespace-pre-wrap">Excluded: {response.excludedScope}</p> : null}
          </div>
          <div className="grid gap-1">
            <p className="font-medium">Selected job scope</p>
            {picked.length === 0 ? (
              <p className="text-foreground/80">No pricing lines selected. Unselected lines stay charged.</p>
            ) : (
              <ul className="grid gap-1">
                {picked.map((line) => (
                  <li key={line.id} className="break-words">{line.label}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
        <p className="text-sm">
          {picked.length === 1 ? "1 line selected" : `${picked.length} lines selected`}.
          {" "}
          Selected lines are replaced. Unselected lines remain.
          {preview && picked.length > 0 ? (
            <>
              {" "}
              Combined cost {preview.affected.some((line) => line.cost == null) ? "Pricing Required" : money(preview.selectedBefore.cost)}.
              {" "}
              Combined client sell {preview.affected.some((line) => line.sell == null) ? "Pricing Required" : money(preview.selectedBefore.sell, "Pricing Required")}.
            </>
          ) : null}
        </p>
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
            const suggested = lineSuggested(line.label, evidence, detail.scopeLabel || "");
            return (
              <label key={line.id} className="flex min-h-11 items-start gap-3 rounded-md border border-border px-3 py-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-0.5 size-5 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-orange)]"
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
                  {suggested ? <span>Suggested from the supplier scope. Confirm this line.</span> : null}
                </span>
              </label>
            );
          })}
        </fieldset>
        {selected.length === 0 ? (
          <div className="grid gap-2 rounded-md border border-border bg-background p-3 text-sm">
            <p>
              {activeApplication
                ? "No lines selected. This updates the allowance already used for this work area and keeps the lines it already replaced hidden. It does not add a second allowance. The lines listed above stay charged."
                : `No lines selected. Every line listed above stays charged. This adds the supplier allowance of ${response?.priceExGst == null ? "the submitted price" : "$" + money(response.priceExGst)} ex GST on top of those lines. The same work can be billed twice if this price already covers it.`}
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
                  resetChoice();
                  schedulePreview(selected, next, manualSell, responseId);
                }}
              />
              <span>Add this supplier allowance without replacing any line.</span>
            </label>
          </div>
        ) : (
          <details>
            <summary className="min-h-11 cursor-pointer py-2 text-sm">Selected line details</summary>
            <ul className="grid gap-1 pb-2 text-sm">
              {picked.map((line) => (
                <li key={line.id} className="break-words">
                  {line.label} · {quantityLabel(line.quantity, line.unit)} · cost {lineKnown(line) ? money(line.totalCost) : "Pricing Required"} · sell {lineKnown(line) ? money(line.totalSell) : "Pricing Required"}
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>

      <section className="grid gap-3" aria-labelledby="rfq-sell-heading" data-rfq-pricing-preview>
        <h3 id="rfq-sell-heading" className="text-sm font-semibold">Choose the client sell</h3>
        {previewing ? <p className="text-sm">Checking these lines…</p> : null}
        {!preview && !previewing ? <p className="text-sm">Select the lines this price replaces, or confirm that it adds a new allowance.</p> : null}
        {preview ? (
          <fieldset className="grid gap-3">
            <legend className="text-sm">Nothing is selected for you.</legend>
            {preview.choices.map((choice) => (
              <label key={choice.treatment} className="grid gap-2 rounded-md border border-border p-3" data-rfq-sell-choice={choice.treatment}>
                <span className="flex min-h-11 items-start gap-3 font-medium">
                  <input
                    type="radio"
                    name="rfq-sell-treatment"
                    className="mt-0.5 size-5 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-orange)]"
                    disabled={choice.treatment !== "manual" && !choice.available}
                    checked={treatment === choice.treatment}
                    onChange={() => {
                      setTreatment(choice.treatment);
                      setAcknowledgeLoss(false);
                      setConfirmed(false);
                    }}
                  />
                  <span>{choiceTitle(choice.treatment)}</span>
                </span>
                {choice.treatment === "manual" ? (
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
                {choice.available ? (
                  <span className="grid gap-1 pl-8 text-sm font-normal">
                    <span>Supplier cost {money(choice.cost)}</span>
                    <span>Client sell {choice.sellKnown ? money(choice.sell) : "Pricing Required"}</span>
                    <span>Gross profit {money(choice.grossProfit)}</span>
                    <span>Margin {percent(choice.marginPercent)}</span>
                    {choice.loss ? <span className="font-medium text-destructive">Loss. The supplier cost is higher than the client sell.</span> : null}
                  </span>
                ) : (
                  <span className="pl-8 text-sm font-normal">{choice.unavailableReason}</span>
                )}
              </label>
            ))}
          </fieldset>
        ) : null}
      </section>

      <section className="grid gap-4" aria-labelledby="rfq-review-heading">
        <h3 id="rfq-review-heading" className="text-sm font-semibold">Review and confirm</h3>
        {preview && selectedChoice?.available ? (
          <>
            <div className="grid gap-3">
              <p className="text-sm font-medium">Selected work</p>
              {preview.affected.length === 0 ? (
                <p className="text-sm">No existing lines are included. The new allowance is the selected work.</p>
              ) : null}
              <div className="grid gap-4 sm:grid-cols-2">
                {preview.affected.length > 0 ? (
                  <div className="grid gap-2 text-sm">
                    <p>Before</p>
                    <MoneyRows view={preview.selectedBefore} />
                  </div>
                ) : null}
                <div className="grid gap-2 text-sm">
                  <p>After</p>
                  <MoneyRows view={selectedChoice.selectedAfter} />
                </div>
              </div>
            </div>
            <div className="grid gap-3">
              <p className="text-sm font-medium">Whole job</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2 text-sm">
                  <p>Before</p>
                  <MoneyRows view={preview.before} />
                </div>
                <div className="grid gap-2 text-sm">
                  <p>After</p>
                  <MoneyRows view={selectedChoice.after} />
                </div>
              </div>
            </div>
            <div className="grid gap-2 text-sm">
              <p>
                {activeApplication ? "Updates" : "Adds"} <span className="font-medium">{preview.label}</span>.
              </p>
              {preview.affected.length > 0 ? (
                <p>
                  {preview.affected.length === 1 ? "1 line becomes" : `${preview.affected.length} lines become`} replaced and hidden from the client quote.
                </p>
              ) : (
                <p>No lines are hidden. Existing lines stay charged.</p>
              )}
              {preview.affected.length > 0 ? (
                <details>
                  <summary className="min-h-11 cursor-pointer py-2">Replaced lines</summary>
                  <ul className="grid gap-1 pb-2">
                    {preview.affected.map((line) => (
                      <li key={line.id} className="break-words">{line.label}</li>
                    ))}
                  </ul>
                </details>
              ) : null}
            </div>
            {preview.quoteExists ? (
              <p className="text-sm">
                An issued quote on this job stays unchanged. A revised client price needs the normal new quote or revision path.
              </p>
            ) : null}
          </>
        ) : (
          <p className="text-sm">Choose a client sell to see the before and after.</p>
        )}
        {needsScopeDecision ? (
          <label className="flex min-h-11 items-start gap-3 text-sm">
            <input
              type="checkbox"
              className="mt-0.5 size-5 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-orange)]"
              checked={acknowledgeScope}
              onChange={(event) => setAcknowledgeScope(event.target.checked)}
            />
            <span>I have decided how this qualification or exclusion is covered for the client. It stays on the private response until I write the client wording into Pricing.</span>
          </label>
        ) : null}
        {selected.length === 0 && !activeApplication && lines.length > 0 ? (
          <label className="flex min-h-11 items-start gap-3 text-sm">
            <input
              type="checkbox"
              className="mt-0.5 size-5 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-orange)]"
              checked={acknowledgeOverlap}
              onChange={(event) => setAcknowledgeOverlap(event.target.checked)}
            />
            <span>I confirm the existing lines stay charged and this supplier allowance is added as well.</span>
          </label>
        ) : null}
        {selectedChoice?.loss ? (
          <label className="flex min-h-11 items-start gap-3 text-sm">
            <input
              type="checkbox"
              className="mt-0.5 size-5 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-orange)]"
              checked={acknowledgeLoss}
              onChange={(event) => setAcknowledgeLoss(event.target.checked)}
            />
            <span>I acknowledge this cost is higher than the sell. This does not award the work.</span>
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
      {error ? (
        <p ref={errorRef} tabIndex={-1} className="text-sm text-red-700 outline-none" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
