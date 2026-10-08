"use server";

import { revalidatePath } from "next/cache";
import { resolveRfqPublicOrigin } from "@/lib/rfqs/origin";
import { readSentRfqLink } from "@/lib/rfqs/sent-link";
import { getAuthOrgContext } from "@/lib/assistant/state";
import { createAdminClient } from "@/lib/supabase/admin";
import { getQuoteDeliveryProvider } from "@/lib/quotes/delivery-provider";
import { buildRfqAnswerEmail, buildRfqDeliveryEmail, rfqDeliveryFromHeader, rfqEmailLogoUrl } from "@/lib/rfqs/email";
import { draftRfqJobFacts } from "@/lib/rfqs/draft-facts";
import { sharedAnswerLeak } from "@/lib/rfqs/draft-privacy";
import {
  generateRfqAccessToken,
  hashRfqAccessToken,
  rfqPublicPath,
} from "@/lib/rfqs/token";
import { permissionDeniedError } from "@/lib/team/permission-server";

/**
 * RFQ writes use projects.edit and the existing projects.create entitlement.
 * Builder, Business, and an active trial allow it when the role can edit a project.
 * An expired or cancelled trial denies projects.create. Viewer never has projects.edit.
 * Do not add a separate RFQ capability, and do not use quotes.send for this.
 * Public replies do not check the plan. The link was already issued.
 * Inbound email is not captured and is never turned into a price.
 */

const SAVE_FAILED = "Could not save the request. Please try again.";
const SEND_FAILED = "Could not send the request. Please try again.";

type Fail = { ok: false; error: string };
type Ok<T> = { ok: true } & T;

async function requireRfqWriter(): Promise<
  | { ok: true; context: NonNullable<Awaited<ReturnType<typeof getAuthOrgContext>>> }
  | Fail
> {
  const context = await getAuthOrgContext();
  if (!context) return { ok: false, error: "You need to be signed in." };
  const denied = await permissionDeniedError({
    orgId: context.orgId,
    userId: context.user.id,
    permission: "projects.edit",
    entitlement: "projects.create",
  });
  if (denied) return { ok: false, error: denied.error };
  return { ok: true, context };
}

function rpcError(data: unknown, fallback: string): string {
  const body = (data ?? {}) as { ok?: boolean; error?: string };
  if (body.ok === true) return "";
  switch (body.error) {
    case "ARCHIVED_SUBCONTRACTOR":
      return "That subcontractor is archived. Choose an active business.";
    case "MISSING_EMAIL":
      return "Each recipient needs a contact with an email address.";
    case "DUE_DATE_PAST":
      return "The response date needs to be today or later.";
    case "SCOPE_CHANGE":
      return "An answer cannot change the scope, quantities, files, or due date. Send a new request so every recipient sees the same change.";
    case "NOT_FOUND":
      return "That question is no longer available.";
    case "BODY":
      return "Write an answer before sending it.";
    case "AUDIENCE":
      return "Choose who receives this answer.";
    case "BROADCAST_PRIVATE":
      return "Remove the asking business, contact, email, phone, or price from the message every recipient will see.";
    case "FROZEN":
    case "ALREADY_SENT":
      return "This request has been sent and can no longer be edited.";
    case "FORBIDDEN":
      return "You do not have permission to change this request.";
    case "SCHEDULE":
      return "Add at least one required item with a scope, a unit, and a quantity where the unit is measured.";
    case "DUPLICATE_ROW":
      return "Two items use the same scope. Give each item its own wording.";
    case "STALE_SCHEDULE":
      return "This request was replaced. Open the latest link before pricing it.";
    case "NOT_PRICED_REASON":
      return "Give a reason for each required item you cannot price.";
    case "INCOMPLETE":
      return "Price or mark every required item before submitting.";
    default:
      return fallback;
  }
}

