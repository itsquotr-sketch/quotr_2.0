"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import type { RfqDetail } from "@/lib/rfqs/load";
import { gstTreatmentLabel, pricingStructureLabel } from "@/lib/rfqs/shared";
import { rfqDeliveryFailed, rfqDeliveryLabel, rfqResponseLabel } from "@/lib/rfqs/states";
import { answerRfqQuestion, resendRfqRecipient, revokeRfqRecipient, signRfqResponseFile } from "@/lib/rfqs/actions";
import { stripSupplierIdentity } from "@/lib/rfqs/draft-compose";
import type { RfqPricingTarget } from "@/lib/rfqs/load";
import { RfqPricingApply } from "@/components/rfqs/RfqPricingApply";
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
    if (!id) return;
    document.getElementById(`question-${id}`)?.scrollIntoView({ block: "center" });
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
          <p className="text-sm text-foreground/70">{detail.status === "draft" ? "Draft" : "Sent"} · The request content stays as it was sent.</p>
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
                <p>Price ex GST: {latest?.priceExGst == null ? "None" : latest.priceExGst.toLocaleString()}</p>
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
                    {latest ? <SaveResponseAsRate responseId={latest.id} canSave={canEdit} /> : null}
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
                </p>
              ))}
              {canEdit && detail.status === "sent" && recipient ? (
                <AnswerForm
                  projectId={detail.projectId}
                  rfqId={detail.id}
                  clarificationId={note.id}
                  names={[recipient.tradingName, recipient.contactName, recipient.contactEmail]}
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
  names,
  onError,
}: {
  projectId: string;
  rfqId: string;
  clarificationId: string;
  names: string[];
  onError: (message: string | null) => void;
}) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState<"private" | "all">("private");
  const [scopeUnchanged, setScopeUnchanged] = useState(false);
  const [shareWording, setShareWording] = useState(false);
  const [pending, setPending] = useState(false);
  const preview = stripSupplierIdentity(body, names);
  async function submit() {
    if (!scopeUnchanged) {
      onError("An answer cannot change the scope, quantities, files, or due date. Send a new request so every recipient sees the same change.");
      return;
    }
    if (audience === "all" && !shareWording) {
      onError("Review the wording that every recipient will see, then confirm it.");
      return;
    }
    setPending(true);
    onError(null);
    const result = await answerRfqQuestion({
      projectId,
      rfqId,
      clarificationId,
      body,
      audience,
      scopeUnchanged: true,
    });
    setPending(false);
    if (!result.ok) {
      onError(result.error);
      return;
    }
    if (result.failed > 0) onError("The answer was saved. One or more emails were not sent.");
    router.refresh();
  }
  return (
    <form className="grid gap-2" onSubmit={(event) => { event.preventDefault(); void submit(); }}>
      <label className="grid gap-1">
        Answer
        <textarea className="min-h-20 w-full rounded-md border border-border bg-card px-3 py-2 text-base" value={body} onChange={(event) => setBody(event.target.value)} />
      </label>
      <fieldset className="grid gap-1">
        <legend>Who receives this answer</legend>
        <label className="flex min-h-11 items-center gap-2">
          <input type="radio" name={`audience-${clarificationId}`} checked={audience === "private"} onChange={() => setAudience("private")} />
          Only this subcontractor
        </label>
        <label className="flex min-h-11 items-center gap-2">
          <input type="radio" name={`audience-${clarificationId}`} checked={audience === "all"} onChange={() => setAudience("all")} />
          All recipients
        </label>
      </fieldset>
      {audience === "all" ? (
        <div className="grid gap-2 rounded-md border border-border p-3" data-answer-preview>
          <p>Every recipient will see this wording. The asking business is not named, and prices are removed.</p>
          <p className="whitespace-pre-wrap">{preview || "Write the answer to preview it."}</p>
          <label className="flex min-h-11 items-center gap-2">
            <input type="checkbox" checked={shareWording} onChange={(event) => setShareWording(event.target.checked)} />
            Share this wording
          </label>
        </div>
      ) : null}
      <label className="flex min-h-11 items-start gap-2">
        <input type="checkbox" checked={scopeUnchanged} onChange={(event) => setScopeUnchanged(event.target.checked)} />
        <span>This answer does not change the scope, quantities, files, or due date. A change needs a new request.</span>
      </label>
      <Button type="submit" className="h-11 min-h-11 w-fit" disabled={pending}>Send answer</Button>
    </form>
  );
}
