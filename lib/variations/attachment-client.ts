import type { VariationAttachmentMime, VariationAttachmentVisibility } from "@/lib/variations/attachment-files";
import type { VariationAttachmentView } from "@/lib/variations/workspace-types";

type Fail = { ok: false; error: string; attachmentId?: string };

const UNAVAILABLE: Fail = { ok: false, error: "That file could not be saved." };

async function postAttachment<T>(body: Record<string, unknown>): Promise<T | Fail> {
  try {
    const response = await fetch("/api/variations/attachments", {
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

export function prepareVariationAttachmentUpload(input: {
  projectId: string;
  variationId: string;
  revisionId: string;
  visibility: VariationAttachmentVisibility;
  originalFilename: string;
  byteSize: number;
  headerBase64: string;
  retryAttachmentId?: string | null;
}): Promise<{ ok: true; attachmentId: string; signedUrl: string; displayFilename: string; mimeType: VariationAttachmentMime } | Fail> {
  return postAttachment({ op: "prepare", ...input });
}

export function finalizeVariationAttachment(input: {
  projectId: string;
  variationId: string;
  attachmentId: string;
}): Promise<{ ok: true; attachment: VariationAttachmentView } | Fail> {
  return postAttachment({ op: "finalize", ...input });
}

export function failVariationAttachmentUpload(input: {
  projectId: string;
  variationId: string;
  attachmentId: string;
}): Promise<Fail> {
  return postAttachment({ op: "fail", ...input });
}

export function updateVariationAttachment(input: {
  projectId: string;
  variationId: string;
  attachmentId: string;
  displayFilename: string;
  caption: string;
  internalDescription: string;
  linkedVariationItemId: string | null;
}): Promise<{ ok: true; displayFilename: string } | Fail> {
  return postAttachment({ op: "update", ...input });
}

export function reorderVariationAttachments(input: {
  projectId: string;
  variationId: string;
  revisionId: string;
  visibility: VariationAttachmentVisibility;
  ids: string[];
}): Promise<{ ok: true } | Fail> {
  return postAttachment({ op: "reorder", ...input });
}

export function removeVariationAttachment(input: {
  projectId: string;
  variationId: string;
  attachmentId: string;
}): Promise<{ ok: true } | Fail> {
  return postAttachment({ op: "remove", ...input });
}

export function signVariationAttachment(input: {
  projectId: string;
  variationId: string;
  attachmentId: string;
}): Promise<{ ok: true; url: string } | Fail> {
  return postAttachment({ op: "sign", ...input });
}
