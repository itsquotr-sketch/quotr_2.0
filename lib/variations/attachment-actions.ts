"use server";

import { getAuthOrgContext } from "@/lib/security/auth-org-context";
import { assertOrgOwnsActiveProject } from "@/lib/security/org-ownership";
import {
  VARIATION_ATTACHMENT_BUCKET,
  canDeleteVariationAttachmentObject,
  sniffVariationAttachment,
  VARIATION_ATTACHMENT_MAX_BYTES,
  type VariationAttachmentMime,
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

function decodeHeader(value: string): Uint8Array | null {
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(value) || value.length > 88) return null;
  const bytes = Buffer.from(value, "base64");
  if (bytes.byteLength < 4 || bytes.byteLength > 64) return null;
  return new Uint8Array(bytes);
}

export async function prepareVariationAttachmentUpload(input: {
  projectId: string;
  variationId: string;
  revisionId: string;
  visibility: VariationAttachmentVisibility;
  originalFilename: string;
  byteSize: number;
  headerBase64: string;
  retryAttachmentId?: string | null;
}): Promise<Ok<{ attachmentId: string; signedUrl: string; displayFilename: string; mimeType: VariationAttachmentMime }> | Fail> {
  if (!isVisibility(input.visibility)) return fail("FILE_TYPE");
  const owned = await ownedRevision(input);
  if (!owned.ok) return owned;
  if (owned.revision.status !== "draft") return fail("IMMUTABLE");
  if (!Number.isInteger(input.byteSize) || input.byteSize <= 0 || input.byteSize > VARIATION_ATTACHMENT_MAX_BYTES) {
    return fail("FILE_TOO_LARGE");
  }
  const header = decodeHeader(input.headerBase64);
  const sniffed = header ? sniffVariationAttachment(header, input.originalFilename) : null;
  if (!sniffed) return fail("FILE_TYPE");

  const retryId = input.retryAttachmentId?.trim() || "";
  let prepared: { data: unknown; error: { message: string } | null };
  if (retryId) {
    const existing = await owned.context.supabase
      .from("variation_attachments")
      .select("id, mime_type, upload_status, variation_id, variation_revision_id")
      .eq("id", retryId)
      .maybeSingle();
    const row = existing.data as { mime_type?: string; upload_status?: string; variation_id?: string; variation_revision_id?: string } | null;
    if (!row || row.variation_id !== input.variationId || row.variation_revision_id !== input.revisionId) return fail("NOT_FOUND");
    if (row.mime_type !== sniffed.mime) return fail("FILE_TYPE");
    if (row.upload_status === "pending") {
      const failed = await owned.context.supabase.rpc("fail_variation_attachment_v1", { p_attachment: retryId });
      const failedBody = (failed.data ?? {}) as { ok?: boolean; error?: string };
      if (failed.error || failedBody.ok !== true) return fail(failedBody.error);
    }
    prepared = await owned.context.supabase.rpc("retry_variation_attachment_v1", {
      p_attachment: retryId,
      p_byte_size: input.byteSize,
    });
  } else {
    prepared = await owned.context.supabase.rpc("prepare_variation_attachment_v1", {
      p_revision: input.revisionId,
      p_visibility: input.visibility,
      p_original_filename: input.originalFilename,
      p_mime_type: sniffed.mime,
      p_byte_size: input.byteSize,
      p_caption: null,
      p_internal_description: null,
      p_linked_item: null,
    });
  }
  const body = (prepared.data ?? {}) as {
    ok?: boolean;
    error?: string;
    attachmentId?: string;
    storageObjectPath?: string;
    storageBucket?: string;
    mimeType?: string;
    displayFilename?: string;
  };
  if (prepared.error || body.ok !== true || !body.attachmentId || !body.storageObjectPath) {
    return fail(body.error);
  }
  const expectedPrefix = `${owned.orgId}/${input.projectId}/${input.variationId}/${input.revisionId}/`;
  if (
    !body.storageObjectPath.startsWith(expectedPrefix) ||
    body.storageObjectPath.includes("..") ||
    (body.storageBucket != null && body.storageBucket !== VARIATION_ATTACHMENT_BUCKET) ||
    (body.mimeType != null && body.mimeType !== sniffed.mime)
  ) {
    await owned.context.supabase.rpc("fail_variation_attachment_v1", { p_attachment: body.attachmentId });
    return { ...fail("NOT_FOUND"), attachmentId: body.attachmentId };
  }

  const admin = createAdminClient();
  const signed = await admin.storage.from(VARIATION_ATTACHMENT_BUCKET).createSignedUploadUrl(body.storageObjectPath, {
    upsert: Boolean(retryId),
  });
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  let signedHostMatches = false;
  try {
    signedHostMatches = Boolean(
      supabaseUrl &&
        signed.data?.signedUrl &&
        new URL(signed.data.signedUrl).host === new URL(supabaseUrl).host &&
        new URL(signed.data.signedUrl).pathname.includes("/object/upload/sign/")
    );
  } catch {
    signedHostMatches = false;
  }
  if (signed.error || !signedHostMatches || !signed.data?.signedUrl) {
    await owned.context.supabase.rpc("fail_variation_attachment_v1", { p_attachment: body.attachmentId });
    return { ...fail("MISSING_OBJECT"), attachmentId: body.attachmentId };
  }
  return {
    ok: true,
    attachmentId: body.attachmentId,
    signedUrl: signed.data.signedUrl,
    displayFilename: body.displayFilename || input.originalFilename,
    mimeType: sniffed.mime,
  };
}

