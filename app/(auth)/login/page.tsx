"use client";

import Link from "next/link";
import { Suspense, useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { login, type AuthActionState } from "@/app/(auth)/actions";
import { loginConfirmationPresentation } from "@/lib/auth/confirmation-link";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AUTH_USER_MESSAGES } from "@/lib/auth/errors";
import { getSafeInternalPath } from "@/lib/auth/safe-redirect";
import { PLAY_SURFACE_BILLING_NOTE } from "@/lib/android/play-surface";
import { usePlaySurface } from "@/components/android/PlaySurfaceProvider";
import { LegalDocumentLinks } from "@/components/legal/LegalDocumentLinks";

const initialState: AuthActionState = {};

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages?.length) return null;
  return <p className="text-sm text-destructive" role="alert">{messages[0]}</p>;
}

function LoginForm() {
  const searchParams = useSearchParams();
  const next = getSafeInternalPath(searchParams.get("next"));
  const linkError = searchParams.get("error");
  const [state, formAction, pending] = useActionState(login, initialState);

  const playSurface = usePlaySurface();
  const confirmation = loginConfirmationPresentation(linkError);
  const bannerError =
    state.error ??
    (confirmation.tone === "error" ? confirmation.message : null) ??
    (linkError === "reset_invalid"
      ? AUTH_USER_MESSAGES.RESET_LINK_INVALID
      : null);
  const alreadyConfirmed =
    !state.error && confirmation.tone === "calm" ? confirmation.message : null;

  if (state.continueTo) {
    return (
      <AuthContinue
        continueTo={state.continueTo}
        label="Opening your workspace…"
      />
    );
  }

  return (
    <AuthCard>
      <AuthCardHeader
        title="Welcome back"
        description="Sign in to your account to continue to your dashboard."
      />
      <form action={formAction} className="flex flex-col gap-(--card-spacing)">
        <input type="hidden" name="next" value={next} />
        <AuthCardContent>
          {alreadyConfirmed ? (
            <p
              role="status"
              className="rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground"
            >
              {alreadyConfirmed}
            </p>
          ) : null}
          {bannerError ? (
            <p
              role="alert"
              className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {bannerError}
            </p>
          ) : null}
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
            />
            <FieldError messages={state.fieldErrors?.email} />
          </div>

          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
              <Label className="text-xs" htmlFor="password">Password</Label>
              <Link
                href="/forgot-password"
                className="inline-flex min-h-11 shrink-0 items-center text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-orange)] focus-visible:ring-offset-2"
              >
                Forgot password?
              </Link>
            </div>
            <PasswordField
              id="password"
              name="password"
              autoComplete="current-password"
              required
            />
            <FieldError messages={state.fieldErrors?.password} />
          </div>
        </AuthCardContent>
        <AuthCardFooter>
          <AuthSubmitButton
            pending={pending}
            idle="Sign in"
            pendingLabel="Signing in…"
          />
          {playSurface ? (
            <>
              <p className="text-center text-sm text-muted-foreground">
                {PLAY_SURFACE_BILLING_NOTE} Sign in with an existing account.
              </p>
              <LegalDocumentLinks className="text-center" />
            </>
          ) : (
            <p className="text-center text-sm text-muted-foreground">
              Don&apos;t have an account?{" "}
              <Link href="/signup" className={authTextLinkClass}>
                Create account
              </Link>
            </p>
          )}
        </AuthCardFooter>
      </form>
    </AuthCard>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <AuthCard>
          <div className="min-h-48" />
        </AuthCard>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
