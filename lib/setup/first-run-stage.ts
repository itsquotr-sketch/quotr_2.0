/**
 * First-run setup stage (BETA-1.5).
 *
 * Authority is existing organisation_settings columns plus
 * organisation_work_areas.enabled. No new schema.
 *
 *   onboarding_status / onboarding_step
 *   not_started / company     → Company Basics
 *   in_progress / work_areas  → company saved
 *     + no enabled work area  → Your Work (new signup)
 *     + ≥1 enabled work area  → Pricing Basics not visited
 *   in_progress / rates       → Pricing Basics saved or consciously skipped
 *   review | completed        → first-run finished (legacy wizard or later)
 *
 * Existing onboarded orgs (rates / review / completed) are never sent back
 * to Your Work. Missing preferences surface on the Dashboard ladder.
 *
 * Skipping labour is not the same as never visiting Pricing: skip still
 * writes onboarding_step = rates via savePricingBasics.
 */

export type FirstRunStage = "basics" | "work" | "pricing" | "ready" | "done";

export const FIRST_RUN_BASICS_PATH = "/app/setup?mode=basics";
export const FIRST_RUN_WORK_PATH = "/app/setup?mode=work";
export const FIRST_RUN_PRICING_PATH = "/app/setup?mode=pricing";
export const FIRST_RUN_READY_PATH = "/app/setup?mode=ready";

export type FirstRunStageInput = {
  onboardingStatus: string | null | undefined;
  onboardingStep: string | null | undefined;
  /** True when organisation_work_areas has at least one enabled row. */
  hasPrimaryWorkAreas?: boolean;
};

export function resolveFirstRunStage(input: FirstRunStageInput): FirstRunStage {
  const status = input.onboardingStatus ?? "not_started";
  const step = input.onboardingStep ?? "company";
  const hasWork = input.hasPrimaryWorkAreas === true;

  if (status === "completed" || step === "completed" || step === "review") {
    return "done";
  }

  if (status === "not_started" || step === "company") {
    return "basics";
  }

  if (step === "work_areas") {
    return hasWork ? "pricing" : "work";
  }

  if (step === "rates") {
    return "ready";
  }

  return "done";
}

export function firstRunIsComplete(stage: FirstRunStage): boolean {
  return stage === "ready" || stage === "done";
}

/** Forced resume path while first-run is unfinished. Null once pricing is visited. */
export function firstRunForcedPath(stage: FirstRunStage): string | null {
  if (stage === "basics") return FIRST_RUN_BASICS_PATH;
  if (stage === "work") return FIRST_RUN_WORK_PATH;
  if (stage === "pricing") return FIRST_RUN_PRICING_PATH;
  return null;
}

/**
 * Redirect when the requested setup mode does not match current stage.
 * Never sends an unfinished company→work→pricing user to Dashboard.
 */
export function setupModeRedirect(
  requestedMode: string | undefined,
  stage: FirstRunStage
): string | null {
  if (stage === "basics") {
    if (requestedMode && requestedMode !== "basics") {
      return FIRST_RUN_BASICS_PATH;
    }
    return null;
  }

  if (stage === "work") {
    if (requestedMode !== "work") {
      return FIRST_RUN_WORK_PATH;
    }
    return null;
  }

  if (stage === "pricing") {
    if (requestedMode !== "pricing") {
      return FIRST_RUN_PRICING_PATH;
    }
    return null;
  }

  if (requestedMode === "basics") {
    if (stage === "ready") return FIRST_RUN_READY_PATH;
    return "/app/dashboard";
  }

  if (requestedMode === "work") {
    if (stage === "ready") return FIRST_RUN_READY_PATH;
    if (stage === "done") return "/app/dashboard";
    return null;
  }

  return null;
}

export function setupShellMode(
  requestedMode: string | undefined,
  stage: FirstRunStage
): "basics" | "work" | "pricing" | "ready" | "improve" {
  if (requestedMode === "work") return "work";
  if (requestedMode === "pricing") return "pricing";
  if (requestedMode === "ready") return "ready";
  if (requestedMode === "basics" || stage === "basics") return "basics";
  return "improve";
}
