import "server-only";

import { cache } from "react";
import {
  AUTH_ORG_MESSAGES,
  evaluateAuthOrgInputs,
  type AuthOrgFailure,
  type AuthOrgUser,
} from "@/lib/security/auth-org-evaluation";
import { createClient } from "@/lib/supabase/server";

export type { AuthOrgFailure, AuthOrgUser } from "@/lib/security/auth-org-evaluation";
export {
  AUTH_ORG_MESSAGES,
  evaluateAuthOrgInputs,
} from "@/lib/security/auth-org-evaluation";

/**
 * Canonical request-scoped authenticated organisation context.
 *
 * Trusted fields only: session user, organisation derived from the signed-in
 * profile, and the request-scoped Supabase client. Project / pricing / quote
 * state must not be stored here.
 *
 * Organisation is always derived from the signed-in profile — never from a
 * client-supplied organisation ID.
 */
export type AuthOrgContext = {
  supabase: Awaited<ReturnType<typeof createClient>>;
  orgId: string;
  user: AuthOrgUser;
};

export type AuthOrgSuccess = AuthOrgContext & { ok: true };

export type AuthOrgResult = AuthOrgSuccess | AuthOrgFailure;

let underlyingAuthResolutionCount = 0;

function noteUnderlyingAuthResolution(): void {
  if (process.env.NODE_ENV === "production") {
    return;
  }
  underlyingAuthResolutionCount += 1;
}

/**
 * Dev/test-only counter of actual getUser+profile+org executions.
 * Always 0 in production. No PII.
 */
export function getUnderlyingAuthResolutionCount(): number {
  return process.env.NODE_ENV === "production"
    ? 0
    : underlyingAuthResolutionCount;
}

/**
 * Dev/test-only reset. No-op in production.
 */
export function resetUnderlyingAuthResolutionCount(): void {
  if (process.env.NODE_ENV === "production") {
    return;
  }
  underlyingAuthResolutionCount = 0;
}

async function resolveAuthOrgContextUncached(): Promise<AuthOrgResult> {
  noteUnderlyingAuthResolution();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      ok: false,
      code: "not_authenticated",
      error: AUTH_ORG_MESSAGES.not_authenticated,
    };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("org_id")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.org_id) {
    return {
      ok: false,
      code: "organisation_required",
      error: AUTH_ORG_MESSAGES.organisation_required,
    };
  }

  const { data: organisation } = await supabase
    .from("organisations")
    .select("id")
    .eq("id", profile.org_id)
    .maybeSingle();

  const evaluated = evaluateAuthOrgInputs({
    user: { id: user.id, email: user.email },
    profile,
    organisation,
  });

  if (!evaluated.ok) {
    return evaluated;
  }

  return {
    ok: true,
    supabase,
    orgId: evaluated.orgId,
    user: evaluated.user,
  };
}

/**
 * Authoritative auth + organisation context loader.
 * Fails closed. Never accepts a client-supplied organisation ID.
 *
 * Memoised with React.cache() — request-scoped in Next.js 16 / React 19.
 * Within one request, nested requireAuthOrgContext() calls share one
 * getUser → profile → organisation tree. The next request, including a
 * different user or a later server action, starts empty and resolves again.
 *
 * Failure results (unauthenticated / missing org) are also request-scoped:
 * a failed resolution cannot become a later success inside the same request,
 * and a thrown resolver error cannot collapse into a stale successful identity.
 *
 * Do not persist identity in a process-global structure.
 * Do not use Next data-cache directives for session authority.
 */
export const requireAuthOrgContext: () => Promise<AuthOrgResult> = cache(
  resolveAuthOrgContextUncached
);

/**
 * Compatibility wrapper around {@link requireAuthOrgContext}.
 * Prefer `requireAuthOrgContext` for new call sites that must fail closed
 * with an explicit result. Existing callers that already null-check may keep
 * using this helper.
 *
 * Returns the same success object as the cached resolver (same reference)
 * so request-scoped ownership memoisation can key on it.
 */
export async function getAuthOrgContext(): Promise<AuthOrgContext | null> {
  const result = await requireAuthOrgContext();
  if (!result.ok) {
    return null;
  }

  return result;
}

export function isAuthOrgSuccess(
  result: AuthOrgResult
): result is AuthOrgSuccess {
  return result.ok;
}
