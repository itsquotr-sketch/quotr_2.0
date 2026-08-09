"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import {
  classifyAuthProviderError,
  PASSWORD_RESET_REQUEST_ACK,
  presentAuthError,
  type AuthErrorCategory,
} from "@/lib/auth/errors";
import {
  createAuthCorrelationId,
  logAuthEvent,
} from "@/lib/auth/logging";
import { newPasswordPairSchema } from "@/lib/auth/password";
import {
  buildAuthCallbackUrl,
  getAuthSiteOrigin,
} from "@/lib/auth/site-url";
import { createClient } from "@/lib/supabase/server";

export type RecoveryActionState = {
  error?: string;
  success?: string;
  fieldErrors?: Record<string, string[]>;
};

const emailSchema = z.object({
  email: z.email("Invalid email address"),
});

/**
 * Request a password reset email. Always returns non-enumerating success copy
 * on the happy path (and for unknown emails when the provider does not error).
 */
export async function requestPasswordReset(
  _prev: RecoveryActionState,
  formData: FormData
): Promise<RecoveryActionState> {
  const correlationId = createAuthCorrelationId();
  const startedAt = Date.now();

  const parsed = emailSchema.safeParse({
    email: formData.get("email"),
  });
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const { email } = parsed.data;
  const supabase = await createClient();
  const origin = await getAuthSiteOrigin();
  const redirectTo = buildAuthCallbackUrl(origin, "/reset-password");

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo,
  });

  if (error) {
    const category = classifyAuthProviderError(error.message, "reset_request");
    logAuthEvent({
      event: "password_reset_failed",
      category,
      correlationId,
      elapsedMs: Date.now() - startedAt,
    });
    // Rate limit is the only failure we surface distinctly; otherwise keep
    // non-enumerating ack for provider "user not found" style responses.
    if (category === "RATE_LIMITED") {
      return { error: presentAuthError("RATE_LIMITED") };
    }
    logAuthEvent({
      event: "password_reset_requested",
      correlationId,
      elapsedMs: Date.now() - startedAt,
    });
    return { success: PASSWORD_RESET_REQUEST_ACK };
  }

  logAuthEvent({
    event: "password_reset_requested",
    correlationId,
    elapsedMs: Date.now() - startedAt,
  });

  return { success: PASSWORD_RESET_REQUEST_ACK };
}

/**
 * Set a new password while authenticated via a recovery session.
 * Does not require the current password.
 */
export async function resetPasswordWithRecoverySession(
  _prev: RecoveryActionState,
  formData: FormData
): Promise<RecoveryActionState> {
  const correlationId = createAuthCorrelationId();
  const startedAt = Date.now();

  const parsed = newPasswordPairSchema.safeParse({
    new_password: formData.get("new_password"),
    confirm_password: formData.get("confirm_password"),
  });
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: presentAuthError("RESET_LINK_INVALID") };
  }

  const { error } = await supabase.auth.updateUser({
    password: parsed.data.new_password,
  });

  if (error) {
    const category: AuthErrorCategory = classifyAuthProviderError(
      error.message,
      "password_reset"
    );
    logAuthEvent({
      event: "password_reset_failed",
      category,
      correlationId,
      userId: user.id,
      elapsedMs: Date.now() - startedAt,
    });
    return {
      error: presentAuthError(
        category === "RATE_LIMITED" ? "RATE_LIMITED" : "PASSWORD_RESET_FAILED"
      ),
    };
  }

  logAuthEvent({
    event: "password_reset_completed",
    correlationId,
    userId: user.id,
    elapsedMs: Date.now() - startedAt,
  });

  // Session remains valid after updateUser({ password }) — route through the
  // normal app gate (dashboard or setup-required via layout).
  redirect("/app/dashboard");
}

/**
 * Resend signup confirmation email. Non-enumerating success copy.
 */
export async function resendSignupConfirmation(
  _prev: RecoveryActionState,
  formData: FormData
): Promise<RecoveryActionState> {
  const correlationId = createAuthCorrelationId();
  const startedAt = Date.now();

  const parsed = emailSchema.safeParse({
    email: formData.get("email"),
  });
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createClient();
  const origin = await getAuthSiteOrigin();
  const emailRedirectTo = buildAuthCallbackUrl(origin, "/app/dashboard");

  const { error } = await supabase.auth.resend({
    type: "signup",
    email: parsed.data.email,
    options: { emailRedirectTo },
  });

  if (error) {
    const category = classifyAuthProviderError(error.message, "resend");
    logAuthEvent({
      event: "confirmation_resend_failed",
      category,
      correlationId,
      elapsedMs: Date.now() - startedAt,
    });
    if (category === "RATE_LIMITED") {
      return { error: presentAuthError("RATE_LIMITED") };
    }
    // Non-enumerating: still acknowledge for most provider failures.
    return {
      success:
        "If that email can receive a confirmation link, we've sent another one.",
    };
  }

  logAuthEvent({
    event: "confirmation_resend_requested",
    correlationId,
    elapsedMs: Date.now() - startedAt,
  });

  return {
    success:
      "If that email can receive a confirmation link, we've sent another one.",
  };
}
