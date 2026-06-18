import Link from "next/link";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-muted px-4 py-8">
      <div className="mb-8 w-full max-w-sm text-center">
        <Link href="/login" className="text-lg font-semibold tracking-tight">
          Quotr
        </Link>
        <p className="mt-2 text-sm text-muted-foreground">
          Estimate faster with structured project information.
        </p>
      </div>
      <div className="w-full max-w-sm">{children}</div>
    </div>
  );
}
