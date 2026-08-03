import "server-only";

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
 * Authoritative authenticated-user + organisation context for server code.
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

/**
 * Authoritative auth + organisation context loader.
 * Fails closed. Never accepts a client-supplied organisation ID.
 */
export async function requireAuthOrgContext(): Promise<AuthOrgResult> {
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
 * Compatibility wrapper around {@link requireAuthOrgContext}.
 * Prefer `requireAuthOrgContext` for new call sites that must fail closed
 * with an explicit result. Existing callers that already null-check may keep
 * using this helper.
 */
export async function getAuthOrgContext(): Promise<AuthOrgContext | null> {
  const result = await requireAuthOrgContext();
  if (!result.ok) {
    return null;
  }

  return {
    supabase: result.supabase,
    orgId: result.orgId,
    user: result.user,
  };
}

export function isAuthOrgSuccess(
  result: AuthOrgResult
): result is AuthOrgSuccess {
  return result.ok;
}
