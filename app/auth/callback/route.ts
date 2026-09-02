import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createAuthCorrelationId, logAuthEvent } from "@/lib/auth/logging";
import {
  classifyAuthProviderError,
  type AuthErrorCategory,
} from "@/lib/auth/errors";
import {
  fullNameFromUserMetadata,
  organisationNameFromUserMetadata,
  resolveEmailConfirmDestination,
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
    const orgName = organisationNameFromUserMetadata(
      user.user_metadata as Record<string, unknown>
    );
    if (!hasOrg && pendingInvite === "none" && orgName) {
      const result = await provisionOrganisationForCurrentUser(
        supabase as never,
        {
          organisationName: orgName,
          fullName: fullNameFromUserMetadata(
            user.user_metadata as Record<string, unknown>,
            user.email
          ),
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
