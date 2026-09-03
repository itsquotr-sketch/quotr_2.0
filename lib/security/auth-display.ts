import "server-only";

import { cache } from "react";
import { requireAuthOrgContext } from "@/lib/security/auth-org-context";

export type AuthDisplayProfile = {
  userEmail?: string;
  fullName: string | null;
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

    const [{ data: organisation }, { data: settings }, { data: profile }] =
      await Promise.all([
        auth.supabase
          .from("organisations")
          .select("name")
          .eq("id", auth.orgId)
          .maybeSingle(),
        auth.supabase
          .from("organisation_settings")
          .select("trading_name, timezone")
          .eq("org_id", auth.orgId)
          .maybeSingle(),
        auth.supabase
          .from("profiles")
          .select("full_name")
          .eq("id", auth.user.id)
          .maybeSingle(),
      ]);

    return {
      userEmail: auth.user.email,
      fullName: profile?.full_name ?? null,
      organisationName: organisation?.name ?? null,
      tradingName: (settings?.trading_name as string | null) ?? null,
      timezone: (settings?.timezone as string | null) ?? null,
    };
  }
);
