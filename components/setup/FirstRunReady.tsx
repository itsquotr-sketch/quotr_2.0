"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  completeRequiredOnboarding,
  recordOnboardingMarketingConsent,
} from "@/lib/setup/actions";
import { formatOnboardingAddress } from "@/lib/setup/format-onboarding-address";
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
        className="inline-flex min-h-11 shrink-0 items-center px-1 text-sm text-muted-foreground underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        Edit
      </Link>
    </div>
  );
}

export function FirstRunReady({ state }: { state: SetupState }) {
  const router = useRouter();
  const settings = state.settings;
  const [productUpdates, setProductUpdates] = useState(state.marketingConsent === true);
  const [error, setError] = useState<string | null>(null);
  const [consentNote, setConsentNote] = useState<string | null>(null);
  const [resumePath, setResumePath] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<"project" | "dashboard" | null>(null);
  const pendingRef = useRef(false);
  const work = state.workAreas.filter((area) => area.enabled).map((area) => area.label);
  const address = formatOnboardingAddress([
    settings?.address_line_1,
    settings?.address_line_2,
    settings?.city,
    settings?.region,
    settings?.postcode,
    settings?.address_country,
  ]);
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

  async function finish(destination: "dashboard" | "project") {
    if (pendingRef.current) return;
    pendingRef.current = true;
    setPendingAction(destination);
    setError(null);
    setConsentNote(null);
    setResumePath(null);
    let consentFailed = false;
    if (productUpdates) {
      try {
        const consent = await recordOnboardingMarketingConsent(true);
        consentFailed = Boolean(consent.error);
      } catch {
        consentFailed = true;
      }
    }
    const result = await completeRequiredOnboarding();
    if (result.error) {
      setError(result.error);
      setResumePath(result.resumePath ?? null);
      if (consentFailed) {
        setConsentNote("Product updates were not saved. You can update this later.");
      }
      pendingRef.current = false;
      setPendingAction(null);
      return;
    }
    const params = new URLSearchParams();
    if (destination === "project") params.set("newProject", "1");
    if (consentFailed) params.set("consent", "unsaved");
    const query = params.toString();
    router.replace(query ? `/app/dashboard?${query}` : "/app/dashboard");
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
      <label className="mt-4 flex min-h-11 w-full cursor-pointer items-center gap-3 py-2 text-sm leading-snug">
        <input
          type="checkbox"
          className="size-4 shrink-0"
          checked={productUpdates}
          disabled={pendingAction !== null}
          onChange={(event) => setProductUpdates(event.target.checked)}
        />
        <span>Send me occasional product updates and practical Quotr tips. Unsubscribe anytime.</span>
      </label>
      {consentNote ? (
        <p role="status" className="mt-3 text-sm text-muted-foreground">
          {consentNote}
        </p>
      ) : null}
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
        <Button
          type="button"
          className="min-h-11 w-full"
          disabled={pendingAction !== null}
          onClick={() => void finish("project")}
        >
          {pendingAction === "project" ? "Finishing setup…" : "Create your first project"}
        </Button>
        <button
          type="button"
          className="inline-flex min-h-11 items-center justify-center text-sm text-muted-foreground underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          disabled={pendingAction !== null}
          onClick={() => void finish("dashboard")}
        >
          {pendingAction === "dashboard" ? "Finishing setup…" : "Go to Dashboard"}
        </button>
      </div>
    </OnboardingSurface>
  );
}
