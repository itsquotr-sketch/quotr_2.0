import { NextResponse } from "next/server";
import { loadAnalyticsPage } from "@/lib/analytics/load-analytics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * One period read. `stream` flushes headline measures before the panel
 * queries in the same request finish, so authentication runs once.
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
  const scope =
    body.scope === "headline" || body.scope === "business" || body.scope === "full" || body.scope === "stream"
      ? body.scope
      : null;
  if (!scope || period.length === 0 || period.length > 32) {
    return NextResponse.json(
      { kind: "invalid_range", error: "Check the dates and try again.", timeZone: "Pacific/Auckland" },
      { status: 400 }
    );
  }

  if (scope === "stream") {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const send = (payload: unknown) => {
          controller.enqueue(encoder.encode(`${JSON.stringify(payload)}\n`));
        };
        try {
          const loaded = await loadAnalyticsPage(period, {
            from,
            to,
            onHeadline: send,
          });
          send(loaded);
        } catch {
          send({
            kind: "denied",
            message: "Analytics could not be loaded.",
            reasonCode: null,
            upgradeTarget: null,
          });
        } finally {
          controller.close();
        }
      },
    });
    return new Response(stream, {
      headers: {
        "content-type": "application/x-ndjson; charset=utf-8",
        "cache-control": "no-cache, no-transform",
        "x-accel-buffering": "no",
      },
    });
  }

  const loaded = await loadAnalyticsPage(period, {
    from,
    to,
    scope: scope === "full" ? "full" : scope,
  });
  const status = loaded.kind === "unauthenticated" ? 401 : loaded.kind === "denied" ? 403 : 200;
  return NextResponse.json(loaded, { status });
}
