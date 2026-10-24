"use client";

import { useActionState } from "react";
import {
  submitPublicDeletionRequest,
  submitSignedInDeletionRequest,
} from "@/lib/account-deletion/actions";
import {
  deletionStatusCopy,
  type DeletionActionState,
} from "@/lib/account-deletion/request";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: DeletionActionState = {};

export function SignedInDeletionForm({
  existing,
}: {
  existing: DeletionActionState["record"] | null;
}) {
  const [state, action, pending] = useActionState(
    submitSignedInDeletionRequest,
    existing ? { record: existing } : initialState
  );
  const record = state.record ?? existing;
  const copy = record ? deletionStatusCopy(record) : null;

  return (
    <div className="space-y-4">
      {copy ? (
        <div className="space-y-2 rounded-lg border border-border px-3 py-3">
          <h2 className="text-sm font-semibold">{copy.title}</h2>
          <p className="text-sm text-muted-foreground">{copy.body}</p>
          {record ? (
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
              <dt className="text-muted-foreground">Identity</dt>
              <dd>{record.identityConfirmed ? "Confirmed" : "Not confirmed"}</dd>
              <dt className="text-muted-foreground">Other people</dt>
              <dd>{record.otherActiveMemberCount}</dd>
              <dt className="text-muted-foreground">Issued quotes</dt>
              <dd>{record.issuedQuoteCount}</dd>
              <dt className="text-muted-foreground">Subscription</dt>
              <dd>{record.subscriptionStatus ?? "Not recorded"}</dd>
            </dl>
          ) : null}
        </div>
      ) : null}
      {record?.identityConfirmed ? null : (
        <form action={action} className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Enter your current password to confirm this request is yours.
            Submitting it does not delete the account.
          </p>
          {state.error ? (
            <p role="alert" className="text-sm text-destructive">
              {state.error}
            </p>
          ) : null}
          <div className="space-y-1.5">
            <Label className="text-xs" htmlFor="current_password">
              Current password
            </Label>
            <Input
              id="current_password"
              name="current_password"
              type="password"
              autoComplete="current-password"
              required
              disabled={pending}
              className="h-11"
            />
          </div>
          <Button type="submit" disabled={pending}>
            {pending ? "Recording…" : "Record deletion request"}
          </Button>
        </form>
      )}
    </div>
  );
}

export function PublicDeletionForm() {
  const [state, action, pending] = useActionState(
    submitPublicDeletionRequest,
    initialState
  );

  return (
    <form action={action} className="space-y-4">
      {state.acknowledgement ? (
        <p role="status" className="text-sm text-muted-foreground">
          {state.acknowledgement}
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">
          Ask for an account to be closed. This page records the request. It
          does not delete the account.
        </p>
      )}
      {state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
      <div className="space-y-1.5">
        <Label className="text-xs" htmlFor="deletion-email">
          Account email
        </Label>
        <Input
          id="deletion-email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          disabled={pending}
          className="h-11"
        />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Recording…" : "Record deletion request"}
      </Button>
    </form>
  );
}
