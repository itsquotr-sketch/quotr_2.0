"use client";

import { usePathname } from "next/navigation";
import { AppSidebarNav } from "@/components/app-sidebar";
import { TrialNoticeBanner } from "@/components/billing/TrialNoticeBanner";
import { AccountMenu } from "@/components/layout/account-menu";
import { AppUserProvider } from "@/components/layout/app-user-context";
import { MobileNav } from "@/components/layout/mobile-nav";
import { NotificationBell } from "@/components/layout/notification-bell";
import { QuotrLogo } from "@/components/layout/quotr-logo";
import type { TrialBannerNotice } from "@/lib/billing/trial-countdown";

type AppShellProps = {
  children: React.ReactNode;
  userEmail?: string;
  fullName?: string | null;
  organisationName?: string | null;
  tradingName?: string | null;
  setupIncomplete?: boolean;
  showTeamNav?: boolean;
  deploymentLabel?: "Local" | "Preview" | null;
  billingNotice?: TrialBannerNotice | null;
};

function isQuotePrintRoute(pathname: string | null): boolean {
  return Boolean(pathname?.match(/\/quotes\/[^/]+\/print$/));
}

function isProjectRoute(pathname: string | null): boolean {
  return Boolean(pathname?.startsWith("/app/projects/"));
}

export function AppShell({
  children,
  userEmail,
  fullName,
  organisationName,
  tradingName,
  setupIncomplete = false,
  showTeamNav = false,
  deploymentLabel = null,
  billingNotice = null,
}: AppShellProps) {
  const pathname = usePathname();

  if (isQuotePrintRoute(pathname)) {
    return (
      <div className="min-h-svh w-full bg-neutral-100 print:bg-white">
        {children}
      </div>
    );
  }

  const showMobileNav = !isProjectRoute(pathname);

  return (
    <AppUserProvider
      value={{
        userEmail,
        fullName,
        organisationName,
        tradingName,
        setupIncomplete,
        showTeamNav,
        deploymentLabel,
      }}
    >
      <div className="flex min-h-dvh w-full md:h-dvh md:overflow-hidden">
        <AppSidebarNav
          setupIncomplete={setupIncomplete}
          showTeamNav={showTeamNav}
          deploymentLabel={deploymentLabel}
        />
        <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-background md:overflow-hidden print:bg-white">
          <div className="flex h-12 shrink-0 items-center justify-between gap-3 border-b bg-background px-4 md:hidden print:hidden">
            <div className="flex min-w-0 items-center gap-2">
              <QuotrLogo height={26} />
              {deploymentLabel ? (
                <span className="rounded-full border border-border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  {deploymentLabel}
                </span>
              ) : null}
            </div>
            <div className="flex items-center gap-1">
              <NotificationBell variant="header" />
              <AccountMenu variant="header" />
            </div>
          </div>
          {billingNotice && !pathname?.startsWith("/app/settings/billing") ? (
            <TrialNoticeBanner notice={billingNotice} />
          ) : null}
          <div
            className={
              showMobileNav
                ? "flex min-h-0 flex-1 flex-col md:overflow-hidden pb-[calc(3.5rem+env(safe-area-inset-bottom))] md:pb-0"
                : "flex min-h-0 flex-1 flex-col md:overflow-hidden"
            }
          >
            {children}
          </div>
          {showMobileNav ? <MobileNav /> : null}
        </div>
      </div>
    </AppUserProvider>
  );
}
