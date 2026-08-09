"use client";

import Link from "next/link";
import { Suspense, useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { login, type AuthActionState } from "@/app/(auth)/actions";
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
import { AUTH_USER_MESSAGES } from "@/lib/auth/errors";
import { getSafeInternalPath } from "@/lib/auth/safe-redirect";

const initialState: AuthActionState = {};

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages?.length) return null;
  return <p className="text-sm text-destructive">{messages[0]}</p>;
}

function LoginForm() {
  const searchParams = useSearchParams();
  const next = getSafeInternalPath(searchParams.get("next"));
  const linkError = searchParams.get("error");
  const [state, formAction, pending] = useActionState(login, initialState);

  const bannerError =
    state.error ??
    (linkError === "confirmation_invalid"
      ? AUTH_USER_MESSAGES.CONFIRMATION_LINK_INVALID
      : linkError === "reset_invalid"
        ? AUTH_USER_MESSAGES.RESET_LINK_INVALID
        : null);

  if (state.continueTo) {
    return (
      <Card>
        <CardHeader className="pb-4 sm:pb-6">
          <CardTitle className="text-xl">Signed in</CardTitle>
          <CardDescription>Continuing to Quotr…</CardDescription>
        </CardHeader>
        <CardContent>
          <AuthContinue continueTo={state.continueTo} label="Opening Quotr…" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-4 sm:pb-6">
        <CardTitle className="text-xl">Welcome back</CardTitle>
        <CardDescription>
          Sign in to your account to continue to your dashboard.
        </CardDescription>
      </CardHeader>
      <form action={formAction} className="flex flex-col gap-(--card-spacing)">
        <input type="hidden" name="next" value={next} />
        <CardContent className="space-y-4">
          {bannerError ? (
            <p
              role="alert"
              className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {bannerError}
            </p>
          ) : null}

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
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="password">Password</Label>
              <Link
                href="/forgot-password"
                className="inline-flex min-h-9 shrink-0 items-center text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-orange)] focus-visible:ring-offset-2"
              >
                Forgot password?
              </Link>
            </div>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className="h-11"
            />
            <FieldError messages={state.fieldErrors?.password} />
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-4">
          <Button type="submit" className="h-11 w-full" disabled={pending}>
            {pending ? "Signing in…" : "Sign in"}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            Don&apos;t have an account?{" "}
            <Link
              href="/signup"
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              Create account
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<Card className="min-h-48 animate-pulse" />}>
      <LoginForm />
    </Suspense>
  );
}
