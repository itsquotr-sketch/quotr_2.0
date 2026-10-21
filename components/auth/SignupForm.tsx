"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { signup, type AuthActionState } from "@/app/(auth)/actions";
import {
  resendSignupConfirmation,
  type RecoveryActionState,
} from "@/lib/auth/recovery-actions";
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
import { AccountPhoneField } from "@/components/auth/AccountPhoneField";
import { Button } from "@/components/ui/button";
import { HelpPopover } from "@/components/ui/help-popover";
import { confirmationHelpMessage } from "@/lib/auth/confirmation-link";
import {
  MARKETING_CHOICE_REQUIRED,
  PRIVACY_POLICY_URL,
  TERMS_ACCEPTANCE_REQUIRED,
  TERMS_OF_USE_URL,
} from "@/lib/auth/signup-choices";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: AuthActionState = {};
const resendInitial: RecoveryActionState = {};

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages?.length) return null;
  return <p className="text-sm text-destructive" role="alert">{messages[0]}</p>;
}

function ConfirmationEmail({
  mode,
  email,
  reason = "invalid",
}: {
  mode: "pending" | "link";
  email?: string;
  reason?: "invalid" | "session";
}) {
  const [resendState, resendAction, resendPending] = useActionState(
    resendSignupConfirmation,
    resendInitial
  );
  const resendLock = useRef(false);
  const retained = email?.trim() ?? "";
  const [editing, setEditing] = useState(!retained);

  useEffect(() => {
    if (!resendPending) resendLock.current = false;
  }, [resendPending]);

  const title = mode === "pending" ? "Check your email" : "Confirm your email";
  const description =
    mode === "pending" ? (
      <>
        We&apos;ve sent a confirmation link
        {retained ? (
          <>
            {" "}
            to <span className="font-medium text-foreground">{retained}</span>
          </>
        ) : (
          " to your email address"
        )}
        . Open the link to finish creating your Quotr account.
      </>
    ) : (
      confirmationHelpMessage(reason)
    );

  return (
    <AuthCard>
      <AuthCardHeader title={title} description={description} />
      <AuthCardContent>
        {mode === "pending" ? (
          <p className="text-sm text-muted-foreground">
            After you confirm, you&apos;ll be signed in. If you were invited to a
            company, we&apos;ll take you back to the invitation.
          </p>
        ) : null}
        {resendState.error ? (
          <p
            role="alert"
            className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {resendState.error}
          </p>
        ) : null}
        {resendState.fieldErrors?.email?.[0] ? (
          <p role="alert" className="text-sm text-destructive">
            {resendState.fieldErrors.email[0]}
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
        <form
          action={(formData) => {
            if (resendPending || resendLock.current) return;
            resendLock.current = true;
            resendAction(formData);
          }}
          className="flex flex-col gap-3"
        >
          {retained && !editing ? (
            <input type="hidden" name="email" value={retained} />
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor="resend-email">Email</Label>
              <Input
                id="resend-email"
                name="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                required
                defaultValue={retained || undefined}
                className="h-11"
              />
            </div>
          )}
          <AuthSubmitButton
            pending={resendPending}
            idle="Resend confirmation email"
            pendingLabel="Sending…"
          />
        </form>
        <div className="flex flex-col gap-2">
          {retained && !editing ? (
            <Button
              type="button"
              variant="outline"
              className="h-11 w-full"
              onClick={() => setEditing(true)}
            >
              Change email
            </Button>
          ) : null}
          <Button
            render={<Link href="/login" />}
            variant="outline"
            className="h-11 w-full"
          >
            Return to login
          </Button>
        </div>
      </AuthCardContent>
    </AuthCard>
  );
}

export function SignupForm(props: {
  inviteToken: string;
  invitedEmail: string;
  confirmRequired?: boolean;
  confirmLink?: boolean;
  linkReason?: "invalid" | "session";
  pendingEmail?: string;
}) {
  const inviteToken = props.inviteToken;
  const invitedEmail = props.invitedEmail;
  const [state, formAction, pending] = useActionState(signup, initialState);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [productUpdates, setProductUpdates] = useState<boolean | null>(null);
  const [choiceErrors, setChoiceErrors] = useState<Record<string, string[]>>({});
  const retainedEmail =
    state.confirmationEmail || invitedEmail || props.pendingEmail || undefined;

  if (props.confirmLink && !state.confirmationPending) {
    return (
      <ConfirmationEmail
        mode="link"
        email={retainedEmail}
        reason={props.linkReason}
      />
    );
  }

  if (state.confirmationPending || props.confirmRequired) {
    return <ConfirmationEmail mode="pending" email={retainedEmail} />;
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
      <form
        action={formAction}
        className="flex flex-col gap-(--card-spacing)"
        onSubmit={(event) => {
          const next: Record<string, string[]> = {};
          if (!termsAccepted) next.terms_accepted = [TERMS_ACCEPTANCE_REQUIRED];
          if (productUpdates === null) {
            next.marketing_consent = [MARKETING_CHOICE_REQUIRED];
          }
          setChoiceErrors(next);
          if (Object.keys(next).length > 0) event.preventDefault();
        }}
      >
        {inviteToken ? (
          <input type="hidden" name="invite_token" value={inviteToken} />
        ) : null}
        <AuthCardContent>
          {state.phoneAlreadyLinked ? (
            <p
              role="alert"
              className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              This phone number is already linked to an account.{" "}
              <Link
                href={
                  inviteToken
                    ? `/login?next=/invite/${inviteToken}`
                    : "/login"
                }
                className={authTextLinkClass}
              >
                Sign in
              </Link>
              {" or use a different number. "}
              <Link href="/forgot-password" className={authTextLinkClass}>
                Account recovery
              </Link>
            </p>
          ) : state.error ? (
            <p
              role="alert"
              className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {state.error}
            </p>
          ) : null}

          <div className="space-y-1.5">
            <Label className="text-xs" htmlFor="full_name">Full name</Label>
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
            <div className="space-y-1.5">
              <Label className="text-xs" htmlFor="organisation_name">Company name</Label>
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

          <div className="space-y-1.5">
            <Label className="text-xs" htmlFor="email">Email</Label>
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

          <AccountPhoneField
            help
            error={
              state.fieldErrors?.phone_number?.[0] ??
              state.fieldErrors?.phone_country?.[0]
            }
          />

          <div className="space-y-1.5">
            <Label className="text-xs" htmlFor="password">Password</Label>
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

          <input
            type="hidden"
            name="terms_accepted"
            value={termsAccepted ? "true" : "false"}
          />
          <input
            type="hidden"
            name="marketing_consent"
            value={
              productUpdates === true ? "yes" : productUpdates === false ? "no" : ""
            }
          />

          <div className="space-y-2">
            <label className="flex min-h-11 items-start gap-3 text-sm leading-snug">
              <input
                type="checkbox"
                name="terms_choice"
                checked={termsAccepted}
                onChange={(event) => {
                  setTermsAccepted(event.target.checked);
                  setChoiceErrors((current) => {
                    const next = { ...current };
                    delete next.terms_accepted;
                    return next;
                  });
                }}
                className="mt-0.5 size-4 shrink-0"
              />
              <span>
                I agree to the{" "}
                <a
                  href={TERMS_OF_USE_URL}
                  target="_blank"
                  rel="noreferrer"
                  className={authTextLinkClass}
                >
                  Application Terms
                </a>
                .
              </span>
            </label>
            <p className="text-sm text-muted-foreground">
              <a
                href={PRIVACY_POLICY_URL}
                target="_blank"
                rel="noreferrer"
                className={authTextLinkClass}
              >
                Privacy Notice
              </a>
            </p>
            <FieldError
              messages={
                choiceErrors.terms_accepted ?? state.fieldErrors?.terms_accepted
              }
            />
          </div>

          <fieldset className="space-y-2">
            <legend className="flex items-start gap-1.5 text-sm leading-snug">
              <span>Would you like occasional product updates and practical Quotr tips?</span>
              <HelpPopover label="Product updates help">
                <p>You can unsubscribe anytime.</p>
                <p>
                  Account, security, and service emails are separate. Quotr still
                  sends those, including confirmation and password reset.
                </p>
              </HelpPopover>
            </legend>
            <label className="flex min-h-11 items-center gap-3 text-sm">
              <input
                type="radio"
                name="product_updates"
                checked={productUpdates === true}
                onChange={() => {
                  setProductUpdates(true);
                  setChoiceErrors((current) => {
                    const next = { ...current };
                    delete next.marketing_consent;
                    return next;
                  });
                }}
                className="size-4 shrink-0"
              />
              Yes, send me updates
            </label>
            <label className="flex min-h-11 items-center gap-3 text-sm">
              <input
                type="radio"
                name="product_updates"
                checked={productUpdates === false}
                onChange={() => {
                  setProductUpdates(false);
                  setChoiceErrors((current) => {
                    const next = { ...current };
                    delete next.marketing_consent;
                    return next;
                  });
                }}
                className="size-4 shrink-0"
              />
              No thanks
            </label>
            <FieldError
              messages={
                choiceErrors.marketing_consent ??
                state.fieldErrors?.marketing_consent
              }
            />
          </fieldset>
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
