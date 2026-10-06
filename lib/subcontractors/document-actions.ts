"use server";

import { revalidatePath } from "next/cache";
import { getAuthOrgContext } from "@/lib/assistant/state";
import { toUserError } from "@/lib/errors/user-message";
import {
  SUBCONTRACTOR_DOCUMENT_BUCKET,
  isSubcontractorDocumentMime,
} from "@/lib/subcontractors/document-files";
import { DOCUMENT_KINDS } from "@/lib/subcontractors/types";
import { createAdminClient } from "@/lib/supabase/admin";
import { permissionDeniedError } from "@/lib/team/permission-server";
import { sniffVariationAttachment } from "@/lib/variations/attachment-files";

const FILE_TYPE = "Use a JPG, PNG, PDF, DOCX or XLSX file.";
const FILE_SIZE = "Each file must be 15 MB or smaller.";
const UPLOAD_FAILED = "Could not store that document. Please try again.";
const NOT_FOUND = "That document could not be found.";

/**
 * Subcontractor files stay in a private bucket. Nothing here copies a file
 * onto an RFQ, quote, estimate, or project.
 */

type PrepareResult = {
  documentId?: string;
  signedUrl?: string;
  mimeType?: string;
  error?: string;
};

type SimpleResult = { ok?: boolean; error?: string; url?: string };

function revalidate(subcontractorId: string) {
  revalidatePath("/app/contacts/subcontractors");
  revalidatePath(`/app/contacts/subcontractors/${subcontractorId}`);
}

async function requireEditor() {
  const context = await getAuthOrgContext();
  if (!context) {
    return {
      ok: false as const,
      error: "Your organisation profile could not be loaded. Try signing out and back in.",
    };
  }
  const denied = await permissionDeniedError({
    orgId: context.orgId,
    userId: context.user.id,
    permission: "subcontractors.edit",
    entitlement: "projects.create",
  });
  if (denied) return { ok: false as const, error: denied.error };
  return { ok: true as const, context };
}

function pathMatches(orgId: string, path: string | null): path is string {
  if (!path) return false;
  if (path.includes("..") || path.includes("\\") || path.includes("//")) return false;
  return path.startsWith(`${orgId}/`);
}

function signedHostOk(signedUrl: string | undefined): boolean {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  try {
    return Boolean(
      supabaseUrl &&
        signedUrl &&
        new URL(signedUrl).host === new URL(supabaseUrl).host &&
        new URL(signedUrl).protocol === "https:"
    );
  } catch {
    return false;
  }
}

async function failPending(documentId: string) {
  await createAdminClient().rpc("fail_subcontractor_document_upload_v1", {
    p_document: documentId,
  });
}

export async function prepareSubcontractorDocumentUpload(input: {
  subcontractorId: string;
  documentKind: string;
  title: string;
  expiresOn: string;
  notes: string;
  filename: string;
  mimeType: string;
  byteSize: number;
}): Promise<PrepareResult> {
  const loaded = await requireEditor();
  if (!loaded.ok) return { error: loaded.error };
  const kind = input.documentKind.trim();
  if (!(DOCUMENT_KINDS as readonly string[]).includes(kind)) {
    return { error: "Choose a document type." };
  }
  const title = input.title.trim();
  if (!title || title.length > 160) return { error: "Enter a document title." };
  if (input.notes.trim().length > 2000) return { error: "Notes must be 2000 characters or less." };
  if (input.expiresOn.trim() && !/^\d{4}-\d{2}-\d{2}$/.test(input.expiresOn.trim())) {
    return { error: "Enter an expiry date as YYYY-MM-DD." };
  }
  if (!isSubcontractorDocumentMime(input.mimeType)) return { error: FILE_TYPE };
  if (!Number.isInteger(input.byteSize) || input.byteSize <= 0) return { error: FILE_TYPE };
  if (input.byteSize > 15 * 1024 * 1024) return { error: FILE_SIZE };

  const prepared = await loaded.context.supabase.rpc("prepare_subcontractor_document_upload_v1", {
    p_subcontractor: input.subcontractorId,
    p_kind: kind,
    p_title: title,
    p_expires: input.expiresOn.trim() || null,
    p_notes: input.notes.trim() || null,
    p_filename: input.filename,
    p_mime: input.mimeType,
    p_byte_size: input.byteSize,
  });
  if (prepared.error || typeof prepared.data !== "string") {
    return { error: toUserError(prepared.error, "prepareSubcontractorDocumentUpload", UPLOAD_FAILED) };
  }

  const row = await loaded.context.supabase
    .from("subcontractor_documents")
    .select("id, subcontractor_id, storage_object_path, upload_status, mime_type")
    .eq("id", prepared.data)
    .eq("org_id", loaded.context.orgId)
    .eq("subcontractor_id", input.subcontractorId)
    .maybeSingle();
  const path = typeof row.data?.storage_object_path === "string" ? row.data.storage_object_path : null;
  if (
    row.error ||
    !row.data ||
    row.data.upload_status !== "pending" ||
    !pathMatches(loaded.context.orgId, path) ||
    !isSubcontractorDocumentMime(String(row.data.mime_type ?? ""))
  ) {
    await failPending(prepared.data);
    return { error: UPLOAD_FAILED };
  }

  const signed = await createAdminClient()
    .storage.from(SUBCONTRACTOR_DOCUMENT_BUCKET)
    .createSignedUploadUrl(path, { upsert: false });
  if (
    signed.error ||
    !signedHostOk(signed.data?.signedUrl) ||
    !signed.data?.signedUrl.includes("/object/upload/sign/")
  ) {
    await createAdminClient().storage.from(SUBCONTRACTOR_DOCUMENT_BUCKET).remove([path]);
    await failPending(prepared.data);
    return { error: UPLOAD_FAILED };
  }

  return {
    documentId: prepared.data,
    signedUrl: signed.data.signedUrl,
    mimeType: input.mimeType,
  };
}

