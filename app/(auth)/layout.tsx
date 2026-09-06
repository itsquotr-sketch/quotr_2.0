import Link from "next/link";
import { QuotrLogo } from "@/components/layout/quotr-logo";
import { QUOTR_PRODUCT_LINE } from "@/lib/branding/assets";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-start bg-muted px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-6 sm:justify-center sm:py-8">
      <div className="mb-5 w-full max-w-sm text-center sm:mb-8">
        <Link
          href="/login"
          className="inline-flex justify-center"
          aria-label="Quotr"
        >
          <QuotrLogo variant="wordmark" href={null} height={36} />
        </Link>
        <p className="mt-2 text-sm text-muted-foreground sm:mt-2.5">
          {QUOTR_PRODUCT_LINE}
        </p>
      </div>
      <div className="w-full max-w-sm">{children}</div>
    </div>
  );
}
