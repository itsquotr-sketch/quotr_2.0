/**
 * Map PostgREST / Postgres team RPC failures to contractor-safe copy.
 * Does not print raw Postgres text to the user.
 */

export type TeamRpcErrorLike = {
  message?: string | null;
  details?: string | null;
  hint?: string | null;
  code?: string | null;
};

export function teamRpcErrorBlob(
  error: string | TeamRpcErrorLike | null | undefined
): string {
  if (!error) return "";
  if (typeof error === "string") return error;
  return [error.message, error.details, error.hint, error.code]
    .filter((part) => typeof part === "string" && part.trim())
    .join(" ");
}

export function mapTeamRpcError(
  error: string | TeamRpcErrorLike | null | undefined
): string {
  const blob = teamRpcErrorBlob(error);
  const m = blob.toUpperCase();
  if (m.includes("INVITE_OWNER_ONLY")) {
    return "Only the Owner can invite people. Additional users are billed.";
  }
  if (m.includes("SEAT_LIMIT")) {
    return "This Business account already has 5 people including pending invitations.";
  }
  if (m.includes("INVITE_NOT_AVAILABLE")) {
    return "Team members are available on Quotr Business after you subscribe.";
  }
  if (m.includes("INVALID_EMAIL")) return "Enter a valid email address.";
  if (m.includes("INVALID_ROLE")) return "Choose Admin, Estimator, or Viewer.";
  if (m.includes("EMAIL_MISMATCH")) {
    return "Sign in with the email this invitation was sent to.";
  }
  if (m.includes("EMAIL_UNVERIFIED")) {
    return "Confirm your email before joining this company.";
  }
  if (m.includes("INVITE_EXPIRED")) return "This invitation has expired.";
  if (m.includes("INVITE_NOT_UNIQUE")) {
    return "Open the invitation link from your email for the company you want to join.";
  }
  if (
    m.includes("INVITE_NOT_PENDING") ||
    m.includes("INVITE_NOT_FOUND") ||
    m.includes("INVALID_TOKEN")
  ) {
    return "This invitation is no longer valid.";
  }
  if (m.includes("ALREADY_IN_OTHER_ORG")) {
    return "This email already belongs to a different Quotr company. A person can only be in one company.";
  }
  if (m.includes("OWNER_CANNOT_BE_REMOVED") || m.includes("OWNER_ROLE_LOCKED")) {
    return "The Owner cannot be removed or changed in this version.";
  }
  if (m.includes("REMOVE_OWNER_ONLY")) {
    return "Only the Owner can remove people from this company.";
  }
  if (m.includes("PENDING_INVITATION")) {
    return "You have an invitation to join a company. Open the invite link instead of creating a new company.";
  }
  if (m.includes("SUBSCRIPTION_SCHEDULED_TO_CANCEL")) {
    return "This subscription is scheduled to end. Resume your Business subscription before adding another user.";
  }
  if (m.includes("BILLING_NOT_ACTIVE")) {
    return "Your company's subscription needs attention before this seat can be added.";
  }
  if (m.includes("SEAT_IN_FLIGHT")) {
    return "This seat is being billed. Wait until it finishes, then you can remove the person.";
  }
  if (m.includes("NOT_AUTHENTICATED") || m.includes("PERMISSION DENIED")) {
    return "Sign in to accept this invitation.";
  }
  if (
    m.includes("23505") ||
    m.includes("UNIQUE CONSTRAINT") ||
    m.includes("DUPLICATE KEY") ||
    m.includes("PGRST116")
  ) {
    return "Seat payment is still being processed. Please wait a moment and try again.";
  }
  return "That team action could not be completed. Try again.";
}
