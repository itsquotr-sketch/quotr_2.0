import { Skeleton } from "@/components/ui/skeleton";

export default function SetupLoading() {
  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-8">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-4 w-full max-w-md" />
      <Skeleton className="h-64 w-full rounded-xl" />
    </div>
  );
}
