"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { resolveConfiguredSiteOrigin } from "@/lib/auth/site-url";
import { getQuoteDeliveryProvider } from "@/lib/quotes/delivery-provider";
import { getAuthOrgContext } from "@/lib/security/auth-org-context";
import { parseVariationDocumentIdentity } from "@/lib/variations/document-identity";
import {
  buildVariationDeliveryEmail,
  variationDeliveryFromHeader,
} from "@/lib/variations/delivery-email";
import {
  generateVariationAccessToken,
  hashVariationAccessToken,
  variationPublicPath,
} from "@/lib/variations/delivery-token";

const sendSchema = z.object({
  projectId: z.string().uuid(),
  variationId: z.string().uuid(),
  revisionId: z.string().uuid(),
  recipientEmail: z.string().trim().email().max(200),
  recipientName: z.string().trim().max(200).optional(),
  idempotencyKey: z.string().trim().min(8).max(200),
});

type SendOk = {
  ok: true;
  status: "sent";
  recipientEmail: string;
  sentAt: string;
  clientPath: string | null;
  kind: "send" | "resend";
};

type SendFail = { ok: false; error: string };

const COPY: Record<string, string> = {
  NOT_AUTHENTICATED: "Sign in to send this Variation.",
  NOT_FOUND: "That Variation could not be found.",
  CROSS_TENANT: "That Variation could not be found.",
  CROSS_PROJECT: "That Variation could not be found.",
  DRAFT: "Issue this Variation before sending it.",
  WITHDRAWN: "This Variation has been withdrawn.",
  STALE_REVISION: "This revision is no longer the current Variation.",
  NOT_ELIGIBLE: "This Variation can't be sent.",
  INVALID_EMAIL: "Enter a valid recipient email.",
  IN_PROGRESS: "A send is already in progress.",
  PROJECT_CLOSED: "This project is closed.",
  IDENTITY_REQUIRED: "This Variation can’t be sent until the accepted Quote reference and client name are recorded.",
};

function fail(code: string | undefined, fallback = "The Variation could not be sent."): SendFail {
  return { ok: false, error: COPY[code ?? ""] ?? fallback };
}

