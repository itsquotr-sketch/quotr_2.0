/**
 * Private subcontractor files follow the project-document limits.
 * A stored file is not a quotation and is not attached to an RFQ.
 */

export const SUBCONTRACTOR_DOCUMENT_BUCKET = "subcontractor-documents";
export const SUBCONTRACTOR_DOCUMENT_MAX_BYTES = 15 * 1024 * 1024;

export const SUBCONTRACTOR_DOCUMENT_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
] as const;

export type SubcontractorDocumentMime = (typeof SUBCONTRACTOR_DOCUMENT_MIME_TYPES)[number];

export function isSubcontractorDocumentMime(value: string): value is SubcontractorDocumentMime {
  return (SUBCONTRACTOR_DOCUMENT_MIME_TYPES as readonly string[]).includes(value);
}
