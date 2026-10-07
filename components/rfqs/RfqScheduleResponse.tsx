"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { PublicRfqView } from "@/lib/rfqs/load";
import { saveRfqScheduleResponse, uploadRfqResponsePdf } from "@/lib/rfqs/public-actions";
import { scheduleExtended, scheduleRoleLabel, scheduleUnitLabel } from "@/lib/rfqs/schedule";

const fieldClass = "h-11 min-h-11 w-full rounded-md border border-border bg-white px-3 text-base";

type OpenView = Extract<PublicRfqView, { state: "open" }>;
type LineDraft = {
  decision: "priced" | "not_priced" | "unanswered";
  unitPrice: string;
  reason: string;
  qualification: string;
};

export function RfqScheduleResponse({
  view,
  revise,
  pending,
  onDone,
}: {
  view: OpenView;
  revise: boolean;
  pending: boolean;
  onDone: (error: string | null) => void;
}) {
  const draft = view.responses.find((response) => response.status === "draft");
  const source = draft ?? view.responses.filter((response) => response.status === "submitted").at(-1);
  const [lines, setLines] = useState<Record<string, LineDraft>>(() => {
    const next: Record<string, LineDraft> = {};
    for (const item of view.schedule) {
      const saved = source?.lines.find((line) => line.scheduleItemId === item.id);
      next[item.id] = {
        decision: saved?.decision === "priced" || saved?.decision === "not_priced" ? saved.decision : "unanswered",
        unitPrice: saved?.unitPriceExGst == null ? "" : String(saved.unitPriceExGst),
        reason: saved?.reason ?? "",
        qualification: saved?.qualification ?? "",
      };
    }
    return next;
  });
  const [gst, setGst] = useState(source?.gstTreatment ?? "unknown");
  const [included, setIncluded] = useState(source?.includedScope ?? "");
  const [excluded, setExcluded] = useState(source?.excludedScope ?? "");
  const [assumptions, setAssumptions] = useState(source?.assumptions ?? "");
  const [leadTime, setLeadTime] = useState(source?.leadTime ?? "");
  const [validUntil, setValidUntil] = useState(source?.validUntil ?? "");
  const [message, setMessage] = useState(source?.message ?? "");
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);

  function update(id: string, patch: Partial<LineDraft>) {
    setLines((current) => ({ ...current, [id]: { ...current[id], ...patch } }));
  }

  const review = view.schedule.map((item) => {
    const line = lines[item.id];
    const price = Number(line?.unitPrice);
    const amount = line?.decision === "priced" && Number.isFinite(price) ? scheduleExtended(item.unit, item.quantity, price) : null;
    return { item, line, amount };
  });
  const base = roundShown(review.filter((row) => row.item.role === "required" && row.amount != null).reduce((sum, row) => sum + (row.amount ?? 0), 0));
  const optional = roundShown(review.filter((row) => row.item.role === "optional" && row.amount != null).reduce((sum, row) => sum + (row.amount ?? 0), 0));
  const alternative = roundShown(review.filter((row) => row.item.role === "alternative" && row.amount != null).reduce((sum, row) => sum + (row.amount ?? 0), 0));
  const notPriced = review.filter((row) => row.item.role === "required" && row.line?.decision === "not_priced");
  const complete = review.filter((row) => row.item.role === "required").every((row) => row.line?.decision === "priced");
  const qualified = assumptions.trim().length > 0 || review.some((row) => row.line?.qualification.trim());

  async function submit(confirming: boolean) {
    setBusy(true);
    const payloadLines: Array<{
      scheduleItemId: string;
      decision: "priced" | "not_priced" | "excluded";
      unitPrice: string;
      reason: string;
      qualification: string;
    }> = [];
    for (const item of view.schedule) {
      const line = lines[item.id];
      if (!line || line.decision === "unanswered") {
        if (item.role !== "required") {
          payloadLines.push({ scheduleItemId: item.id, decision: "excluded", unitPrice: "", reason: "", qualification: line?.qualification ?? "" });
        }
        continue;
      }
      payloadLines.push({
        scheduleItemId: item.id,
        decision: line.decision,
        unitPrice: line.unitPrice,
        reason: line.reason,
        qualification: line.qualification,
      });
    }
    const saved = await saveRfqScheduleResponse({
      token: view.token,
      confirm: confirming,
      revise,
      requestSentAt: view.requestSentAt ?? "",
      gstTreatment: gst,
      includedScope: included,
      excludedScope: excluded,
      assumptions,
      leadTime,
      validUntil,
      message,
      lines: payloadLines,
    });
    setBusy(false);
    onDone(saved.error ?? null);
    return saved.responseId ?? null;
  }

  return (
    <div className="grid gap-4" data-rfq-schedule-response>
      <div className="grid gap-3">
        {view.schedule.map((item) => (
          <article key={item.id} className="grid gap-3 rounded-xl border border-border bg-white p-4 text-sm md:grid-cols-[minmax(0,1.4fr)_minmax(0,0.6fr)_minmax(0,1fr)]">
            <div className="min-w-0">
              <p className="font-medium break-words">{item.scope}</p>
              {item.specification ? <p className="break-words">{item.specification}</p> : null}
              <p className="text-foreground/70">{scheduleRoleLabel(item.role)}</p>
            </div>
            <p>{item.unit === "lump_sum" ? "Lump sum, one total" : `${item.quantity ?? ""} ${scheduleUnitLabel(item.unit)}`}</p>
            <PriceControls item={item} line={lines[item.id]} onChange={(patch) => update(item.id, patch)} />
          </article>
        ))}
      </div>

      <section className="grid gap-3 rounded-xl border border-border bg-white p-4">
        <h2 className="text-base font-semibold">Qualifications</h2>
        <label className="grid gap-1 text-sm">Inclusions
          <textarea className="min-h-20 w-full rounded-md border border-border px-3 py-2 text-base" value={included} onChange={(event) => setIncluded(event.target.value)} />
        </label>
        <label className="grid gap-1 text-sm">Exclusions
          <textarea className="min-h-20 w-full rounded-md border border-border px-3 py-2 text-base" value={excluded} onChange={(event) => setExcluded(event.target.value)} />
        </label>
        <label className="grid gap-1 text-sm">Assumptions
          <textarea className="min-h-20 w-full rounded-md border border-border px-3 py-2 text-base" value={assumptions} onChange={(event) => setAssumptions(event.target.value)} />
        </label>
        <label className="grid gap-1 text-sm">GST treatment
          <select className={fieldClass} value={gst} onChange={(event) => setGst(event.target.value)}>
            <option value="extra">GST will be added</option>
            <option value="none">No GST</option>
            <option value="unknown">Not stated</option>
          </select>
        </label>
        <label className="grid gap-1 text-sm">Availability
          <input className={fieldClass} value={leadTime} onChange={(event) => setLeadTime(event.target.value)} />
        </label>
        <label className="grid gap-1 text-sm">Valid until
          <input className={fieldClass} type="date" value={validUntil} onChange={(event) => setValidUntil(event.target.value)} />
        </label>
        <label className="grid gap-1 text-sm">Message
          <textarea className="min-h-20 w-full rounded-md border border-border px-3 py-2 text-base" value={message} onChange={(event) => setMessage(event.target.value)} />
        </label>
      </section>

      <section className="grid gap-2 rounded-xl border border-border bg-white p-4 text-sm" data-rfq-schedule-review>
        <h2 className="text-base font-semibold">Review before you submit</h2>
        <p>Status: {complete ? "Complete" : "Partial"}{qualified ? " · Qualified" : ""}</p>
        <p>Base total ex GST: {money(base)}. Optional items are excluded. Alternatives are excluded.</p>
        <p>Optional items ex GST: {money(optional)}</p>
        <p>Alternatives ex GST: {money(alternative)}</p>
        <p>Priced required items: {review.filter((row) => row.item.role === "required" && row.line?.decision === "priced").map((row) => row.item.scope).join(", ") || "None"}</p>
        <p>Not priced: {notPriced.map((row) => `${row.item.scope} (${row.line?.reason || "reason needed"})`).join(", ") || "None"}</p>
        {qualified ? <p>This response will be labelled Qualified.</p> : null}
      </section>

      <label className="flex min-h-11 items-center gap-2 text-sm">
        <input type="checkbox" checked={confirm} onChange={(event) => setConfirm(event.target.checked)} />
        I confirm this is my response for this schedule
      </label>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" className="h-11 min-h-11" disabled={pending || busy} onClick={() => void submit(false)}>Save draft</Button>
        <Button type="button" className="h-11 min-h-11" disabled={pending || busy || !confirm} onClick={() => void submit(true)}>Submit response</Button>
      </div>
      <PdfUpload token={view.token} responseId={draft?.id ?? null} onNeedDraft={() => submit(false)} />
    </div>
  );
}

