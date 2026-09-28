"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { resolveConfiguredSiteOrigin } from "@/lib/auth/site-url";
import { getQuoteDeliveryProvider } from "@/lib/quotes/delivery-provider";
import {
  clientIpFromHeaders,
  userAgentFromHeaders,
} from "@/lib/quotes/acceptance-request";
import { getAuthOrgContext } from "@/lib/security/auth-org-context";
import { hashVariationAccessToken, isVariationAccessTokenFormat } from "@/lib/variations/delivery-token";
import {
  buildVariationClientConfirmationEmail,
  buildVariationResponseNotificationEmail,
} from "@/lib/variations/response-email";
import { loadVariationResponseReceiptByIds } from "@/lib/variations/response-receipt-load";
import { VARIATION_MANUAL_EVIDENCE_TYPES, manualEvidenceNoteProblem } from "@/lib/variations/response";
import { createClient } from "@supabase/supabase-js";

const clientSchema = z.object({
  token: z.string().trim().min(20).max(200),
  outcome: z.enum(["accepted", "declined"]),
  responderName: z.string().trim().min(1).max(200),
  responderEmail: z.string().trim().email().max(200),
  declineReason: z.string().trim().max(2000).optional(),
  confirmAuthority: z.boolean(),
  confirmScope: z.boolean(),
  confirmAttachments: z.boolean(),
  confirmMasterTerms: z.boolean(),
  confirmFinal: z.boolean(),
  idempotencyKey: z.string().trim().min(8).max(200),
});

const manualSchema = z.object({
  projectId: z.string().uuid(),
  variationId: z.string().uuid(),
  revisionId: z.string().uuid(),
  outcome: z.enum(["accepted", "declined"]),
  responderName: z.string().trim().min(1).max(200),
  responderEmail: z.string().trim().email().max(200).optional().or(z.literal("")),
  evidenceType: z.enum(VARIATION_MANUAL_EVIDENCE_TYPES),
  evidenceNote: z.string().trim().min(1).max(2000),
  confirmReceived: z.boolean(),
  idempotencyKey: z.string().trim().min(8).max(200),
});

export type VariationResponseDeliveryState = "sent" | "failed" | "skipped";

export type VariationResponseActionResult = {
  ok: boolean;
  error?: string;
  outcome?: "accepted" | "declined";
  idempotent?: boolean;
  clientEmail?: VariationResponseDeliveryState;
  contractorEmail?: VariationResponseDeliveryState;
};

const COPY: Record<string, string> = {
  NOT_FOUND: "This Variation is unavailable.",
  NOT_AUTHENTICATED: "Sign in to record this response.",
  DRAFT: "A draft Variation cannot be accepted or declined.",
  WITHDRAWN: "This Variation has been withdrawn.",
  STALE_REVISION: "This revision is no longer the current Variation.",
  INVALID_TRANSITION: "This Variation already has a final outcome.",
  CONFIRMATION_REQUIRED: "Confirm each required statement before continuing.",
  EVIDENCE_NOTE_REQUIRED: "Add a note that explains how this outcome was received.",
  MANIFEST_UNRESOLVED: "The supporting attachments on this Variation could not be confirmed, so it cannot be accepted yet.",
  UNRESOLVED_PRICING: "This Variation does not have a complete issued price, so it cannot be accepted or declined.",
  INVALID_INPUT: "Check the name, email and confirmation, then try again.",
  CROSS_TENANT: "That Variation could not be found.",
  CROSS_PROJECT: "That Variation could not be found.",
};

function fail(code: string | undefined): VariationResponseActionResult {
  return { ok: false, error: COPY[code ?? ""] ?? "This Variation could not be updated. Refresh the page and try again." };
}

function createPublicSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return null;
  return createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function readResult(data: unknown): Record<string, unknown> | null {
  if (!data || typeof data !== "object") return null;
  return data as Record<string, unknown>;
}

async function notifyContractor(
  row: Record<string, unknown>,
  token: string
): Promise<{ clientEmail: VariationResponseDeliveryState; contractorEmail: VariationResponseDeliveryState }> {
  if (row.idempotent === true) return { clientEmail: "skipped", contractorEmail: "skipped" };
  const projectId = typeof row.projectId === "string" ? row.projectId : "";
  const variationId = typeof row.variationId === "string" ? row.variationId : "";
  const responseId = typeof row.responseId === "string" ? row.responseId : variationId;
  if (!projectId || !variationId) return { clientEmail: "failed", contractorEmail: "failed" };
  const receipt = await loadVariationResponseReceiptByIds({ projectId, variationId });
  if (!receipt) return { clientEmail: "failed", contractorEmail: "failed" };
  const origin = await resolveConfiguredSiteOrigin();
  if (!origin) return { clientEmail: "failed", contractorEmail: "failed" };
  const provider = getQuoteDeliveryProvider();
  let clientEmail: VariationResponseDeliveryState = "skipped";
  let contractorEmail: VariationResponseDeliveryState = "skipped";
  const clientTo = receipt.responderEmail?.trim() ?? "";
  if (clientTo.includes("@")) {
    const built = buildVariationClientConfirmationEmail({
      receipt,
      recordUrl: `${origin}/v/${token}/response`,
    });
    if (built.from) {
      try {
        const sent = await provider.send({
          to: clientTo,
          from: built.from,
          subject: built.subject,
          html: built.html,
          text: built.text,
          idempotencyKey: `variation-response-client:${responseId}`,
        });
        clientEmail = sent.ok ? "sent" : "failed";
      } catch {
        clientEmail = "failed";
      }
    } else {
      clientEmail = "failed";
    }
  }
  const contractorTo = typeof row.notifyEmail === "string" ? row.notifyEmail.trim() : "";
  if (contractorTo.includes("@")) {
    const built = buildVariationResponseNotificationEmail({
      receipt,
      internalUrl: `${origin}/app/projects/${projectId}/variations/${variationId}`,
    });
    if (built.from) {
      try {
        const sent = await provider.send({
          to: contractorTo,
          from: built.from,
          subject: built.subject,
          html: built.html,
          text: built.text,
          idempotencyKey: `variation-response-contractor:${responseId}`,
        });
        contractorEmail = sent.ok ? "sent" : "failed";
      } catch {
        contractorEmail = "failed";
      }
    } else {
      contractorEmail = "failed";
    }
  }
  return { clientEmail, contractorEmail };
}

