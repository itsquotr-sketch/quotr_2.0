import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import {
  confirmationHelpPath,
  confirmationLoginPath,
  decideConfirmationCallback,
  decideFailedExchange,
  type ConfirmationCallbackAction,
} from "@/lib/auth/confirmation-link";
import { destinationAfterEmailConfirmation } from "@/lib/auth/finish-email-confirmation";
import { createAuthCorrelationId, logAuthEvent } from "@/lib/auth/logging";
import type { AuthErrorCategory } from "@/lib/auth/errors";
import { recoveryHashHandoffHtml } from "@/lib/auth/recovery-hash-handoff";
import {
  isPrefetch,
  recoveryContinueHtml,
  recoveryTokenHash,
} from "@/lib/auth/recovery-continue";
import {
  signupConfirmContinueHtml,
  signupConfirmationNext,
} from "@/lib/auth/signup-confirm-continue";
import { getSafeInternalPath } from "@/lib/auth/safe-redirect";
import "@/lib/env";

/**
 * Supabase Auth callback (signup confirmation + password recovery).
 *
 * Signup confirmation arrives as token_hash on RedirectTo. GET only shows
 * progress; POST /auth/signup-verify redeems it and sets the session cookie.
 * Recovery still uses its own token_hash POST and is not redeemed here.
 *
 * A leftover PKCE code is exchanged only when this browser still has the
 * verifier. A missing verifier is a session failure, not an expired link.
 * An existing session is not treated as confirmation of this email.
 *
 * Never logs auth codes or tokens.
 */
export async function GET(request: NextRequest) {
  const correlationId = createAuthCorrelationId();
  const startedAt = Date.now();
  const { searchParams, origin } = request.nextUrl;
  const tokenHash = recoveryTokenHash(searchParams.get("token_hash"));
  const tokenType = searchParams.get("type");
  if (tokenHash && tokenType === "recovery") {
    if (isPrefetch(request)) {
      return new NextResponse(null, {
        status: 204,
        headers: { "cache-control": "no-store" },
      });
    }
    const requestedNext = getSafeInternalPath(searchParams.get("next"));
    const destination = requestedNext.startsWith("/reset-password")
      ? requestedNext
      : "/reset-password";
    logAuthEvent({
      event: "confirmation_callback_started",
      correlationId,
    });
    return new NextResponse(recoveryContinueHtml(tokenHash, destination), {
      status: 200,
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store",
      },
    });
  }

  if (tokenHash && tokenType === "email") {
    if (isPrefetch(request)) {
      return new NextResponse(null, {
        status: 204,
        headers: { "cache-control": "no-store" },
      });
    }
    const destination = signupConfirmationNext(searchParams.get("next"));
    logAuthEvent({
      event: "confirmation_callback_started",
      correlationId,
    });
    return new NextResponse(signupConfirmContinueHtml(tokenHash, destination), {
      status: 200,
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store",
      },
    });
  }

  const code = searchParams.get("code");
  const next = getSafeInternalPath(searchParams.get("next"));
  const errorCode = searchParams.get("error_code");
  const errorDescription =
    searchParams.get("error_description") ?? searchParams.get("error");

  logAuthEvent({
    event: "confirmation_callback_started",
    correlationId,
  });

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

  if (!code) {
    const {
      data: { user: existingUser },
    } = await supabase.auth.getUser();
    if (
      next.startsWith("/reset-password") &&
      !existingUser &&
      !errorCode &&
      !errorDescription
    ) {
      return new NextResponse(recoveryHashHandoffHtml(), {
        status: 200,
        headers: {
          "content-type": "text/html; charset=utf-8",
          "cache-control": "no-store",
          "referrer-policy": "no-referrer",
        },
      });
    }
    const action = decideConfirmationCallback({
      code,
      next,
      errorCode,
      errorDescription,
    });
    logAuthEvent({
      event: "confirmation_callback_failed",
      category:
        action.type === "help" && action.reason === "session"
          ? "CONFIRMATION_FAILED"
          : "CONFIRMATION_LINK_INVALID",
      correlationId,
      elapsedMs: Date.now() - startedAt,
    });
    return redirectConfirmationAction(origin, action);
  }

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    const action = decideFailedExchange({
      next,
      providerMessage: `${error.name ?? ""} ${error.message ?? ""}`,
    });
    logAuthEvent({
      event: "confirmation_callback_failed",
      category:
        action.type === "help" && action.reason === "session"
          ? "CONFIRMATION_FAILED"
          : "CONFIRMATION_LINK_INVALID",
      correlationId,
      elapsedMs: Date.now() - startedAt,
    });
    return redirectConfirmationAction(origin, action);
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
    return redirectAuthError(origin, "CONFIRMATION_FAILED");
  }

  return finishConfirmedSession(
    supabase,
    user,
    next,
    origin,
    redirectResponse,
    correlationId,
    startedAt
  );
}

type CallbackClient = ReturnType<typeof createServerClient>;
type CallbackUser = NonNullable<
  Awaited<ReturnType<CallbackClient["auth"]["getUser"]>>["data"]["user"]
>;

async function finishConfirmedSession(
  supabase: CallbackClient,
  user: CallbackUser,
  next: string,
  origin: string,
  redirectResponse: NextResponse,
  correlationId: string,
  startedAt: number
) {
  const destination = await destinationAfterEmailConfirmation(
    supabase,
    user,
    next,
    correlationId
  );
  const finalResponse = NextResponse.redirect(new URL(destination, origin));
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

function redirectConfirmationAction(
  origin: string,
  action: ConfirmationCallbackAction
) {
  if (action.type === "recovery_invalid") {
    return redirectAuthError(origin, "RESET_LINK_INVALID");
  }
  if (action.type === "login") {
    const url = new URL(confirmationLoginPath(action.error), origin);
    return NextResponse.redirect(url);
  }
  if (action.type === "help") {
    return NextResponse.redirect(
      new URL(confirmationHelpPath(action.reason), origin)
    );
  }
  return redirectAuthError(origin, "CONFIRMATION_LINK_INVALID");
}

function redirectAuthError(origin: string, category: AuthErrorCategory) {
  if (category === "RESET_LINK_INVALID") {
    const url = new URL("/reset-password", origin);
    url.searchParams.set("error", "invalid");
    return NextResponse.redirect(url);
  }
  if (category === "CONFIRMATION_FAILED") {
    return NextResponse.redirect(
      new URL(confirmationHelpPath("session"), origin)
    );
  }

  const url = new URL(confirmationHelpPath("invalid"), origin);
  return NextResponse.redirect(url);
}
