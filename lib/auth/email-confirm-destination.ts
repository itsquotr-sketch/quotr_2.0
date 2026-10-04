/**
 * Email-confirm routing after PKCE callback (BETA-1).
 *
 * Ordinary Owner signup must not land on invitation UX.
 * Invite-aware confirm links (next=/invite/…) stay on the invite path.
 */

import { POST_SIGNUP_DESTINATION } from "@/lib/auth/post-auth-navigation";

export type PendingInviteKind = "none" | "one" | "multiple";

export type EmailConfirmRouteInput = {
  next: string;
  hasOrg: boolean;
  pendingInvite: PendingInviteKind;
  provisioned: boolean;
};

export function resolveEmailConfirmDestination(
  input: EmailConfirmRouteInput
): string {
  if (input.next.startsWith("/reset-password")) {
    return "/reset-password";
  }
  if (input.next.startsWith("/invite/")) {
    return input.next;
  }
  if (input.hasOrg || input.provisioned) {
    return POST_SIGNUP_DESTINATION;
  }
  if (input.pendingInvite !== "none") {
    return "/invite/continue";
  }
  return "/app/setup-required";
}

export function organisationNameFromUserMetadata(
  metadata: Record<string, unknown> | null | undefined
): string | null {
  if (!metadata) return null;
  const raw = metadata.organisation_name;
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function fullNameFromUserMetadata(
  metadata: Record<string, unknown> | null | undefined,
  fallbackEmail?: string | null
): string {
  return (
    explicitFullNameFromUserMetadata(metadata) ??
    fallbackDisplayName(fallbackEmail)
  );
}

/** Signup `user_metadata.full_name` only. Email prefixes and placeholders are not stored values. */
export function explicitFullNameFromUserMetadata(
  metadata: Record<string, unknown> | null | undefined
): string | null {
  if (!metadata) return null;
  const raw = metadata.full_name;
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function fallbackDisplayName(fallbackEmail?: string | null): string {
  const email = fallbackEmail?.trim();
  if (email) return email.split("@")[0] ?? "Owner";
  return "Owner";
}

/**
 * Self-service signup may create one organisation from verified metadata.
 * Existing members and pending invitations must not get a second organisation.
 */
export function shouldProvisionSignupOrganisation(input: {
  hasOrg: boolean;
  pendingInvite: PendingInviteKind;
  organisationName: string | null;
  fullName: string | null;
}): boolean {
  return (
    !input.hasOrg &&
    input.pendingInvite === "none" &&
    input.organisationName !== null &&
    input.fullName !== null
  );
}

/** Repair inputs use stored metadata. An empty string keeps the placeholder visible. */
export function repairFieldValue(stored: string | null | undefined): string {
  if (typeof stored !== "string") return "";
  return stored.trim();
}
