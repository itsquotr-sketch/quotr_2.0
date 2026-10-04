import Link from "next/link";
import { QuotrLogo } from "@/components/layout/quotr-logo";
import { QUOTR_PRODUCT_LINE } from "@/lib/branding/assets";

/**
 * Shared frame for existing authentication routes: ground, wordmark,
 * width, and scroll behaviour. Pages supply their own card.
 */
export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div
      data-auth-shell
      className="flex h-dvh min-h-dvh flex-col items-center justify-start overflow-x-hidden overflow-y-auto bg-background pt-6 sm:justify-center"
      style={{
        paddingTop: "max(1.5rem, env(safe-area-inset-top))",
        paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))",
        paddingLeft: "max(1rem, env(safe-area-inset-left))",
        paddingRight: "max(1rem, env(safe-area-inset-right))",
      }}
    >
      <div className="mb-6 w-full min-w-0 max-w-sm shrink-0 text-center">
        <Link
          href="/login"
          className="inline-flex justify-center rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-orange)] focus-visible:ring-offset-2"
          aria-label="Quotr"
        >
          <QuotrLogo
            variant="wordmark"
            href={null}
            height={36}
            className="h-9 w-auto max-w-full"
          />
        </Link>
        <p className="mt-2 text-sm text-muted-foreground">{QUOTR_PRODUCT_LINE}</p>
      </div>
      <div className="w-full min-w-0 max-w-sm">{children}</div>
    </div>
  );
}
