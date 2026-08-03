/**
 * Auth/org evaluation helpers safe to import from scripts and server modules.
 * Runtime Supabase loading lives in `auth-org-context.ts`.
 */

export type AuthOrgUser = { id: string; email?: string };

export type AuthOrgFailureCode =
  | "not_authenticated"
  | "organisation_required";

export type AuthOrgFailure = {
  ok: false;
  code: AuthOrgFailureCode;
  error: string;
};

export type AuthOrgIdentity = {
  ok: true;
  orgId: string;
  user: AuthOrgUser;
};

export const AUTH_ORG_MESSAGES = {
  not_authenticated: "Not authenticated.",
  organisation_required: "Organisation setup is required.",
} as const;

/**
 * Pure decision helper for auth/org resolution — used by the authoritative
 * loader and by focused Batch 2A.1 verification without a live database.
 *
 * MVP organisation model (Stage 2A):
 * - Each user belongs to exactly one company (`profiles.org_id`).
 * - One company may contain multiple users.
 * - Organisation is always derived from the signed-in profile — never from
 *   a client-supplied organisation ID.
 * - Organisation switching / multi-company UX is not supported.
 * - Same-company users share authorised company records.
 * - Cross-company access must fail closed.
 */
export function evaluateAuthOrgInputs(input: {
  user: { id: string; email?: string | null } | null;
  profile: { org_id: string | null } | null;
  organisation: { id: string } | null;
}): AuthOrgIdentity | AuthOrgFailure {
  if (!input.user) {
    return {
      ok: false,
      code: "not_authenticated",
      error: AUTH_ORG_MESSAGES.not_authenticated,
    };
  }

  const user: AuthOrgUser = {
    id: input.user.id,
    email: input.user.email ?? undefined,
  };

  if (!input.profile?.org_id) {
    return {
      ok: false,
      code: "organisation_required",
      error: AUTH_ORG_MESSAGES.organisation_required,
    };
  }

  if (!input.organisation || input.organisation.id !== input.profile.org_id) {
    return {
      ok: false,
      code: "organisation_required",
      error: AUTH_ORG_MESSAGES.organisation_required,
    };
  }

  return {
    ok: true,
    orgId: input.profile.org_id,
    user,
  };
}
