import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { FormContainer } from "@/components/layout/page-containers";
import { UserMenu } from "@/components/layout/user-menu";
import { CompanyDnaRwIntro } from "@/components/company-dna/CompanyDnaRwIntro";
import { CompanyDnaDeckSummary } from "@/components/company-dna/CompanyDnaDeckSummary";
import { getCompanyDnaHubState } from "@/lib/company-dna/actions";
import {
  listCompanyDnaRwV2UiTasks,
  listRwSystemProgress,
  nextCompanyDnaRwV2Task,
  rwTaskHref,
} from "@/lib/company-dna/rw-v2";
import { createClient } from "@/lib/supabase/server";
import { needsCompanyBasics } from "@/lib/setup/actions";

type PageProps = {
  searchParams: Promise<{ view?: string; system?: string }>;
};

export default async function CompanyDnaRetainingWallLandingPage({
  searchParams,
}: PageProps) {
  if (await needsCompanyBasics()) {
    redirect("/app/setup?mode=basics");
  }

  const params = await searchParams;
  const view = params.view?.trim() ?? "";
  const hub = await getCompanyDnaHubState();
  const area = hub.progress.find(
    (item) => item.workAreaType === "retaining_wall"
  );
  const calibratedKeys =
    area?.tasks
      .filter((status) => status.calibrated)
      .map((status) => status.calibrationTaskKey) ?? [];
  const systems = listRwSystemProgress(calibratedKeys);
  const nextTask = nextCompanyDnaRwV2Task({
    calibratedTaskKeys: calibratedKeys,
  });
  const firstTask = listCompanyDnaRwV2UiTasks()[0];
  const firstHref = nextTask
    ? rwTaskHref(nextTask.calibrationTaskKey)
    : rwTaskHref(firstTask?.calibrationTaskKey ?? "retaining_wall.excavation.machine.v1");

  if (view === "continue" && nextTask) {
    redirect(rwTaskHref(nextTask.calibrationTaskKey));
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user!.id)
    .maybeSingle();

  const showSummary = view === "summary";

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <PageHeader
        title="Retaining wall calibration"
        description="Tell Quotr how your crew normally completes common retaining wall tasks."
        actions={
          <UserMenu userEmail={user?.email} fullName={profile?.full_name} />
        }
      />
      <FormContainer innerClassName="pb-[calc(6rem+env(safe-area-inset-bottom))] md:pb-6">
        {showSummary ? (
          <CompanyDnaDeckSummary
            workAreaType="retaining_wall"
            status={area?.status ?? "benchmarks"}
            tier1Calibrated={
              systems.find((row) => row.system === "timber")?.tier1Calibrated ?? 0
            }
            tier1Total={
              systems.find((row) => row.system === "timber")?.tier1Total ?? 3
            }
            tasks={area?.tasks ?? []}
            nextOptionalHref={
              nextTask ? rwTaskHref(nextTask.calibrationTaskKey) : null
            }
            canCalibrate={hub.canCalibrate}
            systemProgress={systems}
          />
        ) : (
          <CompanyDnaRwIntro
            systems={systems}
            calibratedTaskKeys={calibratedKeys}
            firstTaskHref={firstHref}
            canCalibrate={hub.canCalibrate}
          />
        )}
      </FormContainer>
    </div>
  );
}
