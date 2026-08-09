"use client";

import Link from "next/link";
import { useActionState } from "react";
import {
  requestPasswordReset,
  type RecoveryActionState,
} from "@/lib/auth/recovery-actions";
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

const initialState: RecoveryActionState = {};

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages?.length) return null;
  return <p className="text-sm text-destructive">{messages[0]}</p>;
}

export default function ForgotPasswordPage() {
  const [state, formAction, pending] = useActionState(
    requestPasswordReset,
    initialState
  );

  return (
    <Card>
      <CardHeader className="pb-4 sm:pb-6">
        <CardTitle className="text-xl">Forgot password</CardTitle>
        <CardDescription>
          Enter your email and we&apos;ll send password reset instructions if an
          account exists.
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
          {state.success ? (
            <p
              role="status"
              className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-800 dark:text-emerald-200"
            >
              {state.success}
            </p>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="email">Email address</Label>
            <Input
              id="email"
              name="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="you@company.com"
              required
              className="h-11"
              disabled={pending}
            />
            <FieldError messages={state.fieldErrors?.email} />
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-4">
          <Button type="submit" className="h-11 w-full" disabled={pending}>
            {pending ? "Sending…" : "Send reset link"}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            <Link
              href="/login"
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              Back to login
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}
