import { Skeleton } from "@/components/ui/skeleton";

function PageHeaderSkeleton({ description = true }: { description?: boolean }) {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b bg-background px-4 sm:px-6">
      <div className="min-w-0 space-y-1.5">
        <Skeleton className="h-5 w-32" />
        {description ? <Skeleton className="h-4 w-56 max-w-full" /> : null}
      </div>
      <Skeleton className="size-8 shrink-0 rounded-full" />
    </header>
  );
}

function ProjectHeaderSkeleton() {
  return (
    <header className="shrink-0 border-b bg-background">
      <div className="mx-auto flex max-w-7xl items-start justify-between gap-4 px-4 py-6 sm:px-6 lg:px-8">
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-7 w-48 max-w-full" />
          <Skeleton className="h-4 w-64 max-w-full" />
        </div>
        <Skeleton className="size-8 shrink-0 rounded-full" />
      </div>
    </header>
  );
}

function WorkspaceTabsSkeleton() {
  return (
    <div className="border-b bg-background">
      <div className="mx-auto max-w-7xl px-4 pt-2 pb-3 sm:px-6 lg:px-8">
        <Skeleton className="h-10 w-full max-w-md rounded-lg" />
      </div>
    </div>
  );
}

function CardSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="rounded-xl border border-border/60 bg-card p-5">
      <Skeleton className="mb-3 h-5 w-40" />
      <div className="space-y-2">
        {Array.from({ length: lines }).map((_, index) => (
          <Skeleton
            key={index}
            className="h-4"
            style={{ width: `${Math.max(55, 100 - index * 12)}%` }}
          />
        ))}
      </div>
    </div>
  );
}

export function DashboardRouteLoading() {
  return (
    <>
      <PageHeaderSkeleton />
      <div className="flex-1 overflow-auto">
        <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
          <div className="grid gap-3 sm:grid-cols-3">
            <Skeleton className="h-20 rounded-xl" />
            <Skeleton className="h-20 rounded-xl" />
            <Skeleton className="h-20 rounded-xl" />
          </div>
          <Skeleton className="h-10 w-full max-w-sm rounded-lg" />
          <div className="grid gap-3 sm:grid-cols-2">
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
          </div>
        </div>
      </div>
    </>
  );
}

export function ProjectRouteLoading() {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <ProjectHeaderSkeleton />
      <WorkspaceTabsSkeleton />
      <div className="flex-1 overflow-auto overflow-x-hidden">
        <div className="mx-auto mt-6 max-w-7xl space-y-4 px-4 pb-6 sm:px-6 lg:px-8">
          <CardSkeleton lines={4} />
          <CardSkeleton lines={4} />
          <CardSkeleton lines={3} />
        </div>
      </div>
    </div>
  );
}

export function PricingRouteLoading() {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <ProjectHeaderSkeleton />
      <WorkspaceTabsSkeleton />
      <div className="flex-1 overflow-auto overflow-x-hidden">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_280px]">
            <div className="space-y-5">
              <Skeleton className="h-12 w-full rounded-lg" />
              <CardSkeleton lines={5} />
              <CardSkeleton lines={4} />
            </div>
            <Skeleton className="h-64 rounded-xl xl:sticky xl:top-[4.5rem]" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function QuoteRouteLoading() {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <ProjectHeaderSkeleton />
      <WorkspaceTabsSkeleton />
      <div className="flex-1 overflow-auto overflow-x-hidden">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_280px]">
            <Skeleton className="min-h-[480px] rounded-xl" />
            <Skeleton className="h-72 rounded-xl xl:sticky xl:top-[4.5rem]" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function SettingsRouteLoading() {
  return (
    <>
      <PageHeaderSkeleton />
      <div className="flex-1 overflow-auto">
        <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
          <CardSkeleton lines={2} />
          <CardSkeleton lines={4} />
          <CardSkeleton lines={4} />
          <CardSkeleton lines={3} />
        </div>
      </div>
    </>
  );
}

export function RatesRouteLoading() {
  return (
    <>
      <PageHeaderSkeleton />
      <div className="flex-1 overflow-auto">
        <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
          <CardSkeleton lines={3} />
          <CardSkeleton lines={5} />
          <CardSkeleton lines={4} />
        </div>
      </div>
    </>
  );
}
