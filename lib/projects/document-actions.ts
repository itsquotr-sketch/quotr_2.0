import "server-only";

import { getAuthOrgContext } from "@/lib/security/auth-org-context";
import { assertOrgOwnsActiveProject } from "@/lib/security/org-ownership";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  PROJECT_DOCUMENT_BUCKET,
  isProjectDocumentCategory,
  isProjectDocumentVisibility,
  projectDocumentObjectPath,
  sniffProjectDocument,
  type ProjectDocumentCategory,
  type ProjectDocumentMime,
  type ProjectDocumentVisibility,
} from "@/lib/projects/document-files";
import {
  projectDocumentCentreFromRows,
  type ProjectDocumentVersionView,
  type ProjectDocumentView,
} from "@/lib/projects/document-model";

type Fail = { ok: false; error: string; versionId?: string };
type Ok<T> = { ok: true } & T;

const COPY: Record<string, string> = {
  NOT_AUTHENTICATED: "You need to sign in.",
  NOT_FOUND: "File unavailable",
  FILE_TYPE: "Use a JPG, PNG, PDF, DOCX or XLSX file.",
  FILE_TOO_LARGE: "Each file must be 15 MB or smaller.",
  ARCHIVED: "Restore this document before uploading a new version.",
  REFERENCED: "This document is still used by another record.",
  DELETE_FAILED: "The file could not be removed. The document is still here.",
  INVALID_INPUT: "Check the file details and try again.",
  MISSING_OBJECT: "File unavailable",
  VERSION_CONFLICT: "Upload failed",
};

function fail(code: string | undefined): Fail {
  return { ok: false, error: COPY[code ?? ""] ?? "Upload failed" };
}

function decodeHeader(value: string): Uint8Array | null {
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(value) || value.length > 88) return null;
  const bytes = Buffer.from(value, "base64");
  if (bytes.byteLength < 4 || bytes.byteLength > 64) return null;
  return new Uint8Array(bytes);
}

async function ownedProject(projectId: string) {
  const context = await getAuthOrgContext();
  if (!context) return fail("NOT_AUTHENTICATED");
  const owned = await assertOrgOwnsActiveProject(context, projectId);
  if ("error" in owned) return fail("NOT_FOUND");
  return { ok: true as const, context, orgId: context.orgId, projectId: owned.projectId };
}

type StoredVersion = {
  id: string;
  document_id: string;
  org_id: string;
  project_id: string;
  version_number: number;
  original_filename: string;
  display_filename: string;
  mime_type: string;
  byte_size: number | string;
  storage_bucket: string;
  storage_object_path: string;
  visibility: string;
  version_note: string | null;
  upload_status: string;
  object_confirmed: boolean;
  created_at: string;
  created_by: string | null;
};

async function readStoredVersion(orgId: string, projectId: string, versionId: string): Promise<StoredVersion | null> {
  const row = await createAdminClient()
    .from("project_document_versions")
    .select("id, document_id, org_id, project_id, version_number, original_filename, display_filename, mime_type, byte_size, storage_bucket, storage_object_path, visibility, version_note, upload_status, object_confirmed, created_at, created_by")
    .eq("id", versionId)
    .maybeSingle();
  const data = row.data as StoredVersion | null;
  if (row.error || !data || data.org_id !== orgId || data.project_id !== projectId) return null;
  if (data.storage_bucket !== PROJECT_DOCUMENT_BUCKET || data.storage_object_path.includes("..")) return null;
  return data;
}

function pathMatches(orgId: string, row: StoredVersion): boolean {
  return row.storage_object_path === projectDocumentObjectPath({
    orgId,
    projectId: row.project_id,
    documentId: row.document_id,
    versionId: row.id,
    safeFilename: row.display_filename,
  });
}

