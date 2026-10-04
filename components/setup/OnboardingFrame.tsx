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

/**
 * Focused setup shell. The page scrolls with the keyboard. Back and
 * Continue stay in the form, so they do not cover fields.
 */
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
      <div
        className="flex h-dvh flex-col overflow-y-auto bg-[#f6f5f2]"
        style={{
          paddingTop: "max(1rem, env(safe-area-inset-top))",
          paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))",
          paddingLeft: "max(1rem, env(safe-area-inset-left))",
          paddingRight: "max(1rem, env(safe-area-inset-right))",
        }}
      >
        <div className="m-auto w-full min-w-0 max-w-xl py-4">
          <div className="mb-5">
            <QuotrLogo variant="wordmark" href={null} height={22} />
          </div>
          {children}
        </div>
      </div>
    </AppUserProvider>
  );
}
