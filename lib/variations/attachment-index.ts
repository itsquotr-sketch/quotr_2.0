import type { VariationAttachmentVisibility } from "@/lib/variations/attachment-files";

/**
 * Variation revision remains the owner of each attachment.
 * Project Documents is a discovery/index surface over these same rows.
 * It must not copy storage objects or create a second attachment row.
 * Deleting or reclassifying a file later must still obey the Variation revision lifecycle.
 * Issued Variation attachments cannot be deleted through a future Documents screen.
 */
export type VariationAttachmentIndexSource = {
  id: string;
  variationNumber: number;
  revisionNumber: number;
  revisionStatus: string;
  visibility: VariationAttachmentVisibility;
  mimeType: string;
  createdAt: string;
  frozen: boolean;
  /** Discovery fields. They do not copy the Variation row or its object. */
  displayFilename?: string;
  byteSize?: number;
  variationId?: string;
};

export type IndexedVariationAttachment = VariationAttachmentIndexSource & {
  deletableThroughDocuments: boolean;
};

export type VariationAttachmentRevisionGroup = {
  variationNumber: number;
  revisionNumber: number;
  revisionStatus: string;
  attachments: IndexedVariationAttachment[];
};

export function indexVariationAttachments(
  rows: readonly VariationAttachmentIndexSource[]
): VariationAttachmentRevisionGroup[] {
  const groups = new Map<string, VariationAttachmentRevisionGroup>();
  for (const row of rows) {
    const key = `${row.variationNumber}:${row.revisionNumber}`;
    const current = groups.get(key) ?? {
      variationNumber: row.variationNumber,
      revisionNumber: row.revisionNumber,
      revisionStatus: row.revisionStatus,
      attachments: [],
    };
    current.attachments.push({
      ...row,
      deletableThroughDocuments: row.revisionStatus === "draft" && !row.frozen,
    });
    groups.set(key, current);
  }
  return [...groups.values()].sort((a, b) =>
    a.variationNumber - b.variationNumber || a.revisionNumber - b.revisionNumber
  );
}
