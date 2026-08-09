"use client";

import { useActionState } from "react";
import {
  resetPasswordWithRecoverySession,
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

export function ResetPasswordClient() {
  const [state, formAction, pending] = useActionState(
    resetPasswordWithRecoverySession,
    initialState
  );

  return (
    <Card>
      <CardHeader className="pb-4 sm:pb-6">
        <CardTitle className="text-xl">Set a new password</CardTitle>
        <CardDescription>
          Choose a new password for your Quotr account. You do not need your
          old password.
        </CardDescription>
      </CardHeader>
      <form action={formAction} className="flex flex-col gap-(--card-spacing)" autoComplete="off">
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
            <Label htmlFor="new_password">New password</Label>
            <Input
              id="new_password"
              name="new_password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
              disabled={pending}
              className="h-11"
            />
            <FieldError messages={state.fieldErrors?.new_password} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm_password">Confirm new password</Label>
            <Input
              id="confirm_password"
              name="confirm_password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
              disabled={pending}
              className="h-11"
            />
            <FieldError messages={state.fieldErrors?.confirm_password} />
          </div>
        </CardContent>
        <CardFooter>
          <Button type="submit" className="h-11 w-full" disabled={pending}>
            {pending ? "Updating…" : "Update password"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
