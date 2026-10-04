import Link from "next/link";
import type { OnboardingShellMode } from "@/lib/setup/first-run-stage";

const STEPS: Array<{ mode: OnboardingShellMode; name: string }> = [
  { mode: "basics", name: "Your business" },
  { mode: "address", name: "Business address" },
  { mode: "tax", name: "GST" },
  { mode: "work", name: "Work you price" },
  { mode: "labour", name: "Labour costs" },
  { mode: "ready", name: "Ready to price" },
];

export function OnboardingSurface({
  mode,
  title,
  description,
  children,
}: {
  mode: OnboardingShellMode;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  const index = Math.max(
    0,
    STEPS.findIndex((step) => step.mode === mode)
  );
  const current = STEPS[index];

  return (
    <section
      data-onboarding-step={mode}
      className="w-full min-w-0 rounded-xl border border-border bg-white p-4 text-foreground shadow-sm sm:p-6"
    >
      <div className="mb-5">
        <p className="text-sm font-medium text-foreground">Step {index + 1} of 6</p>
        <ol className="mt-3 flex gap-1.5" aria-label="Setup progress">
          {STEPS.map((step, stepIndex) => {
            const reached = stepIndex <= index;
            const active = stepIndex === index;
            return (
              <li key={step.mode} className="min-w-0 flex-1">
                <span
                  className={
                    reached
                      ? "block h-1.5 rounded-full bg-foreground"
                      : "block h-1.5 rounded-full bg-neutral-200"
                  }
                />
                <span className="sr-only">
                  {active ? `${step.name}, current step` : step.name}
                </span>
                <span
                  className={
                    active
                      ? "mt-1 hidden break-words text-[11px] font-medium leading-tight text-foreground md:block"
                      : "mt-1 hidden break-words text-[11px] leading-tight text-muted-foreground md:block"
                  }
                >
                  {step.name}
                </span>
              </li>
            );
          })}
        </ol>
        <p className="mt-2 text-sm text-muted-foreground md:hidden">{current.name}</p>
      </div>
      <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-1 text-sm leading-snug text-muted-foreground">{description}</p>
      <div className="mt-6 min-w-0">{children}</div>
    </section>
  );
}

export function OnboardingActions({
  backHref,
  pending = false,
  continueLabel = "Continue",
}: {
  backHref?: string | null;
  pending?: boolean;
  continueLabel?: string;
}) {
  return (
    <div className="mt-8 flex items-center justify-between gap-3">
      {backHref ? (
        <Link
          href={backHref}
          className="inline-flex min-h-11 items-center rounded-md px-2 text-sm font-medium text-foreground underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Back
        </Link>
      ) : (
        <span />
      )}
      <button
        type="submit"
        disabled={pending}
        className="inline-flex min-h-11 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
      >
        {pending ? "Saving…" : continueLabel}
      </button>
    </div>
  );
}
