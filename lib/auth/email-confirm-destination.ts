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
  if (metadata) {
    const raw = metadata.full_name;
    if (typeof raw === "string" && raw.trim()) return raw.trim();
  }
  const email = fallbackEmail?.trim();
  if (email) return email.split("@")[0] ?? "Owner";
  return "Owner";
}
