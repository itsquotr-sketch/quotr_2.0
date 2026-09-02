import {
  mapLegacyProfileRole,
  type MembershipRole,
} from "@/lib/team/roles";

/**
 * Role authority after organisation_memberships exists.
 * pending_billing is workflow state only — not Viewer, not any role.
 */

export type MembershipAuthorityDecision =
  | { kind: "active"; role: MembershipRole }
  | { kind: "pending_billing" }
  | { kind: "removed_or_absent" }
  | { kind: "bound_without_membership" }
  | { kind: "legacy_profile"; role: MembershipRole };

export function decideMembershipAuthority(input: {
  membershipTableAvailable: boolean;
  membership: { role: string; status: string } | null;
  profile: { orgId: string | null; role: string | null } | null;
}): MembershipAuthorityDecision {
  if (!input.membershipTableAvailable) {
    return {
      kind: "legacy_profile",
      role: mapLegacyProfileRole(input.profile?.role),
    };
  }

  if (input.membership?.status === "active") {
    return {
      kind: "active",
      role: mapLegacyProfileRole(input.membership.role),
    };
  }

  if (input.membership?.status === "pending_billing") {
    return { kind: "pending_billing" };
  }

  if (input.profile?.orgId) {
    return { kind: "bound_without_membership" };
  }

  return { kind: "removed_or_absent" };
}

export function membershipGrantsRolePermissions(
  decision: MembershipAuthorityDecision
): decision is { kind: "active"; role: MembershipRole } | {
  kind: "legacy_profile";
  role: MembershipRole;
} {
  return decision.kind === "active" || decision.kind === "legacy_profile";
}