async function discardUnsharedObject(orgId: string, attachmentId: string, objectPath: string): Promise<void> {
  if (!objectPath.startsWith(`${orgId}/`) || !objectPath.includes(`/${attachmentId}/`) || objectPath.includes("..")) return;
  await createAdminClient().storage.from(VARIATION_ATTACHMENT_BUCKET).remove([objectPath]);
}

export async function finalizeVariationAttachment(input: {
  projectId: string;
  variationId: string;
  attachmentId: string;
}): Promise<Ok<{ attachment: VariationAttachmentView }> | Fail> {
  const context = await getAuthOrgContext();
  if (!context) return fail("NOT_AUTHENTICATED");
  const owned = await assertOrgOwnsActiveProject(context, input.projectId);
  if ("error" in owned) return fail("NOT_FOUND");
  const rowQuery = await context.supabase
    .from("variation_attachments")
    .select("id, variation_id, variation_revision_id, original_filename, mime_type, byte_size, storage_object_path, upload_status")
    .eq("id", input.attachmentId)
    .maybeSingle();
  const row = rowQuery.data as {
    variation_id?: string;
    original_filename?: string;
    mime_type?: string;
    byte_size?: number | string;
    storage_object_path?: string;
    upload_status?: string;
  } | null;
  if (!row || row.variation_id !== input.variationId || row.upload_status !== "pending" || !row.storage_object_path) {
    return fail("NOT_FOUND");
  }
  if (!row.storage_object_path.startsWith(`${context.orgId}/`) || row.storage_object_path.includes("..")) {
    return fail("NOT_FOUND");
  }
  const admin = createAdminClient();
  const downloaded = await admin.storage.from(VARIATION_ATTACHMENT_BUCKET).download(row.storage_object_path);
  const bytes = downloaded.data ? new Uint8Array(await downloaded.data.arrayBuffer()) : null;
  const sniffed = bytes ? sniffVariationAttachment(bytes, row.original_filename || "file") : null;
  const declaredSize = typeof row.byte_size === "number" ? row.byte_size : Number(row.byte_size);
  const typeOk = Boolean(sniffed && sniffed.mime === row.mime_type);
  const sizeOk = Boolean(bytes && bytes.byteLength === declaredSize);
  if (downloaded.error || !bytes || !typeOk || !sizeOk) {
    await discardUnsharedObject(context.orgId, input.attachmentId, row.storage_object_path);
    await context.supabase.rpc("fail_variation_attachment_v1", { p_attachment: input.attachmentId });
    const code = !bytes || downloaded.error ? "MISSING_OBJECT" : !typeOk ? "FILE_TYPE" : "FILE_TOO_LARGE";
    return { ...fail(code), attachmentId: input.attachmentId };
  }
  const completed = await context.supabase.rpc("complete_variation_attachment_v1", {
    p_attachment: input.attachmentId,
    p_byte_size: declaredSize,
  });
  const done = (completed.data ?? {}) as { ok?: boolean; error?: string };
  if (completed.error || done.ok !== true) {
    await discardUnsharedObject(context.orgId, input.attachmentId, row.storage_object_path);
    await context.supabase.rpc("fail_variation_attachment_v1", { p_attachment: input.attachmentId });
    return { ...fail(done.error ?? "MISSING_OBJECT"), attachmentId: input.attachmentId };
  }
  const listed = await listVariationAttachments({ projectId: input.projectId, variationId: input.variationId });
  const attachment = listed.ok ? listed.attachments.find((item) => item.id === input.attachmentId) : null;
  if (!attachment || attachment.uploadStatus !== "ready" || !attachment.objectConfirmed) {
    return { ...fail("MISSING_OBJECT"), attachmentId: input.attachmentId };
  }
  return { ok: true, attachment };
}

export async function failVariationAttachmentUpload(input: {
  projectId: string;
  variationId: string;
  attachmentId: string;
}): Promise<Fail & { ok: false }> {
  const context = await getAuthOrgContext();
  if (!context) return fail("NOT_AUTHENTICATED");
  const owned = await assertOrgOwnsActiveProject(context, input.projectId);
  if ("error" in owned) return fail("NOT_FOUND");
  const result = await context.supabase.rpc("fail_variation_attachment_v1", { p_attachment: input.attachmentId });
  const body = (result.data ?? {}) as { ok?: boolean; error?: string };
  if (result.error || body.ok !== true) return { ...fail(body.error), attachmentId: input.attachmentId };
  return { ...fail("MISSING_OBJECT"), attachmentId: input.attachmentId };
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