export async function saveRfqDraft(input: {
  id?: string | null;
  projectId: string;
  scopeKind: "work_area" | "written";
  workAreaId?: string | null;
  writtenScopeLabel?: string | null;
  requestedScope: string;
  measurementNotes: string;
  responseDueOn?: string | null;
  includeSiteAddress: boolean;
  siteDetails: string;
  questions: string;
  message: string;
  recipients: Array<{
    subcontractorId: string;
    contactId: string;
    selectionSource: "suggested" | "manual";
  }>;
  documentVersionIds: string[];
  pricingRequest?: "lump_sum" | "schedule";
  schedule?: Array<{
    id: string;
    scope: string;
    specification: string;
    quantity: string;
    unit: string;
    role: string;
  }>;
}): Promise<Ok<{ id: string }> | Fail> {
  const loaded = await requireRfqWriter();
  if (!loaded.ok) return loaded;
  const { data, error } = await loaded.context.supabase.rpc("save_rfq_draft_v1", {
    p_payload: {
      id: input.id ?? null,
      project_id: input.projectId,
      scope_kind: input.scopeKind,
      work_area_id: input.workAreaId ?? null,
      written_scope_label: input.writtenScopeLabel ?? null,
      requested_scope: input.requestedScope,
      measurement_notes: input.measurementNotes,
      response_due_on: input.responseDueOn || null,
      include_site_address: input.includeSiteAddress,
      site_details: input.siteDetails,
      questions: input.questions,
      message: input.message,
      recipients: input.recipients.map((recipient) => ({
        subcontractor_id: recipient.subcontractorId,
        contact_id: recipient.contactId,
        selection_source: recipient.selectionSource,
      })),
      document_version_ids: input.documentVersionIds,
    },
  });
  const message = error ? SAVE_FAILED : rpcError(data, SAVE_FAILED);
  if (message) return { ok: false, error: message };
  const id = (data as { id?: string }).id;
  if (!id) return { ok: false, error: SAVE_FAILED };
  const mode = input.pricingRequest === "schedule" ? "schedule" : "lump_sum";
  const modeResult = await loaded.context.supabase.rpc("set_rfq_pricing_request_v1", {
    p_rfq: id,
    p_mode: mode,
  });
  const modeMessage = modeResult.error ? SAVE_FAILED : rpcError(modeResult.data, SAVE_FAILED);
  if (modeMessage) return { ok: false, error: modeMessage };
  if (mode === "schedule") {
    const scheduleResult = await loaded.context.supabase.rpc("save_rfq_schedule_v1", {
      p_rfq: id,
      p_items: (input.schedule ?? []).map((row) => ({
        id: row.id,
        scope: row.scope,
        specification: row.specification,
        quantity: row.unit === "lump_sum" ? null : row.quantity,
        unit: row.unit,
        role: row.role,
      })),
    });
    const scheduleMessage = scheduleResult.error ? SAVE_FAILED : rpcError(scheduleResult.data, SAVE_FAILED);
    if (scheduleMessage) return { ok: false, error: scheduleMessage };
  }
  revalidatePath(`/app/projects/${input.projectId}/requests`);
  return { ok: true, id };
}

