"use client";

import { usePathname } from "next/navigation";
import { AppSidebarNav } from "@/components/app-sidebar";
import { AccountMenu } from "@/components/layout/account-menu";
import { AppUserProvider } from "@/components/layout/app-user-context";
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
      <div className="flex min-h-dvh w-full md:h-dvh md:overflow-hidden">
        <AppSidebarNav setupIncomplete={setupIncomplete} />
        <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-background md:overflow-hidden print:bg-white">
          <div className="flex h-12 shrink-0 items-center justify-between gap-3 border-b bg-background px-4 md:hidden print:hidden">
            <QuotrLogo height={26} />
            <AccountMenu variant="header" />
          </div>
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
