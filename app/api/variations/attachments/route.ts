import { NextResponse } from "next/server";
import {
  failVariationAttachmentUpload,
  finalizeVariationAttachment,
  prepareVariationAttachmentUpload,
  removeVariationAttachment,
  reorderVariationAttachments,
  signVariationAttachment,
  updateVariationAttachment,
} from "@/lib/variations/attachment-actions";
import type { VariationAttachmentVisibility } from "@/lib/variations/attachment-files";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const INVALID = { ok: false, error: "Check the file details and try again." };

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function visibility(value: unknown): VariationAttachmentVisibility | null {
  return value === "client" || value === "internal" ? value : null;
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
  const variationId = text(body.variationId);
  const attachmentId = text(body.attachmentId);

  if (body.op === "prepare") {
    const kind = visibility(body.visibility);
    if (!kind) return NextResponse.json(INVALID, { status: 400 });
    return NextResponse.json(await prepareVariationAttachmentUpload({
      projectId,
      variationId,
      revisionId: text(body.revisionId),
      visibility: kind,
      originalFilename: text(body.originalFilename),
      byteSize: typeof body.byteSize === "number" ? body.byteSize : Number.NaN,
      headerBase64: text(body.headerBase64),
      retryAttachmentId: body.retryAttachmentId == null ? null : text(body.retryAttachmentId),
    }));
  }
  if (body.op === "finalize") {
    return NextResponse.json(await finalizeVariationAttachment({ projectId, variationId, attachmentId }));
  }
  if (body.op === "fail") {
    return NextResponse.json(await failVariationAttachmentUpload({ projectId, variationId, attachmentId }));
  }
  if (body.op === "remove") {
    return NextResponse.json(await removeVariationAttachment({ projectId, variationId, attachmentId }));
  }
  if (body.op === "sign") {
    return NextResponse.json(await signVariationAttachment({ projectId, variationId, attachmentId }));
  }
  if (body.op === "update") {
    return NextResponse.json(await updateVariationAttachment({
      projectId,
      variationId,
      attachmentId,
      displayFilename: text(body.displayFilename),
      caption: text(body.caption),
      internalDescription: text(body.internalDescription),
      linkedVariationItemId: body.linkedVariationItemId == null || body.linkedVariationItemId === "" ? null : text(body.linkedVariationItemId),
    }));
  }
  if (body.op === "reorder") {
    const kind = visibility(body.visibility);
    const ids = Array.isArray(body.ids) ? body.ids.filter((id): id is string => typeof id === "string") : [];
    if (!kind) return NextResponse.json(INVALID, { status: 400 });
    return NextResponse.json(await reorderVariationAttachments({
      projectId,
      variationId,
      revisionId: text(body.revisionId),
      visibility: kind,
      ids,
    }));
  }
  return NextResponse.json(INVALID, { status: 400 });
}
