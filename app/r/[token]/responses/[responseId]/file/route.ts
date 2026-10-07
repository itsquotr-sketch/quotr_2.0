import { createAdminClient } from "@/lib/supabase/admin";
import { hashRfqAccessToken, isRfqAccessTokenFormat } from "@/lib/rfqs/token";

export const runtime = "nodejs";

type RouteProps = { params: Promise<{ token: string; responseId: string }> };

export async function GET(_request: Request, { params }: RouteProps): Promise<Response> {
  const { token, responseId } = await params;
  if (!isRfqAccessTokenFormat(token) || !/^[0-9a-f-]{36}$/i.test(responseId)) {
    return new Response("This request is unavailable.", { status: 404 });
  }
  const admin = createAdminClient();
  const resolved = await admin.rpc("resolve_rfq_response_file_v1", {
    p_token_hash: hashRfqAccessToken(token),
    p_response: responseId,
  });
  const body = (resolved.data ?? {}) as { ok?: boolean; path?: string; filename?: string };
  if (resolved.error || body.ok !== true || !body.path || body.path.includes("..")) {
    return new Response("This request is unavailable.", { status: 404 });
  }
  const downloaded = await admin.storage.from("rfq-response-files").download(body.path);
  if (downloaded.error || !downloaded.data) {
    return new Response("This request is unavailable.", { status: 404 });
  }
  const filename = (body.filename || "quotation.pdf").replace(/[^A-Za-z0-9._() -]+/g, "_").slice(0, 120);
  return new Response(downloaded.data, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename || "quotation.pdf"}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "X-Robots-Tag": "noindex",
      "Referrer-Policy": "no-referrer",
    },
  });
}
