"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import type { RfqDetail } from "@/lib/rfqs/load";
import { gstTreatmentLabel, pricingStructureLabel } from "@/lib/rfqs/shared";
import { rfqDeliveryFailed, rfqDeliveryLabel, rfqResponseLabel } from "@/lib/rfqs/states";
import { answerRfqQuestion, resendRfqRecipient, revokeRfqRecipient, signRfqResponseFile } from "@/lib/rfqs/actions";
import { sharedAnswerLeak } from "@/lib/rfqs/draft-privacy";
import type { RfqPricingTarget } from "@/lib/rfqs/load";
import { RfqPricingApply } from "@/components/rfqs/RfqPricingApply";
import { RfqScheduleCompare } from "@/components/rfqs/RfqScheduleCompare";
import { scheduleRoleLabel, scheduleUnitLabel } from "@/lib/rfqs/schedule";
import { SaveResponseAsRate } from "@/components/rfqs/SaveResponseAsRate";

export function RfqDetailView({
  detail,
  canEdit,
  canPrice,
  pricing,
}: {
  detail: RfqDetail;
  canEdit: boolean;
  canPrice: boolean;
  pricing: RfqPricingTarget | null;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const submitted = detail.responses.filter((response) => response.status === "submitted");
  const diagnostics = detail.events.filter((event) => event.kind.includes("delivery") || event.kind.includes("email") || event.kind === "link_prepared" || event.summary.startsWith("Mail service"));
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("question");
    const hash = window.location.hash.replace(/^#/, "");
    const target = (id ? `question-${id}` : hash);
    if (!target) return;
    const matches = [
      document.getElementById(target),
      ...document.querySelectorAll(`[data-rfq-anchor~="${CSS.escape(target)}"]`),
    ].filter((node): node is HTMLElement => node instanceof HTMLElement);
    const visible = matches.find((node) => node.getClientRects().length > 0) ?? matches[0];
    visible?.scrollIntoView({ block: "center" });
  }, []);

  async function resend(recipientId: string) {
    setError(null);
    const result = await resendRfqRecipient({
      projectId: detail.projectId,
      rfqId: detail.id,
      recipientId,
    });
    if (!result.ok) setError(result.error);
    else if (result.failed) setError("The link was replaced, but the email was not accepted.");
    router.refresh();
  }

  async function revoke(recipientId: string) {
    setError(null);
    const result = await revokeRfqRecipient({
      projectId: detail.projectId,
      rfqId: detail.id,
      recipientId,
    });
    if (!result.ok) setError(result.error);
    router.refresh();
  }

  async function openFile(responseId: string) {
    const result = await signRfqResponseFile({ projectId: detail.projectId, responseId });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    const link = document.createElement("a");
    link.href = result.url;
    link.rel = "noopener";
    link.click();
  }

  return (
    <div className="grid gap-6 pb-28 md:pb-0" data-rfq-detail>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="break-words text-xl font-semibold">{detail.scopeLabel || "Request"}</h1>
          <p className="text-sm text-foreground/70">{detail.status === "draft" ? "Draft" : "Sent"} · {detail.pricingRequest === "schedule" ? "Item schedule" : "One price for this scope"} · The request content stays as it was sent.</p>
          {detail.status === "sent" ? (
            <p className="text-sm">To change the scope, quantities, due date, or files, <Link className="underline" href={`/app/projects/${detail.projectId}/requests/new`}>create a new request</Link>. This request stays as sent, and a response is not reused on a different schedule.</p>
          ) : null}
        </div>
        {canEdit && detail.status === "draft" ? (
          <Button className="h-11 min-h-11" render={<Link href={`/app/projects/${detail.projectId}/requests/${detail.id}/edit`} />}>
            Edit draft
          </Button>
        ) : null}
      </div>

      <section className="grid gap-2 rounded-xl border border-border bg-card p-4 text-sm">
        <h2 className="text-base font-semibold">Request</h2>
        <p>{detail.requestedScope || "No scope written."}</p>
        {detail.measurementNotes ? <p>Measurements: {detail.measurementNotes}</p> : null}
        <p>Due: {detail.responseDueOn || "Not set"}</p>
        <p>Site address: {detail.includeSiteAddress ? detail.siteAddress || "None" : "Not included"}</p>
        {detail.siteDetails ? <p>Site details: {detail.siteDetails}</p> : null}
        {detail.questions ? <p>Questions: {detail.questions}</p> : null}
        {detail.message ? <p>Message: {detail.message}</p> : null}
        <p>Files: {detail.files.length === 0 ? "None selected" : detail.files.map((file) => file.filename).join(", ")}</p>
        {detail.pricingRequest === "schedule" ? (
          <ol className="grid gap-1" data-rfq-frozen-schedule>
            {detail.schedule.map((item, index) => (
              <li key={item.id} className="break-words">{index + 1}. {item.scope} · {item.unit === "lump_sum" ? "Lump sum" : `${item.quantity ?? ""} ${scheduleUnitLabel(item.unit)}`} · {scheduleRoleLabel(item.role)}</li>
            ))}
          </ol>
        ) : null}
      </section>

      <section className="grid gap-3">
        <h2 className="text-base font-semibold">Recipients</h2>
        <ul className="grid gap-2">
          {detail.recipients.map((recipient) => (
            <li key={recipient.id} className="grid gap-2 rounded-xl border border-border bg-card p-4 text-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <Link href={`/app/contacts/subcontractors/${recipient.subcontractorId}`} className="font-medium break-words">{recipient.tradingName}</Link>
                  <p>{recipient.contactName} · {recipient.contactEmail}</p>
                  <p className="text-foreground/70">{recipient.suggestionReason || "Chosen manually"}</p>
                </div>
                <div className="text-right">
                  <p>{rfqResponseLabel(recipient.responseState)}</p>
                  <p className="text-foreground/70">{rfqDeliveryLabel(recipient.deliveryState)}{recipient.viewed ? " · Viewed" : ""}</p>
                  {rfqDeliveryFailed(recipient.deliveryState) ? <p>The email was not delivered. No response has been received.</p> : null}
                </div>
              </div>
              {canEdit && detail.status === "sent" ? (
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" className="h-11 min-h-11" onClick={() => resend(recipient.id)}>Resend</Button>
                  <Button type="button" variant="outline" className="h-11 min-h-11" onClick={() => revoke(recipient.id)}>Revoke link</Button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      <section className="grid gap-3" data-rfq-compare>
        <h2 className="text-base font-semibold">Compare responses</h2>
        <p className="text-sm text-foreground/70">No response is not a decline. Using a price for draft pricing does not award the work or notify the subcontractor.</p>
        <ul className="grid gap-3">
          {detail.recipients.map((recipient) => {
            const versions = submitted.filter((response) => response.recipientId === recipient.id).sort((a, b) => b.versionNumber - a.versionNumber);
            const latest = versions[0];
            const used = Boolean(latest && detail.applications.some((application) => application.responseId === latest.id));
            return (
              <li key={recipient.id} className="grid gap-2 rounded-xl border border-border bg-card p-4 text-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="font-medium">{recipient.tradingName}</p>
                  <p>{rfqResponseLabel(recipient.responseState)} · {rfqDeliveryLabel(recipient.deliveryState)}</p>
                </div>
                <p>Price ex GST: {detail.pricingRequest === "schedule"
                  ? (latest?.completeness === "complete" ? latest.priceExGst?.toLocaleString("en-NZ", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : latest?.completeness === "partial" ? "Partial" : "None")
                  : (latest?.priceExGst == null ? "None" : latest.priceExGst.toLocaleString())}</p>
                {detail.pricingRequest === "schedule" && latest?.qualified ? <p>Qualified</p> : null}
                <p>GST: {latest ? gstTreatmentLabel(latest.gstTreatment) : "None"}</p>
                <p>Pricing: {pricingUseReason(recipient.responseState, Boolean(latest), used, rfqDeliveryFailed(recipient.deliveryState))}</p>
                <details>
                  <summary className="cursor-pointer">Response details</summary>
                  <div className="grid gap-1 pt-2">
                    <p>Structure: {latest ? pricingStructureLabel(latest.pricingStructure) : "None"}</p>
                    <p className="whitespace-pre-wrap">Inclusions: {latest?.includedScope || "None"}</p>
                    <p className="whitespace-pre-wrap">Exclusions: {latest?.excludedScope || "None"}</p>
                    <p>Valid until: {latest?.validUntil || "Not stated"}</p>
                    <p>Version: {latest ? latest.versionNumber : "None"}</p>
                    <p>File: {latest?.fileReady ? (
                      <button type="button" className="underline" onClick={() => openFile(latest.id)}>{latest.fileName || "PDF"}</button>
                    ) : "None"}</p>
                    {latest && detail.pricingRequest !== "schedule" ? <SaveResponseAsRate responseId={latest.id} canSave={canEdit} /> : null}
                    {versions.length > 1 ? (
                      <ul>
                        {versions.map((response) => (
                          <li key={response.id}>Version {response.versionNumber} remains on record.</li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                </details>
              </li>
            );
          })}
        </ul>
      </section>

      {detail.pricingRequest === "schedule" ? <RfqScheduleCompare detail={detail} onOpenFile={openFile} /> : null}

      <RfqPricingApply detail={detail} pricing={pricing} canPrice={canPrice} />

      <section className="grid gap-3" data-rfq-conversation>
        <h2 className="text-base font-semibold">Conversation</h2>
        {detail.clarifications.filter((note) => note.fromRecipient && !note.parentId).length === 0 ? (
          <p className="text-sm text-foreground/70">No questions yet.</p>
        ) : null}
        {detail.clarifications.filter((note) => note.fromRecipient && !note.parentId).map((note) => {
          const recipient = detail.recipients.find((item) => item.id === note.recipientId);
          const replies = detail.clarifications.filter((item) => item.parentId === note.id && item.recipientId === note.recipientId);
          return (
            <article key={note.id} id={`question-${note.id}`} className="grid gap-2 rounded-xl border border-border bg-card p-4 text-sm">
              <p className="text-foreground/70">{recipient?.tradingName || "Recipient"} · {new Date(note.createdAt).toLocaleString()}</p>
              <p className="whitespace-pre-wrap">{note.body}</p>
              {replies.map((reply) => (
                <p key={reply.id} className="whitespace-pre-wrap rounded-md bg-muted/40 p-3">
                  {reply.audience === "all" ? "Answer to every recipient" : "Answer to this subcontractor"}: {reply.body}
                  {reply.deliveryState === "sent" ? " Email sent." : reply.deliveryState === "failed" ? " Email not sent." : ""}
                </p>
              ))}
              {canEdit && detail.status === "sent" && recipient ? (
                <AnswerForm
                  projectId={detail.projectId}
                  rfqId={detail.id}
                  clarificationId={note.id}
                  question={note.body}
                  asker={{ name: recipient.tradingName, contact: recipient.contactName, email: recipient.contactEmail }}
                  request={{
                    scope: detail.requestedScope,
                    measurements: detail.measurementNotes,
                    due: detail.responseDueOn,
                    files: detail.files.map((file) => file.filename),
                  }}
                  onError={setError}
                />
              ) : null}
            </article>
          );
        })}
        <details>
          <summary className="cursor-pointer text-sm font-medium">Delivery details</summary>
          <ol className="grid gap-2 pt-2">
            {diagnostics.map((event) => (
              <li key={event.id} className="text-sm">
                <time dateTime={event.createdAt}>{new Date(event.createdAt).toLocaleString()}</time>
                {" · "}
                {event.summary}
              </li>
            ))}
            {diagnostics.length === 0 ? <li className="text-sm text-foreground/70">No delivery records yet.</li> : null}
          </ol>
        </details>
      </section>
      {error ? <p className="text-sm text-red-700" role="alert">{error}</p> : null}
    </div>
  );
}

function pricingUseReason(state: string, hasPrice: boolean, used: boolean, deliveryFailed: boolean): string {
  if (used) return "Used for draft Pricing. This does not award the work.";
  if (state === "declined") return "Declined, so there is no price to use.";
  if (state === "clarification") return "A question is not a price.";
  if (state === "expired") return "The link expired before a price was submitted.";
  if (deliveryFailed && !hasPrice) return "The email was not delivered, so there is no price to use.";
  if (!hasPrice) return "No response yet, so there is no price to use.";
  return "A price is recorded. Use for Pricing is a separate choice and does not award the work.";
}

function AnswerForm({
  projectId,
  rfqId,
  clarificationId,
  question,
  asker,
  request,
  onError,
}: {
  projectId: string;
  rfqId: string;
  clarificationId: string;
  question: string;
  asker: { name: string; contact: string; email: string };
  request: { scope: string; measurements: string; due: string | null; files: string[] };
  onError: (message: string | null) => void;
}) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [broadcast, setBroadcast] = useState("");
  const [audience, setAudience] = useState<"private" | "all">("private");
  const [effect, setEffect] = useState<"clarifies" | "changes" | "">("");
  const [reviewed, setReviewed] = useState(false);
  const [pending, setPending] = useState(false);
  const outgoing = audience === "all" ? broadcast : body;
  const leak = audience === "all"
    ? sharedAnswerLeak(broadcast, { names: [asker.name, asker.contact], emails: [asker.email], phones: [], question })
    : null;
  async function submit() {
    if (effect === "changes") {
      onError("This would change the request already sent. Create a new request instead.");
      return;
    }
    if (effect !== "clarifies") {
      onError("Review the answer next to the request already sent.");
      return;
    }
    if (!reviewed || !outgoing.trim()) {
      onError("Review the exact message, then confirm it.");
      return;
    }
    if (leak) {
      onError(leak);
      return;
    }
    setPending(true);
    onError(null);
    const result = await answerRfqQuestion({
      projectId,
      rfqId,
      clarificationId,
      body: outgoing,
      reviewedBody: outgoing,
      audience,
      clarification: "clarifies",
    });
    setPending(false);
    if (!result.ok) {
      onError(result.error);
      return;
    }
    if (result.failed > 0) onError("The answer was saved. One or more emails were not sent.");
    setBody("");
    setBroadcast("");
    setReviewed(false);
    router.refresh();
  }
  return (
    <form className="grid gap-3" onSubmit={(event) => { event.preventDefault(); void submit(); }}>
      <div className="grid gap-2 rounded-md border border-border p-3" data-sent-request>
        <p className="font-medium">Request already sent</p>
        <p className="whitespace-pre-wrap">{request.scope}</p>
        <p className="whitespace-pre-wrap">Measurements: {request.measurements || "None recorded"}</p>
        <p>Due: {request.due || "Not set"}</p>
        <p>Files: {request.files.length === 0 ? "None" : request.files.join(", ")}</p>
      </div>
      <label className="grid gap-1">
        Answer
        <textarea className="min-h-20 w-full rounded-md border border-border bg-card px-3 py-2 text-base" value={body} onChange={(event) => { setReviewed(false); setBody(event.target.value); }} />
      </label>
      <fieldset className="grid gap-1">
        <legend>Who receives this answer</legend>
        <label className="flex min-h-11 items-center gap-2">
          <input type="radio" name={`audience-${clarificationId}`} checked={audience === "private"} onChange={() => { setAudience("private"); setReviewed(false); }} />
          Only this subcontractor
        </label>
        <label className="flex min-h-11 items-center gap-2">
          <input type="radio" name={`audience-${clarificationId}`} checked={audience === "all"} onChange={() => { setAudience("all"); setReviewed(false); }} />
          All recipients
        </label>
      </fieldset>
      {audience === "all" ? (
        <div className="grid gap-2 rounded-md border border-border p-3" data-answer-preview>
          <label className="grid gap-1">
            Message every recipient will see
            <textarea className="min-h-20 w-full rounded-md border border-border bg-card px-3 py-2 text-base" value={broadcast} onChange={(event) => { setReviewed(false); setBroadcast(event.target.value); }} />
          </label>
          <p>This is the exact message. It is not rewritten.</p>
          <p className="whitespace-pre-wrap" data-answer-exact>{broadcast || "Write the shared message to preview it."}</p>
          {leak ? <p className="text-red-700" role="alert">{leak}</p> : null}
        </div>
      ) : (
        <p className="whitespace-pre-wrap rounded-md border border-border p-3" data-answer-exact>{body || "Write the private answer to preview it."}</p>
      )}
      <fieldset className="grid gap-1">
        <legend>Compare this answer with the request already sent</legend>
        <label className="flex min-h-11 items-start gap-2">
          <input type="radio" name={`effect-${clarificationId}`} checked={effect === "clarifies"} onChange={() => setEffect("clarifies")} />
          <span>This clarifies the request already sent</span>
        </label>
        <label className="flex min-h-11 items-start gap-2">
          <input type="radio" name={`effect-${clarificationId}`} checked={effect === "changes"} onChange={() => setEffect("changes")} />
          <span>This changes the scope, quantities, due date, or files</span>
        </label>
      </fieldset>
      {effect === "changes" ? (
        <p>
          <Link className="underline" href={`/app/projects/${projectId}/requests/new`}>Create a new request</Link>
          . Recipients keep the request they were sent.
        </p>
      ) : (
        <>
          <label className="flex min-h-11 items-start gap-2">
            <input type="checkbox" checked={reviewed} onChange={(event) => setReviewed(event.target.checked)} />
            <span>I have reviewed this exact message.</span>
          </label>
          <Button type="submit" className="h-11 min-h-11 w-fit" disabled={pending || Boolean(leak)}>Send answer</Button>
        </>
      )}
    </form>
  );
}
