import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { FormContainer } from "@/components/layout/page-containers";
import { UserMenu } from "@/components/layout/user-menu";
import { CompanyDnaDeckIntro } from "@/components/company-dna/CompanyDnaDeckIntro";
import { CompanyDnaDeckSummary } from "@/components/company-dna/CompanyDnaDeckSummary";
import { getCompanyDnaHubState } from "@/lib/company-dna/actions";
import {
  deckV2ProgressCounts,
  listCompanyDnaDeckV2UiTasks,
  nextCompanyDnaDeckV2Task,
} from "@/lib/company-dna/deck-v2";
import { createClient } from "@/lib/supabase/server";
import { needsCompanyBasics } from "@/lib/setup/actions";

type PageProps = {
  searchParams: Promise<{ view?: string }>;
};

export default async function CompanyDnaDeckLandingPage({
  searchParams,
}: PageProps) {
  if (await needsCompanyBasics()) {
    redirect("/app/setup?mode=basics");
  }

  const params = await searchParams;
  const view = params.view?.trim() ?? "";
  const hub = await getCompanyDnaHubState();
  const area = hub.progress.find((item) => item.workAreaType === "deck");
  const calibratedKeys =
    area?.tasks
      .filter((status) => status.calibrated)
      .map((status) => status.calibrationTaskKey) ?? [];
  const counts = deckV2ProgressCounts(calibratedKeys);
  const nextTask = nextCompanyDnaDeckV2Task({ calibratedTaskKeys: calibratedKeys });
  const firstTask = listCompanyDnaDeckV2UiTasks()[0];
  const firstHref = `/app/setup/dna/${encodeURIComponent(
    nextTask?.calibrationTaskKey ?? firstTask?.calibrationTaskKey ?? "deck.posts.v1"
  )}`;

  if (view === "continue" && nextTask) {
    redirect(`/app/setup/dna/${encodeURIComponent(nextTask.calibrationTaskKey)}`);
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

  const showSummary =
    view === "summary" ||
    (area?.status === "calibrated" && view !== "intro");

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <PageHeader
        title="Deck calibration"
        description="Tell Quotr how your crew normally completes common deck tasks."
        actions={
          <UserMenu userEmail={user?.email} fullName={profile?.full_name} />
        }
      />
      <FormContainer innerClassName="pb-[calc(6rem+env(safe-area-inset-bottom))] md:pb-6">
        {showSummary ? (
          <CompanyDnaDeckSummary
            status={area?.status ?? "benchmarks"}
            tier1Calibrated={counts.tier1Calibrated}
            tier1Total={counts.tier1Total}
            tasks={area?.tasks ?? []}
            nextOptionalHref={
              nextTask
                ? `/app/setup/dna/${encodeURIComponent(nextTask.calibrationTaskKey)}`
                : null
            }
            canCalibrate={hub.canCalibrate}
          />
        ) : (
          <CompanyDnaDeckIntro
            firstTaskHref={firstHref}
            canCalibrate={hub.canCalibrate}
          />
        )}
      </FormContainer>
    </div>
  );
}
