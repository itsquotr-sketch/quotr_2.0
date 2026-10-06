import { NextResponse } from "next/server";
import { loadAnalyticsPage } from "@/lib/analytics/load-analytics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Parallel period reads. Two browser requests can run at once; a server
 * action queue would make the Business read wait for the headline read.
 * The organisation comes from the signed-in session inside the loader.
 */
export async function POST(request: Request) {
  const raw = await request.text();
  if (raw.length > 2048) {
    return NextResponse.json(
      { kind: "invalid_range", error: "Check the dates and try again.", timeZone: "Pacific/Auckland" },
      { status: 400 }
    );
  }
  let body: Record<string, unknown>;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("bad");
    }
    body = parsed as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { kind: "invalid_range", error: "Check the dates and try again.", timeZone: "Pacific/Auckland" },
      { status: 400 }
    );
  }

  const period = typeof body.period === "string" ? body.period : "";
  const from = typeof body.from === "string" ? body.from : undefined;
  const to = typeof body.to === "string" ? body.to : undefined;
  const scope = body.scope === "headline" || body.scope === "business" ? body.scope : null;
  if (!scope || period.length === 0 || period.length > 32) {
    return NextResponse.json(
      { kind: "invalid_range", error: "Check the dates and try again.", timeZone: "Pacific/Auckland" },
      { status: 400 }
    );
  }

  const loaded = await loadAnalyticsPage(period, { from, to, scope });
  const status = loaded.kind === "unauthenticated" ? 401 : loaded.kind === "denied" ? 403 : 200;
  return NextResponse.json(loaded, { status });
}
