"use server";

import { createClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { uploadProjectDocumentToSignedUrl } from "@/lib/projects/document-direct-upload";
import { sniffVariationAttachment } from "@/lib/variations/attachment-files";
import { hashRfqAccessToken, isRfqAccessTokenFormat } from "@/lib/rfqs/token";

const UNAVAILABLE = "This request is unavailable.";
const EXPIRED = "This link has expired.";
const LIMITED = "Too many attempts. Wait a few minutes and try again.";

function anonClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return null;
  return createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function publicError(code: string | undefined): string {
  if (code === "RATE_LIMITED") return LIMITED;
  if (code === "EXPIRED") return EXPIRED;
  if (code === "DUPLICATE") return "That response is already submitted. Send a revision if it needs to change.";
  if (code === "FILE_TYPE") return "Attach a PDF of 15 MB or smaller.";
  if (code === "STALE_SCHEDULE") return "This request was replaced. Open the latest link before pricing it.";
  if (code === "NOT_PRICED_REASON") return "Give a reason for each required item you cannot price.";
  if (code === "INCOMPLETE") return "Price or mark every required item before submitting.";
  if (code === "DUPLICATE_ROW") return "Each schedule item can only be answered once.";
  return UNAVAILABLE;
}

export async function clarifyRfq(input: { token: string; body: string }): Promise<{ error?: string }> {
  if (!isRfqAccessTokenFormat(input.token)) return { error: UNAVAILABLE };
  const supabase = anonClient();
  if (!supabase) return { error: UNAVAILABLE };
  const { data, error } = await supabase.rpc("public_rfq_clarify_v1", {
    p_token_hash: hashRfqAccessToken(input.token),
    p_body: input.body,
  });
  const body = (data ?? {}) as { ok?: boolean; error?: string };
  if (error || body.ok !== true) return { error: publicError(body.error) };
  return {};
}

export async function declineRfq(input: { token: string; message: string }): Promise<{ error?: string }> {
  if (!isRfqAccessTokenFormat(input.token)) return { error: UNAVAILABLE };
  const supabase = anonClient();
  if (!supabase) return { error: UNAVAILABLE };
  const { data, error } = await supabase.rpc("public_rfq_decline_v1", {
    p_token_hash: hashRfqAccessToken(input.token),
    p_message: input.message,
  });
  const body = (data ?? {}) as { ok?: boolean; error?: string };
  if (error || body.ok !== true) return { error: publicError(body.error) };
  return {};
}

export async function saveRfqResponse(input: {
  token: string;
  confirm: boolean;
  revise: boolean;
  priceExGst: string;
  gstTreatment: string;
  pricingStructure: string;
  includedScope: string;
  excludedScope: string;
  assumptions: string;
  leadTime: string;
  validUntil: string;
  message: string;
}): Promise<{ error?: string; responseId?: string }> {
  if (!isRfqAccessTokenFormat(input.token)) return { error: UNAVAILABLE };
  const supabase = anonClient();
  if (!supabase) return { error: UNAVAILABLE };
  const { data, error } = await supabase.rpc("public_rfq_save_response_v1", {
    p_token_hash: hashRfqAccessToken(input.token),
    p_payload: {
      price_ex_gst: input.priceExGst,
      gst_treatment: input.gstTreatment,
      pricing_structure: input.pricingStructure,
      included_scope: input.includedScope,
      excluded_scope: input.excludedScope,
      assumptions: input.assumptions,
      lead_time: input.leadTime,
      valid_until: input.validUntil || null,
      message: input.message,
    },
    p_confirm: input.confirm,
    p_revise: input.revise,
  });
  const body = (data ?? {}) as { ok?: boolean; error?: string; responseId?: string };
  if (error || body.ok !== true || !body.responseId) return { error: publicError(body.error) };
  return { responseId: body.responseId };
}

export async function saveRfqScheduleResponse(input: {
  token: string;
  confirm: boolean;
  revise: boolean;
  requestSentAt: string;
  gstTreatment: string;
  includedScope: string;
  excludedScope: string;
  assumptions: string;
  leadTime: string;
  validUntil: string;
  message: string;
  lines: Array<{
    scheduleItemId: string;
    decision: "priced" | "not_priced" | "excluded";
    unitPrice: string;
    reason: string;
    qualification: string;
  }>;
}): Promise<{ error?: string; responseId?: string }> {
  if (!isRfqAccessTokenFormat(input.token)) return { error: UNAVAILABLE };
  const supabase = anonClient();
  if (!supabase) return { error: UNAVAILABLE };
  const { data, error } = await supabase.rpc("public_rfq_save_schedule_response_v1", {
    p_token_hash: hashRfqAccessToken(input.token),
    p_payload: {
      request_sent_at: input.requestSentAt,
      gst_treatment: input.gstTreatment,
      included_scope: input.includedScope,
      excluded_scope: input.excludedScope,
      assumptions: input.assumptions,
      lead_time: input.leadTime,
      valid_until: input.validUntil || null,
      message: input.message,
      lines: input.lines.map((line) => ({
        schedule_item_id: line.scheduleItemId,
        decision: line.decision,
        unit_price: line.decision === "priced" ? line.unitPrice : null,
        reason: line.reason,
        qualification: line.qualification,
      })),
    },
    p_confirm: input.confirm,
    p_revise: input.revise,
  });
  const body = (data ?? {}) as { ok?: boolean; error?: string; responseId?: string };
  if (error || body.ok !== true || !body.responseId) return { error: publicError(body.error) };
  return { responseId: body.responseId };
}

export async function uploadRfqResponsePdf(formData: FormData): Promise<{ error?: string }> {
  const token = String(formData.get("token") ?? "");
  const responseId = String(formData.get("responseId") ?? "");
  const file = formData.get("file");
  if (!isRfqAccessTokenFormat(token) || !/^[0-9a-f-]{36}$/i.test(responseId) || !(file instanceof File)) {
    return { error: "Attach a PDF of 15 MB or smaller." };
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const sniffed = sniffVariationAttachment(bytes, file.name);
  if (!sniffed || sniffed.mime !== "application/pdf" || bytes.byteLength > 15 * 1024 * 1024) {
    return { error: "Attach a PDF of 15 MB or smaller." };
  }
  const supabase = anonClient();
  if (!supabase) return { error: UNAVAILABLE };
  const prepared = await supabase.rpc("prepare_rfq_response_upload_v1", {
    p_token_hash: hashRfqAccessToken(token),
    p_response: responseId,
    p_filename: file.name,
    p_byte_size: bytes.byteLength,
  });
  const preparedBody = (prepared.data ?? {}) as { ok?: boolean; error?: string; fileId?: string };
  if (prepared.error || preparedBody.ok !== true || !preparedBody.fileId) {
    return { error: publicError(preparedBody.error) };
  }
  const admin = createAdminClient();
  const path = await admin.rpc("rfq_response_upload_path_v1", {
    p_token_hash: hashRfqAccessToken(token),
    p_file: preparedBody.fileId,
  });
  const pathBody = (path.data ?? {}) as { ok?: boolean; path?: string };
  if (path.error || pathBody.ok !== true || !pathBody.path || pathBody.path.includes("..")) {
    await admin.rpc("fail_rfq_response_upload_v1", { p_file: preparedBody.fileId });
    return { error: UNAVAILABLE };
  }
  const signed = await admin.storage.from("rfq-response-files").createSignedUploadUrl(pathBody.path, { upsert: true });
  if (signed.error || !signed.data?.signedUrl) {
    await admin.rpc("fail_rfq_response_upload_v1", { p_file: preparedBody.fileId });
    return { error: UNAVAILABLE };
  }
  try {
    await uploadProjectDocumentToSignedUrl({
      signedUrl: signed.data.signedUrl,
      file,
      upsert: true,
      onProgress: () => undefined,
      signal: AbortSignal.timeout(20000),
    });
  } catch {
    await admin.storage.from("rfq-response-files").remove([pathBody.path]);
    await admin.rpc("fail_rfq_response_upload_v1", { p_file: preparedBody.fileId });
    return { error: "The PDF could not be stored." };
  }
  const stored = await admin.storage.from("rfq-response-files").download(pathBody.path);
  const storedBytes = stored.data ? new Uint8Array(await stored.data.arrayBuffer()) : null;
  const confirmed = storedBytes ? sniffVariationAttachment(storedBytes, file.name) : null;
  if (!confirmed || confirmed.mime !== "application/pdf" || storedBytes?.byteLength !== bytes.byteLength) {
    await admin.storage.from("rfq-response-files").remove([pathBody.path]);
    await admin.rpc("fail_rfq_response_upload_v1", { p_file: preparedBody.fileId });
    return { error: "Attach a PDF of 15 MB or smaller." };
  }
  const completed = await admin.rpc("complete_rfq_response_upload_v1", {
    p_file: preparedBody.fileId,
    p_byte_size: bytes.byteLength,
  });
  const completedBody = (completed.data ?? {}) as { ok?: boolean };
  if (completed.error || completedBody.ok !== true) return { error: UNAVAILABLE };
  return {};
}
