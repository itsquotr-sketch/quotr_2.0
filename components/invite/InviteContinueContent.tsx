"use client";

import Link from "next/link";
import { useActionState } from "react";
import { acceptPendingInvitationForCurrentUser } from "@/lib/team/actions";
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
import type { PublicInvitationView } from "@/lib/team/public-invite";
import { ROLE_LABELS } from "@/lib/team/roles";

type State = { error?: string; continueTo?: string; warning?: string };

async function acceptAction(): Promise<State> {
  const result = await acceptPendingInvitationForCurrentUser();
  if (result.error) return { error: result.error };
  if (result.warning) {
    return { warning: result.warning };
  }
  return { continueTo: "/app/dashboard" };
}

export function InviteContinueContent(props: {
  kind: "none" | "one" | "multiple";
  view: PublicInvitationView | null;
  signedIn: boolean;
}) {
  const [state, formAction, pending] = useActionState(acceptAction, {});

  if (state.continueTo) {
    const waiting = Boolean(state.warning);
    const queued = state.warning === SEAT_QUEUED_MESSAGE;
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
            {state.warning || "Taking you to Quotr."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AuthContinue
            continueTo={state.continueTo}
            label={waiting ? "Opening invitation status…" : "Opening Quotr…"}
          />
        </CardContent>
      </Card>
    );
  }

  if (!props.signedIn) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Sign in to continue</CardTitle>
          <CardDescription>
            Open the invitation email and sign in with the invited address.
          </CardDescription>
        </CardHeader>
        <CardFooter>
          <Button render={<Link href="/login?next=/invite/continue" />} className="w-full">
            Sign in
          </Button>
        </CardFooter>
      </Card>
    );
  }

  if (props.kind === "multiple") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Open the invitation email</CardTitle>
          <CardDescription>
            More than one invitation is waiting for this email. Use the link in
            the email for the company you want to join.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (props.kind === "none" || !props.view) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No invitation found</CardTitle>
          <CardDescription>
            If you meant to create your own company, finish account setup.
            If you were invited, use the link from your email.
          </CardDescription>
        </CardHeader>
        <CardFooter className="flex flex-col gap-2">
          <Button render={<Link href="/app/setup-required" />} className="w-full">
            Finish account setup
          </Button>
        </CardFooter>
      </Card>
    );
  }

  if (props.view.status === "accepting" || state.warning) {
    const queued =
      state.warning === SEAT_QUEUED_MESSAGE ||
      props.view.waitKind === "queued";
    return (
      <Card>
        <CardHeader>
          <CardTitle>
            {queued
              ? "Your seat is being activated"
              : "Your seat is not active yet"}
          </CardTitle>
          <CardDescription>
            {state.warning ||
              (queued
                ? SEAT_QUEUED_MESSAGE
                : "Your seat couldn't be activated because the account payment needs attention. You cannot open this company until payment succeeds.")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {state.error ? (
            <p
              role="alert"
              className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {state.error}
            </p>
          ) : null}
        </CardContent>
        <CardFooter>
          <form action={formAction} className="w-full">
            <Button type="submit" className="h-11 w-full" disabled={pending}>
              {pending ? "Checking…" : "Try again"}
            </Button>
          </form>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Join {props.view.organisationName}</CardTitle>
        <CardDescription>
          You were invited as {ROLE_LABELS[props.view.role]}. Additional people
          on Business cost $35 + GST/month once you join.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {state.error ? (
          <p
            role="alert"
            className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {state.error}
          </p>
        ) : null}
      </CardContent>
      <CardFooter>
        <form action={formAction} className="w-full">
          <Button type="submit" className="h-11 w-full" disabled={pending}>
            {pending ? "Joining…" : "Join company"}
          </Button>
        </form>
      </CardFooter>
    </Card>
  );
}
