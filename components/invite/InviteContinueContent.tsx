"use client";

import Link from "next/link";
import { useActionState } from "react";
import { acceptPendingInvitationForCurrentUser } from "@/lib/team/actions";
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
    const warning = state.warning;
    const queued = warning === SEAT_QUEUED_MESSAGE;
    const label = !warning
      ? "Opening your workspace…"
      : queued
        ? "Your seat is being activated"
        : "Payment needs to finish";
    return (
      <AuthContinue
        continueTo={state.continueTo}
        label={label}
        supporting={warning && !queued ? warning : undefined}
      />
    );
  }

  if (!props.signedIn) {
    return (
      <AuthCard>
        <AuthCardHeader
          title="Sign in to continue"
          description="Open the invitation email and sign in with the invited address."
        />
        <AuthCardFooter>
          <Button
            render={<Link href="/login?next=/invite/continue" />}
            className="h-11 w-full"
          >
            Sign in
          </Button>
        </AuthCardFooter>
      </AuthCard>
    );
  }

  if (props.kind === "multiple") {
    return (
      <AuthCard>
        <AuthCardHeader
          title="Open the invitation email"
          description="More than one invitation is waiting for this email. Use the link in the email for the company you want to join."
        />
      </AuthCard>
    );
  }

  if (props.kind === "none" || !props.view) {
    return (
      <AuthCard>
        <AuthCardHeader
          title="No invitation found"
          description="If you meant to create your own company, finish account setup. If you were invited, use the link from your email."
        />
        <AuthCardFooter>
          <Button
            render={<Link href="/app/setup-required" />}
            className="h-11 w-full"
          >
            Finish account setup
          </Button>
        </AuthCardFooter>
      </AuthCard>
    );
  }

  if (props.view.status === "accepting" || state.warning) {
    const queued =
      state.warning === SEAT_QUEUED_MESSAGE ||
      props.view.waitKind === "queued";
    return (
      <AuthCard>
        <AuthCardHeader
          title={
            queued
              ? "Your seat is being activated"
              : "Your seat is not active yet"
          }
          description={
            state.warning ||
            (queued
              ? SEAT_QUEUED_MESSAGE
              : "Your seat couldn't be activated because the account payment needs attention. You cannot open this company until payment succeeds.")
          }
        />
        <AuthCardContent>
          {state.error ? (
            <p
              role="alert"
              className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {state.error}
            </p>
          ) : null}
        </AuthCardContent>
        <form action={formAction}>
          <AuthCardFooter>
            <AuthSubmitButton
              pending={pending}
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
        title={`Join ${props.view.organisationName}`}
        description={`You were invited as ${ROLE_LABELS[props.view.role]}.`}
      />
      <AuthCardContent>
        {state.error ? (
          <p
            role="alert"
            className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {state.error}
          </p>
        ) : null}
      </AuthCardContent>
      <form action={formAction}>
        <AuthCardFooter>
          <AuthSubmitButton
            pending={pending}
            idle="Join company"
            pendingLabel="Joining…"
          />
        </AuthCardFooter>
      </form>
    </AuthCard>
  );
}