async function deliverRecipient(input: {
  supabase: NonNullable<Awaited<ReturnType<typeof getAuthOrgContext>>>["supabase"];
  recipientId: string;
  email: string;
  contactName: string;
  builderName: string;
  scopeLabel: string;
  responseDueOn: string | null;
  rawToken: string;
  idempotencyKey: string;
  pricingRequest: "lump_sum" | "schedule";
  logoUrl?: string | null;
}): Promise<{ status: "sent" | "failed" }> {
  const begun = await input.supabase.rpc("begin_rfq_delivery_v1", {
    p_recipient: input.recipientId,
    p_idempotency_key: input.idempotencyKey,
  });
  const delivery = (begun.data ?? {}) as { ok?: boolean; deliveryId?: string; status?: string };
  if (begun.error || delivery.ok !== true || !delivery.deliveryId) return { status: "failed" };
  if (delivery.status === "sent" || delivery.status === "delivered") return { status: "sent" };
  if (delivery.status === "failed") return { status: "failed" };
  const origin = resolveRfqPublicOrigin();
  const from = rfqDeliveryFromHeader(input.builderName);
  const provider = getQuoteDeliveryProvider();
  if (!origin || !from || !provider.isConfigured()) {
    await input.supabase.rpc("fail_rfq_delivery_v1", {
      p_delivery: delivery.deliveryId,
      p_failure_code: "not_configured",
    });
    return { status: "failed" };
  }
  const publicUrl = `${origin}${rfqPublicPath(input.rawToken)}`;
  const mail = buildRfqDeliveryEmail({
    builderName: input.builderName,
    contactName: input.contactName,
    scopeLabel: input.scopeLabel,
    responseDueOn: input.responseDueOn,
    publicUrl,
    pricingRequest: input.pricingRequest,
    logoUrl: input.logoUrl,
  });
  const sent = await provider.send({
    to: input.email,
    from,
    subject: mail.subject,
    html: mail.html,
    text: mail.text,
    idempotencyKey: input.idempotencyKey,
  });
  if (!sent.ok) {
    await input.supabase.rpc("fail_rfq_delivery_v1", {
      p_delivery: delivery.deliveryId,
      p_failure_code: sent.code,
    });
    return { status: "failed" };
  }
  const completed = await input.supabase.rpc("complete_rfq_delivery_v1", {
    p_delivery: delivery.deliveryId,
    p_provider_message_id: sent.providerMessageId,
  });
  const completedBody = (completed.data ?? {}) as { ok?: boolean };
  if (completed.error || completedBody.ok !== true) return { status: "failed" };
  let checked = await readSentRfqLink(sent.providerMessageId);
  if (checked.providerStatus !== "delivered" && checked.providerStatus !== "bounced" && checked.providerStatus !== "complained") {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    checked = await readSentRfqLink(sent.providerMessageId);
  }
  const preparedHost = new URL(origin).host;
  const providerHost = checked.host ?? "unavailable";
  const summary = checked.host
    ? `Mail service status: ${checked.providerStatus ?? "unknown"}. Provider link host: ${providerHost}. Prepared link host: ${preparedHost}.`
    : `Mail service status: ${checked.providerStatus ?? "unknown"}. Provider link host: unavailable. Prepared link host: ${preparedHost}. Provider read status: ${checked.readStatus ?? "none"}. HTML length: ${checked.htmlLength}. Text length: ${checked.textLength}.`;
  try {
    const admin = createAdminClient();
    const recipient = await admin.from("rfq_recipients").select("org_id, rfq_id").eq("id", input.recipientId).maybeSingle();
    if (recipient.data) {
      await admin.from("rfq_events").insert({
        org_id: recipient.data.org_id,
        rfq_id: recipient.data.rfq_id,
        recipient_id: input.recipientId,
        kind: "link_prepared",
        summary: summary.slice(0, 300),
        actor: "system",
      });
    }
  } catch {
    // The email was already accepted. A host note must not turn that into a failed send.
  }
  return { status: "sent" };
}

export async function sendRfq(input: {
  id?: string | null;
  projectId: string;
  scopeKind: "work_area" | "written";
  workAreaId?: string | null;
  writtenScopeLabel?: string | null;
  requestedScope: string;
  measurementNotes: string;
  responseDueOn?: string | null;
  includeSiteAddress: boolean;
  siteDetails: string;
  questions: string;
  message: string;
  recipients: Array<{
    subcontractorId: string;
    contactId: string;
    selectionSource: "suggested" | "manual";
  }>;
  documentVersionIds: string[];
  previewApproved?: boolean;
  pricingRequest?: "lump_sum" | "schedule";
  schedule?: Array<{
    id: string;
    scope: string;
    specification: string;
    quantity: string;
    unit: string;
    role: string;
  }>;
}): Promise<Ok<{ id: string; failed: number }> | Fail> {
  if (input.previewApproved !== true) {
    return { ok: false, error: "Review the request the recipient will see, then approve it before sending." };
  }
  const saved = await saveRfqDraft(input);
  if (!saved.ok) return saved;
  const loaded = await requireRfqWriter();
  if (!loaded.ok) return loaded;
  const { data: rows, error: loadError } = await loaded.context.supabase
    .from("rfq_recipients")
    .select("id, contact_name, contact_email")
    .eq("rfq_id", saved.id);
  if (loadError || !rows?.length) return { ok: false, error: SEND_FAILED };
  const rawByRecipient = new Map<string, string>();
  const payload = rows.map((row) => {
    const raw = generateRfqAccessToken();
    rawByRecipient.set(row.id, raw);
    return { recipient_id: row.id, token_hash: hashRfqAccessToken(raw) };
  });
  const sent = await loaded.context.supabase.rpc("send_rfq_v1", {
    p_rfq: saved.id,
    p_tokens: payload,
  });
  const sendMessage = sent.error ? SEND_FAILED : rpcError(sent.data, SEND_FAILED);
  if (sendMessage) return { ok: false, error: sendMessage };
  const rfq = await loaded.context.supabase
    .from("rfqs")
    .select("builder_name, work_area_name, written_scope_label, response_due_on, scope_kind, pricing_request")
    .eq("id", saved.id)
    .maybeSingle();
  const scopeLabel =
    rfq.data?.scope_kind === "work_area"
      ? rfq.data.work_area_name || "Requested work"
      : rfq.data?.written_scope_label || "Requested work";
  const logoRow = await loaded.context.supabase
    .from("organisation_settings")
    .select("logo_url")
    .eq("org_id", loaded.context.orgId)
    .maybeSingle();
  const logoUrl = rfqEmailLogoUrl(logoRow.data?.logo_url, process.env.NEXT_PUBLIC_SUPABASE_URL);
  let failed = 0;
  for (const row of rows) {
    const raw = rawByRecipient.get(row.id);
    if (!raw) {
      failed += 1;
      continue;
    }
    const result = await deliverRecipient({
      supabase: loaded.context.supabase,
      recipientId: row.id,
      email: row.contact_email,
      contactName: row.contact_name,
      builderName: rfq.data?.builder_name || "Your builder",
      scopeLabel,
      responseDueOn: rfq.data?.response_due_on ?? null,
      pricingRequest: rfq.data?.pricing_request === "schedule" ? "schedule" : "lump_sum",
      rawToken: raw,
      idempotencyKey: `rfq-send:${row.id}`,
      logoUrl,
    });
    if (result.status === "failed") failed += 1;
  }
  revalidatePath(`/app/projects/${input.projectId}/requests`);
  revalidatePath(`/app/projects/${input.projectId}/requests/${saved.id}`);
  return { ok: true, id: saved.id, failed };
}

