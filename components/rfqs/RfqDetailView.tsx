"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { mobileNavPaddingClass } from "@/components/layout/mobile-nav-metrics";
import { RFQ_LIST_FILTER_KEYS, rfqListStorageKey, RfqReadingColumn } from "@/components/rfqs/rfq-layout";
import type { RfqDetail, RfqRecipientView, RfqResponseView } from "@/lib/rfqs/load";
import { gstTreatmentLabel } from "@/lib/rfqs/shared";
import { rfqDeliveryFailed, rfqDeliveryLabel, rfqResponseLabel } from "@/lib/rfqs/states";
import { answerRfqQuestion, resendRfqRecipient, revokeRfqRecipient, signRfqResponseFile } from "@/lib/rfqs/actions";
import { sharedAnswerLeak } from "@/lib/rfqs/draft-privacy";
import type { RfqPricingTarget } from "@/lib/rfqs/load";
import { RfqPricingApply, type RfqReviewRequest } from "@/components/rfqs/RfqPricingApply";
import { RfqScheduleCompare } from "@/components/rfqs/RfqScheduleCompare";
import { scheduleRoleLabel, scheduleUnitLabel } from "@/lib/rfqs/schedule";
import { SaveResponseAsRate } from "@/components/rfqs/SaveResponseAsRate";
import { formatPricingMoney } from "@/lib/pricing/format";
import type { QuoteStatus } from "@/lib/quotes/types";
import { scrollWorkspaceTarget } from "@/lib/rfqs/scroll-workspace";
import { cn } from "@/lib/utils";

const focusClass = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-orange)]";

type AnswerDraft = {
  body: string;
  broadcast: string;
  audience: "private" | "all";
  effect: "clarifies" | "changes" | "";
  reviewed: boolean;
};

const emptyDraft: AnswerDraft = { body: "", broadcast: "", audience: "private", effect: "", reviewed: false };

