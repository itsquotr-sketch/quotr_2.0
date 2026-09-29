/**
 * Required first-run stage (ONBOARDING-01).
 *
 * New organisations:
 *   not_started / company → company profile
 *   work_areas, no enabled work → work types
 *   labour → carpenter and labourer internal costs
 *   ready → start the first job (still inside the focused gate)
 *   completed → app
 *
 * Finished organisations stay out of the gate:
 *   onboarding_status completed, or step completed / review / rates.
 *   `rates` is the previous "pricing visited" marker. Do not treat it as
 *   the new ready screen, or existing companies are sent through setup again.
 */

export type FirstRunStage = "basics" | "work" | "labour" | "ready" | "done";

export const FIRST_RUN_BASICS_PATH = "/app/setup?mode=basics";
export const FIRST_RUN_WORK_PATH = "/app/setup?mode=work";
export const FIRST_RUN_LABOUR_PATH = "/app/setup?mode=labour";
export const FIRST_RUN_READY_PATH = "/app/setup?mode=ready";

export type FirstRunStageInput = {
  onboardingStatus: string | null | undefined;
  onboardingStep: string | null | undefined;
  /** True when organisation_work_areas has at least one enabled row. */
  hasPrimaryWorkAreas?: boolean;
};

const GRANDFATHERED_STEPS = new Set(["completed", "review", "rates"]);

export function resolveFirstRunStage(input: FirstRunStageInput): FirstRunStage {
  const status = input.onboardingStatus ?? "not_started";
  const step = input.onboardingStep ?? "company";
  const hasWork = input.hasPrimaryWorkAreas === true;

  if (status === "completed" || GRANDFATHERED_STEPS.has(step)) {
    return "done";
  }

  if (step === "ready") return "ready";
  if (step === "labour") return "labour";

  if (status === "not_started" || step === "company") {
    return "basics";
  }

  if (step === "work_areas") {
    return hasWork ? "labour" : "work";
  }

  return "done";
}

export function firstRunIsComplete(stage: FirstRunStage): boolean {
  return stage === "done";
}

export function requiredOnboardingLocksNavigation(stage: FirstRunStage): boolean {
  return stage !== "done";
}

/** Forced resume path while required onboarding is unfinished. */
export function firstRunForcedPath(stage: FirstRunStage): string | null {
  if (stage === "basics") return FIRST_RUN_BASICS_PATH;
  if (stage === "work") return FIRST_RUN_WORK_PATH;
  if (stage === "labour") return FIRST_RUN_LABOUR_PATH;
  if (stage === "ready") return FIRST_RUN_READY_PATH;
  return null;
}

/**
 * Routes a signed-in user may open before required onboarding is complete.
 * Project, rates, company and calibration routes are not included.
 */
export function isRequiredOnboardingAllowedPath(pathname: string | null): boolean {
  if (!pathname) return false;
  const path = pathname.split("?")[0] || pathname;
  if (path === "/app/setup") return true;
  if (path === "/app/profile" || path.startsWith("/app/profile/")) return true;
  if (path === "/app/settings/billing" || path.startsWith("/app/settings/billing/")) {
    return true;
  }
  return false;
}

/**
 * Redirect when the requested setup mode does not match the current stage.
 * Finished organisations leave the wizard entirely.
 */
export function setupModeRedirect(
  requestedMode: string | undefined,
  stage: FirstRunStage
): string | null {
  if (stage === "done") {
    return "/app/dashboard";
  }

  if (stage === "basics") {
    if (requestedMode && requestedMode !== "basics") return FIRST_RUN_BASICS_PATH;
    return null;
  }

  if (stage === "work") {
    if (requestedMode !== "work") return FIRST_RUN_WORK_PATH;
    return null;
  }

  if (stage === "labour") {
    if (requestedMode !== "labour") return FIRST_RUN_LABOUR_PATH;
    return null;
  }

  if (stage === "ready") {
    if (requestedMode !== "ready") return FIRST_RUN_READY_PATH;
    return null;
  }

  return null;
}

export function setupShellMode(
  requestedMode: string | undefined,
  stage: FirstRunStage
): "basics" | "work" | "labour" | "ready" {
  if (stage === "work" || requestedMode === "work") return "work";
  if (stage === "labour" || requestedMode === "labour") return "labour";
  if (stage === "ready" || requestedMode === "ready") return "ready";
  return "basics";
}

/** Cross-tenant onboarding writes are rejected when the org ids differ. */
export function onboardingMutationIsTenantScoped(
  authOrgId: string,
  targetOrgId: string
): boolean {
  return authOrgId.length > 0 && authOrgId === targetOrgId;
}
