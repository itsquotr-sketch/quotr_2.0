"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  presentAuthError,
  type AuthErrorCategory,
} from "@/lib/auth/errors";
import {
  createAuthCorrelationId,
  logAuthEvent,
} from "@/lib/auth/logging";
import { createClient } from "@/lib/supabase/server";

export type ProfileActionState = {
  error?: string;
  success?: string;
  fieldErrors?: Record<string, string[]>;
};

const fullNameSchema = z.object({
  full_name: z
    .string()
    .trim()
    .min(1, "Full name is required")
    .max(200, "Full name is too long"),
});

const changePasswordSchema = z
  .object({
    current_password: z.string().min(1, "Current password is required"),
    new_password: z
      .string()
      .min(8, "Password must be at least 8 characters"),
    confirm_password: z.string().min(1, "Confirm your new password"),
  })
  .refine((data) => data.new_password === data.confirm_password, {
    message: "New passwords do not match",
    path: ["confirm_password"],
  })
  .refine((data) => data.current_password !== data.new_password, {
    message: "New password must be different from your current password",
    path: ["new_password"],
  });

/**
 * Update the signed-in user's full name only.
 * Never accepts user id, org id, role, or email from the client.
 */
export async function updateProfileFullName(
  _prev: ProfileActionState,
  formData: FormData
): Promise<ProfileActionState> {
  const correlationId = createAuthCorrelationId();
  const startedAt = Date.now();

  const parsed = fullNameSchema.safeParse({
    full_name: formData.get("full_name"),
  });
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: presentAuthError("INVALID_CREDENTIALS") };
  }

  logAuthEvent({
    event: "profile_update_started",
    correlationId,
    userId: user.id,
  });

  const { error } = await supabase
    .from("profiles")
    .update({ full_name: parsed.data.full_name })
    .eq("id", user.id);

  if (error) {
    logAuthEvent({
      event: "profile_update_failed",
      category: "PROFILE_UPDATE_FAILED",
      correlationId,
      userId: user.id,
      elapsedMs: Date.now() - startedAt,
    });
    return { error: presentAuthError("PROFILE_UPDATE_FAILED") };
  }

  logAuthEvent({
    event: "profile_update_completed",
    correlationId,
    userId: user.id,
    elapsedMs: Date.now() - startedAt,
  });

  revalidatePath("/app", "layout");
  revalidatePath("/app/profile");

  return { success: "Profile saved." };
}

/**
 * Logged-in password change with current-password reauthentication.
 * Passwords are never logged.
 */
export async function changePassword(
  _prev: ProfileActionState,
  formData: FormData
): Promise<ProfileActionState> {
  const correlationId = createAuthCorrelationId();
  const startedAt = Date.now();

  const parsed = changePasswordSchema.safeParse({
    current_password: formData.get("current_password"),
    new_password: formData.get("new_password"),
    confirm_password: formData.get("confirm_password"),
  });

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const { current_password, new_password } = parsed.data;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    return { error: presentAuthError("INVALID_CREDENTIALS") };
  }

  logAuthEvent({
    event: "password_change_started",
    correlationId,
    userId: user.id,
  });

  // Re-authenticate with current password before allowing update.
  const { error: reauthError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: current_password,
  });

  if (reauthError) {
    const category: AuthErrorCategory = "PASSWORD_CHANGE_FAILED";
    logAuthEvent({
      event: "password_change_failed",
      category,
      correlationId,
      userId: user.id,
      elapsedMs: Date.now() - startedAt,
    });
    return { error: presentAuthError(category) };
  }

  const { error: updateError } = await supabase.auth.updateUser({
    password: new_password,
  });

  if (updateError) {
    logAuthEvent({
      event: "password_change_failed",
      category: "PASSWORD_CHANGE_FAILED",
      correlationId,
      userId: user.id,
      elapsedMs: Date.now() - startedAt,
    });
    return { error: presentAuthError("PASSWORD_CHANGE_FAILED") };
  }

  logAuthEvent({
    event: "password_change_completed",
    correlationId,
    userId: user.id,
    elapsedMs: Date.now() - startedAt,
  });

  return { success: "Password updated." };
}