export async function resendRfqRecipient(input: {
  projectId: string;
  rfqId: string;
  recipientId: string;
}): Promise<Ok<{ failed: boolean }> | Fail> {
  const loaded = await requireRfqWriter();
  if (!loaded.ok) return loaded;
  const raw = generateRfqAccessToken();
  const resent = await loaded.context.supabase.rpc("resend_rfq_recipient_v1", {
    p_recipient: input.recipientId,
    p_token_hash: hashRfqAccessToken(raw),
  });
  const message = resent.error ? SEND_FAILED : rpcError(resent.data, SEND_FAILED);
  if (message) return { ok: false, error: SEND_FAILED };
  const recipient = await loaded.context.supabase
    .from("rfq_recipients")
    .select("id, contact_name, contact_email, rfq_id")
    .eq("id", input.recipientId)
    .maybeSingle();
  const rfq = await loaded.context.supabase
    .from("rfqs")
    .select("builder_name, work_area_name, written_scope_label, response_due_on, scope_kind, pricing_request")
    .eq("id", input.rfqId)
    .maybeSingle();
  if (!recipient.data) return { ok: false, error: SEND_FAILED };
  const logoRow = await loaded.context.supabase
    .from("organisation_settings")
    .select("logo_url")
    .eq("org_id", loaded.context.orgId)
    .maybeSingle();
  const scopeLabel =
    rfq.data?.scope_kind === "work_area"
      ? rfq.data.work_area_name || "Requested work"
      : rfq.data?.written_scope_label || "Requested work";
  const result = await deliverRecipient({
    supabase: loaded.context.supabase,
    recipientId: input.recipientId,
    email: recipient.data.contact_email,
    contactName: recipient.data.contact_name,
    builderName: rfq.data?.builder_name || "Your builder",
    scopeLabel,
    responseDueOn: rfq.data?.response_due_on ?? null,
    pricingRequest: rfq.data?.pricing_request === "schedule" ? "schedule" : "lump_sum",
    rawToken: raw,
    idempotencyKey: `rfq-resend:${input.recipientId}:${Date.now()}`,
    logoUrl: rfqEmailLogoUrl(logoRow.data?.logo_url, process.env.NEXT_PUBLIC_SUPABASE_URL),
  });
  revalidatePath(`/app/projects/${input.projectId}/requests/${input.rfqId}`);
  return { ok: true, failed: result.status === "failed" };
}

