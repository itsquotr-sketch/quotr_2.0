/**
 * POLISH-02 — setup completion from persisted organisation truth.
 * Presentation only. Does not invent frontend-only complete flags.
 */
import type { SetupState } from "@/components/setup/types";

export type SetupCompletionHub = {
  preferredWorkAreaTypes: string[];
  progress: Array<{
    workAreaType: string;
    status: "benchmarks" | "partly" | "calibrated";
    highImpactCalibrated: number;
    highImpactTotal: number;
    calibratedCount: number;
    taskTotal: number;
  }>;
};

export function isCompanyBasicsComplete(state: SetupState): boolean {
  const settings = state.settings;
  if (!settings) return false;
  if (settings.onboarding_status === "not_started") return false;
  return Boolean(settings.contact_email?.trim());
}

export function enabledWorkAreas(state: SetupState) {
  return state.workAreas.filter((area) => area.enabled);
}

export function isWorkAreasComplete(state: SetupState): boolean {
  return enabledWorkAreas(state).length > 0;
}

export function companyRatesWithCost(state: SetupState) {
  return state.rates.filter((rate) => rate.cost_rate != null);
}

export function isRatesSetupComplete(state: SetupState): boolean {
  return companyRatesWithCost(state).length > 0;
}

export function isCalibrationSetupComplete(
  hub: SetupCompletionHub | null | undefined
): boolean {
  if (!hub || hub.progress.length === 0) return false;
  const preferred = hub.progress.filter((area) =>
    hub.preferredWorkAreaTypes.includes(area.workAreaType)
  );
  const areas = preferred.length > 0 ? preferred : hub.progress;
  return areas.some(
    (area) =>
      area.status === "calibrated" ||
      (area.highImpactTotal > 0 &&
        area.highImpactCalibrated >= Math.min(2, area.highImpactTotal))
  );
}

export function companyBasicsSummary(state: SetupState): string {
  const email = state.settings?.contact_email?.trim();
  if (email) return email;
  if (state.organisationName.trim()) return state.organisationName.trim();
  return "Complete";
}

export function workAreasSummary(state: SetupState): string {
  const enabled = enabledWorkAreas(state);
  if (enabled.length === 1) return enabled[0]?.label ?? "1 Work Area";
  return `${enabled.length} Work Areas`;
}

export function ratesSetupSummary(state: SetupState): string {
  const count = companyRatesWithCost(state).length;
  if (count === 1) return "1 company rate set";
  return `${count} company rates set`;
}

export function calibrationSetupSummary(
  hub: SetupCompletionHub | null | undefined
): string {
  if (!hub) return "Set";
  const preferred = hub.progress.filter((area) =>
    hub.preferredWorkAreaTypes.includes(area.workAreaType)
  );
  const areas = preferred.length > 0 ? preferred : hub.progress;
  const calibrated = areas.filter((area) => area.status === "calibrated").length;
  if (calibrated === areas.length && areas.length > 0) {
    return "Using your crew times";
  }
  const highImpact = areas.reduce(
    (sum, area) => sum + area.highImpactCalibrated,
    0
  );
  const highImpactTotal = areas.reduce(
    (sum, area) => sum + area.highImpactTotal,
    0
  );
  if (highImpactTotal > 0) {
    return `${highImpact} of ${highImpactTotal} key tasks calibrated`;
  }
  return "Set";
}
