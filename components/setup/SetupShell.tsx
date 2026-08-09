"use client";

import { useCallback, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FormContainer } from "@/components/layout/page-containers";
import { PageHeader } from "@/components/layout/page-header";
import { UserMenu } from "@/components/layout/user-menu";
import { getSetupState } from "@/lib/setup/actions";
import { CompanyBasicsStep } from "./CompanyBasicsStep";
import { CompanyDefaultsStep } from "./CompanyDefaultsStep";
import { RatesStep } from "./RatesStep";
import { ReviewStep } from "./ReviewStep";
import { SetupProgress } from "./SetupProgress";
import type { SetupState, SetupStep } from "./types";
import { WorkAreasStep } from "./WorkAreasStep";

type SetupShellProps = {
  initialState: SetupState;
  userEmail?: string;
  fullName?: string | null;
};

function getInitialStep(settings: SetupState["settings"]): SetupStep {
  if (!settings) return "company";
  if (settings.onboarding_status === "completed") return "review";
  if (settings.onboarding_step === "completed") return "review";
  if (settings.onboarding_status === "not_started") return "company";
  return settings.onboarding_step;
}

export function SetupShell({
  initialState,
  userEmail,
  fullName,
}: SetupShellProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [state, setState] = useState(initialState);
  const [step, setStep] = useState<SetupStep>(() =>
    getInitialStep(initialState.settings)
  );
  const [showPricingDefaults, setShowPricingDefaults] = useState(false);

  const refreshState = useCallback(async () => {
    const nextState = await getSetupState();
    setState(nextState);
    router.refresh();
  }, [router]);

  function goToStep(nextStep: SetupStep) {
    setStep(nextStep);
    setShowPricingDefaults(false);
    startTransition(() => {
      void refreshState();
    });
  }

  const isFirstRun =
    !state.settings || state.settings.onboarding_status === "not_started";

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <PageHeader
        title={isFirstRun ? "Welcome to Quotr" : "Setup"}
        description={
          isFirstRun
            ? "Confirm a few company basics, then start quoting."
            : "Optional setup to improve estimate and quote quality."
        }
        actions={<UserMenu userEmail={userEmail} fullName={fullName} />}
      />
      <FormContainer>
        {!isFirstRun || step !== "company" ? (
          <div className="mb-8 space-y-4">
            <p className="text-sm text-muted-foreground">
              Complete optional steps when you are ready. You can create projects
              after company basics.
            </p>
            <SetupProgress currentStep={step} />
          </div>
        ) : null}

        {step === "company" && !showPricingDefaults ? (
          <CompanyBasicsStep
            state={state}
            mode={isFirstRun ? "first-run" : "wizard"}
            onContinueWizard={() => {
              setShowPricingDefaults(true);
              void refreshState();
            }}
          />
        ) : null}

        {step === "company" && showPricingDefaults ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Pricing defaults are optional. Safe defaults already apply (20%
              margin).
            </p>
            <CompanyDefaultsStep
              state={state}
              onComplete={() => goToStep("work_areas")}
            />
          </div>
        ) : null}

        {step === "work_areas" ? (
          <WorkAreasStep
            state={state}
            onComplete={() => goToStep("rates")}
            onBack={() => setStep("company")}
          />
        ) : null}

        {step === "rates" ? (
          <RatesStep
            state={state}
            onComplete={() => goToStep("review")}
            onBack={() => setStep("work_areas")}
          />
        ) : null}

        {step === "review" || step === "completed" ? (
          <ReviewStep
            state={state}
            onBack={() => setStep("rates")}
            onComplete={() => {
              void refreshState();
            }}
          />
        ) : null}
      </FormContainer>
    </div>
  );
}
