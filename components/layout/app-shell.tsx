"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AppSidebarNav } from "@/components/app-sidebar";
import { AppUserProvider } from "@/components/layout/app-user-context";
import { BetaNotice } from "@/components/layout/beta-notice";
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
      <div className="flex min-h-svh w-full overflow-x-hidden">
        <AppSidebarNav setupIncomplete={setupIncomplete} />
        <div className="flex min-w-0 flex-1 flex-col bg-background print:bg-white">
          <BetaNotice />
          <div className="flex h-14 items-center border-b px-4 md:hidden print:hidden">
            <QuotrLogo height={28} />
          </div>
          {children}
        </div>
      </div>
    </AppUserProvider>
  );
}
