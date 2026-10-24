/**
 * Supabase signUp hides whether an email already exists.
 * A confirmed account comes back with no error, no session, an empty
 * identities list, and email_confirmed_at cleared. That is not a new
 * unconfirmed signup. The id in that response is not the stored account.
 */

export const EXISTING_EMAIL_MESSAGE =
  "This email already has a Quotr account. Sign in or reset your password.";

export const EXISTING_EMAIL_UNKNOWN_MESSAGE =
  "This email already has a Quotr account. Sign in or reset your password. If it is not confirmed yet, resend the confirmation email.";

export type ExistingSignupConfirmation = "confirmed" | "unconfirmed" | "unknown";

type SignupIdentity = {
  identity_id?: string;
  id?: string;
  provider?: string;
};

export function signupResponseConcealsExistingAccount(user: {
  identities?: SignupIdentity[] | null;
} | null): boolean {
  return Array.isArray(user?.identities) && user.identities.length === 0;
}

export function retainedAuthEmail(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim() ?? "";
  if (!trimmed || trimmed.length > 254 || !/^[^\s@]+@[^\s@]+$/.test(trimmed)) {
    return undefined;
  }
  return trimmed;
}

export function marketingConsentFromMetadata(value: unknown): boolean | null {
  if (value === true || value === "true" || value === "yes") return true;
  if (value === false || value === "false" || value === "no") return false;
  return null;
}
