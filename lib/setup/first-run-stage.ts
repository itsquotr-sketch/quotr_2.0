/**
 * Required first-run stage.
 *
 * Field authority resumes an unfinished organisation at the first missing
 * answer: basics, address, tax, work, labour, then ready.
 * Address and tax still open the current company form until the six-step
 * screens exist.
 *
 * Finished organisations stay out of the gate when status or step is
 * `completed`. `rates` and `review` are not completion. The migration
 * canonicalises those historical rows before this rule is deployed.
 */

import type { MembershipRole } from "@/lib/team/roles";
import {
  assessRequiredOnboarding,
  isCanonicalOnboardingComplete,
  type OnboardingAuthoritySnapshot,
} from "@/lib/setup/onboarding-authority";

export type FirstRunStage =
  | "basics"
  | "address"
  | "tax"
  | "work"
  | "labour"
  | "ready"
  | "done";

export const FIRST_RUN_BASICS_PATH = "/app/setup?mode=basics";
export const FIRST_RUN_ADDRESS_PATH = "/app/setup?mode=address";
export const FIRST_RUN_TAX_PATH = "/app/setup?mode=tax";
export const FIRST_RUN_WORK_PATH = "/app/setup?mode=work";
export const FIRST_RUN_LABOUR_PATH = "/app/setup?mode=labour";
export const FIRST_RUN_READY_PATH = "/app/setup?mode=ready";

export type FirstRunStageInput = {
  onboardingStatus: string | null | undefined;
  onboardingStep: string | null | undefined;
  /** True when organisation_work_areas has at least one enabled row. */
  hasPrimaryWorkAreas?: boolean;
  /**
   * When present, resume follows the stored answers. Omitted only by
   * step-only callers. The protected layout always supplies it.
   */
  authority?: OnboardingAuthoritySnapshot | null;
};

export function resolveFirstRunStage(input: FirstRunStageInput): FirstRunStage {
  if (
    isCanonicalOnboardingComplete(input.onboardingStatus, input.onboardingStep)
  ) {
    return "done";
  }

  if (input.authority) {
    return assessRequiredOnboarding(input.authority).stage;
  }

  const status = input.onboardingStatus ?? "not_started";
  const step = input.onboardingStep ?? "company";
  const hasWork = input.hasPrimaryWorkAreas === true;

  if (step === "ready") return "ready";
  if (step === "labour") return "labour";
  if (status === "not_started" || step === "company") return "basics";
  if (step === "work_areas") return hasWork ? "labour" : "work";

  // rates, review, and unknown steps are unfinished. They do not open the app.
  return "basics";
}

export function firstRunIsComplete(stage: FirstRunStage): boolean {
  return stage === "done";
}

export function requiredOnboardingLocksNavigation(stage: FirstRunStage): boolean {
  return stage !== "done";
}

/** Forced resume path while the owner is still inside required setup. */
export function firstRunForcedPath(stage: FirstRunStage): string | null {
  if (stage === "basics") return FIRST_RUN_BASICS_PATH;
  if (stage === "address") return FIRST_RUN_ADDRESS_PATH;
  if (stage === "tax") return FIRST_RUN_TAX_PATH;
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

export function isCompanySetupWizardPath(pathname: string | null): boolean {
  if (!pathname) return false;
  const path = pathname.split("?")[0] || pathname;
  return path === "/app/setup";
}

export type OnboardingAccessDecision = {
  lockNavigation: boolean;
  redirectTo: string | null;
};

/**
 * Owner is forced through unfinished setup.
 * Admin may enter the app and may open setup, and is not trapped.
 * Estimator and Viewer enter the app and are not sent into the company form.
 * A completed organisation is never redirected, for every role.
 * An unknown role is not trapped: only a known owner is forced.
 */
export function resolveProtectedOnboardingAccess(input: {
  stage: FirstRunStage;
  role: MembershipRole | null;
  pathname: string | null;
}): OnboardingAccessDecision {
  if (input.stage === "done") {
    return { lockNavigation: false, redirectTo: null };
  }

  if (input.role !== "owner") {
    if (isCompanySetupWizardPath(input.pathname) && input.role !== "admin") {
      return { lockNavigation: false, redirectTo: "/app/dashboard" };
    }
    return { lockNavigation: false, redirectTo: null };
  }

  const forced = firstRunForcedPath(input.stage);
  if (forced && !isRequiredOnboardingAllowedPath(input.pathname)) {
    return { lockNavigation: true, redirectTo: forced };
  }
  return { lockNavigation: true, redirectTo: null };
}

/**
 * Redirect when the requested setup mode does not match the current stage.
 * Address and tax use their own mode values. The current screen still
 * renders the combined company form for those modes.
 * Finished organisations leave the wizard entirely.
 */
export function setupModeRedirect(
  requestedMode: string | undefined,
  stage: FirstRunStage
): string | null {
  if (stage === "done") {
    return "/app/dashboard";
  }

  const expected =
    stage === "basics"
      ? "basics"
      : stage === "address"
        ? "address"
        : stage === "tax"
          ? "tax"
          : stage === "work"
            ? "work"
            : stage === "labour"
              ? "labour"
              : stage === "ready"
                ? "ready"
                : null;
  if (!expected) return null;
  if (requestedMode !== expected) return firstRunForcedPath(stage);
  return null;
}

export function setupShellMode(
  requestedMode: string | undefined,
  stage: FirstRunStage
): "basics" | "work" | "labour" | "ready" {
  const mode = requestedMode ?? stage;
  if (mode === "work" || stage === "work") return "work";
  if (mode === "labour" || stage === "labour") return "labour";
  if (mode === "ready" || stage === "ready") return "ready";
  return "basics";
}

/** Cross-tenant onboarding writes are rejected when the org ids differ. */
export function onboardingMutationIsTenantScoped(
  authOrgId: string,
  targetOrgId: string
): boolean {
  return authOrgId.length > 0 && authOrgId === targetOrgId;
}
