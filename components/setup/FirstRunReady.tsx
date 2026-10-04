"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { NewProjectDialog } from "@/components/projects/NewProjectDialog";
import {
  completeRequiredOnboarding,
  recordOnboardingMarketingConsent,
} from "@/lib/setup/actions";
import {
  FIRST_RUN_ADDRESS_PATH,
  FIRST_RUN_BASICS_PATH,
  FIRST_RUN_LABOUR_PATH,
  FIRST_RUN_TAX_PATH,
  FIRST_RUN_WORK_PATH,
} from "@/lib/setup/first-run-stage";
import { OnboardingSurface } from "./OnboardingSurface";
import type { SetupState } from "./types";

function choiceLabel(choice: string | null | undefined): string {
  if (choice === "company") return "Company cost";
  if (choice === "quotr_benchmark") return "Quotr benchmark";
  return "Not answered";
}

function ReviewRow({
  title,
  detail,
  href,
}: {
  title: string;
  detail: string;
  href: string;
}) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border py-3 last:border-b-0">
      <div className="min-w-0">
        <h2 className="text-sm font-medium">{title}</h2>
        <p className="break-words text-sm text-muted-foreground">{detail}</p>
      </div>
      <Link
        href={href}
        className="inline-flex min-h-11 shrink-0 items-center text-sm font-medium underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        Edit
      </Link>
    </div>
  );
}

export function FirstRunReady({ state }: { state: SetupState }) {
  const router = useRouter();
  const settings = state.settings;
  const [productUpdates, setProductUpdates] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resumePath, setResumePath] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);
  const work = state.workAreas.filter((area) => area.enabled).map((area) => area.label);
  const address = [
    settings?.address_line_1,
    settings?.address_line_2,
    settings?.city,
    settings?.region,
    settings?.postcode,
    settings?.address_country,
  ]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(", ");
  const gst =
    settings?.gst_registered === true
      ? "Registered"
      : settings?.gst_registered === false
        ? "Not registered"
        : "Not answered";
  const margin =
    settings?.default_margin_percent != null
      ? `${settings.default_margin_percent}%`
      : "Not set";

  async function finish(): Promise<boolean> {
    setError(null);
    setResumePath(null);
    if (productUpdates) {
      try {
        await recordOnboardingMarketingConsent(true);
      } catch {
        // Product updates are optional and must not block completion.
      }
    }
    const result = await completeRequiredOnboarding();
    if (result.error) {
      setError(result.error);
      setResumePath(result.resumePath ?? null);
      return false;
    }
    return true;
  }

  async function goToDashboard() {
    setLeaving(true);
    const ok = await finish();
    setLeaving(false);
    if (!ok) return;
    router.push("/app/dashboard");
  }

  return (
    <OnboardingSurface
      mode="ready"
      title="Ready to price"
      description="You can refine materials, labour and productivity later under Rates."
    >
      <div className="space-y-1">
        <ReviewRow
          title="Business"
          detail={settings?.trading_name?.trim() || state.organisationName || "Not entered"}
          href={FIRST_RUN_BASICS_PATH}
        />
        <ReviewRow
          title="Address"
          detail={address || "Not entered"}
          href={FIRST_RUN_ADDRESS_PATH}
        />
        <ReviewRow title="GST" detail={gst} href={FIRST_RUN_TAX_PATH} />
        <ReviewRow
          title="Work types"
          detail={work.length > 0 ? work.join(", ") : "Not selected"}
          href={FIRST_RUN_WORK_PATH}
        />
        <ReviewRow
          title="Carpenter"
          detail={choiceLabel(settings?.carpenter_onboarding_choice)}
          href={FIRST_RUN_LABOUR_PATH}
        />
        <ReviewRow
          title="Labourer"
          detail={choiceLabel(settings?.labourer_onboarding_choice)}
          href={FIRST_RUN_LABOUR_PATH}
        />
        <ReviewRow title="Target margin" detail={margin} href={FIRST_RUN_LABOUR_PATH} />
      </div>
      <label className="mt-4 flex min-h-11 cursor-pointer items-start gap-3 text-sm">
        <input
          type="checkbox"
          className="mt-1 size-4 shrink-0"
          checked={productUpdates}
          onChange={(event) => setProductUpdates(event.target.checked)}
        />
        <span>Send me product updates and practical Quotr tips.</span>
      </label>
      {error ? (
        <div role="alert" className="mt-4 rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <p>{error}</p>
          {resumePath ? (
            <Link href={resumePath} className="mt-1 inline-flex min-h-11 items-center underline">
              Go to the first incomplete step
            </Link>
          ) : null}
        </div>
      ) : null}
      <div className="mt-6 flex flex-col items-stretch gap-2">
        <NewProjectDialog
          intent="first-job"
          beforeOpen={finish}
          trigger={
            <Button type="button" className="min-h-11 w-full">
              Create your first project
            </Button>
          }
        />
        <button
          type="button"
          className="inline-flex min-h-11 items-center justify-center text-sm text-muted-foreground underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          disabled={leaving}
          onClick={() => void goToDashboard()}
        >
          Go to Dashboard
        </button>
      </div>
    </OnboardingSurface>
  );
}
