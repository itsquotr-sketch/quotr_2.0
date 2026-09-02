export function FirstRunProgress({
  current,
}: {
  current: "company" | "pricing" | "job";
}) {
  const steps = [
    { id: "company" as const, label: "Company" },
    { id: "pricing" as const, label: "Pricing" },
    { id: "job" as const, label: "First job" },
  ];
  const currentIndex = steps.findIndex((step) => step.id === current);

  return (
    <ol className="mb-5 flex items-center gap-2 text-sm" aria-label="Setup progress">
      {steps.map((step, index) => {
        const done = index < currentIndex;
        const active = index === currentIndex;
        return (
          <li key={step.id} className="flex items-center gap-2">
            {index > 0 ? (
              <span className="text-muted-foreground" aria-hidden>
                ·
              </span>
            ) : null}
            <span
              className={
                active
                  ? "font-medium text-foreground"
                  : done
                    ? "text-foreground"
                    : "text-muted-foreground"
              }
              aria-current={active ? "step" : undefined}
            >
              {step.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
