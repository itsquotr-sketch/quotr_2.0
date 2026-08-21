import {
  LAYOUT_MAX_WIDTH,
  WorkspaceContainer,
} from "@/components/layout/page-containers";
import { cn } from "@/lib/utils";

type WorkspacePageProps = {
  header?: React.ReactNode;
  nav?: React.ReactNode;
  children: React.ReactNode;
  contentClassName?: string;
};

export function WorkspacePage({
  header,
  nav,
  children,
  contentClassName,
}: WorkspacePageProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      {header ? (
        <header className="shrink-0 border-b bg-background">{header}</header>
      ) : null}
      {nav}
      <WorkspaceContainer
        innerClassName={cn("mt-2 pt-3 pb-6 sm:mt-5 sm:pt-6", contentClassName)}
      >
        {children}
      </WorkspaceContainer>
    </div>
  );
}

type WorkspaceHeaderBarProps = {
  children: React.ReactNode;
  actions?: React.ReactNode;
};

export function WorkspaceHeaderBar({
  children,
  actions,
}: WorkspaceHeaderBarProps) {
  return (
    <div
      className={cn(
          "mx-auto flex w-full items-start justify-between gap-3 px-4 py-2 sm:gap-4 sm:px-6 sm:py-3 lg:px-8",
        LAYOUT_MAX_WIDTH.workspace
      )}
    >
      <div className="min-w-0 flex-1">{children}</div>
      {actions ? <div className="shrink-0 pt-0.5 sm:pt-1">{actions}</div> : null}
    </div>
  );
}
