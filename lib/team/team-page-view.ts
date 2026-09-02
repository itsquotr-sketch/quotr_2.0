import { PLAN_DISPLAY_CATALOGUE } from "@/lib/billing/display-catalogue";
import type { PlanCode } from "@/lib/billing/types";
import { reservedSeatCount, type SeatReservationSnapshot } from "@/lib/team/capacity";
import { ROLE_DESCRIPTIONS, ROLE_LABELS, type MembershipRole } from "@/lib/team/roles";

export type TeamPageKind = "business" | "builder" | "trial" | "custom";

export type TeamMemberView = {
  membershipId: string;
  userId: string;
  fullName: string;
  email: string;
  role: MembershipRole;
  status: "active" | "pending_billing";
  isOwner: boolean;
  isSelf: boolean;
};

export type TeamInvitationView = {
  invitationId: string;
  email: string;
  role: MembershipRole;
  status: string;
  expiresAt: string;
};

export type TeamPageView = {
  kind: TeamPageKind;
  title: string;
  description: string;
  emptyState: string;
  ctaLabel: string | null;
  ctaHref: string | null;
  usageLabel: string | null;
  pendingLabel: string | null;
  extraUserPriceLabel: string | null;
  canInvite: boolean;
  canRemove: boolean;
  canChangeRoles: boolean;
  members: TeamMemberView[];
  invitations: TeamInvitationView[];
  actorRole: MembershipRole;
};

export function buildTeamPageView(input: {
  planCode: PlanCode | null;
  trial: boolean;
  actorRole: MembershipRole;
  members: TeamMemberView[];
  invitations: TeamInvitationView[];
  snapshot: SeatReservationSnapshot;
  selfServiceLimit: number | null;
}): TeamPageView {
  const kind: TeamPageKind = input.trial
    ? "trial"
    : input.planCode === "builder"
      ? "builder"
      : input.planCode === "custom"
        ? "custom"
        : "business";
  const reserved = reservedSeatCount(input.snapshot);
  const limit = input.selfServiceLimit;
  const extra = PLAN_DISPLAY_CATALOGUE.business.extraSeatExclusiveMonthlyNzd;
  const pending = input.snapshot.validPendingInviteCount;

  if (kind === "builder") {
    return {
      kind,
      title: "Team",
      description: "Team members are available on Quotr Business.",
      emptyState: "Upgrade to Quotr Business to add your team.",
      ctaLabel: "Upgrade to Business",
      ctaHref: "/app/settings/billing",
      usageLabel: null,
      pendingLabel: null,
      extraUserPriceLabel: extra
        ? `Additional users are $${extra} + GST/month each.`
        : null,
      canInvite: false,
      canRemove: false,
      canChangeRoles: false,
      members: input.members,
      invitations: [],
      actorRole: input.actorRole,
    };
  }

  if (kind === "trial") {
    return {
      kind,
      title: "Team",
      description: "Team members become available when you subscribe to Quotr Business.",
      emptyState: "Team access becomes available when you subscribe to Quotr Business.",
      ctaLabel: "Choose a plan",
      ctaHref: "/app/settings/billing",
      usageLabel: "1 user during trial",
      pendingLabel: null,
      extraUserPriceLabel: extra
        ? `Additional users are $${extra} + GST/month each after you subscribe.`
        : null,
      canInvite: false,
      canRemove: false,
      canChangeRoles: false,
      members: input.members,
      invitations: [],
      actorRole: input.actorRole,
    };
  }

  const usageLabel =
    limit == null
      ? `${input.snapshot.activeMemberCount} users`
      : `${reserved} of ${limit} users`;
  const pendingLabel =
    pending > 0
      ? pending === 1
        ? "1 invitation pending"
        : `${pending} invitations pending`
      : null;
  const onlyOne = input.snapshot.activeMemberCount <= 1 && pending === 0;

  return {
    kind,
    title: "Team",
    description: "People in this Quotr account.",
    emptyState: onlyOne
      ? "You're the only person in this Quotr account."
      : "No team members yet.",
    ctaLabel: input.actorRole === "owner" ? "Invite someone" : null,
    ctaHref: null,
    usageLabel,
    pendingLabel,
    extraUserPriceLabel: extra
      ? `Additional users are $${extra} + GST/month each.`
      : null,
    canInvite: input.actorRole === "owner",
    canRemove: input.actorRole === "owner",
    canChangeRoles:
      input.actorRole === "owner" || input.actorRole === "admin",
    members: input.members,
    invitations: input.invitations,
    actorRole: input.actorRole,
  };
}

export function roleOptionCopy(): Array<{
  value: Exclude<MembershipRole, "owner">;
  label: string;
  description: string;
}> {
  return (["admin", "estimator", "viewer"] as const).map((value) => ({
    value,
    label: ROLE_LABELS[value],
    description: ROLE_DESCRIPTIONS[value],
  }));
}
