"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ProjectDocumentCentreModel } from "@/lib/projects/document-model";
import {
  failProjectDocumentUpload,
  finalizeProjectDocumentUpload,
  prepareProjectDocumentUpload,
  removeProjectDocumentUpload,
  renameProjectDocumentTitle,
  setProjectDocumentArchive,
  signProjectDocumentVersion,
} from "@/lib/projects/document-client";
import { uploadProjectDocumentToSignedUrl } from "@/lib/projects/document-direct-upload";
import {
  PROJECT_DOCUMENT_CATEGORIES,
  isProjectDocumentCategory,
  projectDocumentCategoryLabel,
  projectDocumentSelectionError,
  projectDocumentVisibilityLabel,
  type ProjectDocumentCategory,
  type ProjectDocumentVisibility,
} from "@/lib/projects/document-files";
import {
  mergeReadyVersion,
  projectDocumentCategoryGroups,
  removeProjectVersion,
  renameProjectDocument,
  setProjectDocumentArchived,
  summariseProjectDocuments,
  type ProjectDocumentVersionView,
  type ProjectDocumentView,
} from "@/lib/projects/document-model";
import { putTransfer, type UploadTransfer } from "@/lib/projects/document-upload-state";
import { signVariationAttachment } from "@/lib/variations/attachment-client";
import {
  formatAttachmentSize,
  variationAttachmentKind,
  variationAttachmentTypeLabel,
} from "@/lib/variations/attachment-files";

type DraftCard = {
  localId: string;
  documentId: string | null;
  versionId: string | null;
  title: string;
  category: ProjectDocumentCategory;
  visibility: ProjectDocumentVisibility;
  displayFilename: string;
  mimeType: string;
  byteSize: number;
  versionNote: string;
  versionNumber: number | null;
  file: File;
};

type Chooser = {
  documentId: string | null;
  category: ProjectDocumentCategory;
  title: string;
};

const ACCEPT = ".jpg,.jpeg,.png,.pdf,.docx,.xlsx,image/jpeg,image/png,application/pdf";
const CONTROL = "inline-flex min-h-11 items-center justify-center rounded-md border border-border bg-background px-3 text-sm font-medium";

