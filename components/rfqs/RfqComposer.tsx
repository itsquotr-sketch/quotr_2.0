"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { RFQ_WITHHELD } from "@/lib/rfqs/shared";
import { draftRfqFromJobDetails, saveRfqDraft, sendRfq } from "@/lib/rfqs/actions";
import { dueDateIsFuture, localToday, scopeIsMeaningful } from "@/lib/rfqs/validate";
import type { DraftSource } from "@/lib/rfqs/draft-compose";

type WorkArea = { id: string; type: string; name: string };
type Contact = { id: string; name: string; email: string };
type Business = {
  id: string;
  tradingName: string;
  workAreaTypes: string[];
  suggestedFor: string[];
  contacts: Contact[];
};
type DocumentChoice = { versionId: string; title: string; filename: string; visibility: string };
type FieldError = { id: string; message: string };

const fieldClass =
  "h-11 min-h-11 w-full rounded-md border border-border bg-card px-3 text-base text-foreground";
const STEPS = ["Scope and pricing format", "Recipients", "Site and files to share", "Review and send"] as const;

export function RfqComposer({
  projectId,
  rfqId = null,
  workAreas,
  subcontractors,
  documents,
  siteAddress,
  initial,
}: {
  projectId: string;
  rfqId?: string | null;
  workAreas: WorkArea[];
  subcontractors: Business[];
  documents: DocumentChoice[];
  siteAddress: string;
  initial?: {
    scopeKind: "work_area" | "written";
    workAreaId: string | null;
    scopeLabel: string;
    requestedScope: string;
    measurementNotes: string;
    responseDueOn: string | null;
    includeSiteAddress: boolean;
    siteDetails: string;
    questions: string;
    message: string;
    recipients: Array<{ subcontractorId: string; contactId: string; selectionSource: "suggested" | "manual" }>;
    documentVersionIds: string[];
  };
}) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [scopeKind, setScopeKind] = useState<"work_area" | "written">(initial?.scopeKind ?? "work_area");
  const [workAreaId, setWorkAreaId] = useState(initial?.workAreaId ?? workAreas[0]?.id ?? "");
  const [writtenLabel, setWrittenLabel] = useState(initial?.scopeKind === "written" ? initial.scopeLabel : "");
  const [requestedScope, setRequestedScope] = useState(initial?.requestedScope ?? "");
  const [measurementNotes, setMeasurementNotes] = useState(initial?.measurementNotes ?? "");
  const [responseDueOn, setResponseDueOn] = useState(initial?.responseDueOn ?? "");
  const [includeSiteAddress, setIncludeSiteAddress] = useState(initial?.includeSiteAddress ?? false);
  const [siteDetails, setSiteDetails] = useState(initial?.siteDetails ?? "");
  const [questions, setQuestions] = useState(initial?.questions ?? "");
  const [message, setMessage] = useState(initial?.message ?? "");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Record<string, { contactId: string; source: "suggested" | "manual" }>>(() => {
    const next: Record<string, { contactId: string; source: "suggested" | "manual" }> = {};
    for (const recipient of initial?.recipients ?? []) {
      next[recipient.subcontractorId] = { contactId: recipient.contactId, source: recipient.selectionSource };
    }
    return next;
  });
  const [files, setFiles] = useState<string[]>(initial?.documentVersionIds ?? []);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldError[]>([]);
  const [pending, setPending] = useState<"save" | "send" | "draft" | null>(null);
  const [sources, setSources] = useState<DraftSource[]>([]);
  const [draftNote, setDraftNote] = useState<string | null>(null);
  const edited = useRef({ scope: Boolean(initial?.requestedScope), notes: Boolean(initial?.measurementNotes) });
  const draftGeneration = useRef(0);
  const summaryRef = useRef<HTMLDivElement>(null);
  const area = workAreas.find((item) => item.id === workAreaId) ?? null;
  const scopeLabel = scopeKind === "work_area" ? area?.name || "Work area" : writtenLabel.trim() || "Written scope";
  const suggested = subcontractors.filter((business) => area && business.suggestedFor.includes(area.type));
  const manual = subcontractors.filter((business) => {
    const needle = search.trim().toLowerCase();
    if (!needle) return true;
    return business.tradingName.toLowerCase().includes(needle);
  });
  const chosen = Object.entries(selected).map(([id, value]) => {
    const business = subcontractors.find((item) => item.id === id);
    return { business, value };
  }).filter((item) => item.business);
  const mismatches = chosen.filter((item) => item.value.source === "manual" && area && !item.business!.workAreaTypes.includes(area.type) && !item.business!.suggestedFor.includes(area.type));

  function payload() {
    return {
      id: rfqId,
      projectId,
      scopeKind,
      workAreaId: scopeKind === "work_area" ? workAreaId : null,
      writtenScopeLabel: scopeKind === "written" ? writtenLabel : null,
      requestedScope,
      measurementNotes,
      responseDueOn: responseDueOn || null,
      includeSiteAddress,
      siteDetails,
      questions,
      message,
      recipients: Object.entries(selected).map(([subcontractorId, value]) => ({
        subcontractorId,
        contactId: value.contactId,
        selectionSource: value.source,
      })),
      documentVersionIds: files,
    };
  }

  function sendProblems(): FieldError[] {
    const problems: FieldError[] = [];
    if (scopeKind === "work_area" && !workAreaId) problems.push({ id: "work-area", message: "Choose a Work Area." });
    if (scopeKind === "written" && writtenLabel.trim().length < 2) problems.push({ id: "scope-name", message: "Name the written scope." });
    if (!scopeIsMeaningful(requestedScope)) problems.push({ id: "requested-scope", message: "Write the work you want priced. A placeholder such as “as” is not enough." });
    if (!dueDateIsFuture(responseDueOn, localToday())) problems.push({ id: "response-due", message: "Choose a due date after today, or leave it blank." });
    const recipients = Object.values(selected);
    if (recipients.length === 0) problems.push({ id: "recipients", message: "Choose at least one business with an email contact." });
    if (recipients.some((recipient) => !recipient.contactId)) problems.push({ id: "recipients", message: "Each recipient needs an email contact." });
    return problems;
  }

  function showProblems(problems: FieldError[]) {
    setFieldErrors(problems);
    setError(problems.map((problem) => problem.message).join(" "));
  }

  useEffect(() => {
    if (!error) return;
    summaryRef.current?.focus();
    const id = fieldErrors[0]?.id;
    if (id) document.getElementById(id)?.scrollIntoView({ block: "center" });
  }, [error, fieldErrors, step]);

  async function onSave() {
    setPending("save");
    setError(null);
    setFieldErrors([]);
    const result = await saveRfqDraft(payload());
    setPending(null);
    if (!result.ok) {
      setError(result.error);
      summaryRef.current?.focus();
      return;
    }
    router.push(`/app/projects/${projectId}/requests/${result.id}`);
    router.refresh();
  }

  async function onSend() {
    const problems = sendProblems();
    if (problems.length > 0) {
      if (problems.some((problem) => problem.id === "requested-scope" || problem.id === "work-area" || problem.id === "scope-name" || problem.id === "response-due")) setStep(0);
      else if (problems.some((problem) => problem.id === "recipients")) setStep(1);
      showProblems(problems);
      return;
    }
    setPending("send");
    setError(null);
    setFieldErrors([]);
    const result = await sendRfq(payload());
    setPending(null);
    if (!result.ok) {
      setError(result.error);
      summaryRef.current?.focus();
      return;
    }
    router.push(`/app/projects/${projectId}/requests/${result.id}`);
    router.refresh();
  }

  async function draftFromJob() {
    if (!workAreaId) return;
    const generation = draftGeneration.current + 1;
    draftGeneration.current = generation;
    setPending("draft");
    setDraftNote(null);
    const result = await draftRfqFromJobDetails({ projectId, workAreaId });
    if (generation !== draftGeneration.current) return;
    setPending(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    const kept: string[] = [];
    if (!edited.current.scope) setRequestedScope(result.requestedScope);
    else kept.push("requested scope");
    if (!edited.current.notes) setMeasurementNotes(result.measurementNotes);
    else kept.push("measurements");
    setSources(result.sources);
    const missing = result.missing.join(" ");
    const keptNote = kept.length > 0 ? `Your ${kept.join(" and ")} stayed as you wrote it.` : "";
    const aiNote = result.aiUsed ? "The facts were ordered with help." : "The draft uses the recorded facts directly.";
    setDraftNote([aiNote, missing, keptNote].filter(Boolean).join(" "));
  }

  function toggleBusiness(business: Business, source: "suggested" | "manual") {
    setSelected((current) => {
      const next = { ...current };
      if (next[business.id]) delete next[business.id];
      else if (business.contacts[0]) next[business.id] = { contactId: business.contacts[0].id, source };
      return next;
    });
  }

  function messageFor(id: string) {
    return fieldErrors.find((problem) => problem.id === id)?.message;
  }

  return (
    <div className="grid gap-6 pb-28 md:pb-0" data-rfq-composer data-rfq-step={STEPS[step]}>
      <ol className="flex flex-wrap gap-2 text-sm">
        {STEPS.map((label, index) => (
          <li key={label} className={index === step ? "font-semibold" : "text-foreground/60"}>{index + 1}. {label}</li>
        ))}
      </ol>
      <div ref={summaryRef} tabIndex={-1} role={error ? "alert" : undefined} className="outline-none">
        {error ? <p className="text-sm text-red-700">{error}</p> : null}
      </div>

      {step === 0 ? (
        <section className="grid gap-3 rounded-xl border border-border bg-card p-4">
          <h2 className="text-base font-semibold">Scope and pricing format</h2>
          <p className="text-sm text-foreground/70">This phase asks for one lump-sum price. The subcontractor can still describe what is included.</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="grid gap-1 text-sm">
              Source
              <select className={fieldClass} value={scopeKind} onChange={(event) => setScopeKind(event.target.value as "work_area" | "written")}>
                <option value="work_area">Project Work Area</option>
                <option value="written">Written subcontract scope</option>
              </select>
            </label>
            {scopeKind === "work_area" ? (
              <label className="grid gap-1 text-sm" id="work-area">
                Work Area
                <select className={fieldClass} value={workAreaId} onChange={(event) => setWorkAreaId(event.target.value)}>
                  {workAreas.map((item) => (
                    <option key={item.id} value={item.id}>{item.name}</option>
                  ))}
                </select>
                {messageFor("work-area") ? <span className="text-red-700">{messageFor("work-area")}</span> : null}
              </label>
            ) : (
              <label className="grid gap-1 text-sm" id="scope-name">
                Scope name
                <input className={fieldClass} value={writtenLabel} onChange={(event) => setWrittenLabel(event.target.value)} maxLength={160} />
                {messageFor("scope-name") ? <span className="text-red-700">{messageFor("scope-name")}</span> : null}
              </label>
            )}
          </div>
          {scopeKind === "work_area" ? (
            <Button type="button" variant="outline" className="h-11 min-h-11 w-fit" disabled={pending != null || !workAreaId} onClick={() => void draftFromJob()}>
              {pending === "draft" ? "Drafting" : "Draft from job details"}
            </Button>
          ) : null}
          {draftNote ? <p className="text-sm text-foreground/70" data-rfq-draft-note>{draftNote}</p> : null}
          <label className="grid gap-1 text-sm" id="requested-scope">
            Requested scope
            <textarea className="min-h-28 w-full rounded-md border border-border bg-card px-3 py-2 text-base" value={requestedScope} onChange={(event) => { edited.current.scope = true; setRequestedScope(event.target.value); }} />
            {messageFor("requested-scope") ? <span className="text-red-700">{messageFor("requested-scope")}</span> : null}
          </label>
          <SourceList sources={sources.filter((source) => source.field === "scope")} />
          <label className="grid gap-1 text-sm">
            Quantities or measurement notes
            <textarea className="min-h-20 w-full rounded-md border border-border bg-card px-3 py-2 text-base" value={measurementNotes} onChange={(event) => { edited.current.notes = true; setMeasurementNotes(event.target.value); }} />
          </label>
          <SourceList sources={sources.filter((source) => source.field === "measurements")} />
          <label className="grid gap-1 text-sm sm:max-w-xs" id="response-due">
            Response due
            <input className={fieldClass} type="date" value={responseDueOn} onChange={(event) => setResponseDueOn(event.target.value)} />
            {messageFor("response-due") ? <span className="text-red-700">{messageFor("response-due")}</span> : null}
          </label>
        </section>
      ) : null}

      {step === 1 ? (
        <section className="grid gap-3 rounded-xl border border-border bg-card p-4" id="recipients">
          <h2 className="text-base font-semibold">Recipients</h2>
          <p className="text-sm text-foreground/70">Suggested businesses match the Work Area tags. You can also choose someone else. Each business needs one email contact.</p>
          {messageFor("recipients") ? <p className="text-sm text-red-700">{messageFor("recipients")}</p> : null}
          {mismatches.length > 0 ? (
            <p className="text-sm text-amber-800" data-capability-warning>
              {mismatches.map((item) => item.business!.tradingName).join(", ")} {mismatches.length === 1 ? "does" : "do"} not list this Work Area. You can still send the request.
            </p>
          ) : null}
          {scopeKind === "work_area" ? (
            <ul className="grid gap-2">
              {suggested.map((business) => (
                <BusinessRow key={business.id} business={business} reason={`Suggested because this business lists ${area?.name ?? "this work"}`} selected={selected[business.id]} onToggle={() => toggleBusiness(business, "suggested")} onContact={(contactId) => setSelected((current) => ({ ...current, [business.id]: { contactId, source: "suggested" } }))} />
              ))}
              {suggested.length === 0 ? <li className="text-sm text-foreground/70">No suggested businesses for this Work Area.</li> : null}
            </ul>
          ) : null}
          <label className="grid gap-1 text-sm">
            Find a business
            <input className={fieldClass} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by name" />
          </label>
          <ul className="grid max-h-80 gap-2 overflow-y-auto">
            {manual.map((business) => (
              <BusinessRow key={business.id} business={business} reason={null} selected={selected[business.id]} onToggle={() => toggleBusiness(business, area && business.suggestedFor.includes(area.type) ? "suggested" : "manual")} onContact={(contactId) => setSelected((current) => ({ ...current, [business.id]: { contactId, source: current[business.id]?.source ?? "manual" } }))} />
            ))}
          </ul>
        </section>
      ) : null}

      {step === 2 ? (
        <section className="grid gap-3 rounded-xl border border-border bg-card p-4">
          <h2 className="text-base font-semibold">Site and files to share</h2>
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input type="checkbox" checked={includeSiteAddress} onChange={(event) => setIncludeSiteAddress(event.target.checked)} />
            Include the site address{siteAddress ? `: ${siteAddress}` : ""}
          </label>
          <label className="grid gap-1 text-sm">
            Site details to share
            <textarea className="min-h-20 w-full rounded-md border border-border bg-card px-3 py-2 text-base" value={siteDetails} onChange={(event) => setSiteDetails(event.target.value)} />
          </label>
          <label className="grid gap-1 text-sm">
            Questions
            <textarea className="min-h-20 w-full rounded-md border border-border bg-card px-3 py-2 text-base" value={questions} onChange={(event) => setQuestions(event.target.value)} />
          </label>
          <label className="grid gap-1 text-sm">
            Message
            <textarea className="min-h-20 w-full rounded-md border border-border bg-card px-3 py-2 text-base" value={message} onChange={(event) => setMessage(event.target.value)} />
          </label>
          <fieldset className="grid gap-2">
            <legend className="text-sm font-medium">Project files</legend>
            <p className="text-sm text-foreground/70">Nothing is shared until you select it. A later file change will not replace this version after send.</p>
            {documents.map((document) => (
              <label key={document.versionId} className="flex min-h-11 items-start gap-2 text-sm">
                <input type="checkbox" className="mt-1" checked={files.includes(document.versionId)} onChange={(event) => setFiles((current) => event.target.checked ? [...current, document.versionId] : current.filter((id) => id !== document.versionId))} />
                <span>{document.title} · {document.filename} · {document.visibility === "internal" ? "Internal" : "Shareable"}</span>
              </label>
            ))}
            {documents.length === 0 ? <p className="text-sm text-foreground/70">This project has no ready files.</p> : null}
          </fieldset>
        </section>
      ) : null}

      {step === 3 ? (
        <section className="grid gap-3 rounded-xl border border-border bg-card p-4" data-rfq-review>
          <h2 className="text-base font-semibold">Review and send</h2>
          <p className="text-sm text-foreground/70">This is the request the recipient will open. Sending does not award the work.</p>
          <article className="grid gap-2 rounded-md border border-border p-4 text-sm">
            <p className="text-foreground/70">Request for price</p>
            <h3 className="text-lg font-semibold">{scopeLabel}</h3>
            <p>Lump sum</p>
            <p className="whitespace-pre-wrap">{requestedScope.trim() || "Not written yet"}</p>
            <p className="whitespace-pre-wrap">Measurements: {measurementNotes.trim() || "None recorded"}</p>
            <p>Due: {responseDueOn || "Not set"}</p>
            <p>Site address: {includeSiteAddress ? siteAddress || "None on the project" : "Not included"}</p>
            {siteDetails.trim() ? <p className="whitespace-pre-wrap">{siteDetails.trim()}</p> : null}
            {questions.trim() ? <p className="whitespace-pre-wrap">Questions: {questions.trim()}</p> : null}
            {message.trim() ? <p className="whitespace-pre-wrap">{message.trim()}</p> : null}
            <p>Files: {files.length === 0 ? "None" : documents.filter((document) => files.includes(document.versionId)).map((document) => document.filename).join(", ")}</p>
            <p>Recipients: {chosen.map((item) => item.business!.tradingName).join(", ") || "None"}</p>
          </article>
          <p className="text-sm text-foreground/70">Not included: {RFQ_WITHHELD.join(", ")}.</p>
        </section>
      ) : null}

      <div className="flex flex-wrap gap-2" data-dialog-actions>
        {step > 0 ? (
          <Button type="button" variant="outline" className="h-11 min-h-11" onClick={() => setStep((current) => current - 1)}>Back</Button>
        ) : null}
        {step < 3 ? (
          <Button type="button" className="h-11 min-h-11" onClick={() => setStep((current) => current + 1)}>Continue</Button>
        ) : (
          <Button type="button" className="h-11 min-h-11" disabled={pending != null} onClick={() => void onSend()}>
            {pending === "send" ? "Sending" : "Send request"}
          </Button>
        )}
        <Button type="button" variant="outline" className="h-11 min-h-11" disabled={pending != null} onClick={() => void onSave()}>
          {pending === "save" ? "Saving" : "Save draft"}
        </Button>
        <Button type="button" variant="outline" className="h-11 min-h-11" render={<Link href={`/app/projects/${projectId}/requests`} />}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

function SourceList({ sources }: { sources: DraftSource[] }) {
  if (sources.length === 0) return null;
  return (
    <ul className="grid gap-1 text-xs text-foreground/70" data-rfq-draft-sources>
      {sources.map((source) => (
        <li key={`${source.source}-${source.text.slice(0, 24)}`}>{source.source}{source.uncertain ? " · check this" : ""}: {source.text}</li>
      ))}
    </ul>
  );
}

function BusinessRow({
  business,
  reason,
  selected,
  onToggle,
  onContact,
}: {
  business: Business;
  reason: string | null;
  selected: { contactId: string; source: "suggested" | "manual" } | undefined;
  onToggle: () => void;
  onContact: (contactId: string) => void;
}) {
  return (
    <li className="rounded-md border border-border p-3">
      <label className="flex min-h-11 items-start gap-2 text-sm">
        <input type="checkbox" className="mt-1" checked={Boolean(selected)} disabled={business.contacts.length === 0} onChange={onToggle} />
        <span>
          <span className="font-medium">{business.tradingName}</span>
          {reason ? <span className="block text-foreground/70">{reason}</span> : null}
          {business.contacts.length === 0 ? <span className="block text-foreground/70">Add an email contact on the business profile first.</span> : null}
        </span>
      </label>
      {selected && business.contacts.length > 0 ? (
        <label className="mt-2 grid gap-1 text-sm">
          Email contact
          <select className={fieldClass} value={selected.contactId} onChange={(event) => onContact(event.target.value)}>
            {business.contacts.map((contact) => (
              <option key={contact.id} value={contact.id}>{contact.name} · {contact.email}</option>
            ))}
          </select>
        </label>
      ) : null}
    </li>
  );
}
