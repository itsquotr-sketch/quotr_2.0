import Link from "next/link";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-start bg-muted px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-6 sm:justify-center sm:py-8">
      <div className="mb-5 w-full max-w-sm text-center sm:mb-8">
        <Link href="/login" className="text-lg font-semibold tracking-tight">
          Quotr
        </Link>
        <p className="mt-1.5 text-sm text-muted-foreground sm:mt-2">
          Turn job notes into a clear estimate and quote.
        </p>
      </div>
      <div className="w-full max-w-sm">{children}</div>
    </div>
  );
}
