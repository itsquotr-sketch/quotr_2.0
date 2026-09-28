"use server";

import { revalidatePath } from "next/cache";
import { getAuthOrgContext } from "@/lib/security/auth-org-context";
import { assertOrgOwnsActiveProject } from "@/lib/security/org-ownership";
import {
  VARIATION_ATTACHMENT_BUCKET,
  canDeleteVariationAttachmentObject,
  sniffVariationAttachment,
  type VariationAttachmentVisibility,
} from "@/lib/variations/attachment-files";
import { createAdminClient } from "@/lib/supabase/admin";
import type { VariationAttachmentView } from "@/lib/variations/workspace-types";

type Fail = { ok: false; error: string; attachmentId?: string };
type Ok<T> = { ok: true } & T;

const COPY: Record<string, string> = {
  NOT_AUTHENTICATED: "You need to sign in.",
  NOT_FOUND: "That file could not be found.",
  FILE_TYPE: "Use a JPG, PNG, PDF, DOCX or XLSX file.",
  FILE_TOO_LARGE: "Each file must be 15 MB or smaller.",
  ATTACHMENT_LIMIT: "This revision already has 20 files.",
  ATTACHMENT_INCOMPLETE: "Finish or remove the client attachments that are still uploading or failed.",
  MISSING_OBJECT: "That file did not finish uploading. Remove it and try again.",
  IMMUTABLE: "Issued Variation files cannot be changed.",
  INVALID_INPUT: "Check the file details and try again.",
};

function fail(code: string | undefined): Fail {
  return { ok: false, error: COPY[code ?? ""] ?? "That file could not be saved." };
}

function isVisibility(value: string): value is VariationAttachmentVisibility {
  return value === "client" || value === "internal";
}

async function ownedRevision(input: { projectId: string; variationId: string; revisionId: string }) {
  const context = await getAuthOrgContext();
  if (!context) return fail("NOT_AUTHENTICATED");
  const owned = await assertOrgOwnsActiveProject(context, input.projectId);
  if ("error" in owned) return fail("NOT_FOUND");
  const revision = await context.supabase
    .from("variation_revisions")
    .select("id, project_id, variation_id, status")
    .eq("id", input.revisionId)
    .maybeSingle();
  const row = revision.data as { id: string; project_id: string; variation_id: string; status: string } | null;
  if (revision.error || !row || row.project_id !== owned.projectId || row.variation_id !== input.variationId) {
    return fail("NOT_FOUND");
  }
  return { ok: true as const, context, orgId: context.orgId, revision: row };
}

function mapRow(row: {
  id: string;
  variation_revision_id: string;
  visibility: string;
  display_filename: string;
  mime_type: string;
  byte_size: number | string;
  caption: string | null;
  internal_description: string | null;
  linked_variation_item_id: string | null;
  sort_order: number;
  upload_status: string;
  object_confirmed: boolean;
  created_at: string;
  frozen_at: string | null;
}): VariationAttachmentView | null {
  if (!isVisibility(row.visibility)) return null;
  if (row.upload_status !== "pending" && row.upload_status !== "ready" && row.upload_status !== "failed") return null;
  const byteSize = typeof row.byte_size === "number" ? row.byte_size : Number(row.byte_size);
  if (!Number.isFinite(byteSize)) return null;
  return {
    id: row.id,
    revisionId: row.variation_revision_id,
    visibility: row.visibility,
    displayFilename: row.display_filename,
    mimeType: row.mime_type,
    byteSize,
    caption: row.caption,
    internalDescription: row.internal_description,
    linkedVariationItemId: row.linked_variation_item_id,
    sortOrder: row.sort_order,
    uploadStatus: row.upload_status,
    objectConfirmed: row.object_confirmed,
    createdAt: row.created_at,
    frozen: row.frozen_at != null,
  };
}

