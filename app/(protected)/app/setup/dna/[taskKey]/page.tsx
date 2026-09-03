import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { FormContainer } from "@/components/layout/page-containers";
import { UserMenu } from "@/components/layout/user-menu";
import { CompanyDnaTaskFlow } from "@/components/company-dna/CompanyDnaTaskFlow";
import { getCompanyDnaHubState } from "@/lib/company-dna/actions";
import { getCompanyDnaTask } from "@/lib/company-dna/catalogue";
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
  const task = getCompanyDnaTask(decodeURIComponent(taskKey));
  if (!task) notFound();

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
  const alreadyCalibrated = Boolean(
    area?.tasks.some(
      (status) =>
        status.calibrationTaskKey === task.calibrationTaskKey &&
        status.calibrated
    )
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <PageHeader
        title="Calibrate how you work"
        description="Quotr turns crew size and time into labour hours for future estimates."
        actions={
          <UserMenu userEmail={user?.email} fullName={profile?.full_name} />
        }
      />
      <FormContainer>
        <CompanyDnaTaskFlow
          task={task}
          alreadyCalibrated={alreadyCalibrated}
          canCalibrate={hub.canCalibrate}
        />
      </FormContainer>
    </div>
  );
}
