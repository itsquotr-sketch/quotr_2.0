import { cn } from "@/lib/utils";

/** The request page uses the workspace width. Phone layout stays one column. */
export const rfqReadingClass = "w-full min-w-0 max-w-none overflow-x-hidden";

/** The pricing decision uses the same width as the request. */
export const rfqApplyClass = "w-full min-w-0 max-w-none";

export const RFQ_LIST_FILTER_KEYS = ["queue", "status", "q", "filter", "workArea"] as const;

export function rfqListStorageKey(projectId: string): string {
  return `quotr-rfq-list:${projectId}`;
}

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
