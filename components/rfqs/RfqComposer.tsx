"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { RFQ_WITHHELD } from "@/lib/rfqs/shared";
import { saveRfqDraft, sendRfq } from "@/lib/rfqs/actions";

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

const fieldClass =
  "h-11 min-h-11 w-full rounded-md border border-border bg-card px-3 text-base text-foreground";

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
  const [pending, setPending] = useState<"save" | "send" | null>(null);

  const area = workAreas.find((item) => item.id === workAreaId) ?? null;
  const scopeLabel = scopeKind === "work_area" ? area?.name || "Work area" : writtenLabel.trim() || "Written scope";
  const suggested = useMemo(
    () => subcontractors.filter((business) => area && business.suggestedFor.includes(area.type)),
    [area, subcontractors]
  );
  const manual = subcontractors.filter((business) => {
    const needle = search.trim().toLowerCase();
    if (!needle) return true;
    return business.tradingName.toLowerCase().includes(needle);
  });

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

  async function onSave() {
    setPending("save");
    setError(null);
    const result = await saveRfqDraft(payload());
    setPending(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.push(`/app/projects/${projectId}/requests/${result.id}`);
    router.refresh();
  }

  async function onSend() {
    setPending("send");
    setError(null);
    const result = await sendRfq(payload());
    setPending(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.push(`/app/projects/${projectId}/requests/${result.id}`);
    router.refresh();
  }

  function toggleBusiness(business: Business, source: "suggested" | "manual") {
    setSelected((current) => {
      const next = { ...current };
      if (next[business.id]) delete next[business.id];
      else if (business.contacts[0]) next[business.id] = { contactId: business.contacts[0].id, source };
      return next;
    });
  }

  return (
    <div className="grid gap-6" data-rfq-composer>
      <section className="grid gap-3 rounded-xl border border-border bg-card p-4">
        <h2 className="text-base font-semibold">Scope</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="grid gap-1 text-sm">
            Source
            <select className={fieldClass} value={scopeKind} onChange={(event) => setScopeKind(event.target.value as "work_area" | "written")}>
              <option value="work_area">Project Work Area</option>
              <option value="written">Written subcontract scope</option>
            </select>
          </label>
          {scopeKind === "work_area" ? (
            <label className="grid gap-1 text-sm">
              Work Area
              <select className={fieldClass} value={workAreaId} onChange={(event) => setWorkAreaId(event.target.value)}>
                {workAreas.map((item) => (
                  <option key={item.id} value={item.id}>{item.name}</option>
                ))}
              </select>
            </label>
          ) : (
            <label className="grid gap-1 text-sm">
              Scope name
              <input className={fieldClass} value={writtenLabel} onChange={(event) => setWrittenLabel(event.target.value)} maxLength={160} />
            </label>
          )}
        </div>
        <label className="grid gap-1 text-sm">
          Requested scope
          <textarea className="min-h-28 w-full rounded-md border border-border bg-card px-3 py-2 text-base" value={requestedScope} onChange={(event) => setRequestedScope(event.target.value)} />
        </label>
        <label className="grid gap-1 text-sm">
          Quantities or measurement notes
          <textarea className="min-h-20 w-full rounded-md border border-border bg-card px-3 py-2 text-base" value={measurementNotes} onChange={(event) => setMeasurementNotes(event.target.value)} />
        </label>
        <label className="grid gap-1 text-sm sm:max-w-xs">
          Response due
          <input className={fieldClass} type="date" value={responseDueOn} onChange={(event) => setResponseDueOn(event.target.value)} />
        </label>
      </section>

      <section className="grid gap-3 rounded-xl border border-border bg-card p-4">
        <h2 className="text-base font-semibold">Recipients</h2>
        <p className="text-sm text-foreground/70">Suggested businesses match the Work Area tags. You can also choose someone else. Each business needs one email contact.</p>
        {scopeKind === "work_area" ? (
          <ul className="grid gap-2">
            {suggested.map((business) => (
              <BusinessRow
                key={business.id}
                business={business}
                reason={`Suggested because this business lists ${area?.name ?? "this work"}`}
                selected={selected[business.id]}
                onToggle={() => toggleBusiness(business, "suggested")}
                onContact={(contactId) => setSelected((current) => ({ ...current, [business.id]: { contactId, source: "suggested" } }))}
              />
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
            <BusinessRow
              key={business.id}
              business={business}
              reason={null}
              selected={selected[business.id]}
              onToggle={() => toggleBusiness(business, area && business.suggestedFor.includes(area.type) ? "suggested" : "manual")}
              onContact={(contactId) => setSelected((current) => ({ ...current, [business.id]: { contactId, source: current[business.id]?.source ?? "manual" } }))}
            />
          ))}
        </ul>
      </section>

      <section className="grid gap-3 rounded-xl border border-border bg-card p-4">
        <h2 className="text-base font-semibold">What to share</h2>
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
              <input
                type="checkbox"
                className="mt-1"
                checked={files.includes(document.versionId)}
                onChange={(event) => setFiles((current) => event.target.checked ? [...current, document.versionId] : current.filter((id) => id !== document.versionId))}
              />
              <span>{document.title} · {document.filename} · {document.visibility === "internal" ? "Internal" : "Shareable"}</span>
            </label>
          ))}
          {documents.length === 0 ? <p className="text-sm text-foreground/70">This project has no ready files.</p> : null}
        </fieldset>
      </section>

      <section className="grid gap-2 rounded-xl border border-border bg-card p-4" data-rfq-review>
        <h2 className="text-base font-semibold">What each recipient will see</h2>
        <ul className="grid gap-1 text-sm">
          <li>Scope: {scopeLabel}</li>
          <li>Requested scope: {requestedScope.trim() || "Not written yet"}</li>
          <li>Measurements: {measurementNotes.trim() || "None"}</li>
          <li>Due: {responseDueOn || "Not set"}</li>
          <li>Site address: {includeSiteAddress ? siteAddress || "None on the project" : "Not included"}</li>
          <li>Site details: {siteDetails.trim() || "None"}</li>
          <li>Questions: {questions.trim() || "None"}</li>
          <li>Message: {message.trim() || "None"}</li>
          <li>Files: {files.length === 0 ? "None" : `${files.length} selected`}</li>
        </ul>
        <p className="text-sm text-foreground/70">Not included: {RFQ_WITHHELD.join(", ")}.</p>
      </section>

      {error ? <p className="text-sm text-red-700" role="alert">{error}</p> : null}
      <div className="flex flex-wrap gap-2">
        <Button type="button" className="h-11 min-h-11" disabled={pending != null} onClick={onSave}>
          {pending === "save" ? "Saving" : "Save draft"}
        </Button>
        <Button type="button" className="h-11 min-h-11" disabled={pending != null} onClick={onSend}>
          {pending === "send" ? "Sending" : "Send request"}
        </Button>
        <Button type="button" variant="outline" className="h-11 min-h-11" render={<Link href={`/app/projects/${projectId}/requests`} />}>
          Cancel
        </Button>
      </div>
    </div>
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
