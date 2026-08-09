import { redirect } from "next/navigation";
import { SetupShell } from "@/components/setup/SetupShell";
import { getCalibrationScenarioStatuses } from "@/lib/calibration/actions";
import { getSetupState, needsCompanyBasics } from "@/lib/setup/actions";
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
  const basicsNeeded = await needsCompanyBasics();

  // Force basics mode while gated; ignore other modes to avoid loops.
  const mode =
    basicsNeeded || params.mode === "basics"
      ? "basics"
      : params.mode === "improve"
        ? "improve"
        : "improve";

  // Basics already confirmed — don't keep user on forced basics URL.
  if (!basicsNeeded && params.mode === "basics") {
    redirect("/app/dashboard");
  }

  // Missing basics always use basics mode (layout also redirects here).
  const shellMode = basicsNeeded
    ? "basics"
    : mode === "basics"
      ? "basics"
      : "improve";

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

  const [state, calibrationStatuses] = await Promise.all([
    getSetupState(),
    shellMode === "improve"
      ? getCalibrationScenarioStatuses()
      : Promise.resolve([]),
  ]);

  return (
    <SetupShell
      initialState={state}
      mode={shellMode}
      userEmail={user?.email}
      fullName={profile?.full_name}
      initialImproveSection={initialImproveSection}
      calibrationStatuses={calibrationStatuses}
    />
  );
}
