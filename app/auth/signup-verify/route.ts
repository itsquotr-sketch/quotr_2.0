import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { confirmationHelpPath } from "@/lib/auth/confirmation-link";
import { destinationAfterEmailConfirmation } from "@/lib/auth/finish-email-confirmation";
import { createAuthCorrelationId, logAuthEvent } from "@/lib/auth/logging";
import { signupConfirmationNext } from "@/lib/auth/signup-confirm-continue";
import { recoveryTokenHash } from "@/lib/auth/recovery-continue";
import "@/lib/env";

function requestHost(request: NextRequest): string {
  return (
    (request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "")
      .split(",")[0]
      ?.trim() ?? ""
  );
}

function sameSitePost(request: NextRequest): boolean {
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite === "cross-site") return false;
  const origin = request.headers.get("origin");
  if (!origin || origin === "null") {
    return (
      fetchSite === "same-origin" ||
      fetchSite === "same-site" ||
      fetchSite === "none"
    );
  }
  const host = requestHost(request);
  if (!host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

/**
 * Redeems a signup token_hash and sends the browser to company setup with
 * the session cookie on this redirect. GET never calls this.
 */
export async function POST(request: NextRequest) {
  const correlationId = createAuthCorrelationId();
  const startedAt = Date.now();
  const form = await request.formData().catch(() => null);
  const tokenHash = recoveryTokenHash(
    form ? String(form.get("token_hash") ?? "") : null
  );
  const type = form?.get("type");
  const next = signupConfirmationNext(
    typeof form?.get("next") === "string" ? String(form.get("next")) : null
  );
  const origin = `${request.nextUrl.protocol}//${requestHost(request)}`;
  const invalid = () =>
    NextResponse.redirect(
      new URL(confirmationHelpPath("invalid"), origin),
      303
    );
  const sessionFailed = () =>
    NextResponse.redirect(
      new URL(confirmationHelpPath("session"), origin),
      303
    );

  if (
    !sameSitePost(request) ||
    !tokenHash ||
    (type !== "email" && type !== "signup")
  ) {
    logAuthEvent({
      event: "confirmation_callback_failed",
      category: "CONFIRMATION_LINK_INVALID",
      correlationId,
      elapsedMs: Date.now() - startedAt,
    });
    return invalid();
  }

  let redirectResponse = NextResponse.redirect(new URL(next, origin), 303);
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          redirectResponse = NextResponse.redirect(new URL(next, origin), 303);
          cookiesToSet.forEach(({ name, value, options }) => {
            redirectResponse.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const otpType = type === "signup" ? "signup" : "email";
  const { error } = await supabase.auth.verifyOtp({
    type: otpType,
    token_hash: tokenHash,
  });

  if (error) {
    const provider = `${error.name ?? ""} ${error.message ?? ""}`.toLowerCase();
    const session =
      provider.includes("pkce") || provider.includes("code verifier");
    logAuthEvent({
      event: "confirmation_callback_failed",
      category: session ? "CONFIRMATION_FAILED" : "CONFIRMATION_LINK_INVALID",
      correlationId,
      elapsedMs: Date.now() - startedAt,
    });
    return session ? sessionFailed() : invalid();
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    logAuthEvent({
      event: "confirmation_callback_failed",
      category: "CONFIRMATION_FAILED",
      correlationId,
      elapsedMs: Date.now() - startedAt,
    });
    return sessionFailed();
  }

  const destination = await destinationAfterEmailConfirmation(
    supabase,
    user,
    next,
    correlationId
  );
  const finalResponse = NextResponse.redirect(
    new URL(destination, origin),
    303
  );
  redirectResponse.cookies.getAll().forEach((cookie) => {
    finalResponse.cookies.set(cookie);
  });

  if (destination.startsWith("/signup")) {
    logAuthEvent({
      event: "confirmation_callback_failed",
      category: "CONFIRMATION_PENDING",
      correlationId,
      userId: user.id,
      elapsedMs: Date.now() - startedAt,
    });
    return finalResponse;
  }

  logAuthEvent({
    event: "confirmation_callback_completed",
    correlationId,
    userId: user.id,
    elapsedMs: Date.now() - startedAt,
  });
  return finalResponse;
}
