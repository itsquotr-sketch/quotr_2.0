import type { ProjectDocumentCategory, ProjectDocumentMime, ProjectDocumentVisibility } from "@/lib/projects/document-files";
import type { ProjectDocumentVersionView, ProjectDocumentView } from "@/lib/projects/document-model";

type Fail = { ok: false; error: string; versionId?: string };

const UNAVAILABLE: Fail = { ok: false, error: "Upload failed" };

async function postDocument<T>(body: Record<string, unknown>): Promise<T | Fail> {
  try {
    const response = await fetch("/api/projects/documents", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = (await response.json()) as T | Fail;
    if (!payload || typeof payload !== "object" || !("ok" in payload)) return UNAVAILABLE;
    return payload;
  } catch {
    return UNAVAILABLE;
  }
}

export function prepareProjectDocumentUpload(input: {
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
}): Promise<
  | {
      ok: true;
      documentId: string;
      versionId: string;
      versionNumber: number;
      signedUrl: string;
      displayFilename: string;
      mimeType: ProjectDocumentMime;
      title: string;
      category: ProjectDocumentCategory;
      visibility: ProjectDocumentVisibility;
    }
  | Fail
> {
  return postDocument({ op: "prepare", ...input });
}

export function finalizeProjectDocumentUpload(input: {
  projectId: string;
  versionId: string;
}): Promise<{ ok: true; document: ProjectDocumentView; version: ProjectDocumentVersionView } | Fail> {
  return postDocument({ op: "finalize", ...input });
}

export function failProjectDocumentUpload(input: {
  projectId: string;
  versionId: string;
}): Promise<Fail> {
  return postDocument({ op: "fail", ...input });
}

export function removeProjectDocumentUpload(input: {
  projectId: string;
  versionId: string;
}): Promise<{ ok: true } | Fail> {
  return postDocument({ op: "remove", ...input });
}

export function renameProjectDocumentTitle(input: {
  projectId: string;
  documentId: string;
  title: string;
}): Promise<{ ok: true; title: string } | Fail> {
  return postDocument({ op: "rename", ...input });
}

export function setProjectDocumentArchive(input: {
  projectId: string;
  documentId: string;
  archived: boolean;
}): Promise<{ ok: true; archived: boolean } | Fail> {
  return postDocument({ op: "archive", ...input });
}

export function signProjectDocumentVersion(input: {
  projectId: string;
  versionId: string;
}): Promise<{ ok: true; url: string } | Fail> {
  return postDocument({ op: "sign", ...input });
}
