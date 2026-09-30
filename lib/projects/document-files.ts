/**
 * Project document file rules.
 * The browser accept hint is not authority. The server sniffs bytes before a
 * version can become ready. Limits match the shared Variation attachment rules.
 */

import {
  VARIATION_ATTACHMENT_MAX_BYTES,
  VARIATION_ATTACHMENT_MIME_TYPES,
  safeVariationDisplayFilename,
  sniffVariationAttachment,
  variationAttachmentSelectionError,
  type VariationAttachmentMime,
} from "@/lib/variations/attachment-files";

export const PROJECT_DOCUMENT_BUCKET = "project-documents";
export const PROJECT_DOCUMENT_MAX_BYTES = VARIATION_ATTACHMENT_MAX_BYTES;
export const PROJECT_DOCUMENT_MIME_TYPES = VARIATION_ATTACHMENT_MIME_TYPES;

export const PROJECT_DOCUMENT_CATEGORIES = [
  "plans_and_drawings",
  "specifications",
  "photos",
  "reports",
  "client_documents",
  "other",
] as const;

export type ProjectDocumentCategory = (typeof PROJECT_DOCUMENT_CATEGORIES)[number];
export type ProjectDocumentVisibility = "internal" | "shareable";
export type ProjectDocumentMime = VariationAttachmentMime;

const CATEGORY_LABEL: Record<ProjectDocumentCategory, string> = {
  plans_and_drawings: "Plans and drawings",
  specifications: "Specifications",
  photos: "Photos",
  reports: "Reports",
  client_documents: "Client documents",
  other: "Other",
};

export function isProjectDocumentCategory(value: string): value is ProjectDocumentCategory {
  return (PROJECT_DOCUMENT_CATEGORIES as readonly string[]).includes(value);
}

export function isProjectDocumentVisibility(value: string): value is ProjectDocumentVisibility {
  return value === "internal" || value === "shareable";
}

export function projectDocumentCategoryLabel(category: ProjectDocumentCategory): string {
  return CATEGORY_LABEL[category];
}

export function projectDocumentVisibilityLabel(visibility: ProjectDocumentVisibility): string {
  return visibility === "shareable" ? "Shareable" : "Internal";
}

export function projectDocumentObjectPath(input: {
  orgId: string;
  projectId: string;
  documentId: string;
  versionId: string;
  safeFilename: string;
}): string {
  return `${input.orgId}/${input.projectId}/${input.documentId}/${input.versionId}/${input.safeFilename}`;
}

export function projectDocumentSelectionError(
  filename: string,
  byteSize: number,
  prefix: Uint8Array
): string | null {
  return variationAttachmentSelectionError(filename, byteSize, prefix);
}

export function sniffProjectDocument(bytes: Uint8Array, filename: string) {
  return sniffVariationAttachment(bytes, filename);
}

export function safeProjectDisplayFilename(original: string, mime: ProjectDocumentMime): string {
  return safeVariationDisplayFilename(original, mime);
}
