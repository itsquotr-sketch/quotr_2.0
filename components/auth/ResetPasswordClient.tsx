"use client";

import { useActionState } from "react";
import {
  resetPasswordWithRecoverySession,
  type RecoveryActionState,
} from "@/lib/auth/recovery-actions";
import {
  AuthCard,
  AuthCardContent,
  AuthCardFooter,
  AuthCardHeader,
} from "@/components/auth/AuthCard";
import { AuthSubmitButton } from "@/components/auth/AuthSubmitButton";
import { PasswordField } from "@/components/auth/PasswordField";
import { Label } from "@/components/ui/label";

const initialState: RecoveryActionState = {};

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages?.length) return null;
  return <p className="text-sm text-destructive" role="alert">{messages[0]}</p>;
}

export function ResetPasswordClient() {
  const [state, formAction, pending] = useActionState(
    resetPasswordWithRecoverySession,
    initialState
  );

  return (
    <AuthCard>
      <AuthCardHeader
        title="Set a new password"
        description="Choose a new password for your Quotr account. You do not need your old password."
      />
      <form
        action={formAction}
        className="flex flex-col gap-(--card-spacing)"
        autoComplete="off"
      >
        <AuthCardContent>
          {state.error ? (
            <p
              role="alert"
              className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {state.error}
            </p>
          ) : null}

          <div className="space-y-1.5">
            <Label className="text-xs" htmlFor="new_password">New password</Label>
            <PasswordField
              id="new_password"
              name="new_password"
              autoComplete="new-password"
              minLength={8}
              required
              disabled={pending}
            />
            <FieldError messages={state.fieldErrors?.new_password} />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs" htmlFor="confirm_password">Confirm new password</Label>
            <PasswordField
              id="confirm_password"
              name="confirm_password"
              autoComplete="new-password"
              minLength={8}
              required
              disabled={pending}
            />
            <FieldError messages={state.fieldErrors?.confirm_password} />
          </div>
        </AuthCardContent>
        <AuthCardFooter>
          <AuthSubmitButton
            pending={pending}
            idle="Update password"
            pendingLabel="Updating…"
          />
        </AuthCardFooter>
      </form>
    </AuthCard>
  );
}