export async function revokeRfqRecipient(input: {
  projectId: string;
  rfqId: string;
  recipientId: string;
}): Promise<{ ok: true } | Fail> {
  const loaded = await requireRfqWriter();
  if (!loaded.ok) return loaded;
  const revoked = await loaded.context.supabase.rpc("revoke_rfq_recipient_v1", {
    p_recipient: input.recipientId,
  });
  const message = revoked.error ? SEND_FAILED : rpcError(revoked.data, SEND_FAILED);
  if (message) return { ok: false, error: SEND_FAILED };
  revalidatePath(`/app/projects/${input.projectId}/requests/${input.rfqId}`);
  return { ok: true };
}

export async function signRfqResponseFile(input: {
  projectId: string;
  responseId: string;
}): Promise<Ok<{ url: string }> | Fail> {
  const context = await getAuthOrgContext();
  if (!context) return { ok: false, error: "You need to be signed in." };
  const visible = await context.supabase
    .from("rfq_response_files")
    .select("id, upload_status, original_filename")
    .eq("response_id", input.responseId)
    .maybeSingle();
  if (visible.error || !visible.data || visible.data.upload_status !== "ready") {
    return { ok: false, error: "That file is unavailable." };
  }
  const admin = createAdminClient();
  const stored = await admin
    .from("rfq_response_files")
    .select("org_id, storage_object_path, original_filename")
    .eq("id", visible.data.id)
    .maybeSingle();
  if (
    stored.error ||
    !stored.data ||
    stored.data.org_id !== context.orgId ||
    !stored.data.storage_object_path ||
    !stored.data.storage_object_path.startsWith(`${context.orgId}/`) ||
    stored.data.storage_object_path.includes("..")
  ) {
    return { ok: false, error: "That file is unavailable." };
  }
  const signed = await admin.storage
    .from("rfq-response-files")
    .createSignedUrl(stored.data.storage_object_path, 60, {
      download: stored.data.original_filename || "quotation.pdf",
    });
  if (signed.error || !signed.data?.signedUrl) {
    return { ok: false, error: "That file is unavailable." };
  }
  return { ok: true, url: signed.data.signedUrl };
}

export async function draftRfqFromJobDetails(input: {
  projectId: string;
  workAreaId: string;
}): Promise<Ok<Awaited<ReturnType<typeof draftRfqJobFacts>>> | Fail> {
  const loaded = await requireRfqWriter();
  if (!loaded.ok) return loaded;
  try {
    const draft = await draftRfqJobFacts(loaded.context.supabase, loaded.context.orgId, input.projectId, input.workAreaId);
    return { ok: true, ...draft };
  } catch {
    return { ok: false, error: "Job details could not be drafted. You can still write the request yourself." };
  }
}

