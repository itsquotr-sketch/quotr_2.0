import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { getOrgBillingState } from "@/lib/billing/server";
import { resolveEffectiveAccessPolicy } from "@/lib/billing/access-policy";
import { shouldShowTeamPrimaryNav } from "@/lib/billing/team-nav-visibility";
import {
  deriveTrialCountdown,
  trialBannerNotice,
  type TrialBannerNotice,
} from "@/lib/billing/trial-countdown";
import { internalDeploymentLabel } from "@/lib/deployment/environment";
import { getAuthDisplayProfile } from "@/lib/security/auth-display";
import { requireAuthOrgContext } from "@/lib/security/auth-org-context";
import { getFirstRunStage } from "@/lib/setup/actions";
import { firstRunForcedPath } from "@/lib/setup/first-run-stage";
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

/** Routes allowed while first-run Company, Work, or Pricing Basics are unfinished. */
function isFirstRunSetupPath(pathname: string | null): boolean {
  if (!pathname) {
    return false;
  }
  return pathname === "/app/setup" || pathname.startsWith("/app/setup/");
}

export default async function AppLayout({
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

    return (
      <div className="flex min-h-svh flex-col items-center justify-center bg-muted px-4 py-8">
        <div className="mb-8 w-full max-w-sm text-center">
          <p className="text-lg font-semibold tracking-tight">Quotr</p>
        </div>
        <div className="w-full max-w-sm">{children}</div>
      </div>
    );
  }

  if (onSetupRequired) {
    redirect("/app/dashboard");
  }

  const [display, firstRunStage] = await Promise.all([
    getAuthDisplayProfile(),
    getFirstRunStage(),
  ]);

  const forcedSetup = firstRunForcedPath(firstRunStage);
  if (forcedSetup && !isFirstRunSetupPath(pathname)) {
    redirect(forcedSetup);
  }

  const setupIncomplete =
    firstRunStage === "basics" ||
    firstRunStage === "work" ||
    firstRunStage === "pricing";

  let billingNotice: TrialBannerNotice | null = null;
  let showTeamNav = false;
  try {
    const billingState = await getOrgBillingState(auth.orgId);
    const policy = resolveEffectiveAccessPolicy(billingState);
    showTeamNav = shouldShowTeamPrimaryNav({
      source: policy.source,
      planCode: policy.planCode,
    });
    if (
      !pathname?.startsWith("/app/settings/billing") &&
      billingState.subscription?.source === "internal_trial"
    ) {
      billingNotice = trialBannerNotice(
        deriveTrialCountdown({
          trialEndsAt: billingState.subscription.trialEndsAt,
          effectiveTrialState: billingState.effectiveTrialState,
        })
      );
    }
  } catch {
    billingNotice = null;
    showTeamNav = false;
  }

  return (
    <AppShell
      userEmail={display?.userEmail ?? auth.user.email}
      fullName={display?.fullName}
      organisationName={display?.organisationName}
      tradingName={display?.tradingName}
      setupIncomplete={setupIncomplete}
      showTeamNav={showTeamNav}
      deploymentLabel={internalDeploymentLabel()}
      billingNotice={billingNotice}
      displayTimezone={display?.timezone ?? null}
    >
      {children}
    </AppShell>
  );
}
