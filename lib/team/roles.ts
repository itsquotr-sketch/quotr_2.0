/**
 * Business membership roles. All four consume one full paid seat in BILLING-4
 * when status is active. pending_billing is not a role and grants zero access.
 * Viewer is an active paid membership — never a stand-in for pending_billing.
 */

export const MEMBERSHIP_ROLES = [
  "owner",
  "admin",
  "estimator",
  "viewer",
] as const;
export type MembershipRole = (typeof MEMBERSHIP_ROLES)[number];

export const INVITABLE_ROLES = ["admin", "estimator", "viewer"] as const;
export type InvitibleRole = (typeof INVITABLE_ROLES)[number];

export const MEMBERSHIP_STATUSES = [
  "active",
  "pending_billing",
  "removed",
] as const;
export type MembershipStatus = (typeof MEMBERSHIP_STATUSES)[number];

/** Legacy profiles.role values still present on existing rows. */
export const LEGACY_PROFILE_ROLES = ["owner", "admin", "member"] as const;
export type LegacyProfileRole = (typeof LEGACY_PROFILE_ROLES)[number];

export const ROLE_LABELS: Record<MembershipRole, string> = {
  owner: "Owner",
  admin: "Admin",
  estimator: "Estimator",
  viewer: "Viewer",
};

export const ROLE_DESCRIPTIONS: Record<MembershipRole, string> = {
  owner:
    "Full control: team, billing, company settings, rates, projects, estimates, pricing, and quotes.",
  admin:
    "Run the company day to day: projects, estimates, pricing, quotes, and role changes for Estimators and Viewers. Cannot invite paid users, remove users, or manage payment.",
  estimator:
    "Create and send commercial work: projects, estimates, pricing, and quotes. No team or billing changes.",
  viewer:
    "View projects, estimates, pricing, and quotes. Cannot create, edit, or send.",
};

export function isMembershipRole(value: string): value is MembershipRole {
  return (MEMBERSHIP_ROLES as readonly string[]).includes(value);
}

export function isInvitableRole(value: string): value is InvitibleRole {
  return (INVITABLE_ROLES as readonly string[]).includes(value);
}

/**
 * Bootstrap map from existing profiles.role.
 * member → estimator so current users keep commercial write access.
 * Viewer is new and is never inferred from legacy rows.
 */
export function mapLegacyProfileRole(
  role: string | null | undefined
): MembershipRole {
  const normalized = role?.trim().toLowerCase() ?? "";
  if (normalized === "owner") return "owner";
  if (normalized === "admin") return "admin";
  if (normalized === "viewer") return "viewer";
  if (normalized === "estimator") return "estimator";
  return "estimator";
}

/** Compatibility write-back onto profiles.role (keeps owner/admin org RLS). */
export function membershipRoleToProfileRole(
  role: MembershipRole
): "owner" | "admin" | "estimator" | "viewer" {
  return role;
}
