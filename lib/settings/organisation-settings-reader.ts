/**
 * PERFORMANCE-01B — request-scoped raw organisation_settings reader.
 *
 * SELECT only. No insert, update, ensure, or create-if-missing.
 * No centralised defaulting — consumers keep their own defaults.
 *
 * React.cache key: orgId. One request + one org → one SELECT.
 */
import "server-only";

import { cache } from "react";
import { requireAuthOrgContext } from "@/lib/security/auth-org-context";

export const ORGANISATION_SETTINGS_RAW_SELECT =
  "id, org_id, trading_name, legal_name, contact_email, contact_phone, timezone, currency, country, region, default_gst_rate, default_margin_percent, default_contingency_percent, budget_rate_factor, premium_rate_factor, onboarding_status, onboarding_step, onboarding_completed_at, prefer_user_rates, allow_benchmark_rates, show_profit_in_estimates, address_line_1, city, logo_url, default_material_wastage_percent, decking_wastage_percent, sheet_material_wastage_percent, flooring_wastage_percent, paint_wastage_percent, timber_framing_wastage_percent";

export type OrganisationSettingsRawRow = Record<string, unknown>;

async function loadOrganisationSettingsRowUncached(
  orgId: string
): Promise<OrganisationSettingsRawRow | null> {
  const auth = await requireAuthOrgContext();
  if (!auth.ok || auth.orgId !== orgId) {
    return null;
  }

  const { data, error } = await auth.supabase
    .from("organisation_settings")
    .select(ORGANISATION_SETTINGS_RAW_SELECT)
    .eq("org_id", orgId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data as OrganisationSettingsRawRow;
}

export const loadOrganisationSettingsRow: (
  orgId: string
) => Promise<OrganisationSettingsRawRow | null> = cache(
  loadOrganisationSettingsRowUncached
);