export function ProjectDocumentsSection({
  projectId,
  centre,
}: {
  projectId: string;
  centre: ProjectDocumentCentreModel;
}) {
  const [documents, setDocuments] = useState(centre.documents);
  const [drafts, setDrafts] = useState<DraftCard[]>([]);
  const [transfers, setTransfers] = useState<Record<string, UploadTransfer>>({});
  const [chooser, setChooser] = useState<Chooser | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [visibility, setVisibility] = useState<ProjectDocumentVisibility>("internal");
  const [note, setNote] = useState("");
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [visibilityFilter, setVisibilityFilter] = useState("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [fileAlert, setFileAlert] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ name: string; url: string } | null>(null);
  const summary = summariseProjectDocuments(documents);
  const filtered = useMemo(
    () => filterDocuments(documents, query, categoryFilter, visibilityFilter),
    [documents, query, categoryFilter, visibilityFilter]
  );
  const groups = projectDocumentCategoryGroups(filtered);
  const photos = photoVersions(documents, query, categoryFilter, visibilityFilter);
  const variationGroups = filterVariations(centre.variationGroups, query, categoryFilter, visibilityFilter);
  const filtering = query.trim() !== "" || categoryFilter !== "all" || visibilityFilter !== "all";
  const visibleDrafts = drafts.filter((draft) => draftMatches(draft, query, categoryFilter, visibilityFilter));

  function updateTransfer(id: string, next: UploadTransfer | null) {
    setTransfers((current) => putTransfer(current, id, next));
  }

  function beginUploads(chosen: File[], options: Chooser & { visibility: ProjectDocumentVisibility; note: string }) {
    for (const file of chosen) {
      const localId = `local-${crypto.randomUUID()}`;
      const draft: DraftCard = {
        localId,
        documentId: options.documentId,
        versionId: null,
        title: options.title.trim() || file.name,
        category: options.category,
        visibility: options.visibility,
        displayFilename: file.name,
        mimeType: file.type || "application/octet-stream",
        byteSize: file.size,
        versionNote: options.note.trim(),
        versionNumber: null,
        file,
      };
      setDrafts((current) => current.concat(draft));
      updateTransfer(localId, { progress: null, error: null });
      void uploadOne(draft, options);
    }
  }

  async function uploadOne(draft: DraftCard, options: Chooser & { visibility: ProjectDocumentVisibility; note: string }) {
    const prefix = new Uint8Array(await draft.file.slice(0, 32).arrayBuffer());
    const rejection = projectDocumentSelectionError(draft.file.name, draft.file.size, prefix);
    if (rejection) {
      updateTransfer(draft.localId, { progress: null, error: rejection });
      return;
    }
    const prepared = await prepareProjectDocumentUpload({
      projectId,
      documentId: options.documentId,
      category: options.category,
      title: options.title,
      visibility: options.visibility,
      originalFilename: draft.file.name,
      byteSize: draft.file.size,
      headerBase64: btoa(String.fromCharCode(...prefix)),
      versionNote: options.note,
      retryVersionId: draft.versionId,
    });
    if (!prepared.ok) {
      updateTransfer(draft.localId, { progress: null, error: prepared.error });
      if (prepared.versionId) {
        setDrafts((current) => current.map((item) => item.localId === draft.localId ? { ...item, versionId: prepared.versionId ?? null } : item));
      }
      return;
    }
    setDrafts((current) => current.map((item) => item.localId === draft.localId ? {
      ...item,
      documentId: prepared.documentId,
      versionId: prepared.versionId,
      versionNumber: prepared.versionNumber,
      displayFilename: prepared.displayFilename,
      mimeType: prepared.mimeType,
      title: prepared.title,
      visibility: prepared.visibility,
    } : item));
    const controller = new AbortController();
    try {
      await uploadProjectDocumentToSignedUrl({
        signedUrl: prepared.signedUrl,
        file: draft.file,
        upsert: Boolean(draft.versionId),
        signal: controller.signal,
        onProgress: (progress) => updateTransfer(draft.localId, { progress, error: null }),
      });
    } catch {
      await failProjectDocumentUpload({ projectId, versionId: prepared.versionId });
      updateTransfer(draft.localId, { progress: null, error: "Upload failed" });
      return;
    }
    const finalized = await finalizeProjectDocumentUpload({ projectId, versionId: prepared.versionId });
    if (!finalized.ok) {
      updateTransfer(draft.localId, { progress: null, error: finalized.error || "Upload failed" });
      return;
    }
    setDocuments((current) => mergeReadyVersion(current, finalized.document));
    setDrafts((current) => current.filter((item) => item.localId !== draft.localId));
    updateTransfer(draft.localId, null);
  }

  async function retryDraft(draft: DraftCard) {
    updateTransfer(draft.localId, { progress: null, error: null });
    await uploadOne(draft, {
      documentId: draft.documentId,
      category: draft.category,
      title: draft.title,
      visibility: draft.visibility,
      note: draft.versionNote,
    });
  }

  async function removeDraft(draft: DraftCard) {
    if (draft.versionId) {
      await removeProjectDocumentUpload({ projectId, versionId: draft.versionId });
      setDocuments((current) => removeProjectVersion(current, draft.versionId as string));
    }
    setDrafts((current) => current.filter((item) => item.localId !== draft.localId));
    updateTransfer(draft.localId, null);
  }

  async function openFile(versionId: string, filename: string, mimeType: string) {
    setFileAlert(null);
    const signed = await signProjectDocumentVersion({ projectId, versionId });
    if (!signed.ok || !signed.url) {
      setFileAlert("File unavailable");
      return;
    }
    if (variationAttachmentKind(mimeType) === "image") setPreview({ name: filename, url: signed.url });
    else window.open(signed.url, "_blank", "noopener,noreferrer");
  }

  async function openVariationFile(variationId: string, attachmentId: string) {
    setFileAlert(null);
    const signed = await signVariationAttachment({ projectId, variationId, attachmentId });
    if (!signed.ok || !signed.url) {
      setFileAlert("File unavailable");
      return;
    }
    window.open(signed.url, "_blank", "noopener,noreferrer");
  }

  const noProjectFiles = documents.length === 0 && drafts.length === 0 && !centre.documentsUnavailable;

  return (
    <div className="min-w-0" data-project-documents-centre="true">
      <p className="text-sm leading-5 text-foreground/75">
        Plans, specifications, photos and project files for this project.
      </p>
      <p className="mt-2 text-sm leading-5" data-project-document-summary="true">
        {summary.files} {summary.files === 1 ? "file" : "files"}
        {" · "}
        {summary.photos} {summary.photos === 1 ? "photo" : "photos"}
        {" · "}
        {summary.shareable} shareable
      </p>
      <div className="mt-3 flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap">
        <Button
          type="button"
          size="touch"
          className="w-full sm:w-auto"
          onClick={() => {
            setVisibility("internal");
            setNote("");
            setFiles([]);
            setChooser({ documentId: null, category: "plans_and_drawings", title: "" });
          }}
        >
          Upload files
        </Button>
      </div>
      <div className="mt-3 grid min-w-0 gap-2 sm:grid-cols-3">
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search files"
          aria-label="Search files"
          className="min-h-11 sm:col-span-1"
        />
        <select
          aria-label="Category"
          value={categoryFilter}
          onChange={(event) => setCategoryFilter(event.target.value)}
          className="min-h-11 w-full min-w-0 rounded-xl border border-border bg-background px-3 text-sm"
        >
          <option value="all">All categories</option>
          {PROJECT_DOCUMENT_CATEGORIES.map((category) => (
            <option key={category} value={category}>{projectDocumentCategoryLabel(category)}</option>
          ))}
        </select>
        <select
          aria-label="Visibility"
          value={visibilityFilter}
          onChange={(event) => setVisibilityFilter(event.target.value)}
          className="min-h-11 w-full min-w-0 rounded-xl border border-border bg-background px-3 text-sm"
        >
          <option value="all">All visibility</option>
          <option value="internal">Internal</option>
          <option value="shareable">Shareable</option>
        </select>
      </div>

      {centre.documentsUnavailable ? (
        <p className="mt-3 text-sm leading-5" role="alert">File unavailable</p>
      ) : null}
      {fileAlert ? (
        <p className="mt-3 text-sm leading-5" role="alert">{fileAlert}</p>
      ) : null}

      <div className="mt-4 min-w-0">
        <h4 className="text-sm font-medium leading-5">Photos</h4>
        {photos.length > 0 ? (
          <ul className="mt-2 grid grid-cols-1 gap-2 min-[420px]:grid-cols-2">
            {photos.map((photo) => (
              <li key={photo.version.id} className="min-w-0 rounded-lg border border-border/70 px-3 py-2">
                <p className="break-words text-sm font-medium leading-5">{photo.document.title}</p>
                <p className="break-words text-sm leading-5 text-foreground/75">
                  {photo.version.displayFilename} · Version {photo.version.versionNumber} · {projectDocumentVisibilityLabel(photo.version.visibility)} · {formatAttachmentSize(photo.version.byteSize)}
                </p>
                <button type="button" className={`${CONTROL} mt-2 w-full sm:w-auto`} onClick={() => void openFile(photo.version.id, photo.version.displayFilename, photo.version.mimeType)}>
                  View
                </button>
              </li>
            ))}
          </ul>
        ) : categoryFilter === "all" || categoryFilter === "photos" ? (
          <p className="mt-2 text-sm leading-5 text-foreground/75">No photos yet</p>
        ) : null}
      </div>

      <div className="mt-4 min-w-0 space-y-4">
        {noProjectFiles && !filtering ? (
          <p className="text-sm leading-5 text-foreground/75">No project files yet</p>
        ) : null}
        {filtering && filtered.length === 0 && visibleDrafts.length === 0 ? (
          <p className="text-sm leading-5 text-foreground/75">No files match these filters</p>
        ) : null}
        {visibleDrafts.length > 0 ? (
          <ul className="divide-y divide-border/70">
            {visibleDrafts.map((draft) => (
              <DraftRow
                key={draft.localId}
                draft={draft}
                transfer={transfers[draft.localId] ?? { progress: null, error: null }}
                onRetry={() => void retryDraft(drafts.find((item) => item.localId === draft.localId) ?? draft)}
                onRemove={() => void removeDraft(draft)}
              />
            ))}
          </ul>
        ) : null}
        {groups.map((group) => (
          <section key={group.category} className="min-w-0">
            <h4 className="text-sm font-medium leading-5">{group.label}</h4>
            <ul className="mt-2 divide-y divide-border/70">
              {group.documents.map((document) => (
                <DocumentRow
                  key={document.id}
                  document={document}
                  open={openId === document.id}
                  onToggle={() => setOpenId((current) => current === document.id ? null : document.id)}
                  onOpenFile={(version) => void openFile(version.id, version.displayFilename, version.mimeType)}
                  onNewVersion={() => {
                    setVisibility("internal");
                    setNote("");
                    setFiles([]);
                    setChooser({ documentId: document.id, category: document.category, title: document.title });
                  }}
                  onRename={async (title) => {
                    const renamed = await renameProjectDocumentTitle({ projectId, documentId: document.id, title });
                    if (renamed.ok) setDocuments((current) => renameProjectDocument(current, document.id, renamed.title));
                  }}
                  onArchive={async (archived) => {
                    const saved = await setProjectDocumentArchive({ projectId, documentId: document.id, archived });
                    if (saved.ok) setDocuments((current) => setProjectDocumentArchived(current, document.id, saved.archived));
                  }}
                />
              ))}
            </ul>
          </section>
        ))}
      </div>

      <section className="mt-4 min-w-0" data-variation-attachment-index="true">
        <h4 className="text-sm font-medium leading-5">Variation attachments</h4>
        {centre.variationUnavailable ? (
          <p className="mt-2 text-sm leading-5" role="alert">Variation attachments unavailable</p>
        ) : variationGroups.length === 0 ? (
          <p className="mt-2 text-sm leading-5 text-foreground/75">No variation attachments to show.</p>
        ) : (
          <ul className="mt-2 divide-y divide-border/70">
            {variationGroups.flatMap((group) => group.attachments).map((file) => (
              <li key={file.id} className="min-w-0 py-3">
                <p className="break-words text-sm font-medium leading-5">{file.displayFilename || "File"}</p>
                <p className="mt-1 break-words text-sm leading-5 text-foreground/75">
                  {variationAttachmentTypeLabel(file.mimeType)}
                  {file.byteSize != null ? ` · ${formatAttachmentSize(file.byteSize)}` : ""}
                  {" · "}
                  {file.visibility === "client" ? "Client" : "Internal"}
                  {" · "}
                  Variation {file.variationNumber}
                  {" · "}
                  Revision {file.revisionNumber}
                  {" · "}
                  {file.revisionStatus}
                  {" · "}
                  {formatWhen(file.createdAt)}
                </p>
                <div className="mt-2 flex min-w-0 flex-col gap-2 sm:flex-row">
                  {file.variationId ? (
                    <Link href={`/app/projects/${projectId}/variations/${file.variationId}`} className={`${CONTROL} w-full sm:w-auto`}>
                      Open variation
                    </Link>
                  ) : null}
                  <button type="button" className={`${CONTROL} w-full sm:w-auto`} onClick={() => file.variationId && void openVariationFile(file.variationId, file.id)}>
                    Download
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Dialog open={chooser != null} onOpenChange={(open) => { if (!open) setChooser(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{chooser?.documentId ? "Upload new version" : "Upload files"}</DialogTitle>
            <DialogDescription>
              {chooser?.documentId
                ? "Adds a new version. Earlier versions stay available."
                : "Each file becomes its own project document."}
            </DialogDescription>
          </DialogHeader>
          {chooser ? (
            <form
              className="grid gap-3"
              onSubmit={(event) => {
                event.preventDefault();
                const chosen = files;
                if (chosen.length === 0) return;
                const options = { ...chooser, visibility, note };
                setChooser(null);
                beginUploads(chosen, options);
              }}
            >
              <div className="grid gap-1">
                <Label htmlFor="project-document-files">Files</Label>
                <input
                  id="project-document-files"
                  type="file"
                  accept={ACCEPT}
                  multiple={chooser.documentId == null}
                  className="min-h-11 w-full min-w-0 text-sm"
                  onChange={(event) => setFiles(Array.from(event.target.files ?? []))}
                />
              </div>
              <div className="grid gap-1">
                <Label htmlFor="project-document-category">Category</Label>
                <select
                  id="project-document-category"
                  aria-label="File category"
                  disabled={chooser.documentId != null}
                  value={chooser.category}
                  onChange={(event) => {
                    const value = event.target.value;
                    if (!isProjectDocumentCategory(value)) return;
                    setChooser({ ...chooser, category: value });
                  }}
                  className="min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm disabled:opacity-70"
                >
                  {PROJECT_DOCUMENT_CATEGORIES.map((category) => (
                    <option key={category} value={category}>{projectDocumentCategoryLabel(category)}</option>
                  ))}
                </select>
              </div>
              <fieldset className="grid gap-2">
                <legend className="text-sm font-medium">Visibility</legend>
                <label className="flex min-h-11 items-center gap-2 text-sm">
                  <input type="radio" name="project-document-visibility" checked={visibility === "internal"} onChange={() => setVisibility("internal")} />
                  Internal
                </label>
                <label className="flex min-h-11 items-center gap-2 text-sm">
                  <input type="radio" name="project-document-visibility" checked={visibility === "shareable"} onChange={() => setVisibility("shareable")} />
                  Shareable
                </label>
                <p className="text-sm leading-5 text-foreground/75">Shareable does not create a public link.</p>
              </fieldset>
              <div className="grid gap-1">
                <Label htmlFor="project-document-title">Title</Label>
                <Input id="project-document-title" value={chooser.title} onChange={(event) => setChooser({ ...chooser, title: event.target.value })} className="min-h-11" placeholder="Optional" />
              </div>
              <div className="grid gap-1">
                <Label htmlFor="project-document-note">Version note</Label>
                <Input id="project-document-note" value={note} onChange={(event) => setNote(event.target.value)} className="min-h-11" placeholder="Optional" />
              </div>
              <Button type="submit" size="touch" disabled={files.length === 0}>Start upload</Button>
            </form>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={preview != null} onOpenChange={(open) => { if (!open) setPreview(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{preview?.name ?? "Photo"}</DialogTitle>
          </DialogHeader>
          {preview ? (
            // The URL is a short-lived private signed link and must not be proxied.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview.url} alt={preview.name} className="max-h-[70vh] w-full object-contain" />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DraftRow({
  draft,
  transfer,
  onRetry,
  onRemove,
}: {
  draft: DraftCard;
  transfer: UploadTransfer;
  onRetry: () => void;
  onRemove: () => void;
}) {
  const failed = transfer.error != null;
  return (
    <li className="min-w-0 py-3" data-project-document-upload={draft.localId}>
      <p className="break-words text-sm font-medium leading-5">{draft.title}</p>
      <p className="mt-1 break-words text-sm leading-5 text-foreground/75">
        {projectDocumentCategoryLabel(draft.category)}
        {" · "}
        {draft.versionNumber ? `Version ${draft.versionNumber}` : "New file"}
        {" · "}
        {projectDocumentVisibilityLabel(draft.visibility)}
        {" · "}
        {formatAttachmentSize(draft.byteSize)}
      </p>
      {failed ? (
        <p className="mt-2 text-sm leading-5" role="alert">Upload failed</p>
      ) : (
        <p className="mt-2 flex items-center gap-2 text-sm leading-5">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          <span>Uploading…{transfer.progress != null ? ` ${transfer.progress}%` : ""}</span>
        </p>
      )}
      {failed ? (
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <button type="button" className={`${CONTROL} w-full sm:w-auto`} onClick={onRetry}>Retry</button>
          <button type="button" className={`${CONTROL} w-full sm:w-auto`} onClick={onRemove}>Remove</button>
        </div>
      ) : null}
    </li>
  );
}

function DocumentRow({
  document,
  open,
  onToggle,
  onOpenFile,
  onNewVersion,
  onRename,
  onArchive,
}: {
  document: ProjectDocumentView;
  open: boolean;
  onToggle: () => void;
  onOpenFile: (version: ProjectDocumentVersionView) => void;
  onNewVersion: () => void;
  onRename: (title: string) => Promise<void>;
  onArchive: (archived: boolean) => Promise<void>;
}) {
  const current = document.versions.find((version) => version.current) ?? document.versions[0];
  const [title, setTitle] = useState(document.title);
  if (!current) return null;
  return (
    <li className="min-w-0 py-3" data-project-document-row={document.id}>
      <div className="flex min-w-0 flex-wrap items-baseline gap-x-4 gap-y-1">
        <p className="min-w-0 basis-full break-words text-sm font-medium leading-5 md:flex-1 md:basis-auto">{document.title}</p>
        <p className="text-sm leading-5 text-foreground/75">{projectDocumentCategoryLabel(document.category)}</p>
        <p className="text-sm leading-5 text-foreground/75">Version {current.versionNumber}{current.current ? " · Current" : ""}</p>
        <p className="text-sm leading-5 text-foreground/75">{projectDocumentVisibilityLabel(current.visibility)}</p>
        <p className="text-sm leading-5 text-foreground/75">{formatAttachmentSize(current.byteSize)}</p>
        {document.archived ? <p className="text-sm leading-5">Archived</p> : null}
      </div>
      <p className="mt-1 break-words text-sm leading-5">{current.displayFilename}</p>
      {current.uploadStatus === "ready" ? (
        <p className="mt-1 text-sm leading-5 text-foreground/75">Ready</p>
      ) : (
        <p className="mt-1 text-sm leading-5" role="alert">Upload failed</p>
      )}
      <div className="mt-2 flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap">
        <button type="button" className={`${CONTROL} w-full sm:w-auto`} onClick={() => onOpenFile(current)} disabled={current.uploadStatus !== "ready"}>
          {variationAttachmentKind(current.mimeType) === "image" ? "View" : "Download"}
        </button>
        <button type="button" className={`${CONTROL} w-full sm:w-auto`} onClick={onToggle} aria-expanded={open}>
          {open ? "Hide details" : "Details"}
        </button>
        <button type="button" className={`${CONTROL} w-full sm:w-auto`} onClick={onNewVersion} disabled={document.archived}>
          Upload new version
        </button>
      </div>
      {open ? (
        <div className="mt-3 grid min-w-0 gap-3 rounded-lg bg-muted/40 px-3 py-3">
          <form
            className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]"
            onSubmit={(event) => {
              event.preventDefault();
              void onRename(title);
            }}
          >
            <Input aria-label="Document title" value={title} onChange={(event) => setTitle(event.target.value)} className="min-h-11" />
            <Button type="submit" size="touch" variant="outline">Rename</Button>
          </form>
          <button type="button" className={`${CONTROL} w-full sm:w-auto`} onClick={() => void onArchive(!document.archived)}>
            {document.archived ? "Restore" : "Archive"}
          </button>
          <ul className="grid gap-2">
            {document.versions.map((version) => (
              <li key={version.id} className="min-w-0 text-sm leading-5">
                <p className="break-words">
                  Version {version.versionNumber}
                  {version.current ? " · Current" : ""}
                  {" · "}
                  {projectDocumentVisibilityLabel(version.visibility)}
                  {" · "}
                  {formatAttachmentSize(version.byteSize)}
                  {" · "}
                  {version.uploadStatus === "ready" ? "Ready" : "Upload failed"}
                </p>
                <p className="break-words text-foreground/75">
                  {version.displayFilename}
                  {version.versionNote ? ` · ${version.versionNote}` : ""}
                  {version.uploaderName ? ` · ${version.uploaderName}` : ""}
                  {" · "}
                  {formatWhen(version.createdAt)}
                </p>
                {version.uploadStatus === "ready" ? (
                  <button type="button" className={`${CONTROL} mt-2 w-full sm:w-auto`} onClick={() => onOpenFile(version)}>
                    {variationAttachmentKind(version.mimeType) === "image" ? "View" : "Download"}
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </li>
  );
}

function filterDocuments(
  documents: readonly ProjectDocumentView[],
  query: string,
  category: string,
  visibility: string
): ProjectDocumentView[] {
  const needle = query.trim().toLowerCase();
  return documents.filter((document) => {
    if (category !== "all" && document.category !== category) return false;
    if (visibility !== "all" && !document.versions.some((version) => version.visibility === visibility)) return false;
    if (!needle) return true;
    return document.title.toLowerCase().includes(needle) || document.versions.some((version) => version.displayFilename.toLowerCase().includes(needle));
  });
}

function draftMatches(draft: DraftCard, query: string, category: string, visibility: string): boolean {
  if (category !== "all" && draft.category !== category) return false;
  if (visibility !== "all" && draft.visibility !== visibility) return false;
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return draft.title.toLowerCase().includes(needle) || draft.displayFilename.toLowerCase().includes(needle);
}

function photoVersions(
  documents: readonly ProjectDocumentView[],
  query: string,
  category: string,
  visibility: string
) {
  if (category !== "all" && category !== "photos") return [];
  return filterDocuments(documents, query, "photos", visibility).flatMap((document) =>
    document.versions
      .filter((version) => version.uploadStatus === "ready" && (version.mimeType === "image/jpeg" || version.mimeType === "image/png"))
      .map((version) => ({ document, version }))
  );
}

function filterVariations(
  groups: ProjectDocumentCentreModel["variationGroups"],
  query: string,
  category: string,
  visibility: string
) {
  if (category !== "all") return [];
  const needle = query.trim().toLowerCase();
  return groups.flatMap((group) => {
    const attachments = group.attachments.filter((file) => {
      if (visibility === "shareable") return false;
      if (visibility === "internal" && file.visibility !== "internal") return false;
      if (!needle) return true;
      return (file.displayFilename || "").toLowerCase().includes(needle);
    });
    return attachments.length === 0 ? [] : [{ ...group, attachments }];
  });
}

function formatWhen(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Date unavailable";
  return new Intl.DateTimeFormat("en-NZ", { day: "numeric", month: "short", year: "numeric" }).format(date);
}
