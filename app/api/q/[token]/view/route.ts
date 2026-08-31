import { NextResponse } from "next/server";
import { isLikelyNonHumanUserAgent } from "@/lib/quotes/delivery-bots";
import { isQuoteAccessTokenFormat } from "@/lib/quotes/delivery-token";
import { markPublicQuoteViewedByToken } from "@/lib/quotes/public-lookup";

export async function POST(
  request: Request,
  context: { params: Promise<{ token: string }> }
) {
  const { token } = await context.params;
  if (!isQuoteAccessTokenFormat(token)) {
    return NextResponse.json({ ok: false }, { status: 404 });
  }
  if (isLikelyNonHumanUserAgent(request.headers.get("user-agent"))) {
    return NextResponse.json({ ok: true, skipped: "bot" });
  }
  const result = await markPublicQuoteViewedByToken(token);
  if (!result.ok) {
    return NextResponse.json({ ok: false }, { status: 404 });
  }
  return NextResponse.json({
    ok: true,
    idempotent: result.idempotent === true,
  });
}
