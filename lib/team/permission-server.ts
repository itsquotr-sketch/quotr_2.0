import "server-only";

import { requireOrgEntitlement } from "@/lib/billing/entitlement-server";
import type { EntitlementCapability } from "@/lib/billing/capabilities";
import { getAuthOrgContext } from "@/lib/security/auth-org-context";
import {
  decideMembershipAuthority,
  membershipGrantsRolePermissions,
} from "@/lib/team/membership-authority";
import {
  PERMISSION_DENIED_MESSAGE,
  roleAllowsPermission,
  type OrgPermission,
} from "@/lib/team/permissions";
import type { MembershipRole } from "@/lib/team/roles";

export type PermissionDecision =
  | { ok: true; role: MembershipRole; orgId: string; userId: string }
  | { ok: false; error: string; reasonCode: "not_authenticated" | "forbidden" };

export type CompositionDecision =
  | { ok: true; role: MembershipRole; orgId: string; userId: string }
  | {
      ok: false;
      error: string;
      reasonCode: string;
      entitlementDenied?: boolean;
    };

async function loadMembershipRole(input: {
  orgId: string;
  userId: string;
}): Promise<MembershipRole | null> {
  const context = await getAuthOrgContext();
  if (!context || context.orgId !== input.orgId || context.user.id !== input.userId) {
    return null;
  }

  const { data, error } = await context.supabase
    .from("organisation_memberships")
    .select("role, status")
    .eq("org_id", input.orgId)
    .eq("user_id", input.userId)
    .in("status", ["active", "pending_billing"])
    .maybeSingle();

  if (error && isMissingMembershipRelation(error.message, error.code)) {
    const { data: profile } = await context.supabase
      .from("profiles")
      .select("role")
      .eq("id", input.userId)
      .eq("org_id", input.orgId)
      .maybeSingle();
    const decision = decideMembershipAuthority({
      membershipTableAvailable: false,
      membership: null,
      profile: { orgId: input.orgId, role: profile?.role ?? null },
    });
    return membershipGrantsRolePermissions(decision) ? decision.role : null;
  }

  if (error) {
    return null;
  }

  const { data: profile } = await context.supabase
    .from("profiles")
    .select("org_id, role")
    .eq("id", input.userId)
    .maybeSingle();

  const decision = decideMembershipAuthority({
    membershipTableAvailable: true,
    membership: data ? { role: data.role, status: data.status } : null,
    profile: profile
      ? { orgId: profile.org_id, role: profile.role }
      : { orgId: input.orgId, role: null },
  });

  if (!membershipGrantsRolePermissions(decision)) {
    return null;
  }
  return decision.role;
}

function isMissingMembershipRelation(
  message: string | undefined,
  code?: string
): boolean {
  const m = (message ?? "").toLowerCase();
  if (code === "PGRST205" || code === "42P01") return true;
  return (
    m.includes("organisation_memberships") &&
    (m.includes("does not exist") ||
      m.includes("schema cache") ||
      m.includes("could not find the table"))
  );
}

export async function requireOrgPermission(input: {
  orgId: string;
  userId: string;
  permission: OrgPermission;
}): Promise<PermissionDecision> {
  const role = await loadMembershipRole(input);
  if (!role || !roleAllowsPermission(role, input.permission)) {
    return {
      ok: false,
      error: PERMISSION_DENIED_MESSAGE,
      reasonCode: "forbidden",
    };
  }
  return { ok: true, role, orgId: input.orgId, userId: input.userId };
}

/**
 * Canonical server-action rule: organisation entitlement AND member permission.
 * Plan logic is not duplicated here. Role permissions require an ACTIVE membership.
 */
export async function requireEntitlementAndPermission(input: {
  orgId: string;
  userId: string;
  permission: OrgPermission;
  entitlement?: EntitlementCapability | null;
}): Promise<CompositionDecision> {
  if (input.entitlement) {
    const entitled = await requireOrgEntitlement(input.orgId, input.entitlement);
    if (!entitled.ok) {
      return {
        ok: false,
        error: entitled.message ?? "This action is not available.",
        reasonCode: entitled.reasonCode ?? "upgrade_required",
        entitlementDenied: true,
      };
    }
  }

  const permitted = await requireOrgPermission({
    orgId: input.orgId,
    userId: input.userId,
    permission: input.permission,
  });
  if (!permitted.ok) {
    return {
      ok: false,
      error: permitted.error,
      reasonCode: permitted.reasonCode,
    };
  }
  return permitted;
}

export async function permissionDeniedError(input: {
  orgId: string;
  userId: string;
  permission: OrgPermission;
  entitlement?: EntitlementCapability | null;
}): Promise<{ error: string } | null> {
  const decision = await requireEntitlementAndPermission(input);
  if (decision.ok) return null;
  return { error: decision.error };
}
