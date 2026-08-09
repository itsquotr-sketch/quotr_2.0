"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import {
  classifyAuthProviderError,
  presentAuthError,
  presentLoginError,
  type AuthErrorCategory,
} from "@/lib/auth/errors";
import {
  createAuthCorrelationId,
  logAuthEvent,
} from "@/lib/auth/logging";
import { passwordSchema } from "@/lib/auth/password";
import { POST_SIGNUP_DESTINATION } from "@/lib/auth/post-auth-navigation";
import { provisionOrganisationForCurrentUser } from "@/lib/auth/provisioning";
import { readSafeNext } from "@/lib/auth/safe-redirect";
import {
  buildAuthCallbackUrl,
  getAuthSiteOrigin,
} from "@/lib/auth/site-url";
import { createClient } from "@/lib/supabase/server";

export type AuthActionState = {
  error?: string;
  fieldErrors?: Record<string, string[]>;
  /**
   * When true, signup created an auth user but provisioning was deferred
   * because email confirmation left the user without a session (3.1C.1B/2B).
   */
  confirmationPending?: boolean;
  /**
   * Email the confirmation was sent to (user-provided; for confirmation UX only).
   */
  confirmationEmail?: string;
  /**
   * After session cookie mutation, client must hard-navigate here
   * (document assign). Soft Server Action redirect can blank protected RSC.
   */
  continueTo?: string;
};

const signupSchema = z.object({
  full_name: z.string().trim().min(1, "Full name is required"),
  organisation_name: z
    .string()
    .trim()
    .min(1, "Organisation name is required")
    .max(200, "Organisation name is too long"),
  email: z.email("Invalid email address"),
  password: passwordSchema,
});

const loginSchema = z.object({
  email: z.email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

const repairSchema = z.object({
  full_name: z.string().trim().min(1, "Full name is required").max(200),
  organisation_name: z
    .string()
    .trim()
    .min(1, "Organisation name is required")
    .max(200, "Organisation name is too long"),
});

function signupFail(
  category: AuthErrorCategory,
  correlationId: string,
  startedAt: number,
  extras?: {
    userId?: string;
    orgId?: string;
    confirmationPending?: boolean;
    confirmationEmail?: string;
  }
): AuthActionState {
  logAuthEvent({
    event: "signup_failed",
    category,
    correlationId,
    elapsedMs: Date.now() - startedAt,
    userId: extras?.userId,
    orgId: extras?.orgId,
  });
  return {
    error: presentAuthError(category),
    confirmationPending: extras?.confirmationPending,
    confirmationEmail: extras?.confirmationEmail,
  };
}

/**
 * Ensure an authenticated session exists after signUp.
 * Returns true when a session is available for the provisioning RPC.
 */
async function ensureSignupSession(
  supabase: Awaited<ReturnType<typeof createClient>>,
  email: string,
  password: string,
  hasSession: boolean
): Promise<boolean> {
  if (hasSession) {
    return true;
  }

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  return !error;
}

export async function signup(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const correlationId = createAuthCorrelationId();
  const startedAt = Date.now();

  const parsed = signupSchema.safeParse({
    full_name: formData.get("full_name"),
    organisation_name: formData.get("organisation_name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const { full_name, organisation_name, email, password } = parsed.data;

  logAuthEvent({
    event: "signup_started",
    correlationId,
  });

  const supabase = await createClient();
  const origin = await getAuthSiteOrigin();
  const emailRedirectTo = buildAuthCallbackUrl(origin, "/app/dashboard");

  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo,
      data: {
        full_name,
        organisation_name,
      },
    },
  });

  if (authError) {
    const category = classifyAuthProviderError(authError.message, "signup");
    return signupFail(category, correlationId, startedAt);
  }

  if (!authData.user) {
    return signupFail("SIGNUP_FAILED", correlationId, startedAt);
  }

  const userId = authData.user.id;

  logAuthEvent({
    event: "auth_user_created",
    correlationId,
    userId,
  });

  const hasSession = await ensureSignupSession(
    supabase,
    email,
    password,
    Boolean(authData.session)
  );

  if (!hasSession) {
    // Email confirmation required: auth user exists, but authenticated RPC
    // cannot run. Do not claim company provisioning succeeded.
    // Confirm link → /auth/callback → setup-required if profile missing.
    logAuthEvent({
      event: "confirmation_pending",
      category: "CONFIRMATION_PENDING",
      correlationId,
      userId,
      elapsedMs: Date.now() - startedAt,
    });
    return {
      error: presentAuthError("CONFIRMATION_PENDING"),
      confirmationPending: true,
      confirmationEmail: email,
    };
  }

  const provisioned = await provisionOrganisationForCurrentUser(supabase, {
    organisationName: organisation_name,
    fullName: full_name,
    correlationId,
    userId,
    context: "signup",
  });

  if (!provisioned.ok) {
    return signupFail(provisioned.category, correlationId, startedAt, {
      userId,
    });
  }

  logAuthEvent({
    event: "signup_completed",
    correlationId,
    userId,
    orgId: provisioned.orgId,
    elapsedMs: Date.now() - startedAt,
    alreadyProvisioned: provisioned.alreadyProvisioned,
  });

  // Hard document navigation on the client — soft redirect after Set-Cookie
  // can leave /app/setup?mode=basics blank until manual refresh (R2E-R1).
  return { continueTo: POST_SIGNUP_DESTINATION };
}

export async function login(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const correlationId = createAuthCorrelationId();
  const startedAt = Date.now();

  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const next = readSafeNext(formData);
  const { email, password } = parsed.data;
  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    const category = classifyAuthProviderError(error.message, "login");
    logAuthEvent({
      event: "login_failed",
      category,
      correlationId,
      elapsedMs: Date.now() - startedAt,
    });
    return { error: presentLoginError(category) };
  }

  // Hard document navigation — cookies must be visible to the next RSC load.
  return { continueTo: next };
}

/**
 * Finish company setup for an authenticated user missing profile/org.
 * Uses the same transactional RPC as signup (idempotent).
 */
export async function finishAccountSetup(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const correlationId = createAuthCorrelationId();
  const startedAt = Date.now();

  const parsed = repairSchema.safeParse({
    full_name: formData.get("full_name"),
    organisation_name: formData.get("organisation_name"),
  });

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const { full_name, organisation_name } = parsed.data;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: presentAuthError("INVALID_CREDENTIALS") };
  }

  const provisioned = await provisionOrganisationForCurrentUser(supabase, {
    organisationName: organisation_name,
    fullName: full_name,
    correlationId,
    userId: user.id,
    context: "repair",
  });

  if (!provisioned.ok) {
    logAuthEvent({
      event: "account_repair_failed",
      category: provisioned.category,
      correlationId,
      userId: user.id,
      elapsedMs: Date.now() - startedAt,
    });
    return { error: presentAuthError(provisioned.category) };
  }

  logAuthEvent({
    event: "account_repair_completed",
    correlationId,
    userId: user.id,
    orgId: provisioned.orgId,
    elapsedMs: Date.now() - startedAt,
  });

  return { continueTo: POST_SIGNUP_DESTINATION };
}

export async function logout() {
  const correlationId = createAuthCorrelationId();
  const supabase = await createClient();

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    await supabase.auth.signOut();
    logAuthEvent({
      event: "logout",
      correlationId,
      userId: user?.id,
    });
  } catch {
    logAuthEvent({
      event: "logout",
      category: "LOGOUT_FAILED",
      correlationId,
    });
    // Still redirect — session may already be cleared.
  }

  redirect("/login");
}
