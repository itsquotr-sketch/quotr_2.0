"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { ImageOff, Loader2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ProjectDocumentCentreModel } from "@/lib/projects/document-model";
import {
  failProjectDocumentUpload,
  finalizeProjectDocumentUpload,
  deleteProjectDocument,
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
  currentReadyVersion,
  mergeReadyVersion,
  presentProjectDocuments,
  projectDocumentCategoryGroups,
  removeProjectDocument,
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
  variant = "centre",
  canUpload = true,
}: {
  projectId: string;
  centre: ProjectDocumentCentreModel;
  /** Capture is a second view of the same documents. Management stays on Project information. */
  variant?: "centre" | "capture";
  canUpload?: boolean;
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
  const [archiveFilter, setArchiveFilter] = useState<"active" | "archived">("active");
  const [details, setDetails] = useState<ProjectDocumentView | null>(null);
  const [renameTarget, setRenameTarget] = useState<ProjectDocumentView | null>(null);
  const [renameTitle, setRenameTitle] = useState("");
  const [renameError, setRenameError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProjectDocumentView | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [narrow, setNarrow] = useState(false);
  const [fileAlert, setFileAlert] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ name: string; url: string } | null>(null);
  const focusReturn = useRef<HTMLElement | null>(null);
  const summary = summariseProjectDocuments(documents.filter((document) => !document.archived));
  const filtered = useMemo(
    () => filterDocuments(
      documents.filter((document) => document.archived === (archiveFilter === "archived")),
      query,
      categoryFilter,
      visibilityFilter
    ),
    [documents, query, categoryFilter, visibilityFilter, archiveFilter]
  );
  const presented = presentProjectDocuments(filtered);
  const groups = projectDocumentCategoryGroups(presented.listed);
  const photos = presented.gallery;
  const variationGroups = filterVariations(centre.variationGroups, query, categoryFilter, visibilityFilter);
  const filtering = query.trim() !== "" || categoryFilter !== "all" || visibilityFilter !== "all" || archiveFilter === "archived";

  useEffect(() => {
    const media = window.matchMedia("(max-width: 639px)");
    const apply = () => setNarrow(media.matches);
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);

  function rememberFocus() {
    focusReturn.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  }

  function restoreFocus() {
    focusReturn.current?.focus();
  }

  function openNewVersion(document: ProjectDocumentView) {
    rememberFocus();
    setVisibility("internal");
    setNote("");
    setFiles([]);
    setChooser({ documentId: document.id, category: document.category, title: document.title });
  }

  function openRename(document: ProjectDocumentView) {
    rememberFocus();
    setRenameError(null);
    setRenameTitle(document.title);
    setRenameTarget(document);
  }

  async function archiveDocument(document: ProjectDocumentView) {
    const saved = await setProjectDocumentArchive({ projectId, documentId: document.id, archived: !document.archived });
    if (!saved.ok) {
      setFileAlert(saved.error);
      return;
    }
    setDocuments((current) => setProjectDocumentArchived(current, document.id, saved.archived));
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError(null);
    const removed = await deleteProjectDocument({ projectId, documentId: deleteTarget.id });
    setDeleting(false);
    if (!removed.ok) {
      setDeleteError(removed.error);
      return;
    }
    setDocuments((current) => removeProjectDocument(current, deleteTarget.id));
    setDeleteTarget(null);
    restoreFocus();
  }
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

  if (variant === "capture") {
    const listed = documents.filter((document) => !document.archived);
    const names = listed.slice(0, 5);
    return (
      <section className="space-y-2" data-job-details-files="true">
        <div className="space-y-1">
          <h4 className="text-sm font-semibold text-foreground">Photos and files</h4>
          <p className="text-xs text-muted-foreground">
            Stored with the project for reference. Quotr does not read them
            during analysis.
          </p>
        </div>
        {centre.documentsUnavailable ? (
          <p className="text-sm text-destructive" role="alert">
            Files could not be loaded. The job description is unchanged.
          </p>
        ) : listed.length === 0 && drafts.length === 0 ? (
          <p className="text-sm text-muted-foreground">No files yet.</p>
        ) : (
          <ul className="space-y-1">
            {names.map((document) => {
              const current = currentReadyVersion(document);
              return (
                <li key={document.id} className="break-words text-sm leading-5">
                  {current?.displayFilename || document.title}
                </li>
              );
            })}
            {listed.length > names.length ? (
              <li className="text-sm text-muted-foreground">
                {listed.length - names.length} more in Project information
              </li>
            ) : null}
          </ul>
        )}
        {drafts.length > 0 ? (
          <ul>
            {drafts.map((draft) => (
              <DraftRow
                key={draft.localId}
                draft={draft}
                transfer={transfers[draft.localId] ?? { progress: null, error: null }}
                onRetry={() => void retryDraft(draft)}
                onRemove={() => void removeDraft(draft)}
              />
            ))}
          </ul>
        ) : null}
        {fileAlert ? (
          <p className="text-sm text-destructive" role="alert">{fileAlert}</p>
        ) : null}
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          {canUpload ? (
            <Button
              type="button"
              variant="outline"
              className="h-11 min-h-11 w-full sm:w-auto"
              onClick={() => {
                rememberFocus();
                setVisibility("internal");
                setNote("");
                setFiles([]);
                setChooser({ documentId: null, category: "photos", title: "" });
              }}
            >
              Add files
            </Button>
          ) : null}
          <Link
            href={`/app/projects/${projectId}/information#project-documents`}
            className="inline-flex h-11 min-h-11 items-center text-sm font-medium underline-offset-4 hover:underline"
          >
            Manage files in Project information
          </Link>
        </div>
        <ResponsivePanel
          open={chooser != null}
          narrow={narrow}
          title="Upload files"
          description="Each file becomes its own project document. JPG, PNG, PDF, DOCX or XLSX up to 15 MB."
          onOpenChange={(open) => {
            if (!open) {
              setChooser(null);
              restoreFocus();
            }
          }}
        >
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
                <Label htmlFor="job-details-document-files">Files</Label>
                <input
                  id="job-details-document-files"
                  type="file"
                  accept={ACCEPT}
                  multiple
                  className="min-h-11 w-full min-w-0 text-base md:text-sm"
                  onChange={(event) => setFiles(Array.from(event.target.files ?? []))}
                />
              </div>
              <div className="grid gap-1">
                <Label htmlFor="job-details-document-category">Category</Label>
                <select
                  id="job-details-document-category"
                  aria-label="File category"
                  value={chooser.category}
                  onChange={(event) => {
                    const value = event.target.value;
                    if (!isProjectDocumentCategory(value)) return;
                    setChooser({ ...chooser, category: value });
                  }}
                  className="min-h-11 w-full rounded-xl border border-border bg-background px-3 text-base md:text-sm"
                >
                  {PROJECT_DOCUMENT_CATEGORIES.map((category) => (
                    <option key={category} value={category}>{projectDocumentCategoryLabel(category)}</option>
                  ))}
                </select>
              </div>
              <fieldset className="grid gap-2">
                <legend className="text-sm font-medium">Visibility</legend>
                <label className="flex min-h-11 items-center gap-2 text-sm">
                  <input type="radio" name="job-details-document-visibility" checked={visibility === "internal"} onChange={() => setVisibility("internal")} />
                  Internal
                </label>
                <label className="flex min-h-11 items-center gap-2 text-sm">
                  <input type="radio" name="job-details-document-visibility" checked={visibility === "shareable"} onChange={() => setVisibility("shareable")} />
                  Shareable
                </label>
              </fieldset>
              <Button type="submit" className="h-11 min-h-11" disabled={files.length === 0}>Start upload</Button>
            </form>
          ) : null}
        </ResponsivePanel>
      </section>
    );
  }

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
            rememberFocus();
            setVisibility("internal");
            setNote("");
            setFiles([]);
            setChooser({ documentId: null, category: "plans_and_drawings", title: "" });
          }}
        >
          Upload files
        </Button>
        <p className="text-xs leading-4 text-foreground/75 sm:self-center">JPG, PNG, PDF, DOCX or XLSX. 15 MB each.</p>
      </div>
      <div className="mt-3 grid min-w-0 gap-2 sm:grid-cols-2 lg:grid-cols-4">
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
          className="min-h-11 w-full min-w-0 rounded-xl border border-border bg-background px-3 text-base sm:text-sm"
        >
          <option value="all">All visibility</option>
          <option value="internal">Internal</option>
          <option value="shareable">Shareable</option>
        </select>
        <select
          aria-label="Archived files"
          data-project-document-archive-filter
          value={archiveFilter}
          onChange={(event) => setArchiveFilter(event.target.value === "archived" ? "archived" : "active")}
          className="min-h-11 w-full min-w-0 rounded-xl border border-border bg-background px-3 text-base sm:text-sm"
        >
          <option value="active">Active files</option>
          <option value="archived">Archived</option>
        </select>
      </div>

      {centre.documentsUnavailable ? (
        <p className="mt-3 text-sm leading-5" role="alert">File unavailable</p>
      ) : null}
      {fileAlert ? (
        <p className="mt-3 text-sm leading-5" role="alert">{fileAlert}</p>
      ) : null}

      {photos.length > 0 || categoryFilter === "all" || categoryFilter === "photos" ? (
        <div className="mt-4 min-w-0" data-project-photo-gallery="true">
          <h4 className="text-base font-semibold leading-snug">Photos</h4>
          {photos.length > 0 ? (
            <ul className="mt-2 grid grid-cols-1 gap-2 min-[420px]:grid-cols-2 lg:grid-cols-3">
              {photos.map((document) => {
                const version = currentReadyVersion(document);
                if (!version) return null;
                return (
                  <li key={document.id} className="min-w-0" data-project-document-row={document.id} data-project-photo-card="true">
                    <PhotoCard
                      projectId={projectId}
                      document={document}
                      version={version}
                      onView={() => void openFile(version.id, version.displayFilename, version.mimeType)}
                      onDetails={() => { rememberFocus(); setDetails(document); }}
                      menu={
                        <DocumentActions
                          document={document}
                          onView={() => void openFile(version.id, version.displayFilename, version.mimeType)}
                          onDetails={() => { rememberFocus(); setDetails(document); }}
                          onNewVersion={() => openNewVersion(document)}
                          onRename={() => openRename(document)}
                          onArchive={() => void archiveDocument(document)}
                          onDelete={() => { rememberFocus(); setDeleteError(null); setDeleteTarget(document); }}
                        />
                      }
                    />
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="mt-2 text-sm leading-5 text-foreground/75">No photos yet</p>
          )}
        </div>
      ) : null}

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
          <section key={group.category} className="min-w-0" data-project-document-list="true">
            <h4 className="text-base font-semibold leading-snug">{group.label}</h4>
            <ul className="mt-2 grid gap-2">
              {group.documents.map((document) => {
                const version = currentReadyVersion(document) ?? document.versions[0];
                if (!version) return null;
                return (
                  <FileCard
                    key={document.id}
                    document={document}
                    version={version}
                    onView={() => void openFile(version.id, version.displayFilename, version.mimeType)}
                    actions={
                      <DocumentActions
                        document={document}
                        onView={() => void openFile(version.id, version.displayFilename, version.mimeType)}
                        onDetails={() => { rememberFocus(); setDetails(document); }}
                        onNewVersion={() => openNewVersion(document)}
                        onRename={() => openRename(document)}
                        onArchive={() => void archiveDocument(document)}
                        onDelete={() => { rememberFocus(); setDeleteError(null); setDeleteTarget(document); }}
                      />
                    }
                  />
                );
              })}
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

      <ResponsivePanel
        open={chooser != null}
        narrow={narrow}
        title={chooser?.documentId ? "Upload new version" : "Upload files"}
        description={chooser?.documentId ? "Adds a new version. Earlier versions stay available." : "Each file becomes its own project document. JPG, PNG, PDF, DOCX or XLSX up to 15 MB."}
        onOpenChange={(open) => {
          if (!open) {
            setChooser(null);
            restoreFocus();
          }
        }}
      >
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
                <p className="text-sm leading-5 text-foreground/75">Internal stays in your organisation. Shareable can be included in a later deliberate share, and does not create a public link.</p>
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
      </ResponsivePanel>

      <ResponsivePanel
        open={details != null}
        narrow={narrow}
        title={details?.title ?? "Document details"}
        description="Version history for this project file."
        onOpenChange={(open) => {
          if (!open) {
            setDetails(null);
            restoreFocus();
          }
        }}
      >
        {details ? <VersionHistory document={details} onOpenFile={(version) => void openFile(version.id, version.displayFilename, version.mimeType)} /> : null}
      </ResponsivePanel>

      <ResponsivePanel
        open={renameTarget != null}
        narrow={narrow}
        title="Rename document"
        description="The title changes. Earlier filenames stay on their versions."
        onOpenChange={(open) => {
          if (!open) {
            setRenameTarget(null);
            restoreFocus();
          }
        }}
      >
        <form
          className="grid gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (!renameTarget) return;
            void renameProjectDocumentTitle({ projectId, documentId: renameTarget.id, title: renameTitle }).then((renamed) => {
              if (!renamed.ok) {
                setRenameError(renamed.error);
                return;
              }
              setDocuments((current) => renameProjectDocument(current, renameTarget.id, renamed.title));
              setRenameTarget(null);
              restoreFocus();
            });
          }}
        >
          <Label htmlFor="project-document-rename">Title</Label>
          <Input id="project-document-rename" value={renameTitle} onChange={(event) => setRenameTitle(event.target.value)} className="min-h-11 text-base sm:text-sm" />
          {renameError ? <p className="text-sm leading-5" role="alert">{renameError}</p> : null}
          <Button type="submit" size="touch">Save title</Button>
        </form>
      </ResponsivePanel>

      <AlertDialog
        open={deleteTarget != null}
        onOpenChange={(open) => {
          if (!open && !deleting) {
            setDeleteTarget(null);
            setDeleteError(null);
            restoreFocus();
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this document permanently?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget
                ? `${deleteTarget.title} and its ${deleteTarget.versions.length} ${deleteTarget.versions.length === 1 ? "version" : "versions"} will be removed.`
                : "This document will be removed."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteError ? <p className="text-sm leading-5" role="alert">{deleteError}</p> : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" size="touch" disabled={deleting} onClick={() => void confirmDelete()}>
              {deleting ? "Deleting…" : "Delete permanently"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={preview != null} onOpenChange={(open) => { if (!open) { setPreview(null); restoreFocus(); } }}>
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

function DocumentActions({
  document,
  onView,
  onDetails,
  onNewVersion,
  onRename,
  onArchive,
  onDelete,
}: {
  document: ProjectDocumentView;
  onView: () => void;
  onDetails: () => void;
  onNewVersion: () => void;
  onRename: () => void;
  onArchive: () => void;
  onDelete: () => void;
}) {
  const current = currentReadyVersion(document) ?? document.versions[0];
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="inline-flex min-h-11 items-center rounded-md border border-border bg-background px-3 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-orange)]" data-project-document-actions="true">
        Actions
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem className="min-h-11" disabled={!current || current.uploadStatus !== "ready"} onClick={onView}>
          {current && variationAttachmentKind(current.mimeType) === "image" ? "View" : "Download"}
        </DropdownMenuItem>
        <DropdownMenuItem className="min-h-11" onClick={onDetails}>Details and version history</DropdownMenuItem>
        <DropdownMenuItem className="min-h-11" disabled={document.archived} onClick={onNewVersion}>Upload new version</DropdownMenuItem>
        <DropdownMenuItem className="min-h-11" onClick={onRename}>Rename</DropdownMenuItem>
        <DropdownMenuItem className="min-h-11" onClick={onArchive}>{document.archived ? "Restore" : "Archive"}</DropdownMenuItem>
        <DropdownMenuItem className="min-h-11" variant="destructive" onClick={onDelete}>Delete permanently</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function FileCard({
  document,
  version,
  onView,
  actions,
}: {
  document: ProjectDocumentView;
  version: ProjectDocumentVersionView;
  onView: () => void;
  actions: ReactNode;
}) {
  return (
    <li className="min-w-0 rounded-lg border border-border/70 bg-card px-3 py-2" data-project-document-row={document.id}>
      <div className="flex min-w-0 items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="break-words text-sm font-medium leading-5">{document.title}</p>
          <p className="mt-0.5 break-words text-xs leading-4 text-foreground/75">
            {projectDocumentCategoryLabel(document.category)}
            {" · "}
            Version {version.versionNumber}
            {" · "}
            {projectDocumentVisibilityLabel(version.visibility)}
            {" · "}
            {variationAttachmentTypeLabel(version.mimeType)}
            {" · "}
            {formatAttachmentSize(version.byteSize)}
          </p>
          <p className="mt-0.5 text-xs leading-4 text-foreground/75">{version.uploadStatus === "ready" ? "Ready" : "Upload failed"}</p>
        </div>
        {actions}
      </div>
      <Button type="button" variant="outline" size="touch" className="mt-2" onClick={onView} disabled={version.uploadStatus !== "ready"}>
        {variationAttachmentKind(version.mimeType) === "image" ? "View" : "Download"}
      </Button>
    </li>
  );
}

function PhotoCard({
  projectId,
  document,
  version,
  onView,
  onDetails,
  menu,
}: {
  projectId: string;
  document: ProjectDocumentView;
  version: ProjectDocumentVersionView;
  onView: () => void;
  onDetails: () => void;
  menu: ReactNode;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let cancelled = false;
    void signProjectDocumentVersion({ projectId, versionId: version.id }).then((signed) => {
      if (cancelled) return;
      if (!signed.ok || !signed.url) setFailed(true);
      else setUrl(signed.url);
    });
    return () => {
      cancelled = true;
    };
  }, [projectId, version.id]);
  return (
    <div className="min-w-0 rounded-lg border border-border/70 bg-card p-2">
      <button type="button" className="block w-full overflow-hidden rounded-md bg-muted/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-orange)]" onClick={onView}>
        {url && !failed ? (
          // The URL is a short-lived private signed link and must not be proxied.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="" className="aspect-[4/3] w-full object-cover" onError={() => setFailed(true)} />
        ) : (
          <span className="flex aspect-[4/3] w-full items-center justify-center text-foreground/60">
            <ImageOff className="size-5" aria-hidden="true" />
            <span className="sr-only">Photo unavailable</span>
          </span>
        )}
      </button>
      <div className="mt-2 flex min-w-0 items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="break-words text-sm font-medium leading-5">{document.title}</p>
          <p className="text-xs leading-4 text-foreground/75">Version {version.versionNumber}</p>
        </div>
        {menu}
      </div>
      <div className="mt-2 flex gap-2">
        <Button type="button" variant="outline" size="touch" onClick={onView}>View</Button>
        <Button type="button" variant="ghost" size="touch" onClick={onDetails}>Details</Button>
      </div>
    </div>
  );
}

function VersionHistory({
  document,
  onOpenFile,
}: {
  document: ProjectDocumentView;
  onOpenFile: (version: ProjectDocumentVersionView) => void;
}) {
  return (
    <ul className="grid gap-3">
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
          <p className="break-words text-xs leading-4 text-foreground/75">
            {version.displayFilename}
            {version.versionNote ? ` · ${version.versionNote}` : ""}
            {version.uploaderName ? ` · ${version.uploaderName}` : ""}
            {" · "}
            {formatWhen(version.createdAt)}
          </p>
          {version.uploadStatus === "ready" ? (
            <Button type="button" variant="outline" size="touch" className="mt-2" onClick={() => onOpenFile(version)}>
              {variationAttachmentKind(version.mimeType) === "image" ? "View" : "Download"}
            </Button>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function ResponsivePanel({
  open,
  narrow,
  title,
  description,
  onOpenChange,
  children,
}: {
  open: boolean;
  narrow: boolean;
  title: string;
  description: string;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
}) {
  if (narrow) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-xl">
          <SheetHeader>
            <SheetTitle>{title}</SheetTitle>
            <SheetDescription>{description}</SheetDescription>
          </SheetHeader>
          <div className="px-4 pb-4">{children}</div>
        </SheetContent>
      </Sheet>
    );
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
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
