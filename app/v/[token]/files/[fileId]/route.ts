import { createAdminClient } from "@/lib/supabase/admin";
import { VARIATION_ATTACHMENT_BUCKET } from "@/lib/variations/attachment-files";
import {
  hashVariationAccessToken,
  isVariationAccessTokenFormat,
} from "@/lib/variations/delivery-token";

export const runtime = "nodejs";

type RouteProps = { params: Promise<{ token: string; fileId: string }> };

function asciiFilename(value: string): string {
  const cleaned = value.replace(/[^A-Za-z0-9._() -]+/g, "_").slice(0, 120);
  return cleaned || "file";
}

export async function GET(request: Request, { params }: RouteProps): Promise<Response> {
  const { token, fileId } = await params;
  if (!isVariationAccessTokenFormat(token) || !/^[0-9a-f-]{36}$/i.test(fileId)) {
    return new Response("This Variation is unavailable.", { status: 404 });
  }
  const admin = createAdminClient();
  const resolved = await admin.rpc("resolve_variation_client_attachment_v1", {
    p_token_hash: hashVariationAccessToken(token),
    p_file_id: fileId,
  });
  const body = (resolved.data ?? {}) as {
    ok?: boolean;
    error?: string;
    storageBucket?: string;
    storageObjectPath?: string;
    mimeType?: string;
    displayFilename?: string;
  };
  if (
    resolved.error ||
    body.ok !== true ||
    body.storageBucket !== VARIATION_ATTACHMENT_BUCKET ||
    !body.storageObjectPath ||
    !body.mimeType ||
    !body.displayFilename
  ) {
    const withdrawn = body.error === "WITHDRAWN";
    return new Response(
      withdrawn ? "This Variation has been withdrawn." : "This Variation is unavailable.",
      { status: withdrawn ? 410 : 404 }
    );
  }
  const downloaded = await admin.storage.from(VARIATION_ATTACHMENT_BUCKET).download(body.storageObjectPath);
  if (downloaded.error || !downloaded.data) {
    return new Response("This Variation is unavailable.", { status: 404 });
  }
  const download = new URL(request.url).searchParams.get("download") === "1";
  const inline = !download && (body.mimeType === "application/pdf" || body.mimeType.startsWith("image/"));
  const filename = asciiFilename(body.displayFilename);
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
