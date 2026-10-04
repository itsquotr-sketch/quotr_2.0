import type { MembershipRole } from "@/lib/team/roles";

/**
 * Smallest useful permission registry. Plan entitlements stay in billing.
 * Role permissions answer "may this member perform the action".
 */
export const ORG_PERMISSIONS = [
  "team.view",
  "team.invite",
  "team.remove",
  "team.change_role",
  "team.assign_projects",
  "billing.view",
  "billing.manage",
  "projects.create",
  "projects.edit",
  "estimates.run",
  "pricing.edit",
  "quotes.create",
  "quotes.send",
  "company.edit",
  "company.rates.manage",
  "company.calibration.manage",
] as const;

export type OrgPermission = (typeof ORG_PERMISSIONS)[number];

const OWNER: ReadonlySet<OrgPermission> = new Set(ORG_PERMISSIONS);

const ADMIN: ReadonlySet<OrgPermission> = new Set([
  "team.view",
  "team.change_role",
  "team.assign_projects",
  "billing.view",
  "projects.create",
  "projects.edit",
  "estimates.run",
  "pricing.edit",
  "quotes.create",
  "quotes.send",
  "company.edit",
  "company.rates.manage",
  "company.calibration.manage",
]);

const ESTIMATOR: ReadonlySet<OrgPermission> = new Set([
  "team.view",
  "billing.view",
  "projects.create",
  "projects.edit",
  "estimates.run",
  "pricing.edit",
  "quotes.create",
  "quotes.send",
  "company.calibration.manage",
]);

const VIEWER: ReadonlySet<OrgPermission> = new Set([
  "team.view",
  "billing.view",
]);

const ROLE_PERMISSIONS: Record<MembershipRole, ReadonlySet<OrgPermission>> = {
  owner: OWNER,
  admin: ADMIN,
  estimator: ESTIMATOR,
  viewer: VIEWER,
};

export function permissionsForRole(
  role: MembershipRole
): readonly OrgPermission[] {
  return ORG_PERMISSIONS.filter((permission) =>
    ROLE_PERMISSIONS[role].has(permission)
  );
}

export function roleAllowsPermission(
  role: MembershipRole,
  permission: OrgPermission
): boolean {
  return ROLE_PERMISSIONS[role].has(permission);
}

/**
 * Read-only UI gate. Uses the same role matrix as server mutations.
 * Callers must still enforce `projects.create` on the server.
 */
export function memberCanCreateProjects(
  role: MembershipRole | null | undefined
): boolean {
  return role != null && roleAllowsPermission(role, "projects.create");
}

/** Read-only UI gate for project edits, including document upload controls. */
export function memberCanEditProjects(
  role: MembershipRole | null | undefined
): boolean {
  return role != null && roleAllowsPermission(role, "projects.edit");
}

/** Read-only UI gate. Server actions and RLS remain the authority. */
export function memberCanRunEstimates(
  role: MembershipRole | null | undefined
): boolean {
  return role != null && roleAllowsPermission(role, "estimates.run");
}

export function isOrgPermission(value: string): value is OrgPermission {
  return (ORG_PERMISSIONS as readonly string[]).includes(value);
}

export const PERMISSION_DENIED_MESSAGE =
  "You don't have permission to do that.";
