"use client";

import { useCallback, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FormContainer } from "@/components/layout/page-containers";
import { PageHeader } from "@/components/layout/page-header";
import { UserMenu } from "@/components/layout/user-menu";
import { getSetupState } from "@/lib/setup/actions";
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

  const refreshState = useCallback(async () => {
    const nextState = await getSetupState();
    setState(nextState);
    router.refresh();
  }, [router]);

  function goToStep(nextStep: SetupStep) {
    setStep(nextStep);
    startTransition(() => {
      void refreshState();
    });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <PageHeader
        title="Setup"
        description="Configure your business so Quotr can produce better estimates"
        actions={<UserMenu userEmail={userEmail} fullName={fullName} />}
      />
      <FormContainer>
          <div className="mb-8 space-y-4">
            <p className="text-sm text-muted-foreground">
              Complete setup to improve estimate accuracy. You can explore the
              app at any time — this is optional but recommended.
            </p>
            <SetupProgress currentStep={step} />
          </div>

          {step === "company" ? (
            <CompanyDefaultsStep
              state={state}
              onComplete={() => goToStep("work_areas")}
            />
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
