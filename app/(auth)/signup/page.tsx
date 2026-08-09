"use client";

import Link from "next/link";
import { useActionState } from "react";
import {
  resendSignupConfirmation,
  type RecoveryActionState,
} from "@/lib/auth/recovery-actions";
import { signup, type AuthActionState } from "@/app/(auth)/actions";
import { AuthContinue } from "@/components/auth/AuthContinue";
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
    <Card>
      <CardHeader className="pb-4 sm:pb-6">
        <CardTitle className="text-xl">Check your email</CardTitle>
        <CardDescription>
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
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          After you confirm, you&apos;ll be signed in. If company setup is still
          needed, we&apos;ll ask you to finish it once.
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
          <form action={resendAction} className="space-y-3">
            <input type="hidden" name="email" value={email} />
            <Button
              type="submit"
              variant="outline"
              className="h-11 w-full"
              disabled={resendPending}
            >
              {resendPending ? "Sending…" : "Resend confirmation email"}
            </Button>
          </form>
        ) : null}
      </CardContent>
      <CardFooter className="flex flex-col gap-3">
        <Button render={<Link href="/login" />} className="h-11 w-full">
          Return to login
        </Button>
      </CardFooter>
    </Card>
  );
}

export default function SignupPage() {
  const [state, formAction, pending] = useActionState(signup, initialState);

  if (state.confirmationPending) {
    return <ConfirmationPending email={state.confirmationEmail} />;
  }

  if (state.continueTo) {
    return (
      <Card>
        <CardHeader className="pb-4 sm:pb-6">
          <CardTitle className="text-xl">Account created</CardTitle>
          <CardDescription>
            Taking you to company basics to finish getting started.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AuthContinue
            continueTo={state.continueTo}
            label="Opening company basics…"
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-4 sm:pb-6">
        <CardTitle className="text-xl">Create your Quotr account</CardTitle>
        <CardDescription>
          Set up your organisation and start building structured estimates.
        </CardDescription>
      </CardHeader>
      <form action={formAction} className="flex flex-col gap-(--card-spacing)">
        <CardContent className="space-y-4">
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

          <div className="space-y-2">
            <Label htmlFor="organisation_name">Organisation / company</Label>
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
            />
            <FieldError messages={state.fieldErrors?.email} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              placeholder="At least 8 characters"
              minLength={8}
              required
              className="h-11"
            />
            <FieldError messages={state.fieldErrors?.password} />
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-4">
          <Button type="submit" className="h-11 w-full" disabled={pending}>
            {pending ? "Creating account…" : "Create account"}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link
              href="/login"
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              Sign in
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}