function PriceControls({
  item,
  line,
  onChange,
}: {
  item: OpenView["schedule"][number];
  line: LineDraft;
  onChange: (patch: Partial<LineDraft>) => void;
}) {
  const pricedLabel = item.unit === "lump_sum" ? "Total ex GST" : "Unit price ex GST";
  return (
    <div className="grid gap-2">
      <label className="flex min-h-11 items-center gap-2">
        <input type="radio" name={`decision-${item.id}`} checked={line.decision === "priced"} onChange={() => onChange({ decision: "priced" })} />
        Price this item
      </label>
      {item.role === "required" ? (
        <label className="flex min-h-11 items-center gap-2">
          <input type="radio" name={`decision-${item.id}`} checked={line.decision === "not_priced"} onChange={() => onChange({ decision: "not_priced" })} />
          Not priced
        </label>
      ) : (
        <label className="flex min-h-11 items-center gap-2">
          <input type="radio" name={`decision-${item.id}`} checked={line.decision === "unanswered"} onChange={() => onChange({ decision: "unanswered" })} />
          Leave out of the total
        </label>
      )}
      {line.decision === "priced" ? (
        <label className="grid gap-1">
          {pricedLabel}
          <input className={fieldClass} inputMode="decimal" value={line.unitPrice} onChange={(event) => onChange({ unitPrice: event.target.value })} />
        </label>
      ) : null}
      {line.decision === "not_priced" ? (
        <label className="grid gap-1">
          Reason
          <input className={fieldClass} value={line.reason} onChange={(event) => onChange({ reason: event.target.value })} />
        </label>
      ) : null}
      <label className="grid gap-1">
        Item qualification
        <input className={fieldClass} value={line.qualification} onChange={(event) => onChange({ qualification: event.target.value })} />
      </label>
    </div>
  );
}

function PdfUpload({
  token,
  responseId,
  onNeedDraft,
}: {
  token: string;
  responseId: string | null;
  onNeedDraft: () => Promise<string | null>;
}) {
  const [error, setError] = useState<string | null>(null);
  return (
    <label className="grid gap-1 text-sm">
      Optional PDF quotation
      <input className="block min-h-11 w-full text-sm" type="file" accept="application/pdf,.pdf" onChange={async (event) => {
        const file = event.target.files?.[0];
        if (!file) return;
        const id = responseId ?? await onNeedDraft();
        if (!id) {
          setError("Save a draft before attaching the PDF.");
          return;
        }
        const body = new FormData();
        body.set("token", token);
        body.set("responseId", id);
        body.set("file", file);
        const result = await uploadRfqResponsePdf(body);
        setError(result.error ?? null);
      }} />
      {error ? <span className="text-red-700">{error}</span> : null}
    </label>
  );
}

function money(value: number): string {
  return value.toLocaleString("en-NZ", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function roundShown(value: number): number {
  return Math.round(value * 100) / 100;
}
