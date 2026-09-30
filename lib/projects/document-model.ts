import type { VariationAttachmentRevisionGroup } from "@/lib/variations/attachment-index";
import {
  isProjectDocumentCategory,
  isProjectDocumentVisibility,
  projectDocumentCategoryLabel,
  type ProjectDocumentCategory,
  type ProjectDocumentVisibility,
} from "@/lib/projects/document-files";

export type ProjectDocumentVersionView = {
  id: string;
  versionNumber: number;
  displayFilename: string;
  mimeType: string;
  byteSize: number;
  visibility: ProjectDocumentVisibility;
  versionNote: string | null;
  uploadStatus: "pending" | "ready" | "failed";
  createdAt: string;
  uploaderName: string | null;
  current: boolean;
};

export type ProjectDocumentView = {
  id: string;
  title: string;
  category: ProjectDocumentCategory;
  archived: boolean;
  createdAt: string;
  versions: ProjectDocumentVersionView[];
};

export type ProjectDocumentSummary = {
  files: number;
  photos: number;
  shareable: number;
};

type VersionRow = {
  id?: unknown;
  document_id?: unknown;
  version_number?: unknown;
  display_filename?: unknown;
  mime_type?: unknown;
  byte_size?: unknown;
  visibility?: unknown;
  version_note?: unknown;
  upload_status?: unknown;
  object_confirmed?: unknown;
  created_by?: unknown;
  created_at?: unknown;
};

type DocumentRow = {
  id?: unknown;
  title?: unknown;
  category?: unknown;
  archived_at?: unknown;
  created_at?: unknown;
};

export function projectDocumentCentreFromRows(input: {
  documents: readonly DocumentRow[];
  versions: readonly VersionRow[];
  uploaderNames?: ReadonlyMap<string, string>;
}): ProjectDocumentView[] {
  const names = input.uploaderNames ?? new Map<string, string>();
  const versionsByDocument = new Map<string, ProjectDocumentVersionView[]>();
  for (const row of input.versions) {
    const documentId = text(row.document_id);
    const visibility = text(row.visibility);
    const status = text(row.upload_status);
    const versionNumber = numberValue(row.version_number);
    const byteSize = numberValue(row.byte_size);
    if (
      !documentId ||
      !isProjectDocumentVisibility(visibility) ||
      (status !== "pending" && status !== "ready" && status !== "failed") ||
      versionNumber == null ||
      byteSize == null
    ) {
      continue;
    }
    const createdBy = text(row.created_by);
    const version: ProjectDocumentVersionView = {
      id: text(row.id),
      versionNumber,
      displayFilename: text(row.display_filename) || "File",
      mimeType: text(row.mime_type),
      byteSize,
      visibility,
      versionNote: text(row.version_note) || null,
      uploadStatus: status,
      createdAt: text(row.created_at),
      uploaderName: createdBy ? names.get(createdBy) ?? null : null,
      current: false,
    };
    if (!version.id) continue;
    const list = versionsByDocument.get(documentId) ?? [];
    list.push(version);
    versionsByDocument.set(documentId, list);
  }

  const documents: ProjectDocumentView[] = [];
  for (const row of input.documents) {
    const id = text(row.id);
    const category = text(row.category);
    if (!id || !isProjectDocumentCategory(category)) continue;
    const versions = (versionsByDocument.get(id) ?? []).sort((a, b) => b.versionNumber - a.versionNumber);
    const currentNumber = versions.reduce<number | null>((best, version) => {
      if (version.uploadStatus !== "ready") return best;
      return best == null || version.versionNumber > best ? version.versionNumber : best;
    }, null);
    documents.push({
      id,
      title: text(row.title) || "Project file",
      category,
      archived: row.archived_at != null && text(row.archived_at) !== "",
      createdAt: text(row.created_at),
      versions: versions.map((version) => ({
        ...version,
        current: currentNumber != null && version.versionNumber === currentNumber && version.uploadStatus === "ready",
      })),
    });
  }
  return documents.sort((a, b) => a.title.localeCompare(b.title) || a.createdAt.localeCompare(b.createdAt));
}

export function summariseProjectDocuments(documents: readonly ProjectDocumentView[]): ProjectDocumentSummary {
  let files = 0;
  let photos = 0;
  let shareable = 0;
  for (const document of documents) {
    for (const version of document.versions) {
      if (version.uploadStatus !== "ready") continue;
      files += 1;
      if (document.category === "photos" && (version.mimeType === "image/jpeg" || version.mimeType === "image/png")) {
        photos += 1;
      }
      if (version.visibility === "shareable") shareable += 1;
    }
  }
  return { files, photos, shareable };
}

export function mergeReadyVersion(
  documents: readonly ProjectDocumentView[],
  document: ProjectDocumentView
): ProjectDocumentView[] {
  const rest = documents.filter((item) => item.id !== document.id);
  const previous = documents.find((item) => item.id === document.id);
  const incoming = document.versions[0];
  if (!incoming) return [...documents];
  const versions = [
    incoming,
    ...(previous?.versions.filter((version) => version.id !== incoming.id) ?? []),
  ].sort((a, b) => b.versionNumber - a.versionNumber);
  const currentNumber = versions.reduce<number | null>((best, version) => {
    if (version.uploadStatus !== "ready") return best;
    return best == null || version.versionNumber > best ? version.versionNumber : best;
  }, null);
  const next: ProjectDocumentView = {
    ...document,
    versions: versions.map((version) => ({
      ...version,
      current: currentNumber != null && version.versionNumber === currentNumber && version.uploadStatus === "ready",
    })),
  };
  return [...rest, next].sort((a, b) => a.title.localeCompare(b.title) || a.createdAt.localeCompare(b.createdAt));
}

export function renameProjectDocument(
  documents: readonly ProjectDocumentView[],
  documentId: string,
  title: string
): ProjectDocumentView[] {
  return documents.map((document) => (document.id === documentId ? { ...document, title } : document));
}

export function setProjectDocumentArchived(
  documents: readonly ProjectDocumentView[],
  documentId: string,
  archived: boolean
): ProjectDocumentView[] {
  return documents.map((document) => (document.id === documentId ? { ...document, archived } : document));
}

export function removeProjectVersion(
  documents: readonly ProjectDocumentView[],
  versionId: string
): ProjectDocumentView[] {
  return documents.flatMap((document) => {
    const versions = document.versions.filter((version) => version.id !== versionId);
    if (versions.length === 0) return [];
    return [{ ...document, versions }];
  });
}

export type ProjectDocumentCentreModel = {
  documents: ProjectDocumentView[];
  documentsUnavailable: boolean;
  variationGroups: VariationAttachmentRevisionGroup[];
  variationUnavailable: boolean;
};

export function projectDocumentCategoryGroups(documents: readonly ProjectDocumentView[]) {
  const order = [
    "plans_and_drawings",
    "specifications",
    "photos",
    "reports",
    "client_documents",
    "other",
  ] as const;
  return order.flatMap((category) => {
    const items = documents.filter((document) => document.category === category);
    if (items.length === 0) return [];
    return [{ category, label: projectDocumentCategoryLabel(category), documents: items }];
  });
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function numberValue(value: unknown): number | null {
  const number = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  return Number.isFinite(number) ? number : null;
}
