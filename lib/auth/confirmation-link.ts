/**
 * Signup confirmation callback decisions.
 *
 * A missing or failed code is not success. An existing browser session is
 * not proof that this email was confirmed. A PKCE verifier miss is a
 * session failure, not an expired link. Supabase uses the same otp_expired
 * code for an expired unused link and a reused link, so that generic code
 * stays on the invalid path unless the provider says the email is already
 * confirmed.
 */

import { AUTH_USER_MESSAGES } from "@/lib/auth/errors";

export const ALREADY_CONFIRMED_MESSAGE =
  "Your email is already confirmed. Sign in to continue.";

export const CONFIRMATION_SESSION_MESSAGE =
  "This confirmation link did not finish signing you in. Send a new confirmation email to continue.";

export type ConfirmationHelpReason = "invalid" | "session";

export type ConfirmationCallbackAction =
  | { type: "exchange" }
  | { type: "login"; error: "confirmation_already" }
  | { type: "help"; reason: ConfirmationHelpReason }
  | { type: "recovery_invalid" };

export function decideConfirmationCallback(input: {
  code: string | null;
  next: string;
  errorCode: string | null;
  errorDescription: string | null;
}): ConfirmationCallbackAction {
  if (input.next.startsWith("/reset-password")) {
    return input.code ? { type: "exchange" } : { type: "recovery_invalid" };
  }

  if (!input.code) {
    if (isAlreadyConfirmedSignal(input.errorCode, input.errorDescription)) {
      return { type: "login", error: "confirmation_already" };
    }
    if (isSessionRedirectSignal(input.errorCode, input.errorDescription)) {
      return { type: "help", reason: "session" };
    }
    return { type: "help", reason: "invalid" };
  }

  return { type: "exchange" };
}

export function decideFailedExchange(input: {
  next: string;
  providerMessage: string | null;
}): Exclude<ConfirmationCallbackAction, { type: "exchange" }> {
  if (input.next.startsWith("/reset-password")) {
    return { type: "recovery_invalid" };
  }
  if (isAlreadyConfirmedSignal(null, input.providerMessage)) {
    return { type: "login", error: "confirmation_already" };
  }
  if (isSessionRedirectSignal(null, input.providerMessage)) {
    return { type: "help", reason: "session" };
  }
  return { type: "help", reason: "invalid" };
}

export function confirmationLoginPath(
  error: "confirmation_already"
): string {
  return `/login?error=${error}`;
}

export function confirmationHelpPath(reason: ConfirmationHelpReason): string {
  return reason === "session"
    ? "/signup?confirm=link&reason=session"
    : "/signup?confirm=link&reason=invalid";
}

export function confirmationContinueOmitsError(path: string): boolean {
  return !/[?&]error=/.test(path);
}

export function loginConfirmationPresentation(errorParam: string | null): {
  tone: "none" | "error" | "calm";
  message: string | null;
} {
  if (errorParam === "confirmation_invalid") {
    return {
      tone: "error",
      message: AUTH_USER_MESSAGES.CONFIRMATION_LINK_INVALID,
    };
  }
  if (errorParam === "confirmation_already") {
    return {
      tone: "calm",
      message: ALREADY_CONFIRMED_MESSAGE,
    };
  }
  return { tone: "none", message: null };
}

export function confirmationHelpMessage(
  reason: ConfirmationHelpReason
): string {
  return reason === "session"
    ? CONFIRMATION_SESSION_MESSAGE
    : AUTH_USER_MESSAGES.CONFIRMATION_LINK_INVALID;
}

function isAlreadyConfirmedSignal(
  code: string | null,
  description: string | null
): boolean {
  const blob = `${code ?? ""} ${description ?? ""}`.toLowerCase();
  return (
    blob.includes("already confirmed") ||
    blob.includes("already been confirmed") ||
    blob.includes("email_already_confirmed") ||
    blob.includes("user already confirmed")
  );
}

function isSessionRedirectSignal(
  code: string | null,
  description: string | null
): boolean {
  const blob = `${code ?? ""} ${description ?? ""}`.toLowerCase();
  return (
    blob.includes("pkce") ||
    blob.includes("code verifier") ||
    blob.includes("flow state") ||
    blob.includes("pkce_code_verifier_not_found")
  );
}
