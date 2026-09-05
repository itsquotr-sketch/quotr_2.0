"use client";

import Link from "next/link";
import { useActionState } from "react";
import { acceptInvitation, retryOwnSeatActivation } from "@/lib/team/actions";
import { ROLE_LABELS, type MembershipRole } from "@/lib/team/roles";
import type { PublicInvitationView } from "@/lib/team/public-invite";
import { SEAT_QUEUED_MESSAGE } from "@/lib/team/seat-queue";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AuthContinue } from "@/components/auth/AuthContinue";

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
    const waiting = Boolean(state.warning || retryState.warning);
    const queued =
      (state.warning ?? retryState.warning) === SEAT_QUEUED_MESSAGE;
    return (
      <Card>
        <CardHeader>
          <CardTitle>
            {queued
              ? "Your seat is being activated"
              : waiting
                ? "Payment needs to finish"
                : "You're in"}
          </CardTitle>
          <CardDescription>
            {state.warning ||
              retryState.warning ||
              "Taking you to Quotr."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AuthContinue
            continueTo={state.continueTo ?? retryState.continueTo ?? "/app/dashboard"}
            label={waiting ? "Opening invitation status…" : "Opening Quotr…"}
          />
        </CardContent>
      </Card>
    );
  }

  if (!props.invitation) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Invitation not found</CardTitle>
          <CardDescription>
            This link is invalid, expired, or has already been used.
          </CardDescription>
        </CardHeader>
        <CardFooter>
          <Button render={<Link href="/login" />} className="w-full">
            Go to login
          </Button>
        </CardFooter>
      </Card>
    );
  }

  const roleLabel =
    ROLE_LABELS[props.invitation.role as MembershipRole] ?? props.invitation.role;
  const expired =
    props.invitation.expired || props.invitation.status === "expired";

  if (props.invitation.status === "accepted") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>
            You&apos;re already in {props.invitation.organisationName}
          </CardTitle>
          <CardDescription>
            This invitation has already been accepted.
          </CardDescription>
        </CardHeader>
        <CardFooter>
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
        </CardFooter>
      </Card>
    );
  }

  if (expired && props.invitation.status !== "accepting") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>This invitation has expired</CardTitle>
          <CardDescription>
            Ask the Owner of {props.invitation.organisationName} to send a new
            invitation.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (!props.signedIn) {
    const next = `/invite/${props.token}`;
    return (
      <Card>
        <CardHeader>
          <CardTitle>Join {props.invitation.organisationName}</CardTitle>
          <CardDescription>
            {props.invitation.inviterName} invited you as {roleLabel}. Sign in
            or create an account with {props.invitation.emailDisplay} to join.
          </CardDescription>
        </CardHeader>
        <CardFooter className="flex flex-col gap-2">
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
        </CardFooter>
      </Card>
    );
  }

  if (props.invitation.status === "accepting") {
    const queued = props.invitation.waitKind === "queued";
    return (
      <Card>
        <CardHeader>
          <CardTitle>
            {queued
              ? "Your seat is being activated"
              : "Your seat is not active yet"}
          </CardTitle>
          <CardDescription>
            {queued
              ? SEAT_QUEUED_MESSAGE
              : "Your seat couldn't be activated because the account payment needs attention. You cannot open this company until payment succeeds."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {retryState.error || state.error ? (
            <p
              role="alert"
              className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {retryState.error ?? state.error}
            </p>
          ) : null}
        </CardContent>
        <CardFooter>
          <form action={retryFormAction} className="w-full">
            <Button
              type="submit"
              className="h-11 w-full"
              disabled={retryPending}
            >
              {retryPending ? "Checking…" : "Try again"}
            </Button>
          </form>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Join {props.invitation.organisationName}</CardTitle>
        <CardDescription>
          You were invited as {roleLabel}.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
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
      </CardContent>
      <CardFooter className="flex flex-col gap-2">
        <form action={formAction} className="w-full">
          <input type="hidden" name="token" value={props.token} />
          <Button type="submit" className="h-11 w-full" disabled={pending}>
            {pending ? "Joining…" : "Join company"}
          </Button>
        </form>
        {state.error?.includes("payment") ? (
          <form action={retryFormAction} className="w-full">
            <Button
              type="submit"
              variant="outline"
              className="h-11 w-full"
              disabled={retryPending}
            >
              {retryPending ? "Checking…" : "Try again"}
            </Button>
          </form>
        ) : null}
      </CardFooter>
    </Card>
  );
}
