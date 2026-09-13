import "server-only";

import { cache } from "react";
import { loadOrganisationName } from "@/lib/org/organisation-name-reader";
import { requireAuthOrgContext } from "@/lib/security/auth-org-context";
import { loadOrganisationSettingsRow } from "@/lib/settings/organisation-settings-reader";

export type AuthDisplayProfile = {
  userEmail?: string;
  fullName: string | null;
  role: string | null;
  organisationName: string | null;
  tradingName: string | null;
  timezone: string | null;
};

/**
 * Display fields for chrome (name, trading name). Not identity authority.
 * Request-scoped only — organisation id still comes from requireAuthOrgContext.
 */
export const getAuthDisplayProfile = cache(
  async function getAuthDisplayProfile(): Promise<AuthDisplayProfile | null> {
    const auth = await requireAuthOrgContext();
    if (!auth.ok) {
      return null;
    }

    const [organisationName, settings, { data: profile }] = await Promise.all([
      loadOrganisationName(auth.orgId),
      loadOrganisationSettingsRow(auth.orgId),
      auth.supabase
        .from("profiles")
        .select("full_name, role")
        .eq("id", auth.user.id)
        .maybeSingle(),
    ]);

    return {
      userEmail: auth.user.email,
      fullName: profile?.full_name ?? null,
      role: profile?.role ?? null,
      organisationName,
      tradingName: (settings?.trading_name as string | null) ?? null,
      timezone: (settings?.timezone as string | null) ?? null,
    };
  }
);
