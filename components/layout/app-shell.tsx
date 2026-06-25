"use client";

import { usePathname } from "next/navigation";
import { AppSidebarNav } from "@/components/app-sidebar";
import { AppUserProvider } from "@/components/layout/app-user-context";
import { BetaNotice } from "@/components/layout/beta-notice";
import { MobileNav } from "@/components/layout/mobile-nav";
import { QuotrLogo } from "@/components/layout/quotr-logo";

type AppShellProps = {
  children: React.ReactNode;
  userEmail?: string;
  fullName?: string | null;
  organisationName?: string | null;
  tradingName?: string | null;
  setupIncomplete?: boolean;
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
      }}
    >
      <div className="flex h-dvh w-full overflow-hidden">
        <AppSidebarNav setupIncomplete={setupIncomplete} />
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-background print:bg-white">
          <BetaNotice />
          <div className="flex h-12 shrink-0 items-center border-b px-4 md:hidden print:hidden">
            <QuotrLogo height={26} />
          </div>
          <div
            className={
              showMobileNav
                ? "flex min-h-0 flex-1 flex-col overflow-hidden pb-[calc(3.5rem+env(safe-area-inset-bottom))] md:pb-0"
                : "flex min-h-0 flex-1 flex-col overflow-hidden"
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
