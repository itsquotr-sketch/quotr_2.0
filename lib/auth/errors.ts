/**
 * Auth-specific error taxonomy (Stage 3.1C.1A / 3.1C.1B).
 *
 * Categories are INTERNAL. User-visible strings must come from
 * {@link AUTH_USER_MESSAGES} / {@link presentAuthError} only.
 * Never surface env var names, SQL, RLS policy names, or raw provider text.
 */

export type AuthErrorCategory =
  | "CONFIGURATION"
  | "INVALID_CREDENTIALS"
  | "EMAIL_NOT_CONFIRMED"
  | "RATE_LIMITED"
  | "EMAIL_ALREADY_REGISTERED"
  | "SIGNUP_FAILED"
  | "ORG_PROVISION_FAILED"
  | "PROFILE_PROVISION_FAILED"
  | "PROVISIONING_FAILED"
  | "ACCOUNT_REPAIR_FAILED"
  | "ACCOUNT_ALREADY_PROVISIONED"
  | "CONFIRMATION_PENDING"
  | "PROFILE_UPDATE_FAILED"
  | "PASSWORD_CHANGE_FAILED"
  | "LOGOUT_FAILED"
  | "UNKNOWN";

/**
 * Safe UI messages mapped from internal categories.
 *
 * Login policy (3.1C.1A): EMAIL_NOT_CONFIRMED is classified internally for
 * logging, but user-facing login collapses it to INVALID_CREDENTIALS so we
 * do not leak account existence / confirmation state.
 *
 * CONFIRMATION_PENDING (3.1C.1B): signup created an auth user but no session
 * exists yet, so transactional provisioning did not run. Honest usability copy.
 */
export const AUTH_USER_MESSAGES: Record<AuthErrorCategory, string> = {
  CONFIGURATION:
    "We couldn’t create your account right now. Please try again shortly.",
  INVALID_CREDENTIALS: "Email or password is incorrect.",
  EMAIL_NOT_CONFIRMED: "Email or password is incorrect.",
  RATE_LIMITED: "Too many attempts. Please wait a moment and try again.",
  EMAIL_ALREADY_REGISTERED:
    "An account with this email already exists. Try signing in instead.",
  SIGNUP_FAILED: "We couldn’t create your account. Please try again.",
  ORG_PROVISION_FAILED:
    "We couldn’t finish setting up your company. Please try again shortly.",
  PROFILE_PROVISION_FAILED:
    "We couldn’t finish setting up your account. Please try again shortly.",
  PROVISIONING_FAILED:
    "We couldn’t finish setting up your company. Please try again shortly.",
  ACCOUNT_REPAIR_FAILED:
    "We couldn’t finish setting up your company. Please try again shortly.",
  ACCOUNT_ALREADY_PROVISIONED:
    "Your company account is already set up. Continue to the dashboard.",
  CONFIRMATION_PENDING:
    "Account created. Please check your email to confirm, then sign in to finish company setup.",
  PROFILE_UPDATE_FAILED: "Could not save your profile. Please try again.",
  PASSWORD_CHANGE_FAILED:
    "Could not change your password. Check your current password and try again.",
  LOGOUT_FAILED: "Could not sign out. Please try again.",
  UNKNOWN: "Something went wrong. Please try again.",
};

export function presentAuthError(category: AuthErrorCategory): string {
  return AUTH_USER_MESSAGES[category] ?? AUTH_USER_MESSAGES.UNKNOWN;
}

/**
 * Login presentation: never distinguish email-not-confirmed from bad password
 * in the UI (enumeration-safe default).
 */
export function presentLoginError(category: AuthErrorCategory): string {
  if (
    category === "EMAIL_NOT_CONFIRMED" ||
    category === "INVALID_CREDENTIALS" ||
    category === "UNKNOWN"
  ) {
    return AUTH_USER_MESSAGES.INVALID_CREDENTIALS;
  }
  if (category === "RATE_LIMITED") {
    return AUTH_USER_MESSAGES.RATE_LIMITED;
  }
  return AUTH_USER_MESSAGES.INVALID_CREDENTIALS;
}

function lower(message: string): string {
  return message.trim().toLowerCase();
}

/**
 * Classify GoTrue / Auth API error messages into internal categories.
 * Used for logging + safe presentation only — never return `message` to UI.
 */
export function classifyAuthProviderError(
  message: string | null | undefined,
  context: "signup" | "login"
): AuthErrorCategory {
  if (!message?.trim()) {
    return context === "login" ? "INVALID_CREDENTIALS" : "SIGNUP_FAILED";
  }

  const m = lower(message);

  if (
    m.includes("rate limit") ||
    m.includes("too many requests") ||
    m.includes("over_request_rate")
  ) {
    return "RATE_LIMITED";
  }

  if (
    m.includes("email not confirmed") ||
    m.includes("email_not_confirmed") ||
    m.includes("confirm your email")
  ) {
    return "EMAIL_NOT_CONFIRMED";
  }

  if (
    m.includes("already registered") ||
    m.includes("already been registered") ||
    m.includes("user already exists") ||
    m.includes("email address is already")
  ) {
    return "EMAIL_ALREADY_REGISTERED";
  }

  if (
    m.includes("invalid login credentials") ||
    m.includes("invalid credentials") ||
    m.includes("invalid email or password")
  ) {
    return "INVALID_CREDENTIALS";
  }

  return context === "login" ? "INVALID_CREDENTIALS" : "SIGNUP_FAILED";
}

/**
 * Map RPC / PostgREST error text to internal categories without exposing it.
 */
export function classifyProvisioningError(
  message: string | null | undefined,
  context: "signup" | "repair" = "signup"
): AuthErrorCategory {
  if (!message?.trim()) {
    return context === "repair" ? "ACCOUNT_REPAIR_FAILED" : "PROVISIONING_FAILED";
  }

  const m = lower(message);

  if (m.includes("not_authenticated") || m.includes("jwt")) {
    return "INVALID_CREDENTIALS";
  }
  if (m.includes("invalid_organisation_name")) {
    return context === "repair" ? "ACCOUNT_REPAIR_FAILED" : "ORG_PROVISION_FAILED";
  }
  if (m.includes("invalid_full_name")) {
    return context === "repair" ? "ACCOUNT_REPAIR_FAILED" : "PROFILE_PROVISION_FAILED";
  }
  if (m.includes("profile_inconsistent")) {
    return context === "repair" ? "ACCOUNT_REPAIR_FAILED" : "PROVISIONING_FAILED";
  }

  return context === "repair" ? "ACCOUNT_REPAIR_FAILED" : "PROVISIONING_FAILED";
}

/**
 * Detect unsafe diagnostic strings that must never reach the client.
 */
export function containsUnsafeAuthDiagnostic(text: string): boolean {
  const m = lower(text);
  return (
    m.includes("supabase_service_role_key") ||
    m.includes("service_role") ||
    m.includes("next_public_") ||
    m.includes("process.env") ||
    m.includes("permission denied") ||
    m.includes("violates") ||
    m.includes("duplicate key") ||
    m.includes("foreign key") ||
    m.includes("check constraint") ||
    m.includes("row-level security") ||
    m.includes("rls") ||
    m.includes("relation ") ||
    m.includes("column ") ||
    m.includes("select ") ||
    m.includes("insert into") ||
    m.includes("pg_") ||
    m.includes("postgrest") ||
    m.includes("stack trace") ||
    m.includes("at object.") ||
    m.includes("ensure supabase") ||
    m.includes("provision_organisation") ||
    m.includes("security definer") ||
    m.includes("sqlstate") ||
    m.includes("auth.uid")
  );
}
