import { LAYOUT_MAX_WIDTH } from "@/components/layout/page-containers";
import { cn } from "@/lib/utils";

type PageHeaderProps = {
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  /**
   * DEMO-R7: on mobile, hide visual chrome (title/description/actions).
   * Keeps an sr-only H1 for accessibility. Desktop unchanged.
   */
  compactOnMobile?: boolean;
  /** Let the subtitle wrap instead of truncating. Header grows with the copy. */
  wrapDescription?: boolean;
  /** Hide header actions below the sidebar breakpoint. The mobile bar owns New project. */
  hideActionsOnMobile?: boolean;
  /** Use the same max width and padding as PageContainer so the title lines up with the page. */
  alignWithContent?: boolean;
};

export function PageHeader({
  title,
  description,
  actions,
  compactOnMobile = false,
  wrapDescription = false,
  hideActionsOnMobile = false,
  alignWithContent = false,
}: PageHeaderProps) {
  return (
    <>
      {compactOnMobile ? (
        <h1 className="sr-only md:hidden">{title}</h1>
      ) : null}
      <header
        className={cn(
          "shrink-0 border-b bg-background px-4 sm:px-6",
          alignWithContent && "lg:px-8",
          wrapDescription || alignWithContent ? "py-4 sm:py-3" : "py-4 sm:h-14 sm:py-0",
          compactOnMobile && "max-md:hidden"
        )}
      >
        <div
          className={cn(
            "flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between",
            alignWithContent && "mx-auto",
            alignWithContent && LAYOUT_MAX_WIDTH.page,
            wrapDescription && "sm:min-h-14"
          )}
        >
        <div className="min-w-0">
          <h1 className="truncate text-lg font-semibold tracking-tight sm:text-xl">
            {title}
          </h1>
          {description ? (
            <p
              className={cn(
                "mt-0.5 text-sm text-muted-foreground",
                wrapDescription ? "whitespace-normal" : "truncate"
              )}
            >
              {description}
            </p>
          ) : null}
        </div>
        {actions ? (
          <div
            className={cn(
              "flex shrink-0 items-center gap-2",
              hideActionsOnMobile && "hidden md:flex"
            )}
          >
            {actions}
          </div>
        ) : null}
        </div>
      </header>
    </>
  );
}
