"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { signupWasBlockedByExistingPhone } from "@/lib/auth/account-phone-claim";
import {
  buildSignupUserMetadata,
  normalizeAccountPhone,
  PHONE_ALREADY_LINKED_MESSAGE,
  signupAuthErrorText,
} from "@/lib/auth/account-phone";
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
import { readSafeNext, getSafeInternalPath } from "@/lib/auth/safe-redirect";
import {
  buildAuthCallbackUrl,
  getAuthCallbackOrigin,
} from "@/lib/auth/site-url";
import { createClient } from "@/lib/supabase/server";
import { lookupPublicInvitation } from "@/lib/team/public-invite";
import { normalizeInviteEmail } from "@/lib/team/email-normalize";
import { isWellFormedInviteToken } from "@/lib/team/tokens";

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
   * The submitted phone is already claimed. The message must not name the
   * other account. Signup did not keep an auth user in this case.
   */
  phoneAlreadyLinked?: boolean;
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
    .max(200, "Company name is too long")
    .optional(),
  email: z.email("Invalid email address"),
  password: passwordSchema,
  invite_token: z.string().optional(),
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
    .min(1, "Company name is required")
    .max(200, "Company name is too long"),
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
    organisation_name: formData.get("organisation_name") ?? undefined,
    email: formData.get("email"),
    password: formData.get("password"),
    invite_token: formData.get("invite_token") ?? undefined,
  });
  const phone = normalizeAccountPhone(
    formData.get("phone_country"),
    formData.get("phone_number")
  );
  const rawInviteValue = formData.get("invite_token");
  const rawInvite = typeof rawInviteValue === "string" ? rawInviteValue : "";
  const inviteToken = isWellFormedInviteToken(rawInvite)
    ? rawInvite.trim()
    : null;
  const organisationMissing =
    !inviteToken &&
    !(parsed.success && parsed.data.organisation_name?.trim());

  if (!parsed.success || !phone.ok || organisationMissing) {
    return {
      fieldErrors: {
        ...(parsed.success ? {} : parsed.error.flatten().fieldErrors),
        ...(!phone.ok ? { [phone.field]: [phone.message] } : {}),
        ...(organisationMissing
          ? { organisation_name: ["Company name is required"] }
          : {}),
      },
    };
  }

  const { full_name, organisation_name, email, password } = parsed.data;

  let signupEmail = email;
  if (inviteToken) {
    const invitation = await lookupPublicInvitation(inviteToken);
    const invitedEmail = invitation?.emailDisplay?.trim() ?? "";
    if (
      !invitation ||
      invitation.expired ||
      invitation.status !== "pending" ||
      !invitedEmail
    ) {
      return {
        error: "This invitation is no longer valid.",
      };
    }
    if (normalizeInviteEmail(email) !== normalizeInviteEmail(invitedEmail)) {
      return {
        fieldErrors: {
          email: ["This invitation was sent to a different email address."],
        },
      };
    }
    signupEmail = invitedEmail;
  }

  logAuthEvent({
    event: "signup_started",
    correlationId,
  });

  const supabase = await createClient();
  const origin = await getAuthCallbackOrigin();
  const emailRedirectTo = buildAuthCallbackUrl(
    origin,
    inviteToken ? `/invite/${inviteToken}` : POST_SIGNUP_DESTINATION
  );

  const { data: authData, error: authError } = await supabase.auth.signUp({
    email: signupEmail,
    password,
    options: {
      emailRedirectTo,
      data: buildSignupUserMetadata({
        invite: Boolean(inviteToken),
        fullName: full_name,
        organisationName: organisation_name,
        phone,
      }),
    },
  });

  if (authError) {
    const providerText = signupAuthErrorText(authError);
    const category = classifyAuthProviderError(providerText, "signup");
    // Rate limit and email collision stay on the existing Auth responses.
    // The phone check runs only after that submit, and only for a database
    // save failure. It is not a public availability endpoint.
    if (
      category === "RATE_LIMITED" ||
      category === "EMAIL_ALREADY_REGISTERED"
    ) {
      return signupFail(category, correlationId, startedAt);
    }
    if (await signupWasBlockedByExistingPhone(providerText, phone.e164)) {
      logAuthEvent({
        event: "signup_failed",
        category: "PHONE_ALREADY_LINKED",
        correlationId,
        elapsedMs: Date.now() - startedAt,
      });
      return {
        phoneAlreadyLinked: true,
        error: PHONE_ALREADY_LINKED_MESSAGE,
      };
    }
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
    signupEmail,
    password,
    Boolean(authData.session)
  );

  if (!hasSession) {
    // Email confirmation required: auth user exists, but authenticated RPC
    // cannot run. Do not claim company provisioning succeeded.
    // Confirm link → /auth/callback → setup-required if profile missing
    // (or /invite/[token] when this signup is invite-aware).
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
      confirmationEmail: signupEmail,
    };
  }

  if (inviteToken) {
    // Phone is already claimed on the auth user. Do not provision a second
    // organisation. A pending invitation is accepted only after sign-in.
    logAuthEvent({
      event: "signup_completed",
      correlationId,
      userId,
      elapsedMs: Date.now() - startedAt,
    });
    return { continueTo: getSafeInternalPath(`/invite/${inviteToken}`) };
  }

  const provisioned = await provisionOrganisationForCurrentUser(supabase, {
    organisationName: organisation_name!.trim(),
    fullName: full_name,
    correlationId,
    userId,
    context: "signup",
  });

  if (!provisioned.ok) {
    if (provisioned.category === "INVITE_PENDING") {
      return { continueTo: "/invite/continue" };
    }
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
    if (provisioned.category === "INVITE_PENDING") {
      return { continueTo: "/invite/continue" };
    }
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
