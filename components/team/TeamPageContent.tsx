"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import {
  cancelTeamInvitation,
  changeTeamMemberRole,
  inviteTeamMember,
  removeTeamMember,
} from "@/lib/team/actions";
import { SEAT_ADD_DISCLOSURE, SEAT_REMOVE_DISCLOSURE } from "@/lib/billing/seat-change";
import { roleOptionCopy, type TeamPageView } from "@/lib/team/team-page-view";
import { ROLE_DESCRIPTIONS, ROLE_LABELS, type MembershipRole } from "@/lib/team/roles";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type ActionState = { error?: string; warning?: string; success?: boolean };

async function inviteAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const result = await inviteTeamMember({
    email: String(formData.get("email") ?? ""),
    role: String(formData.get("role") ?? "estimator"),
  });
  if (result.error) return { error: result.error };
  return { success: true, warning: result.warning };
}

export function TeamPageContent({ view }: { view: TeamPageView }) {
  const [inviteState, inviteFormAction, invitePending] = useActionState(
    inviteAction,
    {}
  );
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
  const [pendingRole, setPendingRole] = useState<{
    membershipId: string;
    role: string;
    name: string;
  } | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteRole, setInviteRole] = useState("estimator");
  const [dismissInviteSuccess, setDismissInviteSuccess] = useState(false);
  if (invitePending && dismissInviteSuccess) setDismissInviteSuccess(false);
  const roles = roleOptionCopy();
  const inviteRoleCopy = roles.find((option) => option.value === inviteRole);
  const activeCount = view.members.filter((member) => member.status === "active").length;
  const removeTarget = view.members.find(
    (member) => member.membershipId === confirmRemoveId
  );

  function requestRoleChange(
    member: { membershipId: string; role: MembershipRole; fullName: string },
    role: string
  ) {
    const rank: Record<string, number> = {
      owner: 4,
      admin: 3,
      estimator: 2,
      viewer: 1,
    };
    if ((rank[role] ?? 0) < (rank[member.role] ?? 0)) {
      setPendingRole({
        membershipId: member.membershipId,
        role,
        name: member.fullName,
      });
      return;
    }
    void onChangeRole(member.membershipId, role);
  }

  async function onChangeRole(membershipId: string, role: string) {
    setError(null);
    setBusyId(membershipId);
    const result = await changeTeamMemberRole({ membershipId, role });
    if (result.error) setError(result.error);
    setBusyId(null);
    setPendingRole(null);
  }

  async function onRemove(membershipId: string) {
    setError(null);
    setBusyId(membershipId);
    const result = await removeTeamMember(membershipId);
    if (result.error) setError(result.error);
    setBusyId(null);
    setConfirmRemoveId(null);
  }

  async function onCancelInvite(invitationId: string) {
    setError(null);
    setBusyId(invitationId);
    const result = await cancelTeamInvitation(invitationId);
    if (result.error) setError(result.error);
    setBusyId(null);
  }

  return (
    <div className="min-w-0 space-y-4 overflow-x-hidden" data-team-page>
      <section className="rounded-xl border border-border/60 bg-card px-4 py-4" data-team-overview>
        <h2 className="text-base font-semibold tracking-tight">{view.title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{view.description}</p>
        <p className="mt-3 text-sm text-muted-foreground">
          {[
            `${activeCount} active`,
            `${view.invitations.length} pending`,
            view.usageLabel,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
        {view.pendingLabel ? (
          <p className="mt-2 text-sm text-muted-foreground">{view.pendingLabel}</p>
        ) : null}
        {view.extraUserPriceLabel ? (
          <p className="mt-2 text-sm text-muted-foreground">{view.extraUserPriceLabel}</p>
        ) : null}
        {view.ctaHref && view.ctaLabel ? (
          <Button
            render={<Link href={view.ctaHref} />}
            size="touch"
            className="mt-4 w-full sm:w-auto"
          >
            {view.ctaLabel}
          </Button>
        ) : null}
        {view.kind === "builder" || view.kind === "trial" ? (
          <p className="mt-3 text-sm">{view.emptyState}</p>
        ) : null}
      </section>

      {error ? (
        <p
          role="alert"
          className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {error}
        </p>
      ) : null}

      {view.kind === "business" || view.kind === "custom" ? (
        <>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-sm font-semibold tracking-tight">Active members</h2>
            {view.canInvite ? (
              <Button
                type="button"
                size="touch"
                className="h-11 min-h-11 w-full sm:w-auto"
                onClick={() => setInviteOpen(true)}
              >
                Invite member
              </Button>
            ) : null}
          </div>
          <div className="overflow-hidden rounded-xl border border-border/60 bg-card" data-team-members>
            {view.members.map((member) => (
              <div
                key={member.membershipId}
                className="grid grid-cols-1 gap-2 border-b border-border/60 px-4 py-3 last:border-0 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_9rem_auto] md:items-center"
                data-team-member={member.membershipId}
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{member.fullName}</p>
                  <p className="truncate text-sm text-muted-foreground">{member.email}</p>
                </div>
                <p className="text-sm text-muted-foreground">
                  {member.status === "pending_billing"
                    ? "Waiting for payment. This person cannot open the company yet."
                    : member.isOwner
                      ? "Owner. This role stays with the account."
                      : ROLE_DESCRIPTIONS[member.role]}
                </p>
                {member.isOwner ||
                !view.canChangeRoles ||
                member.status === "pending_billing" ||
                !roles.some(
                  (option) =>
                    option.value === member.role &&
                    (view.actorRole === "admin" ? option.value !== "admin" : true)
                ) ? (
                  <StatusBadge variant="secondary">
                    {member.status === "pending_billing"
                      ? "Joining"
                      : ROLE_LABELS[member.role]}
                  </StatusBadge>
                ) : (
                  <select
                    className="h-11 min-h-11 w-full rounded-xl border border-border/80 bg-background px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 md:text-sm"
                    value={member.role}
                    disabled={busyId === member.membershipId}
                    onChange={(event) =>
                      requestRoleChange(member, event.target.value)
                    }
                    aria-label={`Role for ${member.fullName}`}
                  >
                    {roles
                      .filter((option) =>
                        view.actorRole === "admin" ? option.value !== "admin" : true
                      )
                      .map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                  </select>
                )}
                {view.canRemove && !member.isOwner && !member.isSelf ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="touch"
                    className="h-11 min-h-11"
                    onClick={() => setConfirmRemoveId(member.membershipId)}
                  >
                    Remove
                  </Button>
                ) : (
                  <span className="hidden md:block" />
                )}
              </div>
            ))}
            {view.members.length <= 1 && view.invitations.length === 0 ? (
              <p className="px-4 py-3 text-sm text-muted-foreground">{view.emptyState}</p>
            ) : null}
          </div>

          {view.invitations.length > 0 ? (
            <div className="space-y-2">
              <h2 className="text-sm font-medium">Pending invitations</h2>
              {view.invitations.map((invite) => (
                <div
                  key={invite.invitationId}
                  className="flex flex-col gap-3 rounded-xl border border-border/60 bg-card px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                  data-team-invitation={invite.invitationId}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{invite.email}</p>
                    <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                      <StatusBadge variant="secondary">{ROLE_LABELS[invite.role]}</StatusBadge>
                      <StatusBadge variant="secondary">Pending</StatusBadge>
                      <span>no access until accepted</span>
                    </p>
                  </div>
                  {view.canInvite ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="touch"
                      className="h-11 min-h-11"
                      disabled={busyId === invite.invitationId}
                      onClick={() => void onCancelInvite(invite.invitationId)}
                    >
                      {busyId === invite.invitationId ? "Updating…" : "Cancel invite"}
                    </Button>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}

          {view.canInvite ? (
            <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
              <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                  <DialogTitle>Invite member</DialogTitle>
                  <DialogDescription>{SEAT_ADD_DISCLOSURE}</DialogDescription>
                </DialogHeader>
                <form
                  action={inviteFormAction}
                  className="space-y-4"
                  onChange={() => {
                    if (inviteState.success) setDismissInviteSuccess(true);
                  }}
                >
                  {inviteState.error ? (
                    <p
                      role="alert"
                      className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive"
                    >
                      {inviteState.error}
                    </p>
                  ) : null}
                  {inviteState.success && !dismissInviteSuccess && !invitePending ? (
                    <p
                      role="status"
                      className="text-sm text-muted-foreground"
                    >
                      {inviteState.warning ?? "Invitation sent."}
                    </p>
                  ) : null}
                  <div className="space-y-1.5">
                    <Label className="text-xs" htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      required
                      className="h-11"
                      placeholder="name@company.co.nz"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs" htmlFor="role">Role</Label>
                    <select
                      id="role"
                      name="role"
                      value={inviteRole}
                      onChange={(event) => setInviteRole(event.target.value)}
                      className="h-11 min-h-11 w-full rounded-xl border border-border/80 bg-background px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 md:text-sm"
                    >
                      {roles.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    {inviteRoleCopy ? (
                      <p className="text-xs text-muted-foreground">
                        {inviteRoleCopy.description}
                      </p>
                    ) : null}
                  </div>
                  <DialogFooter>
                    <Button type="submit" className="h-11 min-h-11 min-w-40" disabled={invitePending}>
                      {invitePending ? "Inviting…" : "Send invitation"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          ) : view.kind === "business" || view.kind === "custom" ? (
            <p className="text-sm text-muted-foreground">
              Only the Owner can invite or remove people.
            </p>
          ) : null}
        </>
      ) : null}

      <Dialog
        open={confirmRemoveId != null}
        onOpenChange={(open) => {
          if (!open) setConfirmRemoveId(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Remove {removeTarget?.fullName ?? "this person"}?
            </DialogTitle>
            <DialogDescription>{SEAT_REMOVE_DISCLOSURE}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="touch"
              onClick={() => setConfirmRemoveId(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="touch"
              disabled={!confirmRemoveId || busyId === confirmRemoveId}
              onClick={() => {
                if (confirmRemoveId) void onRemove(confirmRemoveId);
              }}
            >
              {busyId === confirmRemoveId ? "Removing…" : "Remove"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={pendingRole != null}
        onOpenChange={(open) => {
          if (!open) setPendingRole(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reduce this role?</DialogTitle>
            <DialogDescription>
              {pendingRole
                ? `${pendingRole.name} will become ${ROLE_LABELS[pendingRole.role as MembershipRole] ?? pendingRole.role}. ${ROLE_DESCRIPTIONS[pendingRole.role as MembershipRole] ?? ""}`
                : "This reduces what the person can do."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="touch"
              onClick={() => setPendingRole(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="touch"
              disabled={!pendingRole || busyId === pendingRole.membershipId}
              onClick={() => {
                if (pendingRole) {
                  void onChangeRole(pendingRole.membershipId, pendingRole.role);
                }
              }}
            >
              {pendingRole && busyId === pendingRole.membershipId ? "Updating…" : "Change role"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
