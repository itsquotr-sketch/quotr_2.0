import type { MembershipRole } from "@/lib/team/roles";
import { isInvitableRole } from "@/lib/team/roles";

export const INVITE_STATUSES = [
  "pending",
  "accepting",
  "accepted",
  "cancelled",
  "expired",
] as const;
export type InviteStatus = (typeof INVITE_STATUSES)[number];

export type InviteCreateDecision =
  | { ok: true }
  | { ok: false; errorCode: string; errorSafe: string };

/**
 * Owner-only paid-seat invitations (BILLING-4 v1).
 * Admin may manage existing Estimator/Viewer roles but cannot add seats.
 * Sending an invitation is Owner consent for the future seat charge.
 * Acceptance does not require a second Owner approval.
 */
export function canCreatePaidSeatInvitation(role: MembershipRole): boolean {
  return role === "owner";
}

export function validateInviteRole(role: string): InviteCreateDecision {
  if (role === "owner") {
    return {
      ok: false,
      errorCode: "owner_not_invitable",
      errorSafe: "Owner cannot be invited. Each company has one Owner.",
    };
  }
  if (!isInvitableRole(role)) {
    return {
      ok: false,
      errorCode: "invalid_invite_role",
      errorSafe: "Choose Admin, Estimator, or Viewer.",
    };
  }
  return { ok: true };
}

export function canChangeMemberRole(input: {
  actorRole: MembershipRole;
  targetRole: MembershipRole;
  nextRole: MembershipRole;
}): InviteCreateDecision {
  if (input.targetRole === "owner" || input.nextRole === "owner") {
    return {
      ok: false,
      errorCode: "owner_role_locked",
      errorSafe:
        "Owner cannot be changed in this version. Ownership transfer comes later.",
    };
  }
  if (input.actorRole === "owner") {
    if (!isInvitableRole(input.nextRole)) {
      return {
        ok: false,
        errorCode: "invalid_role",
        errorSafe: "Choose Admin, Estimator, or Viewer.",
      };
    }
    return { ok: true };
  }
  if (input.actorRole === "admin") {
    if (input.targetRole === "admin") {
      return {
        ok: false,
        errorCode: "admin_cannot_change_admin",
        errorSafe: "Only the Owner can change an Admin's role.",
      };
    }
    if (input.nextRole === "admin") {
      return {
        ok: false,
        errorCode: "admin_cannot_promote_admin",
        errorSafe: "Only the Owner can make someone an Admin.",
      };
    }
    if (
      (input.targetRole === "estimator" || input.targetRole === "viewer") &&
      (input.nextRole === "estimator" || input.nextRole === "viewer")
    ) {
      return { ok: true };
    }
  }
  return {
    ok: false,
    errorCode: "role_change_forbidden",
    errorSafe: "You don't have permission to change this person's role.",
  };
}

export function canRemoveMember(input: {
  actorRole: MembershipRole;
  targetRole: MembershipRole;
  targetIsSelf: boolean;
}): InviteCreateDecision {
  if (input.targetRole === "owner") {
    return {
      ok: false,
      errorCode: "owner_cannot_be_removed",
      errorSafe:
        "The Owner cannot be removed. Ownership transfer comes later.",
    };
  }
  if (input.actorRole !== "owner") {
    return {
      ok: false,
      errorCode: "remove_requires_owner",
      errorSafe: "Only the Owner can remove people from this company.",
    };
  }
  if (input.targetIsSelf) {
    return {
      ok: false,
      errorCode: "cannot_remove_self",
      errorSafe: "You cannot remove yourself.",
    };
  }
  return { ok: true };
}

export type CrossOrgInviteDecision =
  | { ok: true; kind: "join" }
  | { ok: true; kind: "already_member" }
  | { ok: false; errorCode: string; errorSafe: string };

/**
 * One authenticated user belongs to exactly one organisation.
 * Do not silently move a provisioned user between companies.
 */
export function decideExistingUserInviteAcceptance(input: {
  userOrgId: string | null;
  invitedOrgId: string;
}): CrossOrgInviteDecision {
  if (!input.userOrgId) {
    return { ok: true, kind: "join" };
  }
  if (input.userOrgId === input.invitedOrgId) {
    return { ok: true, kind: "already_member" };
  }
  return {
    ok: false,
    errorCode: "already_in_another_org",
    errorSafe:
      "This email already belongs to a different Quotr company. A person can only be in one company.",
  };
}