export async function answerRfqQuestion(input: {
  projectId: string;
  rfqId: string;
  clarificationId: string;
  body: string;
  reviewedBody: string;
  audience: "private" | "all";
  clarification: "clarifies" | "changes";
}): Promise<Ok<{ failed: number }> | Fail> {
  if (input.clarification !== "clarifies") {
    return { ok: false, error: rpcError({ error: "SCOPE_CHANGE" }, SEND_FAILED) };
  }
  const body = input.body.trim();
  if (body !== input.reviewedBody.trim()) {
    return { ok: false, error: "Review the exact message, then send that wording." };
  }
  const loaded = await requireRfqWriter();
  if (!loaded.ok) return loaded;
  const question = await loaded.context.supabase
    .from("rfq_clarifications")
    .select("id, body, recipient_id, from_recipient")
    .eq("id", input.clarificationId)
    .maybeSingle();
  if (!question.data || question.data.from_recipient !== true) {
    return { ok: false, error: "That question is no longer available." };
  }
  const recipients = await loaded.context.supabase
    .from("rfq_recipients")
    .select("id, trading_name, contact_name, contact_email")
    .eq("rfq_id", input.rfqId);
  const asker = (recipients.data ?? []).find((recipient) => recipient.id === question.data?.recipient_id);
  if (input.audience === "all" && asker) {
    const leak = sharedAnswerLeak(body, {
      names: [asker.trading_name, asker.contact_name],
      emails: [asker.contact_email],
      phones: [],
      question: question.data.body,
    });
    if (leak) return { ok: false, error: leak };
  }
  const answered = await loaded.context.supabase.rpc("answer_rfq_clarification_v1", {
    p_payload: {
      clarification_id: input.clarificationId,
      body,
      audience: input.audience,
      scope_unchanged: "true",
    },
  });
  const message = answered.error
    ? "Could not record the answer. Please try again."
    : rpcError(answered.data, "Could not record the answer. Please try again.");
  if (message) return { ok: false, error: message };
  const answeredPayload = (answered.data ?? {}) as { recipientIds?: string[]; answerIds?: string[] };
  const recipientIds = answeredPayload.recipientIds ?? [];
  const answerIds = answeredPayload.answerIds ?? [];
  const rfq = await loaded.context.supabase
    .from("rfqs")
    .select("builder_name, work_area_name, written_scope_label, scope_kind")
    .eq("id", input.rfqId)
    .maybeSingle();
  const scopeLabel = rfq.data?.scope_kind === "work_area"
    ? rfq.data.work_area_name || "Requested work"
    : rfq.data?.written_scope_label || "Requested work";
  const origin = resolveRfqPublicOrigin();
  const from = rfqDeliveryFromHeader(rfq.data?.builder_name || "Your builder");
  const provider = getQuoteDeliveryProvider();
  const admin = createAdminClient();
  async function recordDelivery(recipientId: string, state: "sent" | "failed") {
    if (answerIds.length === 0) return;
    await admin.from("rfq_clarifications").update({ delivery_state: state }).in("id", answerIds).eq("recipient_id", recipientId);
  }
  let failed = 0;
  for (const recipientId of recipientIds) {
    const recipient = (recipients.data ?? []).find((item) => item.id === recipientId);
    if (!recipient || !origin || !from || !provider.isConfigured()) {
      failed += 1;
      await recordDelivery(recipientId, "failed");
      await admin.from("rfq_events").insert({
        org_id: loaded.context.orgId,
        rfq_id: input.rfqId,
        recipient_id: recipientId,
        kind: "answer_email_failed",
        summary: "The answer was saved. The email was not sent.",
        actor: "system",
      });
      continue;
    }
    const raw = generateRfqAccessToken();
    const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const token = await admin.from("rfq_access_tokens").insert({
      org_id: loaded.context.orgId,
      recipient_id: recipientId,
      token_hash: hashRfqAccessToken(raw),
      expires_at: expires,
      created_by: loaded.context.user.id,
    });
    if (token.error) {
      failed += 1;
      await recordDelivery(recipientId, "failed");
      continue;
    }
    const mail = buildRfqAnswerEmail({
      builderName: rfq.data?.builder_name || "Your builder",
      contactName: recipient.contact_name,
      scopeLabel,
      answer: body,
      publicUrl: `${origin}${rfqPublicPath(raw)}`,
      audience: input.audience,
    });
    const sent = await provider.send({
      to: recipient.contact_email,
      from,
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
      idempotencyKey: `rfq-answer-${answerIds[recipientIds.indexOf(recipientId)] ?? recipientId}-${recipientId}`,
    });
    await recordDelivery(recipientId, sent.ok ? "sent" : "failed");
    await admin.from("rfq_events").insert({
      org_id: loaded.context.orgId,
      rfq_id: input.rfqId,
      recipient_id: recipientId,
      kind: sent.ok ? "answer_emailed" : "answer_email_failed",
      summary: sent.ok ? "Answer email accepted." : "The answer was saved. The email was not accepted.",
      actor: "system",
    });
    if (!sent.ok) failed += 1;
  }
  revalidatePath(`/app/projects/${input.projectId}/requests/${input.rfqId}`);
  return { ok: true, failed };
}

export async function markRfqQuestionNotificationsRead(input: {
  projectId: string;
  rfqId: string;
}): Promise<void> {
  const context = await getAuthOrgContext();
  if (!context) return;
  const notes = await context.supabase
    .from("notifications")
    .select("id, payload")
    .eq("recipient_user_id", context.user.id)
    .eq("notification_type", "rfq_question")
    .is("read_at", null);
  const ids = (notes.data ?? []).flatMap((note) => {
    const payload = note.payload as { rfqId?: string } | null;
    return payload?.rfqId === input.rfqId ? [note.id as string] : [];
  });
  if (ids.length === 0) return;
  await context.supabase.rpc("mark_notifications_read_v1", { p_ids: ids });
}
