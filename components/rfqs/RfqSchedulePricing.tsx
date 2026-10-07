"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import type { RfqDetail, RfqPricingTarget } from "@/lib/rfqs/load";
import { applySchedulePricing, previewSchedulePricing } from "@/lib/rfqs/schedule-pricing";
import type { ScheduleCoverageDecision, ScheduleCoverageInput, SchedulePricingPreview, SchedulePricingRowInput } from "@/lib/rfqs/schedule-pricing";
import type { RfqSellTreatment } from "@/lib/rfqs/pricing-preview";
import { scheduleRoleLabel, scheduleUnitLabel } from "@/lib/rfqs/schedule";
import { gstTreatmentLabel } from "@/lib/rfqs/shared";
import { useRouter } from "next/navigation";

function money(value: number | null, unknownLabel = "Unknown"): string {
  if (value == null) return unknownLabel;
  return value.toLocaleString("en-NZ", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function percent(value: number | null): string {
  if (value == null) return "Unknown";
  return `${value.toLocaleString("en-NZ", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
}

type RowState = {
  selected: boolean;
  mode: "replace" | "add" | "";
  replacedId: string;
  clientLabel: string;
  scopeConfirmed: boolean;
  treatment: RfqSellTreatment | "";
  manualSell: string;
  acknowledgeLoss: boolean;
  qualificationAcknowledged: boolean;
  acknowledgeAlternative: boolean;
  acknowledgeSource: boolean;
  coverageDecision: ScheduleCoverageDecision | "";
  coverageWording: string;
  coverageNote: string;
  coverageItemId: string;
};

function blankRow(label: string): RowState {
  return {
    selected: false,
    mode: "",
    replacedId: "",
    clientLabel: label,
    scopeConfirmed: false,
    treatment: "",
    manualSell: "",
    acknowledgeLoss: false,
    qualificationAcknowledged: false,
    acknowledgeAlternative: false,
    acknowledgeSource: false,
    coverageDecision: "",
    coverageWording: "",
    coverageNote: "",
    coverageItemId: "",
  };
}

function CoverageFields({
  decision,
  wording,
  note,
  itemId,
  targets,
  onChange,
}: {
  decision: ScheduleCoverageDecision | "";
  wording: string;
  note: string;
  itemId: string;
  targets: Array<{ id: string; label: string }>;
  onChange: (patch: { decision?: ScheduleCoverageDecision | ""; wording?: string; note?: string; itemId?: string }) => void;
}) {
  return (
    <fieldset className="grid gap-2">
      <legend>How is this condition covered?</legend>
      {([
        ["covered_by_item", "Another Pricing item already covers it"],
        ["client_exclusion", "The client quote will exclude it"],
        ["builder_responsibility", "The builder will cover it, privately"],
      ] as const).map(([value, label]) => (
        <label key={value} className="flex min-h-11 items-start gap-2">
          <input type="radio" className="mt-1" checked={decision === value} onChange={() => onChange({ decision: value })} />
          <span>{label}</span>
        </label>
      ))}
      {decision === "covered_by_item" ? (
        <label className="grid gap-1">
          Covering Pricing item
          <select className="h-11 min-h-11 rounded-md border border-border bg-background px-3" value={itemId} onChange={(event) => onChange({ itemId: event.target.value })}>
            <option value="">Choose an item</option>
            {targets.map((target) => <option key={target.id} value={target.id}>{target.label}</option>)}
          </select>
        </label>
      ) : null}
      {decision === "client_exclusion" ? (
        <label className="grid gap-1">
          Client exclusion wording
          <textarea className="min-h-20 rounded-md border border-border bg-background px-3 py-2" value={wording} onChange={(event) => onChange({ wording: event.target.value })} />
        </label>
      ) : null}
      {decision === "builder_responsibility" ? (
        <label className="grid gap-1">
          Internal explanation
          <textarea className="min-h-20 rounded-md border border-border bg-background px-3 py-2" value={note} onChange={(event) => onChange({ note: event.target.value })} />
        </label>
      ) : null}
    </fieldset>
  );
}

function coverageFrom(decision: ScheduleCoverageDecision | "", wording: string, note: string, itemId: string): ScheduleCoverageInput | null {
  if (!decision) return null;
  return { decision, wording, note, itemId: itemId || null };
}

export function RfqSchedulePricing({
  detail,
  pricing,
  canPrice,
}: {
  detail: RfqDetail;
  pricing: RfqPricingTarget | null;
  canPrice: boolean;
}) {
  const router = useRouter();
  const submitted = detail.responses
    .filter((response) => response.status === "submitted")
    .sort((a, b) => b.versionNumber - a.versionNumber);
  const [responseId, setResponseId] = useState(submitted[0]?.id ?? "");
  const [rows, setRows] = useState<Record<string, RowState>>({});
  const [preview, setPreview] = useState<SchedulePricingPreview | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [open, setOpen] = useState(false);
  const [responseDecision, setResponseDecision] = useState<ScheduleCoverageDecision | "">("");
  const [responseWording, setResponseWording] = useState("");
  const [responseNote, setResponseNote] = useState("");
  const [responseItemId, setResponseItemId] = useState("");
  const errorRef = useRef<HTMLParagraphElement>(null);
  const response = submitted.find((item) => item.id === responseId) ?? null;
  const recipient = detail.recipients.find((item) => item.id === response?.recipientId);
  const names = new Map(detail.recipients.map((item) => [item.id, item.tradingName]));
  const newer = Boolean(response && submitted.some((item) => item.recipientId === response.recipientId && item.versionNumber > response.versionNumber));
  const appliedVersion = detail.scheduleApplications.find((application) => application.recipientId === response?.recipientId);
  const editable = pricing != null && (pricing.documentStatus === "draft" || pricing.documentStatus === "reviewed");
  const targets = (pricing?.items ?? []).filter((item) => !detail.workAreaId || item.workAreaId === detail.workAreaId);
  const scheduleById = new Map(detail.schedule.map((item) => [item.id, item]));

  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);

  if (!canPrice || detail.status !== "sent" || submitted.length === 0) return null;

  function clearPreview() {
    setPreview(null);
    setConfirmed(false);
  }

  function updateRow(scheduleItemId: string, label: string, patch: Partial<RowState>, keepPreview = false) {
    if (!keepPreview) clearPreview();
    setRows((current) => ({
      ...current,
      [scheduleItemId]: { ...(current[scheduleItemId] ?? blankRow(label)), ...patch },
    }));
  }

  function selectedInputs(): SchedulePricingRowInput[] | null {
    if (!response) return null;
    const chosen = response.lines.filter((line) => rows[line.scheduleItemId]?.selected);
    if (chosen.length === 0) return null;
    return chosen.map((line) => {
      const state = rows[line.scheduleItemId];
      const item = scheduleById.get(line.scheduleItemId);
      const manual = state.manualSell.trim() === "" ? null : Number(state.manualSell);
      return {
        scheduleItemId: line.scheduleItemId,
        mode: state.mode === "add" ? "add" : "replace",
        replacedItemIds: state.mode === "replace" && state.replacedId ? [state.replacedId] : [],
        clientLabel: state.clientLabel || item?.scope || "",
        scopeConfirmed: state.scopeConfirmed,
        sellTreatment: (state.treatment || "manual") as RfqSellTreatment,
        manualSell: manual != null && Number.isFinite(manual) ? manual : null,
        acknowledgeLoss: state.acknowledgeLoss,
        qualificationAcknowledged: state.qualificationAcknowledged,
        acknowledgeAlternative: state.acknowledgeAlternative,
        acknowledgeSource: state.acknowledgeSource,
        coverage: line.qualification.trim()
          ? coverageFrom(state.coverageDecision, state.coverageWording, state.coverageNote, state.coverageItemId)
          : null,
      };
    });
  }

  async function runPreview() {
    if (!response || !pricing) return;
    const payload = selectedInputs();
    if (!payload) {
      setError("Choose at least one priced item.");
      return;
    }
    if (payload.some((row) => !rows[row.scheduleItemId]?.treatment)) {
      setError("Choose how the sell should be set for each selected item.");
      return;
    }
    setPending(true);
    setError(null);
    const result = await previewSchedulePricing({
      responseId: response.id,
      pricingDocumentId: pricing.documentId,
      workAreaId: detail.workAreaId || targets[0]?.workAreaId || "",
      rows: payload,
      responseCoverage: response.excludedScope.trim()
        ? coverageFrom(responseDecision, responseWording, responseNote, responseItemId)
        : null,
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
    const payload = selectedInputs();
    if (!payload) return;
    setPending(true);
    setError(null);
    const result = await applySchedulePricing({
      responseId: response.id,
      pricingDocumentId: pricing.documentId,
      workAreaId: detail.workAreaId || targets[0]?.workAreaId || "",
      rows: payload,
      responseCoverage: response.excludedScope.trim()
        ? coverageFrom(responseDecision, responseWording, responseNote, responseItemId)
        : null,
    });
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setConfirmed(false);
    setPreview(null);
    router.refresh();
  }

  return (
    <section className="grid gap-3 rounded-xl border border-border bg-card p-4 text-sm" data-rfq-schedule-pricing>
      <h2 className="text-base font-semibold">Use items in Pricing</h2>
      <p>This uses the items you choose on draft pricing. It does not award the work or notify the subcontractor.</p>
      {!pricing ? <p>Create draft pricing before using a response.</p> : null}
      {pricing && !editable ? (
        <p>An issued quote stays as it was. Create a new draft revision from that quote after this pricing document can be edited. Nothing was applied.</p>
      ) : null}
      {editable ? (
        <Button type="button" className="h-11 min-h-11 w-fit" disabled={pending} onClick={() => setOpen(true)}>
          Use items in Pricing
        </Button>
      ) : null}
      {open && editable && response ? (
        <div className="grid gap-4">
          <label className="grid gap-1">
            Response
            <select
              className="h-11 min-h-11 rounded-md border border-border bg-background px-3"
              value={responseId}
              onChange={(event) => {
                setResponseId(event.target.value);
                setRows({});
                setResponseDecision("");
                setResponseWording("");
                setResponseNote("");
                setResponseItemId("");
                clearPreview();
              }}
            >
              {submitted.map((item) => (
                <option key={item.id} value={item.id}>
                  {names.get(item.recipientId) || "Recipient"} · version {item.versionNumber}
                </option>
              ))}
            </select>
          </label>
          <div className="grid gap-1">
            <p>{recipient?.tradingName || "Recipient"} · version {response.versionNumber}</p>
            <p>Valid until {response.validUntil || "No date given"} · {gstTreatmentLabel(response.gstTreatment)} is evidence about the offer. Pricing GST stays on the document.</p>
            <p className="break-words">Exclusions: {response.excludedScope.trim() || "None stated"}.</p>
            {response.excludedScope.trim() ? (
              <div className="grid gap-2 rounded-md border border-border p-3">
                <p className="text-xs text-muted-foreground">Private supplier exclusion</p>
                <p className="break-words">{response.excludedScope}</p>
                <CoverageFields
                  decision={responseDecision}
                  wording={responseWording}
                  note={responseNote}
                  itemId={responseItemId}
                  targets={targets}
                  onChange={(patch) => {
                    if (patch.decision != null) setResponseDecision(patch.decision);
                    if (patch.wording != null) setResponseWording(patch.wording);
                    if (patch.note != null) setResponseNote(patch.note);
                    if (patch.itemId != null) setResponseItemId(patch.itemId);
                    clearPreview();
                  }}
                />
              </div>
            ) : null}
            <p>Assumptions: {response.assumptions.trim() || "None stated"}.</p>
            <p>Schedule frozen at send.</p>
            {response.completeness === "partial" ? (
              <p className="font-medium" data-rfq-priced-subtotal>Priced subtotal — incomplete response. This is not a complete base price.</p>
            ) : null}
            {newer || (appliedVersion && appliedVersion.responseId !== response.id) ? <p className="font-medium">Newer response available</p> : null}
          </div>
          <ul className="grid gap-4">
            {detail.schedule.map((item) => {
              const line = response.lines.find((candidate) => candidate.scheduleItemId === item.id);
              const state = rows[item.id] ?? blankRow(item.scope);
              const priced = line?.decision === "priced" && line.amountExGst != null;
              return (
                <li key={item.id} className="grid gap-2 rounded-md border border-border p-3" data-rfq-schedule-row={item.id}>
                  <p className="break-words font-medium">{item.scope}</p>
                  {item.specification ? <p className="break-words">{item.specification}</p> : null}
                  <p>
                    {item.unit === "lump_sum" ? "One lump sum" : `${item.quantity ?? ""} ${scheduleUnitLabel(item.unit)}`}
                    {" · "}{scheduleRoleLabel(item.role)}
                    {priced ? ` · ${item.unit === "lump_sum" ? money(line?.amountExGst ?? null) : `${money(line?.unitPriceExGst ?? null)} · ${money(line?.amountExGst ?? null)} ex GST`}` : " · Not priced"}
                  </p>
                  {line?.qualification ? <p className="break-words">Qualification: {line.qualification}</p> : null}
                  {line?.decision === "not_priced" ? <p className="break-words">Not priced. {line.reason || "No reason recorded."} This is not $0. Unresolved — not part of this application.</p> : null}
                  {!priced && item.role !== "required" ? <p>Outside this application.</p> : null}
                  {priced && !state.selected && item.role === "required" ? <p>Not selected. This required item is not covered by this application.</p> : null}
                  {priced && !state.selected && item.role !== "required" ? <p>Outside this application until you select it.</p> : null}
                  {priced ? (
                    <label className="flex min-h-11 items-center gap-2">
                      <input
                        type="checkbox"
                        checked={state.selected}
                        onChange={(event) => updateRow(item.id, item.scope, { selected: event.target.checked })}
                      />
                      Use this item
                    </label>
                  ) : null}
                  {priced && state.selected ? (
                    <div className="grid gap-2">
                      <label className="flex min-h-11 items-start gap-2">
                        <input type="checkbox" className="mt-1" checked={state.scopeConfirmed} onChange={(event) => updateRow(item.id, item.scope, { scopeConfirmed: event.target.checked })} />
                        <span>The supplier scope matches this job.</span>
                      </label>
                      <label className="grid gap-1">
                        Pricing item
                        <select
                          className="h-11 min-h-11 rounded-md border border-border bg-background px-3"
                          value={state.mode === "add" ? "add" : state.replacedId}
                          onChange={(event) => {
                            const value = event.target.value;
                            updateRow(item.id, item.scope, value === "add" ? { mode: "add", replacedId: "" } : { mode: "replace", replacedId: value });
                          }}
                        >
                          <option value="">Choose an item</option>
                          <option value="add">Add as new scope</option>
                          {targets.map((target) => (
                            <option key={target.id} value={target.id}>{target.label}</option>
                          ))}
                        </select>
                      </label>
                      <label className="flex min-h-11 items-start gap-2">
                        <input type="checkbox" className="mt-1" checked={state.acknowledgeSource} onChange={(event) => updateRow(item.id, item.scope, { acknowledgeSource: event.target.checked })} />
                        <span>If a supplier rate or an earlier RFQ allowance covers this scope, use this schedule price as the one source.</span>
                      </label>
                      <label className="grid gap-1">
                        Client-facing label
                        <input className="h-11 min-h-11 rounded-md border border-border bg-background px-3" value={state.clientLabel} onChange={(event) => updateRow(item.id, item.scope, { clientLabel: event.target.value })} />
                      </label>
                      <p className="text-foreground/70">The supplier name and cost stay off the client quote.</p>
                      <fieldset className="grid gap-2">
                        <legend>Sell</legend>
                        {(["keep", "target_margin", "manual"] as const).map((treatment) => (
                          <label key={treatment} className="flex min-h-11 items-center gap-2">
                            <input
                              type="radio"
                              name={`sell-${item.id}`}
                              checked={state.treatment === treatment}
                              onChange={() => updateRow(item.id, item.scope, { treatment, acknowledgeLoss: false })}
                            />
                            {treatment === "keep" ? "Keep the current sell" : treatment === "target_margin" ? "Reprice at the job target margin" : "Enter a sell"}
                          </label>
                        ))}
                      </fieldset>
                      {state.treatment === "manual" ? (
                        <label className="grid gap-1">
                          Manual sell ex GST
                          <input className="h-11 min-h-11 rounded-md border border-border bg-background px-3" inputMode="decimal" value={state.manualSell} onChange={(event) => updateRow(item.id, item.scope, { manualSell: event.target.value })} />
                        </label>
                      ) : null}
                      {line.qualification ? (
                        <div className="grid gap-2 md:grid-cols-2">
                          <div>
                            <p className="text-xs text-muted-foreground">Private supplier qualification</p>
                            <p className="break-words">{line.qualification}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Client-facing scope</p>
                            <p className="break-words font-medium">{state.clientLabel}</p>
                            <p className="break-words">{item.scope}</p>
                            {state.coverageDecision === "client_exclusion" && state.coverageWording.trim() ? <p className="break-words">Excluded: {state.coverageWording}</p> : null}
                          </div>
                          <label className="flex min-h-11 items-start gap-2 md:col-span-2">
                            <input type="checkbox" className="mt-1" checked={state.qualificationAcknowledged} onChange={(event) => updateRow(item.id, item.scope, { qualificationAcknowledged: event.target.checked })} />
                            <span className="break-words">I have read this qualification. It is not copied onto the quote.</span>
                          </label>
                          <div className="md:col-span-2">
                            <CoverageFields
                              decision={state.coverageDecision}
                              wording={state.coverageWording}
                              note={state.coverageNote}
                              itemId={state.coverageItemId}
                              targets={targets.filter((target) => target.id !== state.replacedId)}
                              onChange={(patch) => updateRow(item.id, item.scope, {
                                coverageDecision: patch.decision ?? state.coverageDecision,
                                coverageWording: patch.wording ?? state.coverageWording,
                                coverageNote: patch.note ?? state.coverageNote,
                                coverageItemId: patch.itemId ?? state.coverageItemId,
                              })}
                            />
                          </div>
                        </div>
                      ) : null}
                      {item.role === "alternative" ? (
                        <label className="flex min-h-11 items-start gap-2">
                          <input type="checkbox" className="mt-1" checked={state.acknowledgeAlternative} onChange={(event) => updateRow(item.id, item.scope, { acknowledgeAlternative: event.target.checked })} />
                          <span>I have reviewed this alternative against its base item.</span>
                        </label>
                      ) : null}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
          {response.completeness === "partial" ? (
            <div>
              <p className="font-medium">Requested work still unpriced</p>
              <ul>
                {detail.schedule.filter((item) => {
                  const line = response.lines.find((candidate) => candidate.scheduleItemId === item.id);
                  return item.role === "required" && line?.decision !== "priced";
                }).map((item) => <li key={item.id} className="break-words">{item.scope}</li>)}
              </ul>
            </div>
          ) : null}
          <Button type="button" variant="outline" className="h-11 min-h-11 w-fit" disabled={pending} onClick={runPreview}>
            Preview pricing
          </Button>
          {preview ? (
            <div className="grid gap-3" data-rfq-schedule-pricing-preview>
              {preview.pricedSubtotalLabel ? <p className="font-medium">{preview.pricedSubtotalLabel}</p> : null}
              {preview.incomplete ? <p>The whole request is incomplete. Only the selected priced lines are shown here.</p> : null}
              {preview.rows.map((row) => {
                const choice = row.choices.find((item) => item.treatment === rows[row.scheduleItemId]?.treatment);
                return (
                  <div key={row.scheduleItemId} className="grid gap-1 rounded-md border border-border p-3">
                    <p className="break-words font-medium">{row.scope}</p>
                    {row.qualification ? (
                      <div className="grid gap-2 md:grid-cols-2">
                        <p className="break-words"><span className="text-muted-foreground">Private qualification: </span>{row.qualification}</p>
                        <p className="break-words"><span className="text-muted-foreground">Client scope: </span>{rows[row.scheduleItemId]?.clientLabel}. {rows[row.scheduleItemId]?.coverageDecision === "client_exclusion" ? `Excluded: ${rows[row.scheduleItemId]?.coverageWording}` : "No client exclusion from this qualification."}</p>
                      </div>
                    ) : null}
                    <p>Supplier cost ex GST: {money(row.cost)}</p>
                    <p>Current cost: {money(row.currentCost, "None")} · Current sell: {money(row.currentSell, "Pricing Required")}</p>
                    {choice?.available ? (
                      <>
                        <p>New cost: {money(choice.cost)} · Proposed sell: {money(choice.sell)} · Gross profit: {money(choice.grossProfit)} · Margin: {percent(choice.marginPercent)}</p>
                        {choice.loss ? <p className="font-medium text-destructive">This sell is {money((choice.sell ?? 0) - choice.cost)} below the supplier cost. Margin {percent(choice.marginPercent)}.</p> : null}
                      </>
                    ) : <p>{choice?.unavailableReason ?? "Choose a sell."}</p>}
                    {choice?.loss ? (
                      <label className="flex min-h-11 items-start gap-2">
                        <input type="checkbox" className="mt-1" checked={rows[row.scheduleItemId]?.acknowledgeLoss ?? false} onChange={(event) => updateRow(row.scheduleItemId, row.scope, { acknowledgeLoss: event.target.checked }, true)} />
                        <span>I acknowledge this loss for this item and this preview.</span>
                      </label>
                    ) : null}
                  </div>
                );
              })}
              <p>Document before: cost {money(preview.before.cost)} · sell {money(preview.before.sell)} · gross profit {money(preview.before.grossProfit)} · margin {percent(preview.before.marginPercent)} · GST {money(preview.before.gstAmount)} · total {money(preview.before.totalInclGst)}</p>
              {preview.after ? (
                <p>Document after: cost {money(preview.after.cost)} · sell {money(preview.after.sell)} · gross profit {money(preview.after.grossProfit)} · margin {percent(preview.after.marginPercent)} · GST {money(preview.after.gstAmount)} · total {money(preview.after.totalInclGst)}</p>
              ) : <p>Choose an available sell for every selected item to see the document total.</p>}
              <p>Items left untouched: {preview.untouched.length === 0 ? "None in this work area." : preview.untouched.map((item) => item.label).join(", ")}</p>
              <label className="flex min-h-11 items-start gap-2">
                <input type="checkbox" className="mt-1" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />
                <span>Use these items for draft pricing. This does not award the work or notify the subcontractor.</span>
              </label>
              <Button type="button" className="h-11 min-h-11 w-fit" disabled={!confirmed || pending} onClick={apply}>
                Confirm pricing items
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
      {error ? <p ref={errorRef} className="text-sm text-destructive" role="alert" tabIndex={-1}>{error}</p> : null}
    </section>
  );
}
