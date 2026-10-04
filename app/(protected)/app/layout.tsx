import { Suspense } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/AuthShell";
import { QuotrLoader } from "@/components/brand/QuotrLoader";
import { AppShell } from "@/components/layout/app-shell";
import { OnboardingFrame } from "@/components/setup/OnboardingFrame";
import { getOrgBillingState } from "@/lib/billing/server";
import { resolveEffectiveAccessPolicy } from "@/lib/billing/access-policy";
import { shouldShowTeamPrimaryNav } from "@/lib/billing/team-nav-visibility";
import {
  resolveTrialBannerNotice,
  type TrialBannerNotice,
} from "@/lib/billing/trial-countdown";
import { internalDeploymentLabel } from "@/lib/deployment/environment";
import { getAuthDisplayProfile } from "@/lib/security/auth-display";
import { requireAuthOrgContext } from "@/lib/security/auth-org-context";
import { getFirstRunStage, getOnboardingAccess } from "@/lib/setup/actions";
import { resolveProtectedOnboardingAccess } from "@/lib/setup/first-run-stage";
import { memberCanCreateProjects } from "@/lib/team/permissions";
import { lookupPendingInvitationForCurrentUser } from "@/lib/team/public-invite";

const SETUP_REQUIRED_PATH = "/app/setup-required";

function isSetupRequiredPath(pathname: string | null): boolean {
  if (!pathname) {
    return false;
  }
  return (
    pathname === SETUP_REQUIRED_PATH ||
    pathname.startsWith(`${SETUP_REQUIRED_PATH}/`)
  );
}

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense
      fallback={
        <QuotrLoader variant="fullscreen" status="Loading Quotr…" />
      }
    >
      <AuthenticatedApp>{children}</AuthenticatedApp>
    </Suspense>
  );
}

async function AuthenticatedApp({
  children,
}: {
  children: React.ReactNode;
}) {
  const headerStore = await headers();
  const pathname = headerStore.get("x-pathname");
  const onSetupRequired = isSetupRequiredPath(pathname);

  const auth = await requireAuthOrgContext();

  if (!auth.ok) {
    if (auth.code === "not_authenticated") {
      redirect("/login");
    }

    if (!onSetupRequired) {
      const pending = await lookupPendingInvitationForCurrentUser();
      if (pending.kind !== "none") {
        redirect("/invite/continue");
      }
      redirect(SETUP_REQUIRED_PATH);
    }

    return <AuthShell>{children}</AuthShell>;
  }

  if (onSetupRequired) {
    redirect("/app/dashboard");
  }

  const [display, firstRunStage, onboardingAccess, billingState] = await Promise.all([
    getAuthDisplayProfile(),
    getFirstRunStage(),
    getOnboardingAccess(),
    getOrgBillingState(auth.orgId).catch(() => null),
  ]);

  const onboardingAccessDecision = resolveProtectedOnboardingAccess({
    stage: firstRunStage,
    role: onboardingAccess.role,
    pathname,
  });
  if (onboardingAccessDecision.redirectTo) {
    redirect(onboardingAccessDecision.redirectTo);
  }
  const onboardingLocked = onboardingAccessDecision.lockNavigation;

  if (onboardingLocked) {
    return (
      <OnboardingFrame
        userEmail={display?.userEmail ?? auth.user.email}
        fullName={display?.fullName}
        organisationName={display?.organisationName}
        tradingName={display?.tradingName}
        deploymentLabel={internalDeploymentLabel()}
      >
        {children}
      </OnboardingFrame>
    );
  }

  let billingNotice: TrialBannerNotice | null = null;
  let showTeamNav = false;
  if (billingState) {
    try {
      const policy = resolveEffectiveAccessPolicy({
        subscription: billingState.subscription,
        activeOverride: billingState.activeOverride,
      });
      showTeamNav = shouldShowTeamPrimaryNav({
        source: policy.source,
        planCode: policy.planCode,
      });
      // Banner uses the same effective entitlement as access enforcement.
      // Active override / paid Stripe hide trial chrome even when a historical
      // internal_trial row remains. Lookup failure above leaves notice null
      // (neutral — no false "Trial ended" flash before state resolves).
      if (!pathname?.startsWith("/app/settings/billing")) {
        billingNotice = resolveTrialBannerNotice({
          subscription: billingState.subscription,
          activeOverride: billingState.activeOverride,
          effectiveTrialState: billingState.effectiveTrialState,
        });
      }
    } catch {
      billingNotice = null;
      showTeamNav = false;
    }
  }

  return (
    <AppShell
      userEmail={display?.userEmail ?? auth.user.email}
      fullName={display?.fullName}
      organisationName={display?.organisationName}
      tradingName={display?.tradingName}
      setupIncomplete={false}
      incompleteSetupNotice={onboardingAccess.incompleteSetupNotice}
      incompleteSetupCategories={onboardingAccess.noticeCategories}
      incompleteSetupReviewHref={
        onboardingAccess.role === "owner" || onboardingAccess.role === "admin"
          ? onboardingAccess.noticeReviewPath
          : null
      }
      showTeamNav={showTeamNav}
      deploymentLabel={internalDeploymentLabel()}
      billingNotice={billingNotice}
      displayTimezone={display?.timezone ?? null}
      canCreateProject={memberCanCreateProjects(onboardingAccess.role)}
    >
      {children}
    </AppShell>
  );
}
