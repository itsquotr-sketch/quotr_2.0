import { cn } from "@/lib/utils";

/** Prose and forms share this left edge inside the project workspace. */
export const rfqReadingClass = "w-full min-w-0 max-w-[1000px] overflow-x-hidden";

/** Line selection and before/after stay readable without filling the workspace. */
export const rfqApplyClass = "w-full min-w-0 max-w-[880px]";

export function RfqReadingColumn({
  children,
  className,
  ...rest
}: {
  children: React.ReactNode;
  className?: string;
} & Omit<React.ComponentProps<"div">, "className" | "children">) {
  return (
    <div className={cn(rfqReadingClass, className)} data-rfq-reading {...rest}>
      {children}
    </div>
  );
}

export function RfqApplyColumn({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn(rfqApplyClass, className)} data-rfq-apply>
      {children}
    </div>
  );
}
