"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import type { PublicRfqView } from "@/lib/rfqs/load";
import { clarifyRfq, declineRfq, saveRfqResponse, uploadRfqResponsePdf } from "@/lib/rfqs/public-actions";
import { gstTreatmentLabel, pricingStructureLabel } from "@/lib/rfqs/shared";

const fieldClass =
  "h-11 min-h-11 w-full rounded-md border border-border bg-white px-3 text-base";

export function RfqPublicExperience({ view }: { view: PublicRfqView }) {
  if (view.state === "expired") {
    return <Shell><p>This link has expired.</p></Shell>;
  }
  if (view.state === "limited") {
    return <Shell><p>Too many attempts. Wait a few minutes and try again.</p></Shell>;
  }
  if (view.state !== "open") {
    return <Shell><p>This request is unavailable.</p></Shell>;
  }
  return <Open view={view} />;
}

function Open({ view }: { view: Extract<PublicRfqView, { state: "open" }> }) {
  const router = useRouter();
  const draft = view.responses.find((response) => response.status === "draft");
  const submitted = view.responses.filter((response) => response.status === "submitted");
  const latest = submitted[submitted.length - 1];
  const [price, setPrice] = useState(draft?.priceExGst?.toString() ?? "");
  const [gst, setGst] = useState(draft?.gstTreatment ?? "unknown");
  const [structure, setStructure] = useState(draft?.pricingStructure ?? "lump_sum");
  const [included, setIncluded] = useState(draft?.includedScope ?? "");
  const [excluded, setExcluded] = useState(draft?.excludedScope ?? "");
  const [assumptions, setAssumptions] = useState(draft?.assumptions ?? "");
  const [leadTime, setLeadTime] = useState(draft?.leadTime ?? "");
  const [validUntil, setValidUntil] = useState(draft?.validUntil ?? "");
  const [message, setMessage] = useState(draft?.message ?? "");
  const [question, setQuestion] = useState("");
  const [declineMessage, setDeclineMessage] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [revise, setRevise] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const locked = view.responseState === "declined" || view.responseState === "expired";

  async function run(action: () => Promise<{ error?: string }>) {
    setPending(true);
    setError(null);
    const result = await action();
    setPending(false);
    if (result.error) setError(result.error);
    else router.refresh();
  }

  return (
    <Shell>
      <div className="grid gap-6" data-rfq-public>
        <header className="grid gap-1">
          <p className="text-sm text-foreground/70">{view.builderName || "Builder"}</p>
          <h1 className="break-words text-2xl font-semibold">{view.scopeLabel || "Request for price"}</h1>
          <p className="text-sm">This request is only for you. It does not show other subcontractors or their prices.</p>
        </header>
        <section className="grid gap-2 text-sm">
          <p>{view.requestedScope}</p>
          {view.measurementNotes ? <p>Measurements: {view.measurementNotes}</p> : null}
          {view.responseDueOn ? <p>Please respond by {view.responseDueOn}.</p> : null}
          {view.siteAddress ? <p>Site: {view.siteAddress}</p> : null}
          {view.siteDetails ? <p>{view.siteDetails}</p> : null}
          {view.questions ? <p>Questions: {view.questions}</p> : null}
          {view.message ? <p>{view.message}</p> : null}
          <ul className="grid gap-1">
            {view.files.map((file) => (
              <li key={file.id}>
                <a className="underline" href={`/r/${view.token}/files/${file.id}`}>{file.title || file.filename}</a>
              </li>
            ))}
          </ul>
        </section>

        {submitted.map((response) => (
          <section key={response.id} className="rounded-xl border border-border bg-white p-4 text-sm">
            <h2 className="font-semibold">Submitted version {response.versionNumber}</h2>
            <p>{response.priceExGst?.toLocaleString()} ex GST · {gstTreatmentLabel(response.gstTreatment)} · {pricingStructureLabel(response.pricingStructure)}</p>
            {response.excludedScope ? <p>Excluded: {response.excludedScope}</p> : null}
            {response.fileReady ? (
              <a className="underline" href={`/r/${view.token}/responses/${response.id}/file`}>{response.fileName || "PDF"}</a>
            ) : null}
          </section>
        ))}

        {view.clarifications.map((note) => (
          <p key={note.id} className="rounded-md border border-border bg-white p-3 text-sm">{note.body}</p>
        ))}

        {!locked ? (
          <form className="grid gap-3" onSubmit={(event) => event.preventDefault()}>
            <h2 className="text-base font-semibold">{latest && revise ? "Revised response" : latest ? "Your response is submitted" : "Your response"}</h2>
            {latest && !revise ? (
              <Button type="button" className="h-11 min-h-11 w-fit" onClick={() => setRevise(true)}>Revise response</Button>
            ) : (
              <>
                <label className="grid gap-1 text-sm">Price ex GST
                  <input className={fieldClass} inputMode="decimal" value={price} onChange={(event) => setPrice(event.target.value)} />
                </label>
                <label className="grid gap-1 text-sm">GST treatment
                  <select className={fieldClass} value={gst} onChange={(event) => setGst(event.target.value)}>
                    <option value="extra">GST will be added</option>
                    <option value="none">No GST</option>
                    <option value="unknown">Not stated</option>
                  </select>
                </label>
                <label className="grid gap-1 text-sm">Structure
                  <select className={fieldClass} value={structure} onChange={(event) => setStructure(event.target.value)}>
                    <option value="lump_sum">Lump sum</option>
                    <option value="itemised">Itemised</option>
                  </select>
                </label>
                <label className="grid gap-1 text-sm">Included
                  <textarea className="min-h-20 w-full rounded-md border border-border px-3 py-2 text-base" value={included} onChange={(event) => setIncluded(event.target.value)} />
                </label>
                <label className="grid gap-1 text-sm">Excluded
                  <textarea className="min-h-20 w-full rounded-md border border-border px-3 py-2 text-base" value={excluded} onChange={(event) => setExcluded(event.target.value)} />
                </label>
                <label className="grid gap-1 text-sm">Assumptions
                  <textarea className="min-h-20 w-full rounded-md border border-border px-3 py-2 text-base" value={assumptions} onChange={(event) => setAssumptions(event.target.value)} />
                </label>
                <label className="grid gap-1 text-sm">Lead time or availability
                  <input className={fieldClass} value={leadTime} onChange={(event) => setLeadTime(event.target.value)} />
                </label>
                <label className="grid gap-1 text-sm">Valid until
                  <input className={fieldClass} type="date" value={validUntil} onChange={(event) => setValidUntil(event.target.value)} />
                </label>
                <label className="grid gap-1 text-sm">Message
                  <textarea className="min-h-20 w-full rounded-md border border-border px-3 py-2 text-base" value={message} onChange={(event) => setMessage(event.target.value)} />
                </label>
                <p className="text-sm text-foreground/70">This price is not applied to the job and does not change the builder&apos;s Quote GST.</p>
                <label className="flex min-h-11 items-center gap-2 text-sm">
                  <input type="checkbox" checked={confirm} onChange={(event) => setConfirm(event.target.checked)} />
                  I confirm this is my final response for this version
                </label>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" className="h-11 min-h-11" disabled={pending} onClick={() => run(() => saveRfqResponse({
                    token: view.token, confirm: false, revise, priceExGst: price, gstTreatment: gst, pricingStructure: structure,
                    includedScope: included, excludedScope: excluded, assumptions, leadTime, validUntil, message,
                  }))}>Save draft</Button>
                  <Button type="button" className="h-11 min-h-11" disabled={pending || !confirm} onClick={() => run(async () => {
                    const saved = await saveRfqResponse({
                      token: view.token, confirm: true, revise, priceExGst: price, gstTreatment: gst, pricingStructure: structure,
                      includedScope: included, excludedScope: excluded, assumptions, leadTime, validUntil, message,
                    });
                    return saved;
                  })}>Submit response</Button>
                </div>
                <PdfUpload token={view.token} responseId={draft?.id ?? null} onNeedDraft={async () => {
                  const saved = await saveRfqResponse({
                    token: view.token, confirm: false, revise, priceExGst: price, gstTreatment: gst, pricingStructure: structure,
                    includedScope: included, excludedScope: excluded, assumptions, leadTime, validUntil, message,
                  });
                  return saved.responseId ?? null;
                }} />
              </>
            )}
          </form>
        ) : null}

        {!locked && view.responseState !== "responded" ? (
          <section className="grid gap-2">
            <h2 className="text-base font-semibold">Ask a question</h2>
            <textarea className="min-h-20 w-full rounded-md border border-border px-3 py-2 text-base" value={question} onChange={(event) => setQuestion(event.target.value)} />
            <Button type="button" variant="outline" className="h-11 min-h-11 w-fit" disabled={pending} onClick={() => run(() => clarifyRfq({ token: view.token, body: question }))}>Send question</Button>
            <h2 className="text-base font-semibold">Decline to quote</h2>
            <textarea className="min-h-20 w-full rounded-md border border-border px-3 py-2 text-base" value={declineMessage} onChange={(event) => setDeclineMessage(event.target.value)} />
            <Button type="button" variant="outline" className="h-11 min-h-11 w-fit" disabled={pending} onClick={() => run(() => declineRfq({ token: view.token, message: declineMessage }))}>Decline to quote</Button>
          </section>
        ) : null}
        {error ? <p className="text-sm text-red-700" role="alert">{error}</p> : null}
      </div>
    </Shell>
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
      <input
        className="block w-full text-sm"
        type="file"
        accept="application/pdf,.pdf"
        onChange={async (event) => {
          const file = event.target.files?.[0];
          if (!file) return;
          setError(null);
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
          if (result.error) setError(result.error);
        }}
      />
      {error ? <span className="text-red-700">{error}</span> : null}
    </label>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <main className="mx-auto grid w-full max-w-3xl gap-4 px-4 py-8">{children}</main>;
}
