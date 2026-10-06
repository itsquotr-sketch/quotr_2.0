import { createAdminClient } from "@/lib/supabase/admin";
import { PROJECT_DOCUMENT_BUCKET } from "@/lib/projects/document-files";
import { hashRfqAccessToken, isRfqAccessTokenFormat } from "@/lib/rfqs/token";

export const runtime = "nodejs";

type RouteProps = { params: Promise<{ token: string; fileId: string }> };

function asciiFilename(value: string): string {
  const cleaned = value.replace(/[^A-Za-z0-9._() -]+/g, "_").slice(0, 120);
  return cleaned || "file";
}

export async function GET(_request: Request, { params }: RouteProps): Promise<Response> {
  const { token, fileId } = await params;
  if (!isRfqAccessTokenFormat(token) || !/^[0-9a-f-]{36}$/i.test(fileId)) {
    return new Response("This request is unavailable.", { status: 404 });
  }
  const admin = createAdminClient();
  const resolved = await admin.rpc("resolve_rfq_shared_file_v1", {
    p_token_hash: hashRfqAccessToken(token),
    p_file: fileId,
  });
  const body = (resolved.data ?? {}) as {
    ok?: boolean;
    path?: string;
    filename?: string;
    mimeType?: string;
  };
  if (
    resolved.error ||
    body.ok !== true ||
    !body.path ||
    body.path.includes("..") ||
    !body.mimeType ||
    !body.filename
  ) {
    return new Response("This request is unavailable.", { status: 404 });
  }
  const downloaded = await admin.storage.from(PROJECT_DOCUMENT_BUCKET).download(body.path);
  if (downloaded.error || !downloaded.data) {
    return new Response("This file is no longer available.", { status: 404 });
  }
  const filename = asciiFilename(body.filename);
  const inline = body.mimeType === "application/pdf" || body.mimeType.startsWith("image/");
  return new Response(downloaded.data, {
    headers: {
      "Content-Type": body.mimeType,
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${filename}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "X-Robots-Tag": "noindex",
    },
  });
}
