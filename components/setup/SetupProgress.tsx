import { cn } from "@/lib/utils";

const STEPS = [
  { id: "company", label: "Company" },
  { id: "work_areas", label: "Work areas" },
  { id: "rates", label: "Rates" },
  { id: "review", label: "Review" },
] as const;

type SetupProgressProps = {
  currentStep: string;
};

export function SetupProgress({ currentStep }: SetupProgressProps) {
  const currentIndex = STEPS.findIndex((step) => step.id === currentStep);

  return (
    <nav aria-label="Setup progress" className="w-full">
      <ol className="flex flex-wrap items-center gap-2 sm:gap-3">
        {STEPS.map((step, index) => {
          const isComplete = index < currentIndex;
          const isCurrent = step.id === currentStep;

          return (
            <li key={step.id} className="flex items-center gap-2 sm:gap-3">
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-medium",
                    isComplete && "bg-primary text-primary-foreground",
                    isCurrent &&
                      "bg-primary/10 text-primary ring-2 ring-primary/30",
                    !isComplete &&
                      !isCurrent &&
                      "bg-muted text-muted-foreground"
                  )}
                >
                  {index + 1}
                </span>
                <span
                  className={cn(
                    "text-sm",
                    isCurrent ? "font-medium text-foreground" : "text-muted-foreground"
                  )}
                >
                  {step.label}
                </span>
              </div>
              {index < STEPS.length - 1 ? (
                <span
                  className="hidden h-px w-6 bg-border sm:block"
                  aria-hidden
                />
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
