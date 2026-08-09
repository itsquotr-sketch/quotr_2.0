"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { FormContainer } from "@/components/layout/page-containers";
import { PageHeader } from "@/components/layout/page-header";
import { UserMenu } from "@/components/layout/user-menu";
import { Button } from "@/components/ui/button";
import { getSetupState } from "@/lib/setup/actions";
import { CompanyBasicsStep } from "./CompanyBasicsStep";
import { RatesStep } from "./RatesStep";
import type { SetupState, SetupStep } from "./types";
import { WorkAreasStep } from "./WorkAreasStep";

export type SetupShellMode = "basics" | "improve";

type SetupShellProps = {
  initialState: SetupState;
  mode: SetupShellMode;
  userEmail?: string;
  fullName?: string | null;
};

type ImproveSection = "company" | "work_areas" | "rates";

function getInitialImproveSection(
  settings: SetupState["settings"]
): ImproveSection {
  if (!settings || settings.onboarding_status === "not_started") {
    return "company";
  }
  const step: SetupStep = settings.onboarding_step;
  if (step === "rates" || step === "review" || step === "completed") {
    return "rates";
  }
  if (step === "work_areas") return "work_areas";
  return "company";
}

export function SetupShell({
  initialState,
  mode,
  userEmail,
  fullName,
}: SetupShellProps) {
  const router = useRouter();
  const [state, setState] = useState(initialState);
  const [section, setSection] = useState<ImproveSection>(() =>
    getInitialImproveSection(initialState.settings)
  );

  const refreshState = useCallback(async () => {
    const nextState = await getSetupState();
    setState(nextState);
    router.refresh();
  }, [router]);

  if (mode === "basics") {
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <PageHeader
          title="Welcome to Quotr"
          description="Confirm a few company basics, then start quoting."
          actions={<UserMenu userEmail={userEmail} fullName={fullName} />}
        />
        <FormContainer>
          <div className="mx-auto w-full max-w-lg">
            <CompanyBasicsStep state={state} mode="basics" />
          </div>
        </FormContainer>
      </div>
    );
  }

  // Optional improve mode — no mandatory Review / Mark complete.
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <PageHeader
        title="Improve Quotr"
        description="Optional setup to personalise estimates. You can create projects anytime."
        actions={<UserMenu userEmail={userEmail} fullName={fullName} />}
      />
      <FormContainer>
        <div className="mb-6 space-y-3">
          <p className="text-sm text-muted-foreground">
            Choose a section below. Nothing here blocks creating a project.
          </p>
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["company", "Company basics"],
                ["work_areas", "Work types"],
                ["rates", "Rates"],
              ] as const
            ).map(([id, label]) => (
              <Button
                key={id}
                type="button"
                size="sm"
                variant={section === id ? "default" : "outline"}
                className="h-9"
                onClick={() => setSection(id)}
              >
                {label}
              </Button>
            ))}
          </div>
          <p className="text-sm">
            <Link
              href="/app/dashboard"
              className="font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              Back to Dashboard
            </Link>
          </p>
        </div>

        {section === "company" ? (
          <CompanyBasicsStep
            state={state}
            mode="optional"
            onSaved={() => {
              void refreshState();
            }}
          />
        ) : null}

        {section === "work_areas" ? (
          <WorkAreasStep
            state={state}
            onSaved={() => {
              void refreshState();
            }}
            onSkip={() => setSection("rates")}
          />
        ) : null}

        {section === "rates" ? (
          <RatesStep
            state={state}
            onSaved={() => {
              void refreshState();
            }}
            onSkip={() => {
              void refreshState();
            }}
          />
        ) : null}
      </FormContainer>
    </div>
  );
}

/** Re-export step type for callers that imported it from SetupShell. */
export type { SetupStep };