export function RfqDetailView({
  detail,
  canEdit,
  canPrice,
  pricing,
  deliveryNotice = null,
  quote = null,
}: {
  detail: RfqDetail;
  canEdit: boolean;
  canPrice: boolean;
  pricing: RfqPricingTarget | null;
  deliveryNotice?: "accepted" | "failed" | null;
  quote?: { id: string; status: QuoteStatus } | null;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [reviewRequest, setReviewRequest] = useState<RfqReviewRequest | null>(null);
  const [activeResponseId, setActiveResponseId] = useState<string | null>(null);
  const [answerDrafts, setAnswerDrafts] = useState<Record<string, AnswerDraft>>({});
  const listHref = useRequestsHref(detail.projectId);
  const conversationRef = useRef<HTMLDetailsElement>(null);
  const reviewNonce = useRef(0);
  const submitted = detail.responses.filter((response) => response.status === "submitted");
  const respondedCount = detail.recipients.filter((recipient) => recipient.responseState !== "awaiting" && recipient.responseState !== "expired").length;
  const declineRecipientIds = new Set(detail.recipients.filter((recipient) => recipient.responseState === "declined").map((recipient) => recipient.id));
  const isQuestion = (note: (typeof detail.clarifications)[number]) => note.fromRecipient && !note.parentId && !declineRecipientIds.has(note.recipientId);
  const openQuestions = detail.clarifications.filter((note) => isQuestion(note) && !detail.clarifications.some((reply) => reply.parentId === note.id));
  const askedQuestions = detail.clarifications.filter((note) => isQuestion(note));
  const diagnostics = detail.events.filter((event) => event.kind.includes("delivery") || event.kind.includes("email") || event.kind === "link_prepared" || event.summary.startsWith("Mail service"));
  const onResponseId = useCallback((id: string | null) => {
    setActiveResponseId(id);
  }, []);
  const conversationSummary = openQuestions.length > 0
    ? `Conversation · ${openQuestions.length === 1 ? "1 open question" : `${openQuestions.length} open questions`}`
    : askedQuestions.length === 0
      ? "Conversation · No questions"
      : "Conversation · No open questions";
  const appliedIds = new Set(detail.applications.map((application) => application.responseId));

  function openConversation(anchor: string) {
    if (conversationRef.current) conversationRef.current.open = true;
    requestAnimationFrame(() => {
      const node = document.getElementById(anchor);
      if (node instanceof HTMLElement) scrollWorkspaceTarget(node);
      const field = node?.querySelector("textarea");
      if (field instanceof HTMLElement) field.focus({ preventScroll: true });
      else if (node instanceof HTMLElement) node.focus({ preventScroll: true });
    });
  }

  function reviewResponse(id: string, focus: "decision" | "compare" = "decision") {
    reviewNonce.current += 1;
    setReviewRequest({ id, nonce: reviewNonce.current, focus });
  }

  useEffect(() => {
    if (!reviewRequest || reviewRequest.focus !== "compare") return;
    const rows = [...document.querySelectorAll(`[data-rfq-response-row="${CSS.escape(reviewRequest.id)}"]`)]
      .filter((node): node is HTMLElement => node instanceof HTMLElement);
    const row = rows.find((node) => node.getClientRects().length > 0) ?? rows[0];
    if (!row) return;
    const details = row.closest("details");
    if (details) details.open = true;
    scrollWorkspaceTarget(row, { focus: true });
  }, [reviewRequest]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("question");
    const hash = window.location.hash.replace(/^#/, "");
    const responseId = params.get("response");
    const wantsConversation = Boolean(id) || hash.startsWith("question-") || hash === "rfq-conversation";
    const target = id ? `question-${id}` : hash;
    if (wantsConversation && conversationRef.current) conversationRef.current.open = true;
    if (responseId) {
      reviewNonce.current += 1;
      const nonce = reviewNonce.current;
      queueMicrotask(() => setReviewRequest({ id: responseId, nonce, focus: "compare" }));
    }
    if (!target || responseId) return;
    requestAnimationFrame(() => {
      const matches = [
        document.getElementById(target),
        ...document.querySelectorAll(`[data-rfq-anchor~="${CSS.escape(target)}"]`),
      ].filter((node): node is HTMLElement => node instanceof HTMLElement);
      const visible = matches.find((node) => node.getClientRects().length > 0) ?? matches[0];
      if (visible) scrollWorkspaceTarget(visible);
      if (wantsConversation) {
        const field = visible?.querySelector("textarea");
        if (field instanceof HTMLElement) field.focus({ preventScroll: true });
      }
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
    <RfqReadingColumn className={cn("grid gap-4", mobileNavPaddingClass)} data-rfq-detail>
      <DeliveryNotice notice={deliveryNotice} />
      <div className="grid gap-2">
        <Link
          href={listHref}
          className={cn("inline-flex min-h-11 w-fit items-center text-sm font-medium", focusClass)}
          data-rfq-back
        >
          ← All subcontractor prices
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="break-words text-xl font-semibold">{detail.scopeLabel || "Request"}</h1>
            <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-sm text-foreground/70">
              <span>{detail.status === "draft" ? "Draft" : "Sent"}</span>
              <span>Due {dueLabel(detail.responseDueOn)}</span>
              <span>{detail.recipients.length === 0 ? "No suppliers" : `${respondedCount} of ${detail.recipients.length} responded`}</span>
            </p>
            {openQuestions.length > 0 ? (
              <button
                type="button"
                className={cn("mt-1 inline-flex min-h-11 items-center text-sm font-medium underline", focusClass)}
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
      </div>

      <section className="grid min-w-0 gap-3" id="rfq-compare" data-rfq-compare>
        <h2 className="text-base font-semibold">Compare responses</h2>
        <p className="text-sm text-foreground/70">A partial price is not ranked as a cheaper complete offer. Optional and alternative amounts stay out of the base total.</p>
        <div className="grid gap-3 md:hidden">
          {detail.recipients.map((recipient) => {
            const versions = submitted.filter((response) => response.recipientId === recipient.id).sort((a, b) => b.versionNumber - a.versionNumber);
            const latest = versions[0];
            const applied = versions.find((response) => appliedIds.has(response.id));
            const selectedId = versions.some((response) => response.id === activeResponseId) ? activeResponseId : null;
            return (
              <article
                key={recipient.id}
                className={cn("grid gap-2 rounded-xl border bg-card p-4 text-sm", selectedId && selectedId === latest?.id ? "border-[var(--brand-orange)] ring-1 ring-[var(--brand-orange)]" : "border-border")}
                data-rfq-response-card={recipient.id}
                data-rfq-response-row={latest?.id || recipient.id}
                tabIndex={-1}
              >
                <ResponseFacts
                  recipientName={recipient.tradingName}
                  responseState={recipient.responseState}
                  latest={latest}
                  applied={applied}
                  selectedId={selectedId}
                  pricingRequest={detail.pricingRequest}
                />
                {canPrice && latest ? (
                  <button type="button" className={cn("inline-flex min-h-11 w-fit items-center rounded-md border border-border bg-background px-3 text-sm font-medium", focusClass)} aria-pressed={selectedId === latest.id} onClick={() => reviewResponse(latest.id)}>
                    {selectedId === latest.id ? "Selected for pricing review" : "Review this version for pricing"}
                  </button>
                ) : null}
                <HistoryDetails
                  recipient={recipient}
                  versions={versions}
                  latest={latest}
                  appliedIds={appliedIds}
                  activeResponseId={activeResponseId}
                  canPrice={canPrice}
                  canEdit={canEdit}
                  pricingRequest={detail.pricingRequest}
                  events={detail.events.filter((event) => event.recipientId === recipient.id)}
                  onReview={(id) => reviewResponse(id)}
                  onOpenFile={openFile}
                />
              </article>
            );
          })}
        </div>
        <div className="hidden min-w-0 max-w-full overflow-x-auto md:block">
          <table className="w-full min-w-[880px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="px-3 py-2 font-medium">Subcontractor</th>
                <th className="px-3 py-2 font-medium">Version</th>
                <th className="px-3 py-2 font-medium">Amount</th>
                <th className="px-3 py-2 font-medium">Completeness</th>
                <th className="px-3 py-2 font-medium">Qualifications or exclusions</th>
                <th className="px-3 py-2 font-medium">Response</th>
                <th className="px-3 py-2 font-medium">Pricing use</th>
              </tr>
            </thead>
            <tbody>
              {detail.recipients.map((recipient) => {
                const versions = submitted.filter((response) => response.recipientId === recipient.id).sort((a, b) => b.versionNumber - a.versionNumber);
                const latest = versions[0];
                const applied = versions.find((response) => appliedIds.has(response.id));
                const selectedId = versions.some((response) => response.id === activeResponseId) ? activeResponseId : null;
                return (
                  <tr key={recipient.id} className={cn("border-b border-border align-top", selectedId && selectedId === latest?.id && "bg-[var(--brand-orange)]/5")} data-rfq-response-row={latest?.id || recipient.id} tabIndex={-1}>
                    <td className="px-3 py-3 font-medium">{recipient.tradingName}</td>
                    <td className="px-3 py-3">{latest ? `Version ${latest.versionNumber} · ${submittedOn(latest.submittedAt)}` : "No version"}</td>
                    <td className="px-3 py-3 tabular-nums">{amountLabel(latest, recipient.responseState)}</td>
                    <td className="px-3 py-3">{latest ? completenessLabel(latest, detail.pricingRequest) : recipient.responseState === "declined" ? "Declined" : "No response"}</td>
                    <td className="px-3 py-3">{latest ? conditionSummary(latest) : "None"}</td>
                    <td className="px-3 py-3">{rfqResponseLabel(recipient.responseState)}</td>
                    <td className="px-3 py-3">
                      <div className="grid gap-2">
                        <p>{pricingUse(latest, applied, selectedId)}</p>
                        {canPrice && latest ? (
                          <button type="button" className={cn("inline-flex min-h-11 w-fit items-center rounded-md border border-border bg-background px-3 text-sm font-medium", focusClass)} aria-pressed={selectedId === latest.id} onClick={() => reviewResponse(latest.id)}>
                            {selectedId === latest.id ? "Selected for pricing review" : "Review this version for pricing"}
                          </button>
                        ) : null}
                        <HistoryDetails
                          recipient={recipient}
                          versions={versions}
                          latest={latest}
                          appliedIds={appliedIds}
                          activeResponseId={activeResponseId}
                          canPrice={canPrice}
                          canEdit={canEdit}
                          pricingRequest={detail.pricingRequest}
                          events={detail.events.filter((event) => event.recipientId === recipient.id)}
                          onReview={(id) => reviewResponse(id)}
                          onOpenFile={openFile}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {submitted.length === 0 ? <p className="text-sm text-foreground/70">No prices yet.</p> : null}
      </section>

      {detail.pricingRequest === "schedule" ? <RfqScheduleCompare detail={detail} onOpenFile={openFile} /> : null}

      <RfqPricingApply
        detail={detail}
        pricing={pricing}
        canPrice={canPrice}
        quote={quote}
        reviewRequest={reviewRequest}
        onResponseId={onResponseId}
      />

      <details
        id="rfq-conversation"
        ref={conversationRef}
        className="scroll-mt-6 rounded-xl border border-border bg-card p-4 text-sm"
        data-rfq-conversation
        data-open-questions={openQuestions.length}
        onToggle={() => {
          /* Collapsing keeps the unsent answer and does not send it. */
        }}
      >
        <summary className={cn("min-h-11 cursor-pointer text-base font-semibold", focusClass)}>{conversationSummary}</summary>
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
            const draft = answerDrafts[note.id] ?? emptyDraft;
            return (
              <article key={note.id} id={`question-${note.id}`} tabIndex={-1} className="grid scroll-mt-6 gap-2 rounded-md border border-border p-3 outline-none focus:ring-2 focus:ring-[var(--brand-orange)]">
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
                    draft={draft}
                    onDraft={(next) => setAnswerDrafts((current) => ({ ...current, [note.id]: next }))}
                    onError={setError}
                  />
                ) : null}
              </article>
            );
          })}
        </div>
      </details>

      <details className="rounded-xl border border-border bg-card p-4 text-sm" data-rfq-request-disclosure>
        <summary className={cn("min-h-11 cursor-pointer text-base font-semibold", focusClass)}>Request details</summary>
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
            <p>To change the scope, quantities, due date, or files, <Link className="underline" href={`/app/projects/${detail.projectId}/requests/new`}>create a new request</Link>. This request stays as sent.</p>
          ) : null}
        </div>
      </details>

      <details className="rounded-xl border border-border bg-card p-4 text-sm" data-rfq-activity>
        <summary className={cn("min-h-11 cursor-pointer text-base font-semibold", focusClass)}>Activity</summary>
        <div className="grid gap-4 pt-3">
          <div className="grid gap-2">
            <p className="font-medium">Recipients and delivery</p>
            <ul className="grid gap-2">
              {detail.recipients.map((recipient) => (
                <li key={recipient.id} className="grid gap-2 rounded-md border border-border p-3">
                  <div className="min-w-0">
                    <Link href={`/app/contacts/subcontractors/${recipient.subcontractorId}`} className="font-medium break-words">{recipient.tradingName}</Link>
                    <p>{recipient.contactName} · {recipient.contactEmail}</p>
                    <p className="text-foreground/70">{recipient.suggestionReason || "Chosen manually"}</p>
                    <p>Delivered: {rfqDeliveryLabel(recipient.deliveryState)}</p>
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
          </div>
          <div className="grid gap-2">
            <p className="font-medium">Email and link records</p>
            <ol className="grid gap-2">
              {diagnostics.map((event) => (
                <li key={event.id}>
                  <time dateTime={event.createdAt}>{new Date(event.createdAt).toLocaleString()}</time>
                  {" · "}
                  {event.summary}
                </li>
              ))}
              {diagnostics.length === 0 ? <li className="text-foreground/70">No delivery records yet.</li> : null}
            </ol>
          </div>
        </div>
      </details>
      {error ? <p className="text-sm text-red-700" role="alert">{error}</p> : null}
    </RfqReadingColumn>
  );
}

function submittedOn(value: string | null): string {
  if (!value) return "Date not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date not recorded";
  return date.toLocaleDateString("en-NZ", { day: "numeric", month: "short", year: "numeric" });
}

function pricingUse(latest: RfqResponseView | undefined, applied: RfqResponseView | undefined, selectedId: string | null): string {
  const parts: string[] = [];
  if (applied) parts.push(latest && applied.id === latest.id ? "On draft Pricing" : `Version ${applied.versionNumber} is on draft Pricing`);
  if (selectedId) parts.push(latest && selectedId === latest.id ? "Selected for pricing review" : "An earlier version is selected for pricing review");
  return parts.length > 0 ? parts.join(". ") : "Not used for Pricing";
}

function ResponseFacts({
  recipientName,
  responseState,
  latest,
  applied,
  selectedId,
  pricingRequest,
}: {
  recipientName: string;
  responseState: RfqRecipientView["responseState"];
  latest: RfqResponseView | undefined;
  applied: RfqResponseView | undefined;
  selectedId: string | null;
  pricingRequest: RfqDetail["pricingRequest"];
}) {
  return (
    <dl className="grid gap-1">
      <div><dt className="sr-only">Subcontractor</dt><dd className="text-base font-semibold">{recipientName}</dd></div>
      <div className="flex justify-between gap-3"><dt>Version</dt><dd>{latest ? `Version ${latest.versionNumber} · ${submittedOn(latest.submittedAt)}` : "No version"}</dd></div>
      <div className="flex justify-between gap-3"><dt>Amount</dt><dd className="tabular-nums font-medium">{amountLabel(latest, responseState)}</dd></div>
      <div className="flex justify-between gap-3"><dt>Completeness</dt><dd>{latest ? completenessLabel(latest, pricingRequest) : responseState === "declined" ? "Declined" : "No response"}</dd></div>
      <div className="flex justify-between gap-3"><dt>Qualifications or exclusions</dt><dd>{latest ? conditionSummary(latest) : "None"}</dd></div>
      <div className="flex justify-between gap-3"><dt>Response</dt><dd>{rfqResponseLabel(responseState)}</dd></div>
      <div className="flex justify-between gap-3"><dt>Pricing use</dt><dd>{pricingUse(latest, applied, selectedId)}</dd></div>
    </dl>
  );
}

function HistoryDetails({
  recipient,
  versions,
  latest,
  appliedIds,
  activeResponseId,
  canPrice,
  canEdit,
  pricingRequest,
  events,
  onReview,
  onOpenFile,
}: {
  recipient: RfqRecipientView;
  versions: RfqResponseView[];
  latest: RfqResponseView | undefined;
  appliedIds: Set<string>;
  activeResponseId: string | null;
  canPrice: boolean;
  canEdit: boolean;
  pricingRequest: RfqDetail["pricingRequest"];
  events: RfqDetail["events"];
  onReview: (id: string) => void;
  onOpenFile: (responseId: string) => void;
}) {
  const earlier = versions.filter((response) => response.id !== latest?.id);
  return (
    <details>
      <summary className={cn("min-h-11 cursor-pointer py-2", focusClass)}>Delivery and earlier versions</summary>
      <div className="grid gap-2 pb-2">
        <p>Delivered: {rfqDeliveryLabel(recipient.deliveryState)}</p>
        <p>Viewed: {recipient.viewed ? "Viewed" : "Not viewed"}</p>
        <p>GST: {latest ? gstTreatmentLabel(latest.gstTreatment) : "Not stated"}</p>
        <p className="whitespace-pre-wrap">Inclusions: {latest?.includedScope || "None"}</p>
        <p className="whitespace-pre-wrap">Exclusions: {latest?.excludedScope || "None"}</p>
        <p>File: {latest?.fileReady ? (
          <button type="button" className={cn("inline-flex min-h-11 items-center underline", focusClass)} onClick={() => onOpenFile(latest.id)}>{latest.fileName || "PDF"}</button>
        ) : "None"}</p>
        {latest && pricingRequest !== "schedule" ? <SaveResponseAsRate responseId={latest.id} canSave={canEdit} /> : null}
        {rfqDeliveryFailed(recipient.deliveryState) && !latest ? <p>The email was not delivered.</p> : null}
        {events.length > 0 ? events.map((event) => (
          <p key={event.id}>{new Date(event.createdAt).toLocaleString()} · {event.summary}</p>
        )) : <p>No response events yet.</p>}
        {earlier.length === 0 ? <p>No earlier versions.</p> : earlier.map((response) => (
          <div key={response.id} className="grid gap-1" data-rfq-response-row={response.id} tabIndex={-1}>
            <p>
              Version {response.versionNumber}
              {" · "}
              {submittedOn(response.submittedAt)}
              {" · "}
              {amountLabel(response, "responded")}
              {" · "}
              {completenessLabel(response, pricingRequest)}
              {appliedIds.has(response.id) ? " · On draft Pricing" : ""}
              {response.id === activeResponseId ? " · Selected for pricing review" : ""}
            </p>
            {canPrice ? (
              <button type="button" className={cn("inline-flex min-h-11 w-fit items-center text-sm underline", focusClass)} onClick={() => onReview(response.id)}>
                Review version {response.versionNumber} for pricing
              </button>
            ) : null}
          </div>
        ))}
      </div>
    </details>
  );
}

function useRequestsHref(projectId: string): string {
  const base = `/app/projects/${projectId}/requests`;
  const [href, setHref] = useState(base);
  useEffect(() => {
    const current = new URLSearchParams(window.location.search);
    const kept = new URLSearchParams();
    for (const key of RFQ_LIST_FILTER_KEYS) {
      const value = current.get(key);
      if (value) kept.set(key, value);
    }
    let next = base;
    if ([...kept.keys()].length === 0) {
      try {
        const stored = sessionStorage.getItem(rfqListStorageKey(projectId));
        if (stored) next = `${base}?${stored}`;
      } catch {
        /* The plain list is still a valid return. */
      }
    } else {
      next = `${base}?${kept.toString()}`;
    }
    const timer = window.setTimeout(() => setHref(next), 0);
    return () => window.clearTimeout(timer);
  }, [projectId, base]);
  return href;
}

function dueLabel(value: string | null): string {
  if (!value) return "No due date";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-NZ", { day: "numeric", month: "short", year: "numeric" });
}

function amountLabel(response: RfqResponseView | undefined, responseState: string): string {
  if (responseState === "declined" && !response) return "Declined to quote";
  if (!response || response.priceExGst == null) return "No price";
  const base = `${formatPricingMoney(response.priceExGst)} ex GST`;
  const extras: string[] = [];
  if (response.optionalExGst != null) extras.push(`Optional ${formatPricingMoney(response.optionalExGst)} ex GST`);
  if (response.alternativeExGst != null) extras.push(`Alternative ${formatPricingMoney(response.alternativeExGst)} ex GST`);
  return extras.length > 0 ? `${base}. ${extras.join(". ")}` : base;
}

function completenessLabel(response: RfqResponseView | undefined, pricingRequest: RfqDetail["pricingRequest"]): string {
  if (!response) return "No response";
  if (response.completeness === "partial") return "Partial";
  if (response.completeness === "complete") return "Complete";
  if (pricingRequest === "lump_sum" && response.priceExGst != null) return "Complete";
  if (response.priceExGst == null) return "No price";
  return "Not recorded";
}

function conditionSummary(response: RfqResponseView | undefined): string {
  if (!response) return "No qualifications or exclusions";
  const exclusions = response.excludedScope.trim() ? 1 : 0;
  const writtenQualifications = response.assumptions.trim() ? 1 : 0;
  const marked = response.qualified && writtenQualifications === 0 ? 1 : 0;
  const qualifications = writtenQualifications + marked;
  if (qualifications === 0 && exclusions === 0) return "No qualifications or exclusions";
  const parts: string[] = [];
  if (qualifications > 0) parts.push(qualifications === 1 ? "1 qualification" : `${qualifications} qualifications`);
  if (exclusions > 0) parts.push(exclusions === 1 ? "1 exclusion" : `${exclusions} exclusions`);
  return parts.join(" · ");
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
  draft,
  onDraft,
  onError,
}: {
  projectId: string;
  rfqId: string;
  clarificationId: string;
  question: string;
  asker: { name: string; contact: string; email: string };
  draft: AnswerDraft;
  onDraft: (draft: AnswerDraft) => void;
  onError: (message: string | null) => void;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const outgoing = draft.audience === "all" ? draft.broadcast : draft.body;
  const leak = draft.audience === "all"
    ? sharedAnswerLeak(draft.broadcast, { names: [asker.name, asker.contact], emails: [asker.email], phones: [], question })
    : null;
  function patch(next: Partial<AnswerDraft>) {
    onDraft({ ...draft, ...next });
  }
  async function submit() {
    if (draft.effect === "changes") {
      onError("This would change the request already sent. Create a new request instead.");
      return;
    }
    if (draft.effect !== "clarifies") {
      onError("Review the answer next to the request already sent.");
      return;
    }
    if (!draft.reviewed || !outgoing.trim()) {
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
      audience: draft.audience,
      clarification: "clarifies",
    });
    setPending(false);
    if (!result.ok) {
      onError(result.error);
      return;
    }
    if (result.failed > 0) onError("The answer was saved. One or more emails were not sent.");
    onDraft(emptyDraft);
    router.refresh();
  }
  return (
    <form className="grid gap-3" onSubmit={(event) => { event.preventDefault(); void submit(); }}>
      <label className="grid gap-1">
        Answer
        <textarea className="min-h-20 w-full rounded-md border border-border bg-card px-3 py-2 text-base" value={draft.body} onChange={(event) => patch({ reviewed: false, body: event.target.value })} />
      </label>
      <fieldset className="grid gap-1">
        <legend>Who receives this answer</legend>
        <label className="flex min-h-11 items-center gap-2">
          <input type="radio" name={`audience-${clarificationId}`} checked={draft.audience === "private"} onChange={() => patch({ audience: "private", reviewed: false })} />
          Only this subcontractor
        </label>
        <label className="flex min-h-11 items-center gap-2">
          <input type="radio" name={`audience-${clarificationId}`} checked={draft.audience === "all"} onChange={() => patch({ audience: "all", reviewed: false })} />
          All recipients
        </label>
      </fieldset>
      {draft.audience === "all" ? (
        <div className="grid gap-2 rounded-md border border-border p-3" data-answer-preview>
          <label className="grid gap-1">
            Message every recipient will see
            <textarea className="min-h-20 w-full rounded-md border border-border bg-card px-3 py-2 text-base" value={draft.broadcast} onChange={(event) => patch({ reviewed: false, broadcast: event.target.value })} />
          </label>
          <p>This is the exact message. It is not rewritten.</p>
          <p className="whitespace-pre-wrap" data-answer-exact>{draft.broadcast || "Write the shared message to preview it."}</p>
          {leak ? <p className="text-red-700" role="alert">{leak}</p> : null}
        </div>
      ) : (
        <p className="whitespace-pre-wrap rounded-md border border-border p-3" data-answer-exact>{draft.body || "Write the private answer to preview it."}</p>
      )}
      <fieldset className="grid gap-1">
        <legend>Compare this answer with the request already sent</legend>
        <label className="flex min-h-11 items-start gap-2">
          <input type="radio" name={`effect-${clarificationId}`} checked={draft.effect === "clarifies"} onChange={() => patch({ effect: "clarifies" })} />
          <span>This clarifies the request already sent</span>
        </label>
        <label className="flex min-h-11 items-start gap-2">
          <input type="radio" name={`effect-${clarificationId}`} checked={draft.effect === "changes"} onChange={() => patch({ effect: "changes" })} />
          <span>This changes the scope, quantities, due date, or files</span>
        </label>
      </fieldset>
      {draft.effect === "changes" ? (
        <p>
          <Link className="underline" href={`/app/projects/${projectId}/requests/new`}>Create a new request</Link>
          . Recipients keep the request they were sent.
        </p>
      ) : (
        <>
          <label className="flex min-h-11 items-start gap-2">
            <input type="checkbox" checked={draft.reviewed} onChange={(event) => patch({ reviewed: event.target.checked })} />
            <span>I have reviewed this exact message.</span>
          </label>
          <Button type="submit" className="h-11 min-h-11 w-fit" disabled={pending || Boolean(leak)}>Send answer</Button>
        </>
      )}
    </form>
  );
}
