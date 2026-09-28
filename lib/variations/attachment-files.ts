/**
 * Variation attachment file rules.
 * The browser accept attribute is only a hint. The server checks these rules
 * before a storage object or a ready attachment row is kept.
 */

export const VARIATION_ATTACHMENT_BUCKET = "variation-attachments";
export const VARIATION_ATTACHMENT_MAX_BYTES = 15 * 1024 * 1024;
export const VARIATION_ATTACHMENT_MAX_ACTIVE = 20;
export const VARIATION_ATTACHMENT_SCHEMA_VERSION = 1;

export const VARIATION_ATTACHMENT_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
] as const;

export type VariationAttachmentMime = (typeof VARIATION_ATTACHMENT_MIME_TYPES)[number];
export type VariationAttachmentVisibility = "client" | "internal";
export type VariationAttachmentUploadStatus = "pending" | "ready" | "failed";

const MIME_EXTENSION: Record<VariationAttachmentMime, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
};

export function isVariationAttachmentMime(value: string): value is VariationAttachmentMime {
  return (VARIATION_ATTACHMENT_MIME_TYPES as readonly string[]).includes(value);
}

export function variationAttachmentTypeLabel(mime: string): string {
  switch (mime) {
    case "image/jpeg":
      return "JPEG";
    case "image/png":
      return "PNG";
    case "application/pdf":
      return "PDF";
    case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
      return "DOCX";
    case "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
      return "XLSX";
    default:
      return "File";
  }
}

export function variationAttachmentKind(mime: string): "image" | "document" {
  return mime === "image/jpeg" || mime === "image/png" ? "image" : "document";
}

export function formatAttachmentSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "Unknown size";
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  const mb = bytes / (1024 * 1024);
  return `${mb >= 10 ? mb.toFixed(0) : mb.toFixed(1)} MB`;
}

/** Display name only. Storage paths are generated on the server and are not derived from this. */
export function safeVariationDisplayFilename(original: string, mime: VariationAttachmentMime): string {
  const extension = MIME_EXTENSION[mime];
  const leaf = original.split(/[/\\]/).pop() ?? "file";
  const cleaned = leaf.replace(/[^A-Za-z0-9._() -]+/g, "_").replace(/^\.+/, "").trim().slice(0, 100);
  const stem = cleaned.replace(/\.[^.]+$/, "").trim() || "file";
  const lower = cleaned.toLowerCase();
  if (mime === "image/jpeg" && (lower.endsWith(".jpg") || lower.endsWith(".jpeg"))) {
    return cleaned;
  }
  if (lower.endsWith(`.${extension}`)) return cleaned || `file.${extension}`;
  return `${stem.slice(0, 90)}.${extension}`;
}

/** Local and server gate. A valid file is not marked ready until storage finalisation succeeds. */
export function variationAttachmentSelectionError(
  filename: string,
  byteSize: number,
  prefix: Uint8Array
): string | null {
  if (!Number.isInteger(byteSize) || byteSize <= 0 || byteSize > VARIATION_ATTACHMENT_MAX_BYTES) {
    return byteSize > VARIATION_ATTACHMENT_MAX_BYTES
      ? "Each file must be 15 MB or smaller."
      : "Use a JPG, PNG, PDF, DOCX or XLSX file.";
  }
  if (!sniffVariationAttachment(prefix, filename)) {
    return "Use a JPG, PNG, PDF, DOCX or XLSX file.";
  }
  return null;
}

export function sniffVariationAttachment(
  bytes: Uint8Array,
  filename: string
): { mime: VariationAttachmentMime } | null {
  if (bytes.byteLength === 0 || bytes.byteLength > VARIATION_ATTACHMENT_MAX_BYTES) return null;
  const extension = filename.split(/[/\\]/).pop()?.split(".").pop()?.toLowerCase() ?? "";
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return extension === "jpg" || extension === "jpeg" ? { mime: "image/jpeg" } : null;
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return extension === "png" ? { mime: "image/png" } : null;
  }
  if (bytes.length >= 5 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46 && bytes[4] === 0x2d) {
    return extension === "pdf" ? { mime: "application/pdf" } : null;
  }
  const zip = bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && (bytes[2] === 0x03 || bytes[2] === 0x05 || bytes[2] === 0x07);
  if (!zip) return null;
  if (extension === "docx") {
    return { mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" };
  }
  if (extension === "xlsx") {
    return { mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" };
  }
  return null;
}

/**
 * Delete the storage object only when this draft row is the last reference.
 * An issued revision, or any other revision, keeps the shared object.
 */
export function canDeleteVariationAttachmentObject(otherReferenceCount: number): boolean {
  return otherReferenceCount === 0;
}

export function variationAttachmentObjectPath(input: {
  orgId: string;
  projectId: string;
  variationId: string;
  revisionId: string;
  attachmentId: string;
  safeFilename: string;
}): string {
  return `${input.orgId}/${input.projectId}/${input.variationId}/${input.revisionId}/${input.attachmentId}/${input.safeFilename}`;
}
