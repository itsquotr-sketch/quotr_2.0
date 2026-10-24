"use client";

import Link from "next/link";
import { Suspense, useActionState } from "react";
import { useSearchParams } from "next/navigation";
import {
  requestPasswordReset,
  type RecoveryActionState,
} from "@/lib/auth/recovery-actions";
import {
  AuthCard,
  AuthCardContent,
  AuthCardFooter,
  AuthCardHeader,
  authTextLinkClass,
} from "@/components/auth/AuthCard";
import { AuthSubmitButton } from "@/components/auth/AuthSubmitButton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { retainedAuthEmail } from "@/lib/auth/signup-existing-account";

const initialState: RecoveryActionState = {};

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages?.length) return null;
  return <p className="text-sm text-destructive" role="alert">{messages[0]}</p>;
}

function ForgotPasswordForm() {
  const searchParams = useSearchParams();
  const retainedEmail = retainedAuthEmail(searchParams.get("email"));
  const [state, formAction, pending] = useActionState(
    requestPasswordReset,
    initialState
  );

  return (
    <AuthCard>
      <AuthCardHeader
        title="Forgot password"
        description="Enter your email and we'll send password reset instructions if an account exists."
      />
      <form action={formAction} className="flex flex-col gap-(--card-spacing)">
        <AuthCardContent>
          {state.error ? (
            <p
              role="alert"
              className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {state.error}
            </p>
          ) : null}
          {state.success ? (
            <p
              role="status"
              className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-800 dark:text-emerald-200"
            >
              {state.success}
            </p>
          ) : null}

          <div className="space-y-1.5">
            <Label className="text-xs" htmlFor="email">Email address</Label>
            <Input
              id="email"
              name="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="you@company.com"
              required
              defaultValue={retainedEmail}
              className="h-11"
              disabled={pending}
            />
            <FieldError messages={state.fieldErrors?.email} />
          </div>
        </AuthCardContent>
        <AuthCardFooter>
          <AuthSubmitButton
            pending={pending}
            idle="Send reset link"
            pendingLabel="Sending…"
          />
          <p className="text-center text-sm text-muted-foreground">
            <Link
              href={
                retainedEmail
                  ? `/login?email=${encodeURIComponent(retainedEmail)}`
                  : "/login"
              }
              className={authTextLinkClass}
            >
              Back to login
            </Link>
          </p>
        </AuthCardFooter>
      </form>
    </AuthCard>
  );
}

export default function ForgotPasswordPage() {
  return (
    <Suspense
      fallback={
        <AuthCard>
          <div className="min-h-48" />
        </AuthCard>
      }
    >
      <ForgotPasswordForm />
    </Suspense>
  );
}
