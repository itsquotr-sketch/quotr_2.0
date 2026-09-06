import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { FormContainer } from "@/components/layout/page-containers";
import { UserMenu } from "@/components/layout/user-menu";
import { CompanyDnaDeckTaskFlow } from "@/components/company-dna/CompanyDnaDeckTaskFlow";
import { CompanyDnaTaskFlow } from "@/components/company-dna/CompanyDnaTaskFlow";
import { getCompanyDnaHubState } from "@/lib/company-dna/actions";
import { nextCompanyDnaTaskAcrossHub } from "@/lib/company-dna/progress";
import { resolveCompanyDnaTask } from "@/lib/company-dna/resolve-task";
import {
  isCompanyDnaV2TaskKey,
  nextCompanyDnaV2Task,
  v2OptionalKeys,
  v2ProgressCounts,
} from "@/lib/company-dna/v2-ui";
import { createClient } from "@/lib/supabase/server";
import { needsCompanyBasics } from "@/lib/setup/actions";

type PageProps = {
  params: Promise<{ taskKey: string }>;
};

export default async function CompanyDnaTaskPage({ params }: PageProps) {
  if (await needsCompanyBasics()) {
    redirect("/app/setup?mode=basics");
  }

  const { taskKey } = await params;
  const decoded = decodeURIComponent(taskKey);
  const task = resolveCompanyDnaTask(decoded);
  if (!task) notFound();
  const v2 = isCompanyDnaV2TaskKey(task.calibrationTaskKey);
  if (!v2 && !task.exposeInCurrentUi) {
    notFound();
  }
  if (task.workAreaType === "retaining_wall" && !task.exposeInCurrentUi) {
    notFound();
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

  const hub = await getCompanyDnaHubState();
  const area = hub.progress.find(
    (item) => item.workAreaType === task.workAreaType
  );
  const taskStatus = area?.tasks.find(
    (status) => status.calibrationTaskKey === task.calibrationTaskKey
  );
  const alreadyCalibrated = Boolean(taskStatus?.calibrated);
  const calibratedKeys = hub.progress.flatMap((item) =>
    item.tasks
      .filter((status) => status.calibrated)
      .map((status) => status.calibrationTaskKey)
  );
  const areaKeys =
    area?.tasks
      .filter((status) => status.calibrated)
      .map((status) => status.calibrationTaskKey) ?? [];
  const counts = v2ProgressCounts(task.workAreaType, areaKeys);
  const optionalKeys = v2OptionalKeys(task.workAreaType);
  const v1NextTask = nextCompanyDnaTaskAcrossHub({
    orderedWorkAreaTypes: hub.orderedWorkAreas,
    calibratedTaskKeys: calibratedKeys,
    currentTaskKey: task.calibrationTaskKey,
  });
  const remainingAfterSave = v2
    ? nextCompanyDnaV2Task({
        workAreaType: task.workAreaType,
        calibratedTaskKeys: areaKeys,
        currentTaskKey: task.calibrationTaskKey,
      })
    : null;
  const nextTask = remainingAfterSave;
  const optionalIndex = Math.max(
    1,
    optionalKeys.findIndex((key) => key === task.calibrationTaskKey) + 1
  );
  const completesTier1 =
    v2 &&
    task.priorityTier === 1 &&
    counts.tier1Calibrated + (alreadyCalibrated ? 0 : 1) >= counts.tier1Total;
  const areaLabel =
    task.workAreaType === "fence"
      ? "Fence"
      : task.workAreaType === "deck"
        ? "Deck"
        : "Calibrate how you work";

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <PageHeader
        title={v2 ? `${areaLabel} calibration` : "Calibrate how you work"}
        description={
          v2
            ? "Tell Quotr how your crew normally completes this task."
            : "Quotr turns crew size and time into labour hours for future estimates."
        }
        actions={
          <UserMenu userEmail={user?.email} fullName={profile?.full_name} />
        }
      />
      <FormContainer innerClassName="pb-[calc(6rem+env(safe-area-inset-bottom))] md:pb-6">
        {v2 ? (
          <CompanyDnaDeckTaskFlow
            task={task}
            evidence={{
              calibrated: alreadyCalibrated,
              derivedProductivity: taskStatus?.derivedProductivity ?? null,
              crewSize: taskStatus?.crewSize ?? null,
              durationHours: taskStatus?.durationHours ?? null,
            }}
            canCalibrate={hub.canCalibrate}
            nextTask={nextTask}
            remainingAfterSave={remainingAfterSave}
            completesTier1={Boolean(completesTier1)}
            tier1Calibrated={counts.tier1Calibrated}
            tier1Total={counts.tier1Total}
            optionalIndex={optionalIndex}
            optionalTotal={optionalKeys.length}
            includedCopy={task.workIncluded}
          />
        ) : (
          <CompanyDnaTaskFlow
            task={task}
            alreadyCalibrated={alreadyCalibrated}
            canCalibrate={hub.canCalibrate}
            nextTask={v1NextTask}
          />
        )}
      </FormContainer>
    </div>
  );
}
