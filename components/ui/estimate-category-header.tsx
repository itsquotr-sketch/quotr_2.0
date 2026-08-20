import { cn } from "@/lib/utils";
import { PREMIUM } from "@/lib/ui/premium";

export function EstimateCategoryHeader({
  label,
  amount,
  className,
}: {
  label: string;
  amount?: string | null;
  className?: string;
}) {
  return (
    <div
      className={cn("flex items-baseline justify-between gap-2", className)}
      data-estimate-category-header="true"
    >
      <p className={PREMIUM.eyebrow}>{label}</p>
      {amount ? <p className={PREMIUM.metricValue}>{amount}</p> : null}
    </div>
  );
}
