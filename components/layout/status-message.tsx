import { cn } from "@/lib/utils";

type StatusMessageProps = {
  variant: "success" | "error";
  children: React.ReactNode;
  className?: string;
};

export function StatusMessage({
  variant,
  children,
  className,
}: StatusMessageProps) {
  return (
    <p
      role={variant === "error" ? "alert" : "status"}
      className={cn(
        "rounded-lg border px-3 py-2 text-sm",
        variant === "error"
          ? "border-destructive/20 bg-destructive/10 text-destructive"
          : "border-emerald-200/80 bg-emerald-50/80 text-emerald-950 dark:border-emerald-900/60 dark:bg-emerald-950/25 dark:text-emerald-100",
        className
      )}
    >
      {children}
    </p>
  );
}
