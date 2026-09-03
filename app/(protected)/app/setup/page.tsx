import { redirect } from "next/navigation";
import { SetupShell } from "@/components/setup/SetupShell";
import { getCompanyDnaHubState } from "@/lib/company-dna/actions";
import { getFirstRunStage, getSetupState } from "@/lib/setup/actions";
import {
  setupModeRedirect,
  setupShellMode,
} from "@/lib/setup/first-run-stage";
import { createClient } from "@/lib/supabase/server";

type SetupPageProps = {
  searchParams: Promise<{ mode?: string; section?: string }>;
};

const IMPROVE_SECTIONS = new Set([
  "company",
  "work_areas",
  "rates",
  "calibrate",
]);

export default async function SetupPage({ searchParams }: SetupPageProps) {
  const params = await searchParams;
  const stage = await getFirstRunStage();
  const modeParam = params.mode;
  const modeRedirect = setupModeRedirect(modeParam, stage);
  if (modeRedirect) {
    redirect(modeRedirect);
  }

  const shellMode = setupShellMode(modeParam, stage);

  const sectionParam = params.section?.trim();
  const initialImproveSection =
    sectionParam && IMPROVE_SECTIONS.has(sectionParam)
      ? (sectionParam as
          | "company"
          | "work_areas"
          | "rates"
          | "calibrate")
      : undefined;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user!.id)
    .maybeSingle();

  const [state, dnaHub] = await Promise.all([
    getSetupState(),
    shellMode === "improve"
      ? getCompanyDnaHubState()
      : Promise.resolve(null),
  ]);

  return (
    <SetupShell
      initialState={state}
      mode={shellMode}
      userEmail={user?.email}
      fullName={profile?.full_name}
      initialImproveSection={initialImproveSection}
      dnaHub={dnaHub}
    />
  );
}