export async function sendVariationToClient(input: unknown): Promise<SendOk | SendFail> {
  const parsed = sendSchema.safeParse(input);
  if (!parsed.success) return fail("INVALID_EMAIL");
  const context = await getAuthOrgContext();
  if (!context) return fail("NOT_AUTHENTICATED");

  const rawToken = generateVariationAccessToken();
  const { data, error } = await context.supabase.rpc("begin_variation_delivery_v1", {
    p_project: parsed.data.projectId,
    p_variation: parsed.data.variationId,
    p_revision: parsed.data.revisionId,
    p_recipient_email: parsed.data.recipientEmail,
    p_recipient_name: parsed.data.recipientName ?? null,
    p_token_hash: hashVariationAccessToken(rawToken),
    p_idempotency_key: parsed.data.idempotencyKey,
  });
  if (error) return fail("NOT_ELIGIBLE");
  const begun = (data ?? {}) as {
    ok?: boolean;
    error?: string;
    deliveryId?: string;
    status?: string;
    kind?: string;
    revisionId?: string;
    idempotent?: boolean;
  };
  if (begun.ok !== true || !begun.deliveryId) return fail(begun.error);
  if (begun.revisionId !== parsed.data.revisionId) return fail("STALE_REVISION");

  const clientPath = variationPublicPath(rawToken);
  if (begun.status === "sent") {
    return {
      ok: true,
      status: "sent",
      recipientEmail: parsed.data.recipientEmail.trim().toLowerCase(),
      sentAt: new Date().toISOString(),
      clientPath: begun.idempotent ? null : clientPath,
      kind: begun.kind === "resend" ? "resend" : "send",
    };
  }
  if (begun.status === "failed") {
    return fail("NOT_ELIGIBLE", "The previous send failed. Try again.");
  }

  const [revision, variation] = await Promise.all([
    context.supabase
      .from("variation_revisions")
      .select("id, revision_number, title, total_adjustment_incl_gst, currency, status, document_identity")
      .eq("id", parsed.data.revisionId)
      .maybeSingle(),
    context.supabase
      .from("variations")
      .select("variation_number, project_id")
      .eq("id", parsed.data.variationId)
      .maybeSingle(),
  ]);

  const revisionRow = revision.data;
  const identity = parseVariationDocumentIdentity(revisionRow?.document_identity);
  const rawAdjustment = revisionRow?.total_adjustment_incl_gst;
  const adjustment = Number(rawAdjustment);
  const origin = resolveConfiguredSiteOrigin();
  const from = variationDeliveryFromHeader(identity?.companyName ?? "");
  const snapshotReady =
    revisionRow?.id === parsed.data.revisionId &&
    revisionRow.status === "issued" &&
    variation.data?.project_id === parsed.data.projectId &&
    typeof revisionRow.title === "string" &&
    revisionRow.title.trim() !== "" &&
    rawAdjustment != null &&
    Number.isFinite(adjustment) &&
    identity?.available === true &&
    origin &&
    from;

  if (!snapshotReady || !revisionRow || !variation.data || !identity) {
    await context.supabase.rpc("fail_variation_delivery_v1", {
      p_delivery: begun.deliveryId,
      p_code: "snapshot_unavailable",
      p_message: "The issued Variation could not be prepared for email.",
    });
    return fail(
      identity?.available === false ? "IDENTITY_REQUIRED" : "NOT_ELIGIBLE",
      identity?.available === false
        ? "This Variation can’t be sent until the accepted Quote reference and client name are recorded."
        : "The issued Variation could not be prepared for email."
    );
  }

  const attachmentCount = await context.supabase
    .from("variation_attachments")
    .select("id", { count: "exact", head: true })
    .eq("variation_revision_id", parsed.data.revisionId)
    .eq("visibility", "client")
    .eq("upload_status", "ready");
  const clientAttachmentCount = attachmentCount.count ?? 0;

  const email = buildVariationDeliveryEmail({
    companyName: identity.companyName,
    clientName: identity.clientName,
    projectTitle: identity.projectTitle,
    variationNumber: variation.data.variation_number,
    revisionNumber: revisionRow.revision_number,
    title: revisionRow.title,
    adjustmentInclGst: adjustment,
    currency: typeof revisionRow.currency === "string" ? revisionRow.currency : "NZD",
    publicUrl: `${origin}${clientPath}`,
    contactEmail: identity.email,
    contactPhone: identity.phone,
    logoUrl: identity.logoUrl,
    quoteNumber: identity.quoteNumber,
    quoteRevision: identity.quoteRevision,
    contractorAddress: identity.address,
    clientAttachmentCount: clientAttachmentCount,
  });

  const provider = getQuoteDeliveryProvider();
  const sent = await provider.send({
    to: parsed.data.recipientEmail.trim().toLowerCase(),
    from,
    subject: email.subject,
    html: email.html,
    text: email.text,
    idempotencyKey: parsed.data.idempotencyKey,
  });

  if (!sent.ok) {
    await context.supabase.rpc("fail_variation_delivery_v1", {
      p_delivery: begun.deliveryId,
      p_code: sent.code,
      p_message: sent.messageSafe,
    });
    return { ok: false, error: sent.messageSafe };
  }

  const completed = await context.supabase.rpc("complete_variation_delivery_v1", {
    p_delivery: begun.deliveryId,
    p_provider_message_id: sent.providerMessageId,
  });
  const done = (completed.data ?? {}) as { ok?: boolean; error?: string; status?: string; kind?: string };
  if (completed.error || done.ok !== true || done.status !== "sent") {
    return fail(done.error, "The email may not have been recorded. Check delivery history before trying again.");
  }

  revalidatePath(`/app/projects/${parsed.data.projectId}/variations`);
  revalidatePath(`/app/projects/${parsed.data.projectId}/variations/${parsed.data.variationId}`);
  return {
    ok: true,
    status: "sent",
    recipientEmail: parsed.data.recipientEmail.trim().toLowerCase(),
    sentAt: new Date().toISOString(),
    clientPath,
    kind: done.kind === "resend" ? "resend" : "send",
  };
}
