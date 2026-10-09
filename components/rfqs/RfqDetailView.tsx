"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { RfqReadingColumn } from "@/components/rfqs/rfq-layout";
import type { RfqDetail, RfqResponseView } from "@/lib/rfqs/load";
import { gstTreatmentLabel, pricingStructureLabel } from "@/lib/rfqs/shared";
import { rfqDeliveryFailed, rfqDeliveryLabel, rfqResponseLabel } from "@/lib/rfqs/states";
import { answerRfqQuestion, resendRfqRecipient, revokeRfqRecipient, signRfqResponseFile } from "@/lib/rfqs/actions";
import { sharedAnswerLeak } from "@/lib/rfqs/draft-privacy";
import type { RfqPricingTarget } from "@/lib/rfqs/load";
import { RfqPricingApply, type RfqReviewRequest } from "@/components/rfqs/RfqPricingApply";
import { RfqScheduleCompare } from "@/components/rfqs/RfqScheduleCompare";
import { scheduleRoleLabel, scheduleUnitLabel } from "@/lib/rfqs/schedule";
import { SaveResponseAsRate } from "@/components/rfqs/SaveResponseAsRate";
import { formatPricingMoney } from "@/lib/pricing/format";

export function RfqDetailView({
  detail,
  canEdit,
  canPrice,
  pricing,
  deliveryNotice = null,
}: {
  detail: RfqDetail;
  canEdit: boolean;
  canPrice: boolean;
  pricing: RfqPricingTarget | null;
  deliveryNotice?: "accepted" | "failed" | null;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [reviewRequest, setReviewRequest] = useState<RfqReviewRequest | null>(null);
  const [activeResponseId, setActiveResponseId] = useState<string | null>(null);
  const conversationRef = useRef<HTMLDetailsElement>(null);
  const reviewNonce = useRef(0);
  const submitted = detail.responses.filter((response) => response.status === "submitted");
  const openQuestions = detail.clarifications.filter((note) => note.fromRecipient && !note.parentId && !detail.clarifications.some((reply) => reply.parentId === note.id));
  const askedQuestions = detail.clarifications.filter((note) => note.fromRecipient && !note.parentId);
  const diagnostics = detail.events.filter((event) => event.kind.includes("delivery") || event.kind.includes("email") || event.kind === "link_prepared" || event.summary.startsWith("Mail service"));
  const onResponseId = useCallback((id: string) => {
    setActiveResponseId(id);
  }, []);
  const conversationSummary = openQuestions.length > 0
    ? `Conversation · ${openQuestions.length === 1 ? "1 open question" : `${openQuestions.length} open questions`}`
    : askedQuestions.length === 0
      ? "Conversation · No questions"
      : "Conversation · No open questions";

  function openConversation(anchor: string) {
    if (conversationRef.current) conversationRef.current.open = true;
    document.getElementById(anchor)?.scrollIntoView({ block: "start" });
  }

  function reviewResponse(id: string) {
    reviewNonce.current += 1;
    setReviewRequest({ id, nonce: reviewNonce.current });
    window.setTimeout(() => {
      document.getElementById("rfq-pricing-apply")?.scrollIntoView({ block: "start" });
      const focusTarget = document.getElementById("rfq-response") ?? document.getElementById("rfq-offer-heading");
      if (focusTarget instanceof HTMLElement) focusTarget.focus();
    }, 0);
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("question");
    const hash = window.location.hash.replace(/^#/, "");
    const wantsConversation = Boolean(id) || hash.startsWith("question-") || hash === "rfq-conversation";
    const target = id ? `question-${id}` : hash;
    if (wantsConversation && conversationRef.current) conversationRef.current.open = true;
    if (!target) return;
    requestAnimationFrame(() => {
      const matches = [
        document.getElementById(target),
        ...document.querySelectorAll(`[data-rfq-anchor~="${CSS.escape(target)}"]`),
      ].filter((node): node is HTMLElement => node instanceof HTMLElement);
      const visible = matches.find((node) => node.getClientRects().length > 0) ?? matches[0];
      visible?.scrollIntoView({ block: "center" });
    });
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
    <RfqReadingColumn className="grid gap-4 pb-28 md:pb-0" data-rfq-detail>
      <DeliveryNotice notice={deliveryNotice} />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="break-words text-xl font-semibold">{detail.scopeLabel || "Request"}</h1>
          <dl className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-foreground/70">Work area</dt>
              <dd className="break-words">{detail.scopeKind === "work_area" ? detail.scopeLabel || "Not named" : "Written scope, not a project Work Area"}</dd>
            </div>
            <div>
              <dt className="text-foreground/70">Status</dt>
              <dd>{detail.status === "draft" ? "Draft" : "Sent"}</dd>
            </div>
            <div>
              <dt className="text-foreground/70">Due</dt>
              <dd>{dueLabel(detail.responseDueOn)}</dd>
            </div>
            <div>
              <dt className="text-foreground/70">Responses</dt>
              <dd>{submitted.length === 1 ? "1 response" : `${submitted.length} responses`}</dd>
            </div>
          </dl>
          {openQuestions.length > 0 ? (
            <button
              type="button"
              className="mt-2 inline-flex min-h-11 items-center text-sm font-medium underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-orange)]"
              onClick={() => openConversation(openQuestions[0] ? `question-${openQuestions[0].id}` : "rfq-conversation")}
            >
              {openQuestions.length === 1 ? "1 open question" : `${openQuestions.length} open questions`} · Answer question
            </button>
          ) : null}
        </div>
        {canEdit && detail.status === "draft" ? (
          <Button className="h-11 min-h-11" render={<Link href={`/app/projects/${detail.projectId}/requests/${detail.id}/edit`} />}>
            Edit draft
          </Button>
        ) : null}
      </div>

      <section className="grid gap-3" id="rfq-compare" data-rfq-compare>
        <h2 className="text-base font-semibold">Compare responses</h2>
        <ul className="grid gap-3">
          {detail.recipients.map((recipient) => {
            const versions = submitted.filter((response) => response.recipientId === recipient.id).sort((a, b) => b.versionNumber - a.versionNumber);
            const latest = versions[0];
            return (
              <li key={recipient.id} className="grid gap-2 rounded-xl border border-border bg-card p-4 text-sm">
                <p className="break-words font-medium">{recipient.tradingName}</p>
                <p>Version: {latest ? latest.versionNumber : "None"}</p>
                <p>Quoted ex GST: {quotedAmount(latest)}</p>
                <p>Completeness: {completenessLabel(latest, detail.pricingRequest)}</p>
                <p>Qualification: {qualificationLabel(latest)}</p>
                <p>Delivery: {rfqDeliveryLabel(recipient.deliveryState)}</p>
                <p>Viewed: {recipient.viewed ? "Viewed" : "Not viewed"}</p>
                <p>Response: {rfqResponseLabel(recipient.responseState)}</p>
                {rfqDeliveryFailed(recipient.deliveryState) && !latest ? <p>The email was not delivered.</p> : null}
                {canPrice && latest ? (
                  <button
                    type="button"
                    className="inline-flex min-h-11 w-fit items-center rounded-md border border-border bg-background px-3 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-orange)]"
                    onClick={() => reviewResponse(latest.id)}
                  >
                    Review this version for pricing
                  </button>
                ) : null}
                {latest && activeResponseId === latest.id ? <p>Shown in the pricing decision. Nothing is applied until you confirm there.</p> : null}
                <details>
                  <summary className="min-h-11 cursor-pointer py-2">Response files and earlier versions</summary>
                  <div className="grid gap-2 pb-2">
                    <p>GST: {latest ? gstTreatmentLabel(latest.gstTreatment) : "Not stated"}</p>
                    <p>Structure: {latest ? pricingStructureLabel(latest.pricingStructure) : "None"}</p>
                    <p className="whitespace-pre-wrap">Inclusions: {latest?.includedScope || "None"}</p>
                    <p className="whitespace-pre-wrap">Exclusions: {latest?.excludedScope || "None"}</p>
                    <p>Valid until: {latest?.validUntil || "Not stated"}</p>
                    <p>File: {latest?.fileReady ? (
                      <button type="button" className="underline" onClick={() => openFile(latest.id)}>{latest.fileName || "PDF"}</button>
                    ) : "None"}</p>
                    {latest && detail.pricingRequest !== "schedule" ? <SaveResponseAsRate responseId={latest.id} canSave={canEdit} /> : null}
                    {versions.map((response) => (
                      <div key={response.id} className="grid gap-1">
                        <p>Version {response.versionNumber} · {quotedAmount(response)} · {qualificationLabel(response)}</p>
                        {canPrice && response.id !== latest?.id ? (
                          <button
                            type="button"
                            className="inline-flex min-h-11 w-fit items-center text-sm underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-orange)]"
                            onClick={() => reviewResponse(response.id)}
                          >
                            Review version {response.versionNumber} for pricing
                          </button>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </details>
              </li>
            );
          })}
        </ul>
        {submitted.length === 0 ? <p className="text-sm text-foreground/70">No prices yet.</p> : null}
      </section>

      {detail.pricingRequest === "schedule" ? <RfqScheduleCompare detail={detail} onOpenFile={openFile} /> : null}

      {detail.status === "sent" && submitted.length > 0 ? (
        <p className="text-sm">Using a price for draft pricing does not award the work or notify the subcontractor.</p>
      ) : null}
      <RfqPricingApply
        detail={detail}
        pricing={pricing}
        canPrice={canPrice}
        reviewRequest={reviewRequest}
        onResponseId={onResponseId}
      />

      <details className="rounded-xl border border-border bg-card p-4 text-sm">
        <summary className="min-h-11 cursor-pointer text-base font-semibold">Recipients, delivery, and viewing</summary>
        <ul className="grid gap-2 pt-3">
          {detail.recipients.map((recipient) => (
            <li key={recipient.id} className="grid gap-2 rounded-md border border-border p-3">
              <div className="min-w-0">
                <Link href={`/app/contacts/subcontractors/${recipient.subcontractorId}`} className="font-medium break-words">{recipient.tradingName}</Link>
                <p>{recipient.contactName} · {recipient.contactEmail}</p>
                <p className="text-foreground/70">{recipient.suggestionReason || "Chosen manually"}</p>
                <p>Delivery: {rfqDeliveryLabel(recipient.deliveryState)}</p>
                <p>Viewed: {recipient.viewed ? "Viewed" : "Not viewed"}</p>
                <p>Response: {rfqResponseLabel(recipient.responseState)}</p>
                {rfqDeliveryFailed(recipient.deliveryState) ? <p>The email was not delivered.</p> : null}
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
      </details>

      <details className="rounded-xl border border-border bg-card p-4 text-sm" data-rfq-request-disclosure>
        <summary className="min-h-11 cursor-pointer text-base font-semibold">Sent request: scope, measurements, site, and files</summary>
        <div className="grid gap-2 pt-3">
          <p>{detail.pricingRequest === "schedule" ? "Price specific items" : "One price for this scope"}</p>
          <p className="whitespace-pre-wrap">{detail.requestedScope || "No scope written."}</p>
          <p className="whitespace-pre-wrap">Measurements: {detail.measurementNotes || "None recorded"}</p>
          <p>Due: {dueLabel(detail.responseDueOn)}</p>
          <p>Site address: {detail.includeSiteAddress ? detail.siteAddress || "None" : "Not included"}</p>
          {detail.siteDetails ? <p className="whitespace-pre-wrap">Site details: {detail.siteDetails}</p> : null}
          {detail.questions ? <p className="whitespace-pre-wrap">Questions: {detail.questions}</p> : null}
          {detail.message ? <p className="whitespace-pre-wrap">Message: {detail.message}</p> : null}
          <p>Files: {detail.files.length === 0 ? "None selected" : detail.files.map((file) => file.filename).join(", ")}</p>
          {detail.pricingRequest === "schedule" ? (
            <ol className="grid gap-1" data-rfq-frozen-schedule>
              {detail.schedule.map((item, index) => (
                <li key={item.id} className="break-words">{index + 1}. {item.scope} · {item.unit === "lump_sum" ? "Lump sum" : `${item.quantity ?? ""} ${scheduleUnitLabel(item.unit)}`} · {scheduleRoleLabel(item.role)}</li>
              ))}
            </ol>
          ) : null}
          {detail.status === "sent" ? (
            <p>To change the scope, quantities, due date, or files, <Link className="underline" href={`/app/projects/${detail.projectId}/requests/new`}>create a new request</Link>. This request stays as sent, and a response is not reused on a different schedule.</p>
          ) : null}
        </div>
      </details>

      <details
        id="rfq-conversation"
        ref={conversationRef}
        className="rounded-xl border border-border bg-card p-4 text-sm"
        data-rfq-conversation
      >
        <summary className="min-h-11 cursor-pointer text-base font-semibold">{conversationSummary}</summary>
        <div className="grid gap-3 pt-3">
          {askedQuestions.length === 0 ? <p className="text-foreground/70">No questions.</p> : null}
          {askedQuestions.map((note) => {
            const recipient = detail.recipients.find((item) => item.id === note.recipientId);
            const replies = detail.clarifications.filter((item) => item.parentId === note.id && item.recipientId === note.recipientId);
            const requestContext = {
              scope: detail.requestedScope,
              measurements: detail.measurementNotes,
              due: detail.responseDueOn,
              files: detail.files.map((file) => file.filename),
            };
            return (
              <article key={note.id} id={`question-${note.id}`} className="grid gap-2 rounded-md border border-border p-3">
                <p className="text-foreground/70">{recipient?.tradingName || "Recipient"} · {new Date(note.createdAt).toLocaleString()}</p>
                <p className="whitespace-pre-wrap">{note.body}</p>
                {replies.map((reply) => (
                  <p key={reply.id} className="whitespace-pre-wrap rounded-md bg-muted/40 p-3">
                    {reply.audience === "all" ? "Answer to every recipient" : "Answer to this subcontractor"}: {reply.body}
                    {reply.deliveryState === "sent" ? " Email sent." : reply.deliveryState === "failed" ? " Email not sent." : ""}
                  </p>
                ))}
                <div className="grid gap-2 rounded-md border border-border p-3" data-sent-request>
                  <p className="font-medium">Request already sent</p>
                  <p className="whitespace-pre-wrap">{requestContext.scope}</p>
                  <p className="whitespace-pre-wrap">Measurements: {requestContext.measurements || "None recorded"}</p>
                  <p>Due: {requestContext.due || "Not set"}</p>
                  <p>Files: {requestContext.files.length === 0 ? "None" : requestContext.files.join(", ")}</p>
                </div>
                {canEdit && detail.status === "sent" && recipient ? (
                  <AnswerForm
                    projectId={detail.projectId}
                    rfqId={detail.id}
                    clarificationId={note.id}
                    question={note.body}
                    asker={{ name: recipient.tradingName, contact: recipient.contactName, email: recipient.contactEmail }}
                    onError={setError}
                  />
                ) : null}
              </article>
            );
          })}
        </div>
      </details>

      <details className="rounded-xl border border-border bg-card p-4 text-sm">
        <summary className="min-h-11 cursor-pointer font-semibold">Email and link delivery records</summary>
        <ol className="grid gap-2 pt-3">
          {diagnostics.map((event) => (
            <li key={event.id}>
              <time dateTime={event.createdAt}>{new Date(event.createdAt).toLocaleString()}</time>
              {" · "}
              {event.summary}
            </li>
          ))}
          {diagnostics.length === 0 ? <li className="text-foreground/70">No delivery records yet.</li> : null}
        </ol>
      </details>
      {error ? <p className="text-sm text-red-700" role="alert">{error}</p> : null}
    </RfqReadingColumn>
  );
}

function dueLabel(value: string | null): string {
  if (!value) return "No due date";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-NZ", { day: "numeric", month: "short", year: "numeric" });
}

function quotedAmount(response: RfqResponseView | undefined): string {
  if (!response || response.priceExGst == null) return "No price";
  return `${formatPricingMoney(response.priceExGst)} ex GST`;
}

function completenessLabel(response: RfqResponseView | undefined, pricingRequest: RfqDetail["pricingRequest"]): string {
  if (!response) return "No response";
  if (response.completeness === "partial") return "Partial";
  if (response.completeness === "complete") return "Complete";
  if (pricingRequest === "lump_sum" && response.priceExGst != null) return "Complete";
  if (response.priceExGst == null) return "No price";
  return "Not recorded";
}

function qualificationLabel(response: RfqResponseView | undefined): string {
  if (!response) return "None";
  if (response.qualified || response.excludedScope.trim() || response.assumptions.trim()) return "Qualified";
  return "No qualification";
}

function DeliveryNotice({ notice }: { notice: string | null }) {
  if (notice === "accepted") {
    return <p className="rounded-md border border-border bg-card p-3 text-sm" role="status">The request was sent. The mail service accepted it for delivery. That is not the same as the recipient having opened it.</p>;
  }
  if (notice === "failed") {
    return <p className="rounded-md border border-red-200 bg-card p-3 text-sm text-red-700" role="alert">The request was saved, but email delivery failed. The draft content is unchanged. You can resend.</p>;
  }
  return null;
}

function AnswerForm({
  projectId,
  rfqId,
  clarificationId,
  question,
  asker,
  onError,
}: {
  projectId: string;
  rfqId: string;
  clarificationId: string;
  question: string;
  asker: { name: string; contact: string; email: string };
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
