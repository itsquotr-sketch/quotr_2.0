import { cn } from "@/lib/utils";
import { PREMIUM } from "@/lib/ui/premium";

export function SectionEyebrow({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <p className={cn(PREMIUM.eyebrow, className)}>{children}</p>;
}
