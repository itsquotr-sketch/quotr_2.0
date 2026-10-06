"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import {
  changePassword,
  updateProfileFullName,
  type ProfileActionState,
} from "@/lib/auth/profile-actions";
import { PHONE_ALREADY_LINKED_MESSAGE } from "@/lib/auth/account-phone";
import { logout } from "@/app/(auth)/actions";
import { AccountPhoneField } from "@/components/auth/AccountPhoneField";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: ProfileActionState = {};

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages?.length) return null;
  return <p className="text-sm text-destructive" role="alert">{messages[0]}</p>;
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
      role={tone === "error" ? "alert" : "status"}
      className={
        tone === "error"
          ? "rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          : "text-sm text-muted-foreground"
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
  phoneCountry: "NZ" | "AU";
  phoneNumber: string;
};

export function ProfilePageContent({
  fullName,
  email,
  role,
  organisationName,
  phoneCountry,
  phoneNumber,
}: ProfilePageContentProps) {
  const [profileState, profileAction, profilePending] = useActionState(
    updateProfileFullName,
    initialState
  );
  const [passwordState, passwordAction, passwordPending] = useActionState(
    changePassword,
    initialState
  );
  const [hideProfileSuccess, setHideProfileSuccess] = useState(false);
  const [hidePasswordSuccess, setHidePasswordSuccess] = useState(false);
  if (profilePending && hideProfileSuccess) setHideProfileSuccess(false);
  if (passwordPending && hidePasswordSuccess) setHidePasswordSuccess(false);

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

        <form
          action={profileAction}
          className="space-y-4"
          onChange={() => {
            if (profileState.success) setHideProfileSuccess(true);
          }}
        >
          {profileState.phoneAlreadyLinked ? (
            <Alert tone="error">{PHONE_ALREADY_LINKED_MESSAGE}</Alert>
          ) : profileState.error ? (
            <Alert tone="error">{profileState.error}</Alert>
          ) : null}
          {profileState.success && !hideProfileSuccess && !profilePending ? (
            <Alert tone="success">{profileState.success}</Alert>
          ) : null}

          <div className="space-y-1.5">
            <Label className="text-xs" htmlFor="full_name">Full name</Label>
            <Input
              id="full_name"
              name="full_name"
              defaultValue={fullName}
              autoComplete="name"
              required
              disabled={profilePending}
              className="h-11 md:h-9"
            />
            <FieldError messages={profileState.fieldErrors?.full_name} />
          </div>

          <AccountPhoneField
            defaultCountry={phoneCountry}
            defaultNumber={phoneNumber}
            required={Boolean(phoneNumber)}
            disabled={profilePending}
            error={
              profileState.phoneAlreadyLinked
                ? undefined
                : profileState.fieldErrors?.phone_number?.[0] ??
                  profileState.fieldErrors?.phone_country?.[0]
            }
          />

          <div className="space-y-1.5">
            <Label className="text-xs" htmlFor="email">Email address</Label>
            <Input
              id="email"
              value={email}
              readOnly
              disabled
              className="h-11 md:h-9"
            />
            <p className="text-xs text-muted-foreground">
              Email changes require a confirmation flow and will be available
              in a later account-security update.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs" htmlFor="role">Role</Label>
              <Input
                id="role"
                value={role}
                readOnly
                disabled
                className="h-11 capitalize md:h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs" htmlFor="organisation">Organisation</Label>
              <Input
                id="organisation"
                value={organisationName}
                readOnly
                disabled
                className="h-11 md:h-9"
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
            <Button type="submit" disabled={profilePending} className="min-w-36 sm:w-auto">
              {profilePending ? "Saving…" : "Save changes"}
            </Button>
          </div>
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

        <form
          action={passwordAction}
          className="space-y-4"
          autoComplete="off"
          onChange={() => {
            if (passwordState.success) setHidePasswordSuccess(true);
          }}
        >
          {passwordState.error ? (
            <Alert tone="error">{passwordState.error}</Alert>
          ) : null}
          {passwordState.success && !hidePasswordSuccess && !passwordPending ? (
            <Alert tone="success">{passwordState.success}</Alert>
          ) : null}

          <div className="space-y-1.5">
            <Label className="text-xs" htmlFor="current_password">Current password</Label>
            <Input
              id="current_password"
              name="current_password"
              type="password"
              autoComplete="current-password"
              required
              disabled={passwordPending}
              className="h-11 md:h-9"
            />
            <FieldError messages={passwordState.fieldErrors?.current_password} />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs" htmlFor="new_password">New password</Label>
            <Input
              id="new_password"
              name="new_password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              disabled={passwordPending}
              className="h-11 md:h-9"
            />
            <FieldError messages={passwordState.fieldErrors?.new_password} />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs" htmlFor="confirm_password">Confirm new password</Label>
            <Input
              id="confirm_password"
              name="confirm_password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              disabled={passwordPending}
              className="h-11 md:h-9"
            />
            <FieldError
              messages={passwordState.fieldErrors?.confirm_password}
            />
          </div>

          <Button type="submit" disabled={passwordPending} className="min-w-40">
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
