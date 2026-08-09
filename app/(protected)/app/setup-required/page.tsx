"use client";

import { useActionState } from "react";
import {
  finishAccountSetup,
  logout,
  type AuthActionState,
} from "@/app/(auth)/actions";
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

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages?.length) return null;
  return <p className="text-sm text-destructive">{messages[0]}</p>;
}

/**
 * Recovery for authenticated users without a valid company profile.
 * Calls the same transactional provisioning RPC as signup.
 */
export default function SetupRequiredPage() {
  const [state, formAction, pending] = useActionState(
    finishAccountSetup,
    initialState
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Finish account setup</CardTitle>
        <CardDescription>
          Your account is signed in, but it is not linked to a company yet.
          Create your company to continue using Quotr.
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
              disabled={pending}
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
              disabled={pending}
            />
            <FieldError messages={state.fieldErrors?.organisation_name} />
          </div>

          <p className="text-sm text-muted-foreground">
            If you already belong to a company, ask your company owner for help
            or contact support. Do not create a second company for an existing
            team account.
          </p>
        </CardContent>
        <CardFooter className="flex flex-col gap-3">
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Finishing setup…" : "Finish account setup"}
          </Button>
        </CardFooter>
      </form>
      <CardFooter className="border-t pt-(--card-spacing)">
        <form action={logout} className="w-full">
          <Button
            type="submit"
            variant="ghost"
            className="w-full"
            disabled={pending}
          >
            Sign out
          </Button>
        </form>
      </CardFooter>
    </Card>
  );
}