export async function listVariationAttachments(input: {
  projectId: string;
  variationId: string;
}): Promise<Ok<{ attachments: VariationAttachmentView[] }> | Fail> {
  const context = await getAuthOrgContext();
  if (!context) return fail("NOT_AUTHENTICATED");
  const owned = await assertOrgOwnsActiveProject(context, input.projectId);
  if ("error" in owned) return fail("NOT_FOUND");
  const variation = await context.supabase
    .from("variations")
    .select("id, project_id")
    .eq("id", input.variationId)
    .maybeSingle();
  const header = variation.data as { id: string; project_id: string } | null;
  if (variation.error || !header || header.project_id !== owned.projectId) return fail("NOT_FOUND");
  const rows = await context.supabase
    .from("variation_attachments")
    .select("id, variation_revision_id, visibility, display_filename, mime_type, byte_size, caption, internal_description, linked_variation_item_id, sort_order, upload_status, object_confirmed, created_at, frozen_at")
    .eq("variation_id", input.variationId)
    .order("sort_order", { ascending: true });
  if (rows.error) return fail("NOT_FOUND");
  return {
    ok: true,
    attachments: ((rows.data ?? []) as Array<Parameters<typeof mapRow>[0]>).flatMap((row) => {
      const mapped = mapRow(row);
      return mapped ? [mapped] : [];
    }),
  };
}

async function removeObjectIfUnreferenced(orgId: string, bucket: string, objectPath: string, deleteObject: boolean): Promise<void> {
  if (!deleteObject || !canDeleteVariationAttachmentObject(0)) return;
  if (bucket !== VARIATION_ATTACHMENT_BUCKET || !objectPath.startsWith(`${orgId}/`) || objectPath.includes("..")) return;
  const admin = createAdminClient();
  const remaining = await admin
    .from("variation_attachments")
    .select("id", { count: "exact", head: true })
    .eq("storage_object_path", objectPath);
  if ((remaining.count ?? 1) > 0) return;
  await admin.storage.from(VARIATION_ATTACHMENT_BUCKET).remove([objectPath]);
}

