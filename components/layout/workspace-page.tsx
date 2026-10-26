import {
  LAYOUT_MAX_WIDTH,
  WorkspaceContainer,
} from "@/components/layout/page-containers";
import { SectionPendingContent } from "@/components/projects/section-pending";
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
        innerClassName={cn("pt-4 pb-6 lg:pt-5", contentClassName)}
      >
        <SectionPendingContent>
        <div data-workspace-content-gap="progression" className="min-w-0">
        {children}
        </div>
        </SectionPendingContent>
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
          "mx-auto flex w-full items-start justify-between gap-3 px-4 py-2.5 sm:px-6 lg:px-8 lg:py-3",
        LAYOUT_MAX_WIDTH.workspace
      )}
    >
      <div className="min-w-0 flex-1">{children}</div>
      {actions ? <div className="shrink-0">{actions}</div> : null}
    </div>
  );
}
