"use client";

import Link from "next/link";
import { useActionState } from "react";
import {
  changePassword,
  updateProfileFullName,
  type ProfileActionState,
} from "@/lib/auth/profile-actions";
import { updateMarketingConsent } from "@/lib/communications/consent-actions";
import { logout } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: ProfileActionState = {};

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages?.length) return null;
  return <p className="text-sm text-destructive">{messages[0]}</p>;
}

function Alert({
  tone,
  children,
}: {
  tone: "error" | "success";
  children: React.ReactNode;
}) {
  return (
    <p
      role="alert"
      className={
        tone === "error"
          ? "rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          : "rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-800 dark:text-emerald-200"
      }
    >
      {children}
    </p>
  );
}

type ProfilePageContentProps = {
  fullName: string;
  email: string;
  role: string;
  organisationName: string;
  marketingConsent: boolean;
};

export function ProfilePageContent({
  fullName,
  email,
  role,
  organisationName,
  marketingConsent,
}: ProfilePageContentProps) {
  const [profileState, profileAction, profilePending] = useActionState(
    updateProfileFullName,
    initialState
  );
  const [consentState, consentAction, consentPending] = useActionState(
    updateMarketingConsent,
    initialState
  );
  const [passwordState, passwordAction, passwordPending] = useActionState(
    changePassword,
    initialState
  );

  return (
    <div className="mx-auto w-full max-w-lg space-y-8">
      <section className="space-y-4">
        <div>
          <h2 className="text-base font-semibold tracking-tight">
            Personal details
          </h2>
          <p className="text-sm text-muted-foreground">
            Your personal account identity. Company branding and rates live in
            Company settings.
          </p>
        </div>

        <form action={profileAction} className="space-y-4">
          {profileState.error ? (
            <Alert tone="error">{profileState.error}</Alert>
          ) : null}
          {profileState.success ? (
            <Alert tone="success">{profileState.success}</Alert>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="full_name">Full name</Label>
            <Input
              id="full_name"
              name="full_name"
              defaultValue={fullName}
              autoComplete="name"
              required
              disabled={profilePending}
              className="h-10"
            />
            <FieldError messages={profileState.fieldErrors?.full_name} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email address</Label>
            <Input
              id="email"
              value={email}
              readOnly
              disabled
              className="h-10"
            />
            <p className="text-xs text-muted-foreground">
              Email changes require a confirmation flow and will be available
              in a later account-security update.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Input
                id="role"
                value={role}
                readOnly
                disabled
                className="h-10 capitalize"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="organisation">Organisation</Label>
              <Input
                id="organisation"
                value={organisationName}
                readOnly
                disabled
                className="h-10"
              />
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <Link
              href="/app/settings/company"
              className="text-sm font-medium text-foreground underline-offset-4 hover:underline"
            >
              Open Company settings
            </Link>
            <Button type="submit" disabled={profilePending} className="sm:w-auto">
              {profilePending ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </form>
      </section>

      <section className="space-y-4 border-t pt-8">
        <div>
          <h2 className="text-base font-semibold tracking-tight">
            Product & community updates
          </h2>
          <p className="text-sm text-muted-foreground">
            Product updates, practical tips, new features and occasional Quotr
            news.
          </p>
        </div>

        <form action={consentAction} className="space-y-4">
          {consentState.error ? (
            <Alert tone="error">{consentState.error}</Alert>
          ) : null}
          {consentState.success ? (
            <Alert tone="success">{consentState.success}</Alert>
          ) : null}
          <div className="flex items-start gap-3">
            <input
              id="marketing_consent"
              name="marketing_consent"
              type="checkbox"
              value="true"
              defaultChecked={marketingConsent}
              disabled={consentPending}
              className="mt-0.5 size-4 shrink-0 rounded-[5px] border border-input bg-input/90 accent-foreground"
            />
            <label htmlFor="marketing_consent" className="text-sm leading-snug">
              Keep me updated about Quotr
            </label>
          </div>
          <Button type="submit" disabled={consentPending} className="sm:w-auto">
            {consentPending ? "Saving…" : "Save preference"}
          </Button>
        </form>
      </section>

      <section className="space-y-4 border-t pt-8">
        <div>
          <h2 className="text-base font-semibold tracking-tight">Security</h2>
          <p className="text-sm text-muted-foreground">
            Change your password while signed in. You must confirm your current
            password.
          </p>
        </div>

        <form action={passwordAction} className="space-y-4" autoComplete="off">
          {passwordState.error ? (
            <Alert tone="error">{passwordState.error}</Alert>
          ) : null}
          {passwordState.success ? (
            <Alert tone="success">{passwordState.success}</Alert>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="current_password">Current password</Label>
            <Input
              id="current_password"
              name="current_password"
              type="password"
              autoComplete="current-password"
              required
              disabled={passwordPending}
              className="h-10"
            />
            <FieldError messages={passwordState.fieldErrors?.current_password} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="new_password">New password</Label>
            <Input
              id="new_password"
              name="new_password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              disabled={passwordPending}
              className="h-10"
            />
            <FieldError messages={passwordState.fieldErrors?.new_password} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm_password">Confirm new password</Label>
            <Input
              id="confirm_password"
              name="confirm_password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              disabled={passwordPending}
              className="h-10"
            />
            <FieldError
              messages={passwordState.fieldErrors?.confirm_password}
            />
          </div>

          <Button type="submit" disabled={passwordPending}>
            {passwordPending ? "Updating…" : "Change password"}
          </Button>
        </form>
      </section>

      <section className="space-y-3 border-t pt-8">
        <div>
          <h2 className="text-base font-semibold tracking-tight">Account</h2>
          <p className="text-sm text-muted-foreground">
            Sign out of Quotr on this device.
          </p>
        </div>
        <form action={logout}>
          <Button type="submit" variant="outline">
            Log out
          </Button>
        </form>
      </section>
    </div>
  );
}