export async function uploadVariationAttachment(formData: FormData): Promise<Ok<{ attachment: VariationAttachmentView }> | Fail> {
  const projectId = String(formData.get("projectId") ?? "");
  const variationId = String(formData.get("variationId") ?? "");
  const revisionId = String(formData.get("revisionId") ?? "");
  const visibility = String(formData.get("visibility") ?? "");
  const caption = String(formData.get("caption") ?? "");
  const internalDescription = String(formData.get("internalDescription") ?? "");
  const linkedRaw = String(formData.get("linkedVariationItemId") ?? "");
  const retryId = String(formData.get("retryAttachmentId") ?? "");
  const file = formData.get("file");
  if (!(file instanceof File) || !isVisibility(visibility)) return fail("FILE_TYPE");
  const owned = await ownedRevision({ projectId, variationId, revisionId });
  if (!owned.ok) return owned;
  if (owned.revision.status !== "draft") return fail("IMMUTABLE");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const sniffed = sniffVariationAttachment(bytes, file.name);
  if (!sniffed) return fail(bytes.byteLength > 15 * 1024 * 1024 ? "FILE_TOO_LARGE" : "FILE_TYPE");

  const prepared = retryId
    ? await owned.context.supabase.rpc("retry_variation_attachment_v1", {
        p_attachment: retryId,
        p_byte_size: bytes.byteLength,
      })
    : await owned.context.supabase.rpc("prepare_variation_attachment_v1", {
        p_revision: revisionId,
        p_visibility: visibility,
        p_original_filename: file.name,
        p_mime_type: sniffed.mime,
        p_byte_size: bytes.byteLength,
        p_caption: visibility === "client" ? caption : null,
        p_internal_description: visibility === "internal" ? internalDescription : null,
        p_linked_item: linkedRaw || null,
      });
  const body = (prepared.data ?? {}) as {
    ok?: boolean;
    error?: string;
    attachmentId?: string;
    storageObjectPath?: string;
    storageBucket?: string;
    mimeType?: string;
  };
  if (prepared.error || body.ok !== true || !body.attachmentId || !body.storageObjectPath) {
    return fail(body.error);
  }
  if (
    !body.storageObjectPath.startsWith(`${owned.orgId}/`) ||
    (body.storageBucket != null && body.storageBucket !== VARIATION_ATTACHMENT_BUCKET) ||
    (body.mimeType != null && body.mimeType !== sniffed.mime)
  ) {
    await owned.context.supabase.rpc("fail_variation_attachment_v1", { p_attachment: body.attachmentId });
    return { ...fail(body.mimeType && body.mimeType !== sniffed.mime ? "FILE_TYPE" : "NOT_FOUND"), attachmentId: body.attachmentId };
  }

  const admin = createAdminClient();
  const uploaded = await admin.storage.from(VARIATION_ATTACHMENT_BUCKET).upload(body.storageObjectPath, bytes, {
    contentType: sniffed.mime,
    upsert: Boolean(retryId),
  });
  if (uploaded.error) {
    await owned.context.supabase.rpc("fail_variation_attachment_v1", { p_attachment: body.attachmentId });
    return { ...fail("MISSING_OBJECT"), attachmentId: body.attachmentId };
  }

  const completed = await owned.context.supabase.rpc("complete_variation_attachment_v1", {
    p_attachment: body.attachmentId,
    p_byte_size: bytes.byteLength,
  });
  const done = (completed.data ?? {}) as { ok?: boolean; error?: string };
  if (completed.error || done.ok !== true) {
    await admin.storage.from(VARIATION_ATTACHMENT_BUCKET).remove([body.storageObjectPath]);
    await owned.context.supabase.rpc("fail_variation_attachment_v1", { p_attachment: body.attachmentId });
    return { ...fail(done.error ?? "MISSING_OBJECT"), attachmentId: body.attachmentId };
  }

  const listed = await listVariationAttachments({ projectId, variationId });
  const attachment = listed.ok ? listed.attachments.find((row) => row.id === body.attachmentId) : null;
  if (!attachment || attachment.uploadStatus !== "ready") {
    return { ...fail("MISSING_OBJECT"), attachmentId: body.attachmentId };
  }
  revalidatePath(`/app/projects/${projectId}/variations/${variationId}`);
  return { ok: true, attachment };
}

export async function updateVariationAttachment(input: {
  projectId: string;
  variationId: string;
  attachmentId: string;
  displayFilename: string;
  caption: string;
  internalDescription: string;
  linkedVariationItemId: string | null;
}): Promise<Ok<{ displayFilename: string }> | Fail> {
  const context = await getAuthOrgContext();
  if (!context) return fail("NOT_AUTHENTICATED");
  const owned = await assertOrgOwnsActiveProject(context, input.projectId);
  if ("error" in owned) return fail("NOT_FOUND");
  const result = await context.supabase.rpc("update_draft_variation_attachment_v1", {
    p_attachment: input.attachmentId,
    p_display_filename: input.displayFilename,
    p_caption: input.caption,
    p_internal_description: input.internalDescription,
    p_linked_item: input.linkedVariationItemId,
    p_clear_link: input.linkedVariationItemId == null,
  });
  const body = (result.data ?? {}) as { ok?: boolean; error?: string; displayFilename?: string };
  if (result.error || body.ok !== true || !body.displayFilename) return fail(body.error);
  revalidatePath(`/app/projects/${input.projectId}/variations/${input.variationId}`);
  return { ok: true, displayFilename: body.displayFilename };
}

export async function reorderVariationAttachments(input: {
  projectId: string;
  variationId: string;
  revisionId: string;
  visibility: VariationAttachmentVisibility;
  ids: string[];
}): Promise<{ ok: true } | Fail> {
  const owned = await ownedRevision(input);
  if (!owned.ok) return owned;
  const result = await owned.context.supabase.rpc("reorder_draft_variation_attachments_v1", {
    p_revision: input.revisionId,
    p_visibility: input.visibility,
    p_ids: input.ids,
  });
  const body = (result.data ?? {}) as { ok?: boolean; error?: string };
  if (result.error || body.ok !== true) return fail(body.error);
  return { ok: true };
}

