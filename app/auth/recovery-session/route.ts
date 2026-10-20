import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { logAuthEvent } from "@/lib/auth/logging";
import "@/lib/env";

const MAX_TOKEN_LENGTH = 8192;

function sameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  const host = (request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "")
    .split(",")[0]
    ?.trim();
  if (!host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

function tokenValue(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed.length < 20 || trimmed.length > MAX_TOKEN_LENGTH) return null;
  if (/[\s#?&]/.test(trimmed)) return null;
  return trimmed;
}

/**
 * Stores a recovery session from tokens the browser read out of the URL
 * fragment. The response never echoes those tokens.
 */
export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) {
    return NextResponse.json({ ok: false }, { status: 403 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const record = payload && typeof payload === "object" ? payload as Record<string, unknown> : {};
  const accessToken = tokenValue(record.access_token);
  const refreshToken = tokenValue(record.refresh_token);
  if (!accessToken || !refreshToken) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  let response = NextResponse.json({ ok: true });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });
          response = NextResponse.json({ ok: true });
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const { error } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });
  if (error) {
    logAuthEvent({
      event: "confirmation_callback_failed",
      category: "RESET_LINK_INVALID",
    });
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  logAuthEvent({
    event: "confirmation_callback_completed",
    userId: user?.id,
  });
  return response;
}
