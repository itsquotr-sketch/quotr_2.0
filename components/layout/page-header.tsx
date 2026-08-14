import { cn } from "@/lib/utils";

type PageHeaderProps = {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  /**
   * DEMO-R7: on mobile, hide visual chrome (title/description/actions).
   * Keeps an sr-only H1 for accessibility. Desktop unchanged.
   */
  compactOnMobile?: boolean;
};

export function PageHeader({
  title,
  description,
  actions,
  compactOnMobile = false,
}: PageHeaderProps) {
  return (
    <>
      {compactOnMobile ? (
        <h1 className="sr-only md:hidden">{title}</h1>
      ) : null}
      <header
        className={cn(
          "flex shrink-0 flex-col gap-3 border-b bg-background px-4 py-4 sm:h-14 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-0",
          compactOnMobile && "max-md:hidden"
        )}
      >
        <div className="min-w-0">
          <h1 className="truncate text-lg font-semibold tracking-tight sm:text-xl">
            {title}
          </h1>
          {description ? (
            <p className="mt-0.5 truncate text-sm text-muted-foreground">
              {description}
            </p>
          ) : null}
        </div>
        {actions ? (
          <div className="flex shrink-0 items-center gap-2">{actions}</div>
        ) : null}
      </header>
    </>
  );
}