export async function removeVariationAttachment(input: {
  projectId: string;
  variationId: string;
  attachmentId: string;
}): Promise<{ ok: true } | Fail> {
  const context = await getAuthOrgContext();
  if (!context) return fail("NOT_AUTHENTICATED");
  const owned = await assertOrgOwnsActiveProject(context, input.projectId);
  if ("error" in owned) return fail("NOT_FOUND");
  const result = await context.supabase.rpc("remove_draft_variation_attachment_v1", {
    p_attachment: input.attachmentId,
  });
  const body = (result.data ?? {}) as {
    ok?: boolean;
    error?: string;
    deleteObject?: boolean;
    storageBucket?: string;
    storageObjectPath?: string;
  };
  if (result.error || body.ok !== true) return fail(body.error);
  if (body.deleteObject && body.storageBucket && body.storageObjectPath) {
    await removeObjectIfUnreferenced(context.orgId, body.storageBucket, body.storageObjectPath, true);
  }
  revalidatePath(`/app/projects/${input.projectId}/variations/${input.variationId}`);
  return { ok: true };
}

export async function signVariationAttachment(input: {
  projectId: string;
  variationId: string;
  attachmentId: string;
}): Promise<Ok<{ url: string }> | Fail> {
  const context = await getAuthOrgContext();
  if (!context) return fail("NOT_AUTHENTICATED");
  const owned = await assertOrgOwnsActiveProject(context, input.projectId);
  if ("error" in owned) return fail("NOT_FOUND");
  const variation = await context.supabase
    .from("variations")
    .select("id, project_id")
    .eq("id", input.variationId)
    .maybeSingle();
  const header = variation.data as { project_id: string } | null;
  if (!header || header.project_id !== owned.projectId) return fail("NOT_FOUND");
  const authorized = await context.supabase.rpc("authorize_variation_attachment_v1", {
    p_attachment: input.attachmentId,
  });
  const body = (authorized.data ?? {}) as {
    ok?: boolean;
    error?: string;
    storageBucket?: string;
    storageObjectPath?: string;
    displayFilename?: string;
  };
  if (authorized.error || body.ok !== true || !body.storageObjectPath || body.storageBucket !== VARIATION_ATTACHMENT_BUCKET) {
    return fail("NOT_FOUND");
  }
  if (!body.storageObjectPath.startsWith(`${context.orgId}/`)) return fail("NOT_FOUND");
  const signed = await createAdminClient()
    .storage.from(VARIATION_ATTACHMENT_BUCKET)
    .createSignedUrl(body.storageObjectPath, 60, { download: body.displayFilename ?? true });
  if (signed.error || !signed.data?.signedUrl) return fail("NOT_FOUND");
  return { ok: true, url: signed.data.signedUrl };
}

export async function purgeDraftVariationAttachmentObjects(input: {
  projectId: string;
  variationId: string;
}): Promise<void> {
  const context = await getAuthOrgContext();
  if (!context) return;
  const rows = await context.supabase
    .from("variation_attachments")
    .select("storage_bucket, storage_object_path")
    .eq("variation_id", input.variationId);
  const paths = ((rows.data ?? []) as Array<{ storage_bucket: string; storage_object_path: string }>).map((row) => row);
  const admin = createAdminClient();
  for (const row of paths) {
    const still = await admin
      .from("variation_attachments")
      .select("id", { count: "exact", head: true })
      .eq("storage_object_path", row.storage_object_path);
    if ((still.count ?? 1) === 0 && row.storage_object_path.startsWith(`${context.orgId}/`)) {
      await admin.storage.from(VARIATION_ATTACHMENT_BUCKET).remove([row.storage_object_path]);
    }
  }
}
