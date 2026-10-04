/**
 * Signup confirmation callback decisions.
 *
 * A missing or failed code is not success. A confirmed session from the
 * first exchange is continued without an error parameter. Supabase uses the
 * same otp_expired code for an expired unused link and a reused link, so
 * that generic code stays on the invalid path unless the provider says the
 * email is already confirmed.
 */

import { AUTH_USER_MESSAGES } from "@/lib/auth/errors";

export const ALREADY_CONFIRMED_MESSAGE =
  "Your email is already confirmed. Sign in to continue.";

export type ConfirmationCallbackAction =
  | { type: "exchange" }
  | { type: "continue" }
  | { type: "login"; error: "confirmation_invalid" | "confirmation_already" }
  | { type: "recovery_invalid" };

export function decideConfirmationCallback(input: {
  code: string | null;
  next: string;
  errorCode: string | null;
  errorDescription: string | null;
  hasConfirmedSession: boolean;
}): ConfirmationCallbackAction {
  if (input.next.startsWith("/reset-password")) {
    return input.code ? { type: "exchange" } : { type: "recovery_invalid" };
  }

  if (!input.code && input.hasConfirmedSession) {
    return { type: "continue" };
  }

  if (!input.code) {
    if (isAlreadyConfirmedSignal(input.errorCode, input.errorDescription)) {
      return { type: "login", error: "confirmation_already" };
    }
    return { type: "login", error: "confirmation_invalid" };
  }

  return { type: "exchange" };
}

export function decideFailedExchange(input: {
  next: string;
  providerMessage: string | null;
  hasConfirmedSession: boolean;
}): Exclude<ConfirmationCallbackAction, { type: "exchange" }> {
  if (input.next.startsWith("/reset-password")) {
    return { type: "recovery_invalid" };
  }
  if (input.hasConfirmedSession) {
    return { type: "continue" };
  }
  if (isAlreadyConfirmedSignal(null, input.providerMessage)) {
    return { type: "login", error: "confirmation_already" };
  }
  return { type: "login", error: "confirmation_invalid" };
}

export function confirmationLoginPath(
  error: "confirmation_invalid" | "confirmation_already"
): string {
  return `/login?error=${error}`;
}

export function confirmationContinueOmitsError(path: string): boolean {
  return !/[?&]error=/.test(path);
}

export function loginConfirmationPresentation(errorParam: string | null): {
  tone: "none" | "error" | "calm";
  message: string | null;
  showResend: boolean;
} {
  if (errorParam === "confirmation_invalid") {
    return {
      tone: "error",
      message: AUTH_USER_MESSAGES.CONFIRMATION_LINK_INVALID,
      showResend: true,
    };
  }
  if (errorParam === "confirmation_already") {
    return {
      tone: "calm",
      message: ALREADY_CONFIRMED_MESSAGE,
      showResend: false,
    };
  }
  return { tone: "none", message: null, showResend: false };
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