export async function respondToVariationAsClient(input: unknown): Promise<VariationResponseActionResult> {
  const parsed = clientSchema.safeParse(input);
  if (!parsed.success) return fail("INVALID_INPUT");
  if (!isVariationAccessTokenFormat(parsed.data.token)) return fail("NOT_FOUND");
  if (!parsed.data.confirmFinal) return fail("CONFIRMATION_REQUIRED");
  if (parsed.data.outcome === "accepted") {
    if (!parsed.data.confirmAuthority || !parsed.data.confirmScope || !parsed.data.confirmMasterTerms) {
      return fail("CONFIRMATION_REQUIRED");
    }
  }
  const supabase = createPublicSupabase();
  if (!supabase) return fail("NOT_FOUND");
  const headerList = await headers();
  const { data, error } = await supabase.rpc("respond_to_variation_by_token_v1", {
    p_token_hash: hashVariationAccessToken(parsed.data.token),
    p_outcome: parsed.data.outcome,
    p_responder_name: parsed.data.responderName,
    p_responder_email: parsed.data.responderEmail,
    p_decline_reason: parsed.data.outcome === "declined" ? parsed.data.declineReason ?? null : null,
    p_confirm_authority: parsed.data.confirmAuthority,
    p_confirm_scope: parsed.data.confirmScope,
    p_confirm_attachments: parsed.data.confirmAttachments,
    p_confirm_master_terms: parsed.data.confirmMasterTerms,
    p_confirm_final: parsed.data.confirmFinal,
    p_idempotency_key: parsed.data.idempotencyKey,
    p_ip: clientIpFromHeaders(headerList),
    p_user_agent: userAgentFromHeaders(headerList),
  });
  if (error) return fail("NOT_FOUND");
  const row = readResult(data);
  if (!row || row.ok !== true) return fail(typeof row?.error === "string" ? row.error : undefined);
  let delivery: { clientEmail: VariationResponseDeliveryState; contractorEmail: VariationResponseDeliveryState } = {
    clientEmail: "failed",
    contractorEmail: "failed",
  };
  try {
    delivery = await notifyContractor(row, parsed.data.token);
  } catch {
    delivery = { clientEmail: "failed", contractorEmail: "failed" };
  }
  const outcome = row.outcome === "declined" ? "declined" : "accepted";
  return { ok: true, outcome, idempotent: row.idempotent === true, ...delivery };
}

export async function recordVariationResponse(input: unknown): Promise<VariationResponseActionResult> {
  const parsed = manualSchema.safeParse(input);
  if (!parsed.success) return fail("INVALID_INPUT");
  if (!parsed.data.confirmReceived) return fail("CONFIRMATION_REQUIRED");
  const noteProblem = manualEvidenceNoteProblem(parsed.data.evidenceType, parsed.data.evidenceNote);
  if (noteProblem) return fail("EVIDENCE_NOTE_REQUIRED");
  const context = await getAuthOrgContext();
  if (!context) return fail("NOT_AUTHENTICATED");
  const email = parsed.data.responderEmail?.trim() ? parsed.data.responderEmail.trim() : null;
  const { data, error } = await context.supabase.rpc("record_variation_response_v1", {
    p_project: parsed.data.projectId,
    p_variation: parsed.data.variationId,
    p_revision: parsed.data.revisionId,
    p_outcome: parsed.data.outcome,
    p_responder_name: parsed.data.responderName,
    p_responder_email: email,
    p_evidence_type: parsed.data.evidenceType,
    p_evidence_note: parsed.data.evidenceNote.trim(),
    p_confirm_received: true,
    p_idempotency_key: parsed.data.idempotencyKey,
  });
  if (error) return fail("INVALID_TRANSITION");
  const row = readResult(data);
  if (!row || row.ok !== true) return fail(typeof row?.error === "string" ? row.error : undefined);
  revalidatePath(`/app/projects/${parsed.data.projectId}/variations`);
  revalidatePath(`/app/projects/${parsed.data.projectId}/variations/${parsed.data.variationId}`);
  const outcome = row.outcome === "declined" ? "declined" : "accepted";
  return { ok: true, outcome, idempotent: row.idempotent === true };
}
