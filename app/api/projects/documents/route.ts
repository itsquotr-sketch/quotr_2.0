import { NextResponse } from "next/server";
import {
  failProjectDocumentUpload,
  finalizeProjectDocumentUpload,
  prepareProjectDocumentUpload,
  removeProjectDocumentUpload,
  deleteProjectDocument,
  renameProjectDocumentTitle,
  setProjectDocumentArchive,
  signProjectDocumentVersion,
} from "@/lib/projects/document-actions";
import {
  isProjectDocumentCategory,
  isProjectDocumentVisibility,
} from "@/lib/projects/document-files";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const INVALID = { ok: false, error: "Check the file details and try again." };

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export async function POST(request: Request) {
  const raw = await request.text();
  if (raw.length > 16_384) return NextResponse.json(INVALID, { status: 400 });
  let body: Record<string, unknown>;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return NextResponse.json(INVALID, { status: 400 });
    body = parsed as Record<string, unknown>;
  } catch {
    return NextResponse.json(INVALID, { status: 400 });
  }

  const projectId = text(body.projectId);
  const versionId = text(body.versionId);
  const documentId = text(body.documentId);

  if (body.op === "prepare") {
    const category = text(body.category);
    const visibility = text(body.visibility);
    if (!isProjectDocumentCategory(category) || !isProjectDocumentVisibility(visibility)) {
      return NextResponse.json(INVALID, { status: 400 });
    }
    return NextResponse.json(await prepareProjectDocumentUpload({
      projectId,
      documentId: documentId || null,
      category,
      title: text(body.title),
      visibility,
      originalFilename: text(body.originalFilename),
      byteSize: typeof body.byteSize === "number" ? body.byteSize : Number.NaN,
      headerBase64: text(body.headerBase64),
      versionNote: text(body.versionNote),
      retryVersionId: body.retryVersionId == null ? null : text(body.retryVersionId),
    }));
  }
  if (body.op === "finalize") {
    return NextResponse.json(await finalizeProjectDocumentUpload({ projectId, versionId }));
  }
  if (body.op === "fail") {
    return NextResponse.json(await failProjectDocumentUpload({ projectId, versionId }));
  }
  if (body.op === "remove") {
    return NextResponse.json(await removeProjectDocumentUpload({ projectId, versionId }));
  }
  if (body.op === "sign") {
    return NextResponse.json(await signProjectDocumentVersion({ projectId, versionId }));
  }
  if (body.op === "rename") {
    return NextResponse.json(await renameProjectDocumentTitle({ projectId, documentId, title: text(body.title) }));
  }
  if (body.op === "delete") {
    return NextResponse.json(await deleteProjectDocument({ projectId, documentId }));
  }
  if (body.op === "archive") {
    return NextResponse.json(await setProjectDocumentArchive({
      projectId,
      documentId,
      archived: body.archived === true,
    }));
  }
  return NextResponse.json(INVALID, { status: 400 });
}
