import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { FormContainer } from "@/components/layout/page-containers";
import { UserMenu } from "@/components/layout/user-menu";
import { CalibrationFlow } from "@/components/calibration/CalibrationFlow";
import { getActiveCalibrationForScenario } from "@/lib/calibration/actions";
import { getCalibrationScenario } from "@/lib/calibration/catalogue";
import { createClient } from "@/lib/supabase/server";
import { needsCompanyBasics } from "@/lib/setup/actions";

type PageProps = {
  params: Promise<{ scenarioId: string }>;
};

export default async function CalibrateScenarioPage({ params }: PageProps) {
  if (await needsCompanyBasics()) {
    redirect("/app/setup?mode=basics");
  }

  const { scenarioId } = await params;
  const scenario = getCalibrationScenario(decodeURIComponent(scenarioId));
  if (!scenario) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user!.id)
    .maybeSingle();

  const existing = await getActiveCalibrationForScenario(scenario.id);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <PageHeader
        title="Calibrate Quotr"
        description="Example job comparison — evidence only, not automatic rate changes."
        actions={
          <UserMenu userEmail={user?.email} fullName={profile?.full_name} />
        }
      />
      <FormContainer>
        <CalibrationFlow
          scenario={scenario}
          existing={existing.record}
          initialAnswers={existing.answers}
        />
      </FormContainer>
    </div>
  );
}
