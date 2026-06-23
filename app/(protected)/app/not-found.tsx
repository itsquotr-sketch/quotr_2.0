import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function AppNotFound() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <div className="space-y-2">
        <h1 className="text-xl font-semibold tracking-tight">Page not found</h1>
        <p className="max-w-md text-sm text-muted-foreground">
          This project, quote or pricing document could not be found. It may have
          been removed or the link is incorrect.
        </p>
      </div>
      <Button render={<Link href="/app/dashboard" />}>Back to dashboard</Button>
    </div>
  );
}
