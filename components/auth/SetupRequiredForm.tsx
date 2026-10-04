"use client";

import { useActionState } from "react";
import {
  finishAccountSetup,
  logout,
  type AuthActionState,
} from "@/app/(auth)/actions";
import {
  AuthCard,
  AuthCardContent,
  AuthCardFooter,
  AuthCardHeader,
} from "@/components/auth/AuthCard";
import { AuthContinue } from "@/components/auth/AuthContinue";
import { AuthSubmitButton } from "@/components/auth/AuthSubmitButton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: AuthActionState = {};

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages?.length) return null;
  return <p className="text-sm text-destructive">{messages[0]}</p>;
}

/**
 * Account repair when a signed-in user has no organisation and signup
 * metadata cannot finish the link. Placeholders are examples only.
 */
export function SetupRequiredForm({
  defaultFullName,
  defaultOrganisationName,
}: {
  defaultFullName: string;
  defaultOrganisationName: string;
}) {
  const [state, formAction, pending] = useActionState(
    finishAccountSetup,
    initialState
  );

  if (state.continueTo) {
    return (
      <AuthContinue
        continueTo={state.continueTo}
        label="Preparing your account…"
      />
    );
  }

  return (
    <AuthCard>
      <AuthCardHeader
        title="Finish account setup"
        description="Your account is signed in, but it is not linked to a company yet. Create your company to continue using Quotr."
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

          <div className="space-y-2">
            <Label htmlFor="full_name">Full name</Label>
            <Input
              id="full_name"
              name="full_name"
              autoComplete="name"
              placeholder="Alex Smith"
              defaultValue={defaultFullName}
              required
              disabled={pending}
              className="h-11"
            />
            <FieldError messages={state.fieldErrors?.full_name} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="organisation_name">Company name</Label>
            <Input
              id="organisation_name"
              name="organisation_name"
              autoComplete="organization"
              placeholder="Smith Building Co."
              defaultValue={defaultOrganisationName}
              required
              disabled={pending}
              className="h-11"
            />
            <FieldError messages={state.fieldErrors?.organisation_name} />
          </div>

          <p className="text-sm text-muted-foreground">
            If you already belong to a company, ask your company owner for help
            or contact support. Do not create a second company for an existing
            team account.
          </p>
        </AuthCardContent>
        <AuthCardFooter className="gap-3">
          <AuthSubmitButton
            pending={pending}
            idle="Finish account setup"
            pendingLabel="Preparing your account…"
          />
        </AuthCardFooter>
      </form>
      <AuthCardFooter className="border-t pt-(--card-spacing)">
        <form action={logout} className="w-full">
          <Button
            type="submit"
            variant="ghost"
            className="h-11 w-full"
            disabled={pending}
          >
            Sign out
          </Button>
        </form>
      </AuthCardFooter>
    </AuthCard>
  );
}
