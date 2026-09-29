import { redirect } from "next/navigation";
import { SetupShell } from "@/components/setup/SetupShell";
import { getFirstRunStage, getSetupState } from "@/lib/setup/actions";
import {
  setupModeRedirect,
  setupShellMode,
} from "@/lib/setup/first-run-stage";

type SetupPageProps = {
  searchParams: Promise<{ mode?: string }>;
};

export default async function SetupPage({ searchParams }: SetupPageProps) {
  const params = await searchParams;
  const stage = await getFirstRunStage();
  const modeRedirect = setupModeRedirect(params.mode, stage);
  if (modeRedirect) {
    redirect(modeRedirect);
  }

  const state = await getSetupState();

  return <SetupShell initialState={state} mode={setupShellMode(params.mode, stage)} />;
}