export async function finalizeSubcontractorDocumentUpload(input: {
  subcontractorId: string;
  documentId: string;
}): Promise<SimpleResult> {
  const loaded = await requireEditor();
  if (!loaded.ok) return { error: loaded.error };
  const row = await loaded.context.supabase
    .from("subcontractor_documents")
    .select("id, storage_object_path, upload_status, mime_type, byte_size, original_filename, subcontractor_id")
    .eq("id", input.documentId)
    .eq("org_id", loaded.context.orgId)
    .eq("subcontractor_id", input.subcontractorId)
    .maybeSingle();
  const path = typeof row.data?.storage_object_path === "string" ? row.data.storage_object_path : null;
  const declaredSize = typeof row.data?.byte_size === "number" ? row.data.byte_size : Number(row.data?.byte_size);
  if (row.error || !row.data || row.data.upload_status !== "pending" || !pathMatches(loaded.context.orgId, path)) {
    return { error: NOT_FOUND };
  }

  const admin = createAdminClient();
  const downloaded = await admin.storage.from(SUBCONTRACTOR_DOCUMENT_BUCKET).download(path);
  const bytes = downloaded.data ? new Uint8Array(await downloaded.data.arrayBuffer()) : null;
  const sniffed = bytes ? sniffVariationAttachment(bytes, String(row.data.original_filename ?? "")) : null;
  const typeOk = Boolean(sniffed && sniffed.mime === row.data.mime_type);
  const sizeOk = Boolean(bytes && bytes.byteLength === declaredSize && bytes.byteLength <= 15 * 1024 * 1024);
  if (downloaded.error || !bytes || !typeOk || !sizeOk) {
    await admin.storage.from(SUBCONTRACTOR_DOCUMENT_BUCKET).remove([path]);
    await failPending(input.documentId);
    revalidate(input.subcontractorId);
    return { error: !typeOk ? FILE_TYPE : FILE_SIZE };
  }

  const completed = await admin.rpc("complete_subcontractor_document_upload_v1", {
    p_document: input.documentId,
    p_byte_size: declaredSize,
  });
  if (completed.error) {
    await admin.storage.from(SUBCONTRACTOR_DOCUMENT_BUCKET).remove([path]);
    await failPending(input.documentId);
    revalidate(input.subcontractorId);
    return { error: UPLOAD_FAILED };
  }
  revalidate(input.subcontractorId);
  return { ok: true };
}

export async function downloadSubcontractorDocument(input: {
  subcontractorId: string;
  documentId: string;
}): Promise<SimpleResult> {
  const context = await getAuthOrgContext();
  if (!context) {
    return { error: "Your organisation profile could not be loaded. Try signing out and back in." };
  }
  const row = await context.supabase
    .from("subcontractor_documents")
    .select("storage_object_path, upload_status, original_filename, archived_at")
    .eq("id", input.documentId)
    .eq("org_id", context.orgId)
    .eq("subcontractor_id", input.subcontractorId)
    .is("archived_at", null)
    .maybeSingle();
  const path = typeof row.data?.storage_object_path === "string" ? row.data.storage_object_path : null;
  if (row.error || !row.data || row.data.upload_status !== "ready" || !pathMatches(context.orgId, path)) {
    return { error: NOT_FOUND };
  }
  const filename =
    typeof row.data.original_filename === "string" && row.data.original_filename
      ? row.data.original_filename
      : "document";
  const signed = await createAdminClient()
    .storage.from(SUBCONTRACTOR_DOCUMENT_BUCKET)
    .createSignedUrl(path, 60, { download: filename });
  if (signed.error || !signedHostOk(signed.data?.signedUrl)) return { error: NOT_FOUND };
  return { ok: true, url: signed.data.signedUrl };
}

export async function archiveSubcontractorDocument(input: {
  subcontractorId: string;
  documentId: string;
}): Promise<SimpleResult> {
  const loaded = await requireEditor();
  if (!loaded.ok) return { error: loaded.error };
  const { error } = await loaded.context.supabase
    .from("subcontractor_documents")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", input.documentId)
    .eq("org_id", loaded.context.orgId)
    .eq("subcontractor_id", input.subcontractorId)
    .is("archived_at", null);
  if (error) return { error: toUserError(error, "archiveSubcontractorDocument", UPLOAD_FAILED) };
  revalidate(input.subcontractorId);
  return { ok: true };
}

export async function removeSubcontractorDocument(input: {
  subcontractorId: string;
  documentId: string;
}): Promise<SimpleResult> {
  const loaded = await requireEditor();
  if (!loaded.ok) return { error: loaded.error };
  const row = await loaded.context.supabase
    .from("subcontractor_documents")
    .select("storage_object_path")
    .eq("id", input.documentId)
    .eq("org_id", loaded.context.orgId)
    .eq("subcontractor_id", input.subcontractorId)
    .maybeSingle();
  if (row.error || !row.data) return { error: NOT_FOUND };
  const path = typeof row.data.storage_object_path === "string" ? row.data.storage_object_path : null;
  if (pathMatches(loaded.context.orgId, path)) {
    await createAdminClient().storage.from(SUBCONTRACTOR_DOCUMENT_BUCKET).remove([path]);
  }
  const retired = await createAdminClient().rpc("retire_subcontractor_document_file_v1", {
    p_document: input.documentId,
  });
  if (retired.error) return { error: UPLOAD_FAILED };
  revalidate(input.subcontractorId);
  return { ok: true };
}
