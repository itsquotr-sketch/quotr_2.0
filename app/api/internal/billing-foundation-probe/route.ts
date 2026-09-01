import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { resolveBillingEnvironment } from "@/lib/billing/environment";
import {
  probeHostedStripeConfig,
  probeLivemodeRejected,
  probeReplaySignedEvent,
  probeSignedCheckoutSession,
  probeSubscriptionMirror,
} from "@/lib/billing/foundation-probe";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const FIXTURE_ORG_ID = "a59f0f43-e3d1-4f23-a391-b8317ed9b521";

function previewTestOnly(): Response | null {
  if (process.env.VERCEL_ENV !== "preview") {
    return NextResponse.json({ ok: false }, { status: 404 });
  }
  try {
    if (resolveBillingEnvironment() !== "test") {
      return NextResponse.json({ ok: false }, { status: 404 });
    }
  } catch {
    return NextResponse.json({ ok: false }, { status: 404 });
  }
  return null;
}

async function requirePreviewMember(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (bearer) {
    const supabase = createClient(url, anon, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const {
      data: { user },
    } = await supabase.auth.getUser(bearer);
    return user;
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Route handler cookie writes can be ignored when middleware refreshes.
        }
      },
    },
  });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export async function POST(request: Request) {
  const blocked = previewTestOnly();
  if (blocked) return blocked;

  const user = await requirePreviewMember(request);
  if (!user) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  try {
    const admin = createAdminClient();
    const { data: profile } = await admin
      .from("profiles")
      .select("org_id")
      .eq("id", user.id)
      .maybeSingle();
    if (profile?.org_id !== FIXTURE_ORG_ID) {
      return NextResponse.json({ ok: false }, { status: 403 });
    }
  } catch {
    return NextResponse.json({ ok: false }, { status: 403 });
  }

  let body: { action?: string; stripe_event_id?: string } = {};
  try {
    body = (await request.json()) as {
      action?: string;
      stripe_event_id?: string;
    };
  } catch {
    body = {};
  }

  const action = body.action ?? "config";

  if (action === "config") {
    return NextResponse.json({
      ok: true,
      result: await probeHostedStripeConfig(),
    });
  }
  if (action === "signed_checkout") {
    const result = await probeSignedCheckoutSession();
    return NextResponse.json({ ok: result.ok, result });
  }
  if (action === "replay") {
    const eventId = body.stripe_event_id?.trim() ?? "";
    const result = await probeReplaySignedEvent(eventId);
    return NextResponse.json({ ok: result.ok, result });
  }
  if (action === "livemode") {
    const result = await probeLivemodeRejected();
    return NextResponse.json({ ok: result.ok, result });
  }
  if (action === "mirror") {
    const result = await probeSubscriptionMirror();
    return NextResponse.json({ ok: Boolean(result.ok), result });
  }

  return NextResponse.json({ ok: false }, { status: 400 });
}
