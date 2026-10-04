import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import {
  confirmationLoginPath,
  decideConfirmationCallback,
  decideFailedExchange,
  type ConfirmationCallbackAction,
} from "@/lib/auth/confirmation-link";
import { createAuthCorrelationId, logAuthEvent } from "@/lib/auth/logging";
import type { AuthErrorCategory } from "@/lib/auth/errors";
import {
  explicitFullNameFromUserMetadata,
  organisationNameFromUserMetadata,
  resolveEmailConfirmDestination,
  shouldProvisionSignupOrganisation,
  type PendingInviteKind,
} from "@/lib/auth/email-confirm-destination";
import { provisionOrganisationForCurrentUser } from "@/lib/auth/provisioning";
import { getSafeInternalPath } from "@/lib/auth/safe-redirect";
import "@/lib/env";

/**
 * Supabase Auth PKCE callback (signup confirmation + password recovery).
 *
 * Exchange the `code` server-side, set session cookies, then route:
 * - recovery next=/reset-password → reset page (session required)
 * - invite next=/invite/… → invitation (BILLING-4)
 * - ordinary Owner → provision if needed → company basics
 * - authenticated but missing company and not invited → /app/setup-required
 *
 * Never logs auth codes or tokens.
 */
export async function GET(request: NextRequest) {
  const correlationId = createAuthCorrelationId();
  const startedAt = Date.now();
  const { searchParams, origin } = request.nextUrl;
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
    const action = decideConfirmationCallback({
      code,
      next,
      errorCode,
      errorDescription,
      hasConfirmedSession: Boolean(existingUser),
    });
    if (action.type === "continue" && existingUser) {
      return finishConfirmedSession(
        supabase,
        existingUser,
        next,
        origin,
        redirectResponse,
        correlationId,
        startedAt
      );
    }
    logAuthEvent({
      event: "confirmation_callback_failed",
      category: "CONFIRMATION_LINK_INVALID",
      correlationId,
      elapsedMs: Date.now() - startedAt,
    });
    return redirectConfirmationAction(origin, action);
  }

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    const {
      data: { user: existingUser },
    } = await supabase.auth.getUser();
    const action = decideFailedExchange({
      next,
      providerMessage: error.message,
      hasConfirmedSession: Boolean(existingUser),
    });
    if (action.type === "continue" && existingUser) {
      return finishConfirmedSession(
        supabase,
        existingUser,
        next,
        origin,
        redirectResponse,
        correlationId,
        startedAt
      );
    }
    logAuthEvent({
      event: "confirmation_callback_failed",
      category: "CONFIRMATION_LINK_INVALID",
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
      category: "CONFIRMATION_LINK_INVALID",
      correlationId,
      elapsedMs: Date.now() - startedAt,
    });
    return redirectAuthError(origin, "CONFIRMATION_LINK_INVALID");
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

    let hasOrg = Boolean(profile?.org_id);
    if (hasOrg && profile?.org_id) {
      const { data: organisation } = await supabase
        .from("organisations")
        .select("id")
        .eq("id", profile.org_id)
        .maybeSingle();
      hasOrg = Boolean(organisation);
    }

    let pendingInvite: PendingInviteKind = "none";
    if (!hasOrg) {
      const { data: pending } = await supabase.rpc(
        "lookup_pending_invitation_for_current_user"
      );
      const row = Array.isArray(pending) ? pending[0] : pending;
      const count = Number(row?.invite_count ?? 0);
      if (count > 1) pendingInvite = "multiple";
      else if (count === 1) pendingInvite = "one";
    }

    let provisioned = false;
    const metadata = user.user_metadata as Record<string, unknown>;
    const orgName = organisationNameFromUserMetadata(metadata);
    const fullName = explicitFullNameFromUserMetadata(metadata);
    if (
      shouldProvisionSignupOrganisation({
        hasOrg,
        pendingInvite,
        organisationName: orgName,
        fullName,
      }) &&
      orgName &&
      fullName
    ) {
      const result = await provisionOrganisationForCurrentUser(
        supabase as never,
        {
          organisationName: orgName,
          fullName,
          correlationId,
          userId: user.id,
          context: "signup",
        }
      );
      provisioned = result.ok;
      if (result.ok === false && result.category === "INVITE_PENDING") {
        pendingInvite = "one";
      }
    }

    destination = resolveEmailConfirmDestination({
      next,
      hasOrg,
      pendingInvite,
      provisioned,
    });
  }

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
  return redirectAuthError(origin, "CONFIRMATION_LINK_INVALID");
}

function redirectAuthError(origin: string, category: AuthErrorCategory) {
  if (category === "RESET_LINK_INVALID") {
    const url = new URL("/reset-password", origin);
    url.searchParams.set("error", "invalid");
    return NextResponse.redirect(url);
  }

  const url = new URL(confirmationLoginPath("confirmation_invalid"), origin);
  return NextResponse.redirect(url);
}
