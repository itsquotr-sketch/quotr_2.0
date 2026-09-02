import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { getOrgBillingState } from "@/lib/billing/server";
import {
  deriveTrialCountdown,
  trialBannerNotice,
  type TrialBannerNotice,
} from "@/lib/billing/trial-countdown";
import { internalDeploymentLabel } from "@/lib/deployment/environment";
import { getAuthDisplayProfile } from "@/lib/security/auth-display";
import { requireAuthOrgContext } from "@/lib/security/auth-org-context";
import { needsCompanyBasics } from "@/lib/setup/actions";

const SETUP_REQUIRED_PATH = "/app/setup-required";
const SETUP_BASICS_PATH = "/app/setup?mode=basics";

function isSetupRequiredPath(pathname: string | null): boolean {
  if (!pathname) {
    return false;
  }
  return (
    pathname === SETUP_REQUIRED_PATH ||
    pathname.startsWith(`${SETUP_REQUIRED_PATH}/`)
  );
}

/** Routes allowed while company basics are not yet confirmed. */
function isCompanyBasicsAllowedPath(pathname: string | null): boolean {
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

  const [display, basicsNeeded] = await Promise.all([
    getAuthDisplayProfile(),
    needsCompanyBasics(),
  ]);

  if (basicsNeeded && !isCompanyBasicsAllowedPath(pathname)) {
    redirect(SETUP_BASICS_PATH);
  }

  const setupIncomplete = basicsNeeded;

  let billingNotice: TrialBannerNotice | null = null;
  if (!pathname?.startsWith("/app/settings/billing")) {
    try {
      const billingState = await getOrgBillingState(auth.orgId);
      if (billingState.subscription?.source === "internal_trial") {
        billingNotice = trialBannerNotice(
          deriveTrialCountdown({
            trialEndsAt: billingState.subscription.trialEndsAt,
            effectiveTrialState: billingState.effectiveTrialState,
          })
        );
      }
    } catch {
      billingNotice = null;
    }
  }

  return (
    <AppShell
      userEmail={display?.userEmail ?? auth.user.email}
      fullName={display?.fullName}
      organisationName={display?.organisationName}
      tradingName={display?.tradingName}
      setupIncomplete={setupIncomplete}
      deploymentLabel={internalDeploymentLabel()}
      billingNotice={billingNotice}
    >
      {children}
    </AppShell>
  );
}
