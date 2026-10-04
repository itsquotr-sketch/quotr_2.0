"use client";

import Link from "next/link";
import { useActionState } from "react";
import { acceptInvitation, retryOwnSeatActivation } from "@/lib/team/actions";
import { ROLE_LABELS, type MembershipRole } from "@/lib/team/roles";
import type { PublicInvitationView } from "@/lib/team/public-invite";
import { SEAT_QUEUED_MESSAGE } from "@/lib/team/seat-queue";
import {
  AuthCard,
  AuthCardContent,
  AuthCardFooter,
  AuthCardHeader,
} from "@/components/auth/AuthCard";
import { AuthContinue } from "@/components/auth/AuthContinue";
import { AuthSubmitButton } from "@/components/auth/AuthSubmitButton";
import { Button } from "@/components/ui/button";

type InviteAcceptState = {
  error?: string;
  continueTo?: string;
  warning?: string;
};

const initial: InviteAcceptState = {};

async function acceptAction(
  _prev: InviteAcceptState,
  formData: FormData
): Promise<InviteAcceptState> {
  const token = String(formData.get("token") ?? "");
  const result = await acceptInvitation(token);
  if (result.error) return { error: result.error };
  if (result.warning) {
    return { continueTo: "/invite/continue", warning: result.warning };
  }
  return { continueTo: "/app/dashboard" };
}

async function retryAction(): Promise<InviteAcceptState> {
  const result = await retryOwnSeatActivation();
  if (result.error) return { error: result.error };
  if (result.warning) {
    return { continueTo: "/invite/continue", warning: result.warning };
  }
  return { continueTo: "/app/dashboard" };
}

export function InviteAcceptContent(props: {
  token: string;
  invitation: PublicInvitationView | null;
  signedIn: boolean;
  signedInEmail?: string;
}) {
  const [state, formAction, pending] = useActionState(acceptAction, initial);
  const [retryState, retryFormAction, retryPending] = useActionState(
    retryAction,
    initial
  );

  if (state.continueTo || retryState.continueTo) {
    const warning = state.warning || retryState.warning;
    const queued = warning === SEAT_QUEUED_MESSAGE;
    const label = !warning
      ? "Opening your workspace…"
      : queued
        ? "Your seat is being activated"
        : "Payment needs to finish";
    return (
      <AuthContinue
        continueTo={state.continueTo ?? retryState.continueTo ?? "/app/dashboard"}
        label={label}
        supporting={warning && !queued ? warning : undefined}
      />
    );
  }

  if (!props.invitation) {
    return (
      <AuthCard>
        <AuthCardHeader
          title="Invitation not found"
          description="This link is invalid, expired, or has already been used."
        />
        <AuthCardFooter>
          <Button render={<Link href="/login" />} className="h-11 w-full">
            Go to login
          </Button>
        </AuthCardFooter>
      </AuthCard>
    );
  }

  const roleLabel =
    ROLE_LABELS[props.invitation.role as MembershipRole] ?? props.invitation.role;
  const expired =
    props.invitation.expired || props.invitation.status === "expired";

  if (props.invitation.status === "accepted") {
    return (
      <AuthCard>
        <AuthCardHeader
          title={`You're already in ${props.invitation.organisationName}`}
          description="This invitation has already been accepted."
        />
        <AuthCardFooter>
          <Button
            render={
              <Link
                href={
                  props.signedIn
                    ? "/app/dashboard"
                    : `/login?next=${encodeURIComponent(`/invite/${props.token}`)}`
                }
              />
            }
            className="h-11 w-full"
          >
            {props.signedIn ? "Open Quotr" : "Sign in"}
          </Button>
        </AuthCardFooter>
      </AuthCard>
    );
  }

  if (expired && props.invitation.status !== "accepting") {
    return (
      <AuthCard>
        <AuthCardHeader
          title="This invitation has expired"
          description={`Ask the Owner of ${props.invitation.organisationName} to send a new invitation.`}
        />
      </AuthCard>
    );
  }

  if (!props.signedIn) {
    const next = `/invite/${props.token}`;
    return (
      <AuthCard>
        <AuthCardHeader
          title={`Join ${props.invitation.organisationName}`}
          description={`${props.invitation.inviterName} invited you as ${roleLabel}. Sign in or create an account with ${props.invitation.emailDisplay} to join.`}
        />
        <AuthCardFooter className="gap-2">
          <Button
            render={<Link href={`/login?next=${encodeURIComponent(next)}`} />}
            className="h-11 w-full"
          >
            Sign in
          </Button>
          <Button
            variant="outline"
            render={<Link href={`/signup?invite=${encodeURIComponent(props.token)}`} />}
            className="h-11 w-full"
          >
            Create account
          </Button>
        </AuthCardFooter>
      </AuthCard>
    );
  }

  if (props.invitation.status === "accepting") {
    const queued = props.invitation.waitKind === "queued";
    return (
      <AuthCard>
        <AuthCardHeader
          title={
            queued
              ? "Your seat is being activated"
              : "Your seat is not active yet"
          }
          description={
            queued
              ? SEAT_QUEUED_MESSAGE
              : "Your seat couldn't be activated because the account payment needs attention. You cannot open this company until payment succeeds."
          }
        />
        <AuthCardContent>
          {retryState.error || state.error ? (
            <p
              role="alert"
              className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {retryState.error ?? state.error}
            </p>
          ) : null}
        </AuthCardContent>
        <form action={retryFormAction}>
          <AuthCardFooter>
            <AuthSubmitButton
              pending={retryPending}
              idle="Try again"
              pendingLabel="Checking…"
            />
          </AuthCardFooter>
        </form>
      </AuthCard>
    );
  }

  return (
    <AuthCard>
      <AuthCardHeader
        title={`Join ${props.invitation.organisationName}`}
        description={<>You were invited as {roleLabel}.</>}
      />
      <AuthCardContent>
        {state.error || retryState.error ? (
          <p
            role="alert"
            className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {state.error ?? retryState.error}
          </p>
        ) : null}
        {props.signedInEmail ? (
          <p className="text-sm text-muted-foreground">
            Signed in as {props.signedInEmail}
          </p>
        ) : null}
      </AuthCardContent>
      <AuthCardFooter className="gap-2">
        <form action={formAction} className="w-full">
          <input type="hidden" name="token" value={props.token} />
          <AuthSubmitButton
            pending={pending}
            idle="Join company"
            pendingLabel="Joining…"
          />
        </form>
        {state.error?.includes("payment") ? (
          <form action={retryFormAction} className="w-full">
            <AuthSubmitButton
              pending={retryPending}
              idle="Try again"
              pendingLabel="Checking…"
              variant="outline"
            />
          </form>
        ) : null}
      </AuthCardFooter>
    </AuthCard>
  );
}
