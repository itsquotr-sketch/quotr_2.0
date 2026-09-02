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
import { ROLE_LABELS } from "@/lib/team/roles";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
  const roles = roleOptionCopy();

  async function onChangeRole(membershipId: string, role: string) {
    setError(null);
    setBusyId(membershipId);
    const result = await changeTeamMemberRole({ membershipId, role });
    if (result.error) setError(result.error);
    setBusyId(null);
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
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{view.title}</CardTitle>
          <CardDescription>{view.description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {view.usageLabel ? <p>{view.usageLabel}</p> : null}
          {view.pendingLabel ? (
            <p className="text-muted-foreground">{view.pendingLabel}</p>
          ) : null}
          {view.extraUserPriceLabel ? (
            <p className="text-muted-foreground">{view.extraUserPriceLabel}</p>
          ) : null}
        </CardContent>
        {view.ctaHref ? (
          <CardFooter>
            <Button render={<Link href={view.ctaHref} />}>
              {view.ctaLabel}
            </Button>
          </CardFooter>
        ) : null}
      </Card>

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
          <div className="space-y-3">
            {view.members.map((member) => (
              <Card key={member.membershipId}>
                <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{member.fullName}</p>
                    <p className="text-sm text-muted-foreground truncate">
                      {member.email}
                    </p>
                    {member.status === "pending_billing" ? (
                      <p className="text-xs text-muted-foreground">
                        Waiting for payment. This person cannot open the company yet.
                      </p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {member.isOwner ||
                    !view.canChangeRoles ||
                    member.status === "pending_billing" ? (
                      <span className="text-sm">
                        {member.status === "pending_billing"
                          ? "Joining"
                          : ROLE_LABELS[member.role]}
                      </span>
                    ) : (
                      <select
                        className="h-10 rounded-md border border-input bg-background px-2 text-sm"
                        value={member.role}
                        disabled={busyId === member.membershipId}
                        onChange={(event) =>
                          void onChangeRole(member.membershipId, event.target.value)
                        }
                        aria-label={`Role for ${member.fullName}`}
                      >
                        {roles
                          .filter((option) =>
                            view.actorRole === "admin"
                              ? option.value !== "admin"
                              : true
                          )
                          .map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                      </select>
                    )}
                    {view.canRemove && !member.isOwner && !member.isSelf ? (
                      confirmRemoveId === member.membershipId ? (
                        <div className="flex flex-col gap-2 sm:max-w-xs">
                          <p className="text-xs text-muted-foreground">
                            {SEAT_REMOVE_DISCLOSURE}
                          </p>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="destructive"
                              disabled={busyId === member.membershipId}
                              onClick={() => void onRemove(member.membershipId)}
                            >
                              Remove
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setConfirmRemoveId(null)}
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setConfirmRemoveId(member.membershipId)}
                        >
                          Remove
                        </Button>
                      )
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            ))}
            {view.members.length <= 1 && view.invitations.length === 0 ? (
              <p className="text-sm text-muted-foreground">{view.emptyState}</p>
            ) : null}
          </div>

          {view.invitations.length > 0 ? (
            <div className="space-y-3">
              <h2 className="text-sm font-medium">Pending invitations</h2>
              {view.invitations.map((invite) => (
                <Card key={invite.invitationId}>
                  <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-medium">{invite.email}</p>
                      <p className="text-sm text-muted-foreground">
                        {ROLE_LABELS[invite.role]} · pending
                      </p>
                    </div>
                    {view.canInvite ? (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busyId === invite.invitationId}
                        onClick={() => void onCancelInvite(invite.invitationId)}
                      >
                        Cancel invite
                      </Button>
                    ) : null}
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : null}

          {view.canInvite ? (
            <Card>
              <CardHeader>
                <CardTitle>Invite someone</CardTitle>
                <CardDescription>{SEAT_ADD_DISCLOSURE}</CardDescription>
              </CardHeader>
              <form action={inviteFormAction}>
                <CardContent className="space-y-4">
                  {inviteState.error ? (
                    <p
                      role="alert"
                      className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive"
                    >
                      {inviteState.error}
                    </p>
                  ) : null}
                  {inviteState.success ? (
                    <p
                      role="status"
                      className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-sm"
                    >
                      {inviteState.warning ?? "Invitation sent."}
                    </p>
                  ) : null}
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      required
                      className="h-11"
                      placeholder="name@company.co.nz"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="role">Role</Label>
                    <select
                      id="role"
                      name="role"
                      defaultValue="estimator"
                      className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
                    >
                      {roles.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label} — {option.description}
                        </option>
                      ))}
                    </select>
                  </div>
                </CardContent>
                <CardFooter>
                  <Button type="submit" className="h-11" disabled={invitePending}>
                    {invitePending ? "Sending…" : "Send invitation"}
                  </Button>
                </CardFooter>
              </form>
            </Card>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