async function versionView(orgId: string, projectId: string, versionId: string): Promise<ProjectDocumentView | null> {
  const admin = createAdminClient();
  const version = await admin
    .from("project_document_versions")
    .select("id, document_id, version_number, display_filename, mime_type, byte_size, visibility, version_note, upload_status, object_confirmed, created_by, created_at")
    .eq("id", versionId)
    .eq("org_id", orgId)
    .eq("project_id", projectId)
    .maybeSingle();
  const versionRow = version.data as { document_id?: string; created_by?: string | null } | null;
  if (version.error || !versionRow?.document_id) return null;
  const [document, profile] = await Promise.all([
    admin.from("project_documents").select("id, title, category, archived_at, created_at").eq("id", versionRow.document_id).eq("org_id", orgId).maybeSingle(),
    versionRow.created_by
      ? admin.from("profiles").select("id, full_name").eq("id", versionRow.created_by).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);
  if (document.error || !document.data) return null;
  const names = new Map<string, string>();
  const profileRow = profile.data as { id?: string; full_name?: string | null } | null;
  if (profileRow?.id && profileRow.full_name) names.set(profileRow.id, profileRow.full_name);
  const [view] = projectDocumentCentreFromRows({
    documents: [document.data as Record<string, unknown>],
    versions: [version.data as Record<string, unknown>],
    uploaderNames: names,
  });
  return view ?? null;
}

async function signUpload(orgId: string, projectId: string, versionId: string, upsert: boolean): Promise<{ signedUrl: string; displayFilename: string; mimeType: ProjectDocumentMime } | Fail> {
  const row = await readStoredVersion(orgId, projectId, versionId);
  if (!row || !pathMatches(orgId, row) || !isProjectDocumentVisibility(row.visibility)) return fail("NOT_FOUND");
  const signed = await createAdminClient().storage.from(PROJECT_DOCUMENT_BUCKET).createSignedUploadUrl(row.storage_object_path, { upsert });
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  let hostMatches = false;
  try {
    hostMatches = Boolean(
      supabaseUrl &&
        signed.data?.signedUrl &&
        new URL(signed.data.signedUrl).host === new URL(supabaseUrl).host &&
        new URL(signed.data.signedUrl).pathname.includes("/object/upload/sign/")
    );
  } catch {
    hostMatches = false;
  }
  if (signed.error || !hostMatches || !signed.data?.signedUrl) return fail("MISSING_OBJECT");
  return {
    signedUrl: signed.data.signedUrl,
    displayFilename: row.display_filename,
    mimeType: row.mime_type as ProjectDocumentMime,
  };
}

async function discardUnreferencedObject(objectPath: string): Promise<void> {
  if (!objectPath || objectPath.includes("..")) return;
  const admin = createAdminClient();
  const remaining = await admin
    .from("project_document_versions")
    .select("id", { count: "exact", head: true })
    .eq("storage_object_path", objectPath);
  if ((remaining.count ?? 1) > 0) return;
  await admin.storage.from(PROJECT_DOCUMENT_BUCKET).remove([objectPath]);
}

export async function prepareProjectDocumentUpload(input: {
  projectId: string;
  documentId: string | null;
  category: ProjectDocumentCategory;
  title: string;
  visibility: ProjectDocumentVisibility;
  originalFilename: string;
  byteSize: number;
  headerBase64: string;
  versionNote: string;
  retryVersionId?: string | null;
}): Promise<Ok<{ documentId: string; versionId: string; versionNumber: number; signedUrl: string; displayFilename: string; mimeType: ProjectDocumentMime; title: string; category: ProjectDocumentCategory; visibility: ProjectDocumentVisibility }> | Fail> {
  if (!isProjectDocumentCategory(input.category) || !isProjectDocumentVisibility(input.visibility)) return fail("INVALID_INPUT");
  const owned = await ownedProject(input.projectId);
  if (!owned.ok) return owned;
  const header = decodeHeader(input.headerBase64);
  const sniffed = header ? sniffProjectDocument(header, input.originalFilename) : null;
  if (!sniffed) return fail("FILE_TYPE");
  if (!Number.isInteger(input.byteSize) || input.byteSize <= 0) return fail("FILE_TOO_LARGE");

  const retryId = input.retryVersionId?.trim() || "";
  let prepared: { data: unknown; error: { message: string } | null };
  if (retryId) {
    const existing = await readStoredVersion(owned.orgId, owned.projectId, retryId);
    if (!existing || existing.mime_type !== sniffed.mime) return fail("FILE_TYPE");
    if (existing.upload_status === "pending") {
      const failed = await owned.context.supabase.rpc("fail_project_document_version_v1", { p_version: retryId });
      const failedBody = (failed.data ?? {}) as { ok?: boolean; error?: string };
      if (failed.error || failedBody.ok !== true) return fail(failedBody.error);
    }
    prepared = await owned.context.supabase.rpc("retry_project_document_version_v1", {
      p_version: retryId,
      p_byte_size: input.byteSize,
    });
  } else {
    prepared = await owned.context.supabase.rpc("prepare_project_document_upload_v1", {
      p_project: owned.projectId,
      p_document: input.documentId,
      p_category: input.category,
      p_title: input.title,
      p_visibility: input.visibility,
      p_original_filename: input.originalFilename,
      p_mime_type: sniffed.mime,
      p_byte_size: input.byteSize,
      p_version_note: input.versionNote,
    });
  }
  const body = (prepared.data ?? {}) as {
    ok?: boolean;
    error?: string;
    documentId?: string;
    versionId?: string;
    versionNumber?: number;
    displayFilename?: string;
    mimeType?: string;
    title?: string;
    category?: string;
    visibility?: string;
  };
  if (prepared.error || body.ok !== true || !body.versionId || !body.documentId) return fail(body.error);
  const signed = await signUpload(owned.orgId, owned.projectId, body.versionId, Boolean(retryId));
  if (!("signedUrl" in signed)) {
    await owned.context.supabase.rpc("fail_project_document_version_v1", { p_version: body.versionId });
    return { ...fail("MISSING_OBJECT"), versionId: body.versionId };
  }
  return {
    ok: true,
    documentId: body.documentId,
    versionId: body.versionId,
    versionNumber: typeof body.versionNumber === "number" ? body.versionNumber : 1,
    signedUrl: signed.signedUrl,
    displayFilename: signed.displayFilename,
    mimeType: signed.mimeType,
    title: body.title || input.title || signed.displayFilename,
    category: isProjectDocumentCategory(body.category || "") ? (body.category as ProjectDocumentCategory) : input.category,
    visibility: isProjectDocumentVisibility(body.visibility || "") ? (body.visibility as ProjectDocumentVisibility) : input.visibility,
  };
}

export async function finalizeProjectDocumentUpload(input: {
  projectId: string;
  versionId: string;
}): Promise<Ok<{ document: ProjectDocumentView; version: ProjectDocumentVersionView }> | Fail> {
  const owned = await ownedProject(input.projectId);
  if (!owned.ok) return owned;
  const row = await readStoredVersion(owned.orgId, owned.projectId, input.versionId);
  if (!row || row.upload_status !== "pending" || !pathMatches(owned.orgId, row)) return fail("NOT_FOUND");
  const admin = createAdminClient();
  const downloaded = await admin.storage.from(PROJECT_DOCUMENT_BUCKET).download(row.storage_object_path);
  const bytes = downloaded.data ? new Uint8Array(await downloaded.data.arrayBuffer()) : null;
  const sniffed = bytes ? sniffProjectDocument(bytes, row.original_filename || row.display_filename) : null;
  const declaredSize = typeof row.byte_size === "number" ? row.byte_size : Number(row.byte_size);
  const typeOk = Boolean(sniffed && sniffed.mime === row.mime_type);
  const sizeOk = Boolean(bytes && bytes.byteLength === declaredSize && bytes.byteLength <= 15 * 1024 * 1024);
  if (downloaded.error || !bytes || !typeOk || !sizeOk) {
    await admin.storage.from(PROJECT_DOCUMENT_BUCKET).remove([row.storage_object_path]);
    await owned.context.supabase.rpc("fail_project_document_version_v1", { p_version: input.versionId });
    return { ...fail(!typeOk ? "FILE_TYPE" : "FILE_TOO_LARGE"), versionId: input.versionId };
  }
  const completed = await owned.context.supabase.rpc("complete_project_document_version_v1", {
    p_version: input.versionId,
    p_byte_size: declaredSize,
  });
  const done = (completed.data ?? {}) as { ok?: boolean; error?: string };
  if (completed.error || done.ok !== true) {
    await admin.storage.from(PROJECT_DOCUMENT_BUCKET).remove([row.storage_object_path]);
    await owned.context.supabase.rpc("fail_project_document_version_v1", { p_version: input.versionId });
    return { ...fail(done.error ?? "MISSING_OBJECT"), versionId: input.versionId };
  }
  const document = await versionView(owned.orgId, owned.projectId, input.versionId);
  const version = document?.versions.find((item) => item.id === input.versionId) ?? null;
  if (!document || !version || version.uploadStatus !== "ready") {
    return { ...fail("MISSING_OBJECT"), versionId: input.versionId };
  }
  return { ok: true, document, version };
}

export async function failProjectDocumentUpload(input: {
  projectId: string;
  versionId: string;
}): Promise<Fail> {
  const owned = await ownedProject(input.projectId);
  if (!owned.ok) return owned;
  const result = await owned.context.supabase.rpc("fail_project_document_version_v1", { p_version: input.versionId });
  const body = (result.data ?? {}) as { ok?: boolean; error?: string };
  if (result.error || body.ok !== true) return { ...fail(body.error), versionId: input.versionId };
  return { ...fail("MISSING_OBJECT"), versionId: input.versionId };
}

export async function removeProjectDocumentUpload(input: {
  projectId: string;
  versionId: string;
}): Promise<{ ok: true } | Fail> {
  const owned = await ownedProject(input.projectId);
  if (!owned.ok) return owned;
  const row = await readStoredVersion(owned.orgId, owned.projectId, input.versionId);
  const objectPath = row && pathMatches(owned.orgId, row) ? row.storage_object_path : null;
  const result = await owned.context.supabase.rpc("remove_unready_project_document_version_v1", { p_version: input.versionId });
  const body = (result.data ?? {}) as { ok?: boolean; error?: string };
  if (result.error || body.ok !== true) return fail(body.error);
  if (objectPath) await discardUnreferencedObject(objectPath);
  return { ok: true };
}

export async function deleteProjectDocument(input: {
  projectId: string;
  documentId: string;
}): Promise<Ok<{ documentId: string }> | Fail> {
  const owned = await ownedProject(input.projectId);
  if (!owned.ok) return owned;
  const authorized = await owned.context.supabase.rpc("authorize_project_document_delete_v1", {
    p_project: owned.projectId,
    p_document: input.documentId,
  });
  const authBody = (authorized.data ?? {}) as { ok?: boolean; error?: string };
  if (authorized.error || authBody.ok !== true) return fail(authBody.error);
  const admin = createAdminClient();
  const versions = await admin
    .from("project_document_versions")
    .select("id, storage_bucket, storage_object_path, document_id, org_id, project_id, display_filename")
    .eq("document_id", input.documentId)
    .eq("org_id", owned.orgId)
    .eq("project_id", owned.projectId);
  if (versions.error || !versions.data) return fail("NOT_FOUND");
  const versionIds = versions.data.map((row) => row.id).sort().join(",");
  for (const row of versions.data) {
    const path = row.storage_object_path;
    if (row.storage_bucket !== PROJECT_DOCUMENT_BUCKET || typeof path !== "string" || path.includes("..") || !pathMatches(owned.orgId, row as StoredVersion)) {
      return fail("NOT_FOUND");
    }
    const [otherDocs, variations] = await Promise.all([
      admin.from("project_document_versions").select("id", { count: "exact", head: true }).eq("storage_object_path", path).neq("document_id", input.documentId),
      admin.from("variation_attachments").select("id", { count: "exact", head: true }).eq("storage_object_path", path),
    ]);
    if (otherDocs.error || variations.error) return fail("DELETE_FAILED");
    if ((otherDocs.count ?? 0) > 0 || (variations.count ?? 0) > 0) continue;
    const removed = await admin.storage.from(PROJECT_DOCUMENT_BUCKET).remove([path]);
    if (removed.error) return fail("DELETE_FAILED");
  }
  const again = await admin
    .from("project_document_versions")
    .select("id")
    .eq("document_id", input.documentId)
    .eq("org_id", owned.orgId)
    .eq("project_id", owned.projectId);
  const againIds = (again.data ?? []).map((row) => row.id).sort().join(",");
  if (again.error || againIds !== versionIds) return fail("DELETE_FAILED");
  const committed = await owned.context.supabase.rpc("commit_project_document_delete_v1", {
    p_project: owned.projectId,
    p_document: input.documentId,
  });
  const commitBody = (committed.data ?? {}) as { ok?: boolean; error?: string };
  if (committed.error || commitBody.ok !== true) return fail(commitBody.error);
  return { ok: true, documentId: input.documentId };
}

export async function renameProjectDocumentTitle(input: {
  projectId: string;
  documentId: string;
  title: string;
}): Promise<Ok<{ title: string }> | Fail> {
  const owned = await ownedProject(input.projectId);
  if (!owned.ok) return owned;
  const result = await owned.context.supabase.rpc("rename_project_document_v1", {
    p_document: input.documentId,
    p_title: input.title,
  });
  const body = (result.data ?? {}) as { ok?: boolean; error?: string; title?: string };
  if (result.error || body.ok !== true || !body.title) return fail(body.error);
  return { ok: true, title: body.title };
}

export async function setProjectDocumentArchive(input: {
  projectId: string;
  documentId: string;
  archived: boolean;
}): Promise<Ok<{ archived: boolean }> | Fail> {
  const owned = await ownedProject(input.projectId);
  if (!owned.ok) return owned;
  const result = await owned.context.supabase.rpc("set_project_document_archived_v1", {
    p_document: input.documentId,
    p_archived: input.archived,
  });
  const body = (result.data ?? {}) as { ok?: boolean; error?: string; archived?: boolean };
  if (result.error || body.ok !== true || typeof body.archived !== "boolean") return fail(body.error);
  return { ok: true, archived: body.archived };
}

export async function signProjectDocumentVersion(input: {
  projectId: string;
  versionId: string;
}): Promise<Ok<{ url: string }> | Fail> {
  const owned = await ownedProject(input.projectId);
  if (!owned.ok) return owned;
  const authorized = await owned.context.supabase.rpc("authorize_project_document_version_v1", { p_version: input.versionId });
  const body = (authorized.data ?? {}) as { ok?: boolean; error?: string; displayFilename?: string };
  if (authorized.error || body.ok !== true) return fail("NOT_FOUND");
  const row = await readStoredVersion(owned.orgId, owned.projectId, input.versionId);
  if (!row || row.upload_status !== "ready" || !row.object_confirmed || !pathMatches(owned.orgId, row)) return fail("NOT_FOUND");
  const signed = await createAdminClient().storage.from(PROJECT_DOCUMENT_BUCKET).createSignedUrl(row.storage_object_path, 60, {
    download: body.displayFilename || row.display_filename,
  });
  if (signed.error || !signed.data?.signedUrl) return fail("NOT_FOUND");
  return { ok: true, url: signed.data.signedUrl };
}
