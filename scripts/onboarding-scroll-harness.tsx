import { createRoot } from "react-dom/client";
import { FormContainer } from "@/components/layout/page-containers";
import { PageHeader } from "@/components/layout/page-header";
import { FirstRunProgress } from "@/components/setup/FirstRunProgress";
import { OnboardingFrame } from "@/components/setup/OnboardingFrame";
import { RequiredCompanyProfileStep } from "@/components/setup/RequiredCompanyProfileStep";
import {
  onboardingFormEndPadding,
  onboardingFormScrollClass,
} from "@/components/setup/onboarding-scroll";
import type { SetupState } from "@/components/setup/types";

const state: SetupState = {
  organisationName: "",
  settings: null,
  workAreas: [],
  rates: [],
};

function OnboardingScrollHarness() {
  return (
    <OnboardingFrame userEmail="new@example.com" fullName="New Owner">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <PageHeader
          compactOnMobile
          title="Welcome to Quotr"
          description="Company details, the work you price, and your internal labour costs."
        />
        <FormContainer
          className={onboardingFormScrollClass}
          innerClassName={onboardingFormEndPadding}
        >
          <div className="mx-auto w-full max-w-lg">
            <FirstRunProgress current="company" />
            <RequiredCompanyProfileStep state={state} />
          </div>
        </FormContainer>
      </div>
    </OnboardingFrame>
  );
}

const root = document.getElementById("root");
if (!root) throw new Error("Missing layout root");
createRoot(root).render(<OnboardingScrollHarness />);
