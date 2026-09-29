import { AccountMenu } from "@/components/layout/account-menu";
import { AppUserProvider } from "@/components/layout/app-user-context";
import { QuotrLogo } from "@/components/layout/quotr-logo";

type OnboardingFrameProps = {
  children: React.ReactNode;
  userEmail?: string;
  fullName?: string | null;
  organisationName?: string | null;
  tradingName?: string | null;
  deploymentLabel?: "Local" | "Preview" | null;
};

/** Focused shell while required onboarding is unfinished. No primary nav. */
export function OnboardingFrame({
  children,
  userEmail,
  fullName,
  organisationName,
  tradingName,
  deploymentLabel = null,
}: OnboardingFrameProps) {
  return (
    <AppUserProvider
      value={{
        userEmail,
        fullName,
        organisationName,
        tradingName,
        onboardingLocked: true,
        deploymentLabel,
      }}
    >
      <div className="flex min-h-dvh flex-col bg-background">
        <header className="flex h-12 shrink-0 items-center justify-between gap-3 border-b px-4">
          <div className="flex min-w-0 items-center gap-2">
            <QuotrLogo variant="wordmark" href={null} height={22} />
            {deploymentLabel ? (
              <span className="rounded-full border border-border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                {deploymentLabel}
              </span>
            ) : null}
          </div>
          <AccountMenu />
        </header>
        <div className="flex min-h-0 flex-1 flex-col">{children}</div>
      </div>
    </AppUserProvider>
  );
}
