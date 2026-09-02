import "server-only";

import { createClient } from "@/lib/supabase/server";
import { hashInviteToken, isWellFormedInviteToken } from "@/lib/team/tokens";
import { isMembershipRole, type MembershipRole } from "@/lib/team/roles";

export type InviteWaitKind = "queued" | "payment_attention";

export type PublicInvitationView = {
  organisationName: string;
  role: MembershipRole;
  status: string;
  expiresAt: string;
  inviterName: string;
  emailDisplay: string;
  expired: boolean;
  waitKind: InviteWaitKind | null;
};

function mapWaitKind(value: string | null | undefined): InviteWaitKind | null {
  if (value === "queued" || value === "payment_attention") return value;
  return null;
}

function mapPublicRow(row: {
  organisation_name: string | null;
  role: string | null;
  status: string | null;
  expires_at: string | null;
  inviter_name: string | null;
  email_display: string | null;
  wait_kind?: string | null;
}): PublicInvitationView | null {
  if (!row.organisation_name || !row.role || !isMembershipRole(row.role)) {
    return null;
  }
  const status = row.status ?? "pending";
  const expiresAt = row.expires_at ?? new Date(0).toISOString();
  return {
    organisationName: row.organisation_name,
    role: row.role,
    status,
    expiresAt,
    inviterName: row.inviter_name?.trim() || "A teammate",
    emailDisplay: row.email_display ?? "",
    expired: status === "expired" || status === "cancelled" || status === "accepted",
    waitKind: mapWaitKind(row.wait_kind),
  };
}

export async function lookupPublicInvitation(
  rawToken: string
): Promise<PublicInvitationView | null> {
  if (!isWellFormedInviteToken(rawToken)) {
    return null;
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(
    "lookup_organisation_invitation_public",
    { p_token_hash: hashInviteToken(rawToken) }
  );
  if (error || !data) {
    return null;
  }
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return null;
  return mapPublicRow(row);
}

export async function lookupPendingInvitationForCurrentUser(): Promise<
  | { kind: "none" }
  | { kind: "one"; view: PublicInvitationView }
  | { kind: "multiple" }
> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(
    "lookup_pending_invitation_for_current_user"
  );
  if (error || !data) {
    return { kind: "none" };
  }
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return { kind: "none" };
  const count = Number(row.invite_count ?? 0);
  if (count > 1) return { kind: "multiple" };
  if (count !== 1) return { kind: "none" };
  const view = mapPublicRow(row);
  if (!view) return { kind: "none" };
  return { kind: "one", view };
}
