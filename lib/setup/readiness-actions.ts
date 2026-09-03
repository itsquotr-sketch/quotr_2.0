"use server";

import { getAuthOrgContext } from "@/lib/security/auth-org-context";
import {
  computeCompanySetupReadiness,
  type CompanySetupReadiness,
} from "@/lib/setup/readiness";

/**
 * Single server loader for company setup readiness (one query batch).
 */
export async function getCompanySetupReadiness(): Promise<CompanySetupReadiness> {
  const context = await getAuthOrgContext();
  if (!context) {
    return computeCompanySetupReadiness({
      accountReady: false,
      organisationName: "Your company",
      onboardingStatus: null,
      currency: null,
      country: null,
      region: null,
      defaultGstRate: null,
      defaultMarginPercent: null,
      hasLabourRate: false,
      hasWorkTypePreferences: false,
      hasCalibration: false,
      tradingName: null,
      legalName: null,
      contactEmail: null,
      contactPhone: null,
      addressLine1: null,
      city: null,
    });
  }

  const { supabase, orgId } = context;

  const [{ data: organisation }, { data: settings }, { data: labourRates }, { data: companyRates }, { data: preferredWorkAreas }, { data: calibrations }] =
    await Promise.all([
      supabase.from("organisations").select("name").eq("id", orgId).maybeSingle(),
      supabase
        .from("organisation_settings")
        .select(
          "currency, country, region, timezone, default_gst_rate, default_margin_percent, onboarding_status, trading_name, legal_name, contact_email, contact_phone, address_line_1, city, logo_url"
        )
        .eq("org_id", orgId)
        .maybeSingle(),
      supabase
        .from("rates")
        .select("id")
        .eq("org_id", orgId)
        .eq("active", true)
        .eq("rate_type", "labour")
        .not("cost_rate", "is", null)
        .limit(1),
      supabase
        .from("rates")
        .select("id")
        .eq("org_id", orgId)
        .eq("active", true)
        .not("cost_rate", "is", null),
      supabase
        .from("organisation_work_areas")
        .select("id")
        .eq("org_id", orgId)
        .eq("enabled", true)
        .limit(1),
      supabase
        .from("productivity_calibration_responses")
        .select("id, calibration_task_key")
        .eq("org_id", orgId)
        .eq("status", "active"),
    ]);

  const onboardingStatus = settings?.onboarding_status as
    | "not_started"
    | "in_progress"
    | "completed"
    | null
    | undefined;

  const calibratedScenarioIds = new Set(
    (calibrations ?? []).map((row) => String(row.calibration_task_key))
  );

  return computeCompanySetupReadiness({
    accountReady: true,
    organisationName: organisation?.name ?? "Your company",
    onboardingStatus: onboardingStatus ?? null,
    currency: (settings?.currency as string | null) ?? null,
    country: (settings?.country as string | null) ?? null,
    region: (settings?.region as string | null) ?? null,
    defaultGstRate:
      settings?.default_gst_rate != null
        ? Number(settings.default_gst_rate)
        : null,
    defaultMarginPercent:
      settings?.default_margin_percent != null
        ? Number(settings.default_margin_percent)
        : null,
    hasLabourRate: (labourRates?.length ?? 0) > 0,
    hasWorkTypePreferences: (preferredWorkAreas?.length ?? 0) > 0,
    companyRateCount: companyRates?.length ?? 0,
    hasCalibration: calibratedScenarioIds.size > 0,
    calibratedScenarioCount: calibratedScenarioIds.size,
    calibrationScenarioTotal: 9,
    tradingName: (settings?.trading_name as string | null) ?? null,
    legalName: (settings?.legal_name as string | null) ?? null,
    contactEmail: (settings?.contact_email as string | null) ?? null,
    contactPhone: (settings?.contact_phone as string | null) ?? null,
    addressLine1: (settings?.address_line_1 as string | null) ?? null,
    city: (settings?.city as string | null) ?? null,
    logoUrl: (settings?.logo_url as string | null) ?? null,
    timezone: (settings?.timezone as string | null) ?? null,
  });
}
