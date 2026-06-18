import Link from "next/link";
import { AppSidebarNav } from "@/components/app-sidebar";

type AppShellProps = {
  children: React.ReactNode;
  userEmail?: string;
  fullName?: string | null;
  setupIncomplete?: boolean;
};

export function AppShell({
  children,
  userEmail,
  fullName,
  setupIncomplete = false,
}: AppShellProps) {
  return (
    <div className="flex min-h-svh w-full overflow-x-hidden">
      <AppSidebarNav
        userEmail={userEmail}
        fullName={fullName}
        setupIncomplete={setupIncomplete}
      />
      <div className="flex min-w-0 flex-1 flex-col bg-background">
        <div className="flex h-14 items-center border-b px-4 md:hidden">
          <Link
            href="/app/dashboard"
            className="text-base font-semibold tracking-tight"
          >
            Quotr
          </Link>
        </div>
        {children}
      </div>
    </div>
  );
}
