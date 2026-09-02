import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createAuthCorrelationId, logAuthEvent } from "@/lib/auth/logging";
import {
  classifyAuthProviderError,
  type AuthErrorCategory,
} from "@/lib/auth/errors";
import { getSafeInternalPath } from "@/lib/auth/safe-redirect";
import "@/lib/env";

/**
 * Supabase Auth PKCE callback (signup confirmation + password recovery).
 *
 * Exchange the `code` server-side, set session cookies, then route:
 * - recovery next=/reset-password → reset page (session required)
 * - provisioned profile/org → safe next (default dashboard)
 * - authenticated but missing profile/org → /app/setup-required
 *
 * Never logs auth codes or tokens.
 */
export async function GET(request: NextRequest) {
  const correlationId = createAuthCorrelationId();
  const startedAt = Date.now();
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = getSafeInternalPath(searchParams.get("next"));

  logAuthEvent({
    event: "confirmation_callback_started",
    correlationId,
  });

  if (!code) {
    logAuthEvent({
      event: "confirmation_callback_failed",
      category: "CONFIRMATION_LINK_INVALID",
      correlationId,
      elapsedMs: Date.now() - startedAt,
    });
    return redirectAuthError(origin, next, "CONFIRMATION_LINK_INVALID");
  }

  let redirectResponse = NextResponse.redirect(new URL(next, origin));

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
          redirectResponse = NextResponse.redirect(new URL(next, origin));
          cookiesToSet.forEach(({ name, value, options }) => {
            redirectResponse.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    const category = classifyAuthProviderError(error.message, "callback");
    logAuthEvent({
      event: "confirmation_callback_failed",
      category,
      correlationId,
      elapsedMs: Date.now() - startedAt,
    });
    return redirectAuthError(origin, next, category);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    logAuthEvent({
      event: "confirmation_callback_failed",
      category: "CONFIRMATION_LINK_INVALID",
      correlationId,
      elapsedMs: Date.now() - startedAt,
    });
    return redirectAuthError(origin, next, "CONFIRMATION_LINK_INVALID");
  }

  // Password recovery: keep session and land on reset page.
  let destination = next;
  if (next.startsWith("/reset-password")) {
    destination = "/reset-password";
  } else if (next.startsWith("/invite/")) {
    destination = next;
  } else {
    const { data: profile } = await supabase
      .from("profiles")
      .select("org_id")
      .eq("id", user.id)
      .maybeSingle();

    if (!profile?.org_id) {
      destination = "/invite/continue";
    } else {
      const { data: organisation } = await supabase
        .from("organisations")
        .select("id")
        .eq("id", profile.org_id)
        .maybeSingle();
      if (!organisation) {
        destination = "/app/setup-required";
      }
    }
  }

  // Rebuild redirect to final destination while preserving session cookies.
  const finalResponse = NextResponse.redirect(new URL(destination, origin));
  redirectResponse.cookies.getAll().forEach((cookie) => {
    finalResponse.cookies.set(cookie);
  });

  logAuthEvent({
    event: "confirmation_callback_completed",
    correlationId,
    userId: user.id,
    elapsedMs: Date.now() - startedAt,
  });

  return finalResponse;
}

function redirectAuthError(
  origin: string,
  next: string,
  category: AuthErrorCategory
) {
  if (next.startsWith("/reset-password") || category === "RESET_LINK_INVALID") {
    const url = new URL("/reset-password", origin);
    url.searchParams.set("error", "invalid");
    return NextResponse.redirect(url);
  }

  const url = new URL("/login", origin);
  url.searchParams.set("error", "confirmation_invalid");
  return NextResponse.redirect(url);
}
