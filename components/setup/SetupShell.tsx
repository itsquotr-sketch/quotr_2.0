"use client";

import { BusinessAddressStep } from "./BusinessAddressStep";
import { BusinessIdentityStep } from "./BusinessIdentityStep";
import { FirstRunReady } from "./FirstRunReady";
import { GstRegistrationStep } from "./GstRegistrationStep";
import { LabourCostsStep } from "./LabourCostsStep";
import type { SetupState } from "./types";
import { WorkAreasStep } from "./WorkAreasStep";
import type { OnboardingShellMode } from "@/lib/setup/first-run-stage";

type SetupShellProps = {
  initialState: SetupState;
  mode: OnboardingShellMode;
};

export function SetupShell({ initialState, mode }: SetupShellProps) {
  if (mode === "basics") return <BusinessIdentityStep state={initialState} />;
  if (mode === "address") return <BusinessAddressStep state={initialState} />;
  if (mode === "tax") return <GstRegistrationStep state={initialState} />;
  if (mode === "work") return <WorkAreasStep state={initialState} mode="first-run" />;
  if (mode === "labour") return <LabourCostsStep state={initialState} />;
  return <FirstRunReady state={initialState} />;
}
