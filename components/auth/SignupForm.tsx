"use client";

import Link from "next/link";
import { useActionState } from "react";
import {
  resendSignupConfirmation,
  type RecoveryActionState,
} from "@/lib/auth/recovery-actions";
import { signup, type AuthActionState } from "@/app/(auth)/actions";
import {
  AuthCard,
  AuthCardContent,
  AuthCardFooter,
  AuthCardHeader,
  authTextLinkClass,
} from "@/components/auth/AuthCard";
import { AuthContinue } from "@/components/auth/AuthContinue";
import { AuthSubmitButton } from "@/components/auth/AuthSubmitButton";
import { PasswordField } from "@/components/auth/PasswordField";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: AuthActionState = {};
const resendInitial: RecoveryActionState = {};

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages?.length) return null;
  return <p className="text-sm text-destructive">{messages[0]}</p>;
}

function ConfirmationPending({ email }: { email?: string }) {
  const [resendState, resendAction, resendPending] = useActionState(
    resendSignupConfirmation,
    resendInitial
  );

  return (
    <AuthCard>
      <AuthCardHeader
        title="Check your email"
        description={
          <>
            We&apos;ve sent a confirmation link
            {email ? (
              <>
                {" "}
                to <span className="font-medium text-foreground">{email}</span>
              </>
            ) : (
              " to your email address"
            )}
            . Open the link to finish creating your Quotr account.
          </>
        }
      />
      <AuthCardContent>
        <p className="text-sm text-muted-foreground">
          After you confirm, you&apos;ll be signed in. If you were invited to a
          company, we&apos;ll take you back to the invitation.
        </p>
        {resendState.error ? (
          <p
            role="alert"
            className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {resendState.error}
          </p>
        ) : null}
        {resendState.success ? (
          <p
            role="status"
            className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-800 dark:text-emerald-200"
          >
            {resendState.success}
          </p>
        ) : null}
        {email ? (
          <form action={resendAction}>
            <input type="hidden" name="email" value={email} />
            <AuthSubmitButton
              pending={resendPending}
              idle="Resend confirmation email"
              pendingLabel="Sending…"
              variant="outline"
            />
          </form>
        ) : null}
      </AuthCardContent>
      <AuthCardFooter>
        <Button render={<Link href="/login" />} className="h-11 w-full">
          Return to login
        </Button>
      </AuthCardFooter>
    </AuthCard>
  );
}

export function SignupForm(props: {
  inviteToken: string;
  invitedEmail: string;
}) {
  const inviteToken = props.inviteToken;
  const invitedEmail = props.invitedEmail;
  const [state, formAction, pending] = useActionState(signup, initialState);

  if (state.confirmationPending) {
    return (
      <ConfirmationPending email={state.confirmationEmail ?? invitedEmail} />
    );
  }

  if (state.continueTo) {
    return (
      <AuthContinue
        continueTo={state.continueTo}
        label="Preparing your account…"
      />
    );
  }

  if (inviteToken && !invitedEmail) {
    return (
      <AuthCard>
        <AuthCardHeader
          title="Invitation not found"
          description="This invitation link is invalid, expired, or has already been used."
        />
        <AuthCardFooter>
          <Button render={<Link href="/signup" />} className="h-11 w-full">
            Create your own company
          </Button>
        </AuthCardFooter>
      </AuthCard>
    );
  }

  return (
    <AuthCard>
      <AuthCardHeader
        title={
          inviteToken ? "Join this Quotr company" : "Create your Quotr account"
        }
        description={
          inviteToken
            ? "Create your login. You will join the company that invited you — we will not create a second company."
            : "Set up your company and start your first job."
        }
      />
      <form action={formAction} className="flex flex-col gap-(--card-spacing)">
        {inviteToken ? (
          <input type="hidden" name="invite_token" value={inviteToken} />
        ) : null}
        <AuthCardContent>
          {state.error ? (
            <p
              role="alert"
              className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {state.error}
            </p>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="full_name">Full name</Label>
            <Input
              id="full_name"
              name="full_name"
              autoComplete="name"
              placeholder="Alex Smith"
              required
              className="h-11"
            />
            <FieldError messages={state.fieldErrors?.full_name} />
          </div>

          {inviteToken ? null : (
            <div className="space-y-2">
              <Label htmlFor="organisation_name">Company name</Label>
              <Input
                id="organisation_name"
                name="organisation_name"
                autoComplete="organization"
                placeholder="Smith Building Co."
                required
                className="h-11"
              />
              <FieldError messages={state.fieldErrors?.organisation_name} />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="you@company.com"
              required
              className="h-11"
              defaultValue={invitedEmail || undefined}
              readOnly={Boolean(invitedEmail)}
              aria-readonly={Boolean(invitedEmail)}
            />
            {invitedEmail ? (
              <p className="text-sm text-muted-foreground">
                This invitation was sent to this email address.
              </p>
            ) : null}
            <FieldError messages={state.fieldErrors?.email} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <PasswordField
              id="password"
              name="password"
              autoComplete="new-password"
              placeholder="At least 8 characters"
              minLength={8}
              required
            />
            <FieldError messages={state.fieldErrors?.password} />
          </div>
        </AuthCardContent>
        <AuthCardFooter>
          <AuthSubmitButton
            pending={pending}
            idle={inviteToken ? "Create account and join" : "Create account"}
            pendingLabel="Creating account…"
          />
          <p className="text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link
              href={inviteToken ? `/login?next=/invite/${inviteToken}` : "/login"}
              className={authTextLinkClass}
            >
              Sign in
            </Link>
          </p>
        </AuthCardFooter>
      </form>
    </AuthCard>
  );
}
